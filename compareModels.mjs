import tf from '@tensorflow/tfjs-node';
import path from 'path';
// import { datasetReader } from './src/scripts/utils/getMovesDatasetFromDisc.mjs';
import { datasetReaderV3 } from './src/scripts/utils/getMovesDatasetPgV3.mjs';

import { getXs } from './transform.js';

const datasetFolder = './data/newestCsvs/newest2'; //  /newest and /newest2

const sourceModelDirNames = [
  'models/pg1_small_v1_0.001/2.40049481-1666223914108',
  'models/pg1_small__lessbias_v1_0.000125/1.98296010-1668763868855',
];

const filter = (data) => Number(data[2]) >= 0;

const testRecordsPerDataset = 20000;

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign
const batchSize = 5000;

const loadTestData = async () => {
  const { getNextBatch } = await datasetReaderV3({
    folder: path.resolve(datasetFolder),
    test: true,
    batchSize: testRecordsPerDataset,
    filter,
    //noDupes: true,
    dupeCacheSize: 200000,
    singleMoveRatio: 3,
  });

  console.log('datasetReaderV3 for test samples initialized, getting test samples...');
  const rawTestData = await getNextBatch();
  console.log(`Loaded ${rawTestData.length} test samples.`);
  return loadData(rawTestData.map(transformRecord).filter(Boolean));
};

const loadModel = async ({ folder }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);

  return model;
};

const transformRecord = (record) => {
  const [
    fen,
    onehot_move,
    hit_soon,
    chkmate_soon,
    result,
    chkmate_ending,
    stall_ending,
    p, // ? 0 : is_midgame ? 1 : 2,
    is_last,
    lmf, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
    lmt, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
  ] = record;

  const ys = new Array(outUnits).fill(0);
  ys[Number(onehot_move)] = 1;

  const xs = getXs({ fens: [fen], lmf, lmt });

  return { xs, ys };
};

const loadData = function (data) {
  const transform = ({ xs, ys }) => {
    xs = tf.tensor(xs, [8, 8, inUnits]);
    ys = tf.tensor1d(ys);

    return {
      xs,
      ys,
    };
  };

  // load, normalize, transform, batch
  return tf.data.array(data.filter(Boolean)).map(transform).batch(batchSize);
};

// verify the model against the test data
const evaluateModel = async function ({ model, testData }) {
  const evalResult = await model.evaluateDataset(testData);

  const [loss, categoricalCrossentropy] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(8))
      .join(', '),
  );

  const result = { loss, categoricalCrossentropy };

  // if (tempFolder)
  //   await fs.writeFile(
  //     path.resolve(tempFolder, 'evaluation.json'),
  //     JSON.stringify({ ...result, evalResult }, null, 2),
  //     'utf8',
  //   );

  evalResult.forEach((t) => t.dispose());
  console.log(`Tensors in memory after eval: ${tf.memory().numTensors}`);

  return result;
};

const run = async () => {
  try {
    const models = await Promise.all(
      sourceModelDirNames.map((sourceModelDirName) => loadModel({ folder: path.resolve(sourceModelDirName) })),
    );

    // for (const dataProgress of [0, 1, 2]) {
    const testData = await loadTestData();

    for (const [mIndex, model] of models.entries()) {
      model.compile({
        optimizer: tf.train.adam(0.000001),
        loss: 'categoricalCrossentropy',
        metrics: [tf.metrics.categoricalCrossentropy],
      });

      const { categoricalCrossentropy } = await evaluateModel({ model, testData });
      console.log(`${sourceModelDirNames[mIndex]}  categoricalCrossentropy: ${categoricalCrossentropy}`);
    }
    // }
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
