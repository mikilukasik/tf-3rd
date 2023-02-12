import tf from '@tensorflow/tfjs-node';
import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetPgV13.mjs';
import { getXs } from './transform.js';

// const progressGroups = [0];
// const sourceModelDirNames = [
//   'models/newest_SM_tV13-p0_v1_0.0001/1.73833549-1676175521201',
//   'models/newest_tV13-p0_v2_0.0001/1.78347576-1676059536847',
//   'models/newest_tV13-p0_v1_0.00003125/1.79583907-1675965911689',
// ];

// // const progressGroups = [1];
// // const progressGroups = [2];
// const progressGroups = [1, 2];
// const sourceModelDirNames = [
//   'models/newest_M_tV13-p12_v1_0.0001/2.30295753-1676179816721',
//   // 'models/newest_SM_tV13-p12_v1_0.001/2.73277617-1676062941358',
//   'models/newest_tV13-p1_v1_0.0005/2.25634074-1676060740841',
//   'models/newest_tV13-p2_v1_0.00025/2.21247697-1676042555417',
// ];

const progressGroups = [3];
const sourceModelDirNames = [
  'models/newest_SM_tV13-p3_v1_0.0001/2.05400825-1676177341026',
  'models/newest_tV13-p3_v1_0.00025/2.01214457-1676062606287',
];

const testRecordsPerDataset = 50000;
const datasetFolder = './data/csv_v2/default'; //  /newest and /newest2
const filter = (data) => Number(data[2]) >= 0;
const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign
const batchSize = 10000;

const groupTransformer = (groups) => progressGroups.map((pg) => groups[pg]); // [groups[1], groups[2]]; //[{ pointerKey: '.', ratio: 1 }];

const loadTestData = async () => {
  const { getNextBatch } = await datasetReader({
    batchSize: testRecordsPerDataset,
    filter,
    datasetFolder,
    groupTransformer,
  });
  console.log('datasetReaderV13 initialized');

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
    result,
    chkmate_ending,
    stall_ending,
    lmf, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
    lmt, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
    progress,
  ] = record;

  const ys = new Array(outUnits).fill(0);
  ys[Number(onehot_move)] = 1;

  // const ys = [Number(progress)];

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

  evalResult.forEach((t) => t.dispose());
  console.log(`Tensors in memory after eval: ${tf.memory().numTensors}`);

  return result;
};

const run = async () => {
  try {
    const models = await Promise.all(
      sourceModelDirNames.map((sourceModelDirName) => loadModel({ folder: path.resolve(sourceModelDirName) })),
    );

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
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
