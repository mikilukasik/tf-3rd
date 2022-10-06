import tf from '@tensorflow/tfjs-node';
import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetFromDisc.mjs';
import { getXs } from './transform.js';

const datasetFolder = './data/newCsvs3';

const sourceModelDirNames = {
  p0: 'models/2sizesNewV2_p0_v2_04/0.03839-e1-1653577774895',
  p1: 'models/2sizesNewV2_p1_v2_03/0.03550-e1-1653741265601',
  p2: 'models/2sizesNewV2_p2_v6/0.03507-e1-1654062244911',
};

const testRecordsPerDataset = 100000;

const inputLength = 12 * 3 + 2;
const batchSize = 750;

const learningRate = 0.000001;

const loadTestData = async ({ progress }) => {
  const { getNextBatch } = await datasetReader({
    folder: path.resolve(datasetFolder),
    test: true,
    batchSize: testRecordsPerDataset,
    progressGroups: [progress],
  });

  const rawTestData = await getNextBatch();

  console.log(`Progress: ${progress}:Loaded ${rawTestData.length} test samples.`);

  return loadData(rawTestData.map(transformRecord).filter(Boolean));
};

const loadModel = async ({ folder }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError',
    metrics: [tf.metrics.meanAbsoluteError],
  });
  return model;
};

const transformRecord = (record) => {
  const [fen, , prevFen1, prevFen3, lmf, lmt, m0, m1, pm] = record;

  const expandedFrom = new Array(64).fill(0);
  expandedFrom[Number(m0)] = 1;

  const expandedTo = new Array(64).fill(0);
  expandedTo[Number(m1)] = 1;

  const expandedPiece = new Array(6).fill(0);
  expandedPiece[['P', 'B', 'N', 'R', 'Q', 'K'].findIndex((e) => e === pm)] = 1;

  const ys = [expandedFrom, expandedTo, expandedPiece].flat();
  const xs = getXs({ fens: [prevFen1, prevFen3, fen], lmf, lmt });

  return { xs, ys };
};

const loadData = function (data) {
  const transform = ({ xs, ys }) => {
    xs = tf.tensor(xs, [8, 8, inputLength]);
    ys = tf.tensor1d(ys);

    return {
      xs,
      ys,
    };
  };

  // load, normalize, transform, batch
  return tf.data.array(data.filter(Boolean)).map(transform).batch(batchSize);
};

const evaluateModel = async function ({ model, testData }) {
  const evalResult = await model.evaluateDataset(testData);
  const [loss, meanAbsoluteError] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(5))
      .join(', '),
  );

  const result = { loss, meanAbsoluteError };

  return result;
};

const run = async function () {
  await init();

  console.log('DONE');
};

const init = async () => {
  try {
    const models = [
      await loadModel({ folder: path.resolve(sourceModelDirNames.p0) }),
      await loadModel({ folder: path.resolve(sourceModelDirNames.p1) }),
      await loadModel({ folder: path.resolve(sourceModelDirNames.p2) }),
    ];

    for (const dataProgress of [0, 1, 2]) {
      const testData = await loadTestData({ progress: dataProgress });

      for (const modelProgress of [0, 1, 2]) {
        const { meanAbsoluteError } = await evaluateModel({ model: models[modelProgress], testData });
        console.log(`p${dataProgress} data on p${modelProgress} model meanAbsoluteError: ${meanAbsoluteError}`);
      }
    }
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
