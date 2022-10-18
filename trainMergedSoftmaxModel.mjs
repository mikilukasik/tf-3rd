import tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetFromDisc.mjs';
import { movesToOneHot } from './src/scripts/utils/oneHotMovesMap.mjs';
import { getXs } from './transform.js';

const datasetFolder = './data/newCsvs3';

const sourceModelDirName = 'models/oneHot_v1t_3/0.96898-e1-1665266690232';
// const sourceModelDirName = 'models/2sizesMerged_v1_big';

const modelDirName = 'models/oneHot_v1t_4';

const recordsPerDataset = 15000;
const testRecordsPerDataset = 2000;
const batchSize = 2500;
const learningRate = 0.000003;

const outUnits = 134;
const castlingIndex = 0;
const enPassantIndex = 0;
const inputLength = 12 * 3 + 2;
const maxEpochs = 250;
const patience = 1;
const startTime = Date.now();
const needsWNext = true;
const needsPieceVals = true;

let trainCode;
let transformCode;
let trainingMeta = {};
let testData;

const constants = {
  modelDirName,
  outUnits,
  castlingIndex,
  enPassantIndex,
  inputLength,
  batchSize,
  maxEpochs,
  patience,
  startTime,
  recordsPerDataset,
  testRecordsPerDataset,
  needsWNext,
  needsPieceVals,
  learningRate,
  sourceModelDirName,
  movesModel: true,
};

const loadTestData = async () => {
  const { getNextBatch } = await datasetReader({
    folder: path.resolve(datasetFolder),
    test: true,
    batchSize: testRecordsPerDataset,
    progressGroups: [0, 1, 2],
  });

  console.log('datasetReader for test samples initialized, getting test samples...');
  const rawTestData = await getNextBatch();
  console.log(`Loaded ${rawTestData.length} test samples.`);
  testData = loadData(rawTestData.map(transformRecord).filter(Boolean));
};

const loadModel = async ({ folder }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: [tf.metrics.categoricalCrossentropy],
  });
  return model;
};

const saveTrainingMeta = () =>
  fs.writeFile(path.resolve(modelDirName, 'trainingMeta.json'), JSON.stringify(trainingMeta, null, 2));

const loadTrainingMeta = async () => {
  try {
    trainingMeta = JSON.parse(await fs.readFile(path.resolve(modelDirName, 'trainingMeta.json')));
  } catch (e) {
    await updateTrainingMeta({
      ...constants,
      iterations: [],
      filesLearned: [],
      samplesLearned: 0,
      completedIterations: 0,
      completedEpochs: 0,
    });
  }
};

const updateTrainingMeta = async (obj) => {
  Object.assign(trainingMeta, obj);
  await saveTrainingMeta();
};

const transformRecord = (record) => {
  const [fen, , prevFen1, prevFen2, prevFen3, prevFen4, lmf, lmt, m0, m1, pm] = record;

  const oneHotIndex = movesToOneHot[Number(m0)][Number(m1)];
  if (typeof oneHotIndex === 'undefined') throw new Error(`move is missing from onehot map: ${m0} ${m1}`);
  const ys = new Array(1792).fill(0);
  ys[Number(oneHotIndex)] = 1;

  // const expandedTo = new Array(64).fill(0);
  // expandedTo[Number(m1)] = 1;

  // const expandedPiece = new Array(6).fill(0);
  // expandedPiece[['P', 'B', 'N', 'R', 'Q', 'K'].findIndex((e) => e === pm)] = 1;

  // const ys = [expandedFrom, expandedTo, expandedPiece].flat();
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

// train the model against the training data
const trainModel = async function ({ model, trainData }) {
  let started;

  const options = {
    epochs: 1,
    verbose: 1,
    callbacks: [
      tf.callbacks.earlyStopping({ monitor: 'loss', patience }),

      new tf.CustomCallback({
        onEpochBegin: async (epoch) => {
          if (!started) started = Date.now();
        },
      }),

      new tf.CustomCallback({
        onEpochEnd: async (epoch, logs) => {
          console.log({
            ...logs,
            modelDirName,
          });
        },
      }),
    ],
  };

  console.log(`Tensors in memory before training: ${tf.memory().numTensors}`);
  const result = await model.fitDataset(trainData, options);
  console.log(`Tensors in memory after training: ${tf.memory().numTensors}`);
  return result;
};

// verify the model against the test data
const evaluateModel = async function ({ model, testData: rawTestData, tempFolder }) {
  console.log(`Tensors in memory before eval: ${tf.memory().numTensors}`);

  const evalResult = await model.evaluateDataset(testData);

  // console.log({ evalResult });

  const [loss, categoricalCrossentropy] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(5))
      .join(', '),
  );

  const result = { loss, categoricalCrossentropy };

  if (tempFolder)
    await fs.writeFile(
      path.resolve(tempFolder, 'evaluation.json'),
      JSON.stringify({ ...result, evalResult }, null, 2),
      'utf8',
    );

  evalResult.forEach((t) => t.dispose());
  console.log(`Tensors in memory after eval: ${tf.memory().numTensors}`);

  return result;
};

let getNextDatasets;

const saveModel = async ({ model, categoricalCrossentropy, totalEpochs }) => {
  console.log('Saving model...');

  const modelFolder = path.resolve(modelDirName, `${categoricalCrossentropy}-e${totalEpochs}-${Date.now()}`);

  await model.save(`file://${modelFolder}`);
  // await fs.writeFile(path.resolve(modelFolder, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  // await fs.writeFile(path.resolve(modelFolder, 'createModel.js'), createModelCode, 'utf8');
  await fs.writeFile(path.resolve(modelFolder, 'trainMergedSoftmaxModel.mjs'), trainCode, 'utf8');
  await fs.writeFile(path.resolve(modelFolder, 'transform.js'), transformCode, 'utf8');
  // await fs.writeFile(path.resolve(modelFolder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
  return modelFolder;
};

const runIteration = async ({ model, iterationIndex }) => {
  const dataset = await getNextDatasets({ iterationIndex });
  if (!dataset) {
    return { finished: true };
  }

  const { trainData: rawTrainData } = dataset;

  const largeRawTrainData = rawTrainData;

  const trainData = loadData(largeRawTrainData.map(transformRecord).filter(Boolean));

  await trainModel({
    model,
    trainData,
    iterationIndex,
  });

  return { finished: false };
};

// run
let currentBest;
const previousBestFolders = [];
const run = async function () {
  const { model } = await init();

  for (let epochIndex = 1; epochIndex <= maxEpochs; epochIndex += 1) {
    let iterationIndex = 0;
    let finished;
    do {
      finished = await (await runIteration({ model, iterationIndex: iterationIndex++ })).finished;
      console.log('Iteration done, evaluating...');
      const { categoricalCrossentropy } = await evaluateModel({ model, testData });
      console.log(`categoricalCrossentropy: ${categoricalCrossentropy}`);

      if (typeof currentBest === 'undefined' || categoricalCrossentropy <= currentBest) {
        currentBest = categoricalCrossentropy;
        const modelFolder = await saveModel({ model, categoricalCrossentropy, totalEpochs: epochIndex });

        for (const folder of previousBestFolders) {
          console.log('deleting worse model:', { folder });
          fs.rm(folder, { recursive: true, force: true });
        }
        previousBestFolders.length = 0;

        previousBestFolders.push(modelFolder);

        continue;
      }

      if (Math.random() > 0.9) {
        const modelFolder = await saveModel({ model, categoricalCrossentropy, totalEpochs: epochIndex });
        previousBestFolders.push(modelFolder);
      }
    } while (!finished);
  }
  console.log('DONE');
};

const init = async () => {
  try {
    getNextDatasets = await (async () => {
      const { getNextBatch } = await datasetReader({
        folder: path.resolve(datasetFolder),
        test: false,
        batchSize: recordsPerDataset,
        progressGroups: [0, 1, 2],
      });
      console.log('datasetReader for lessons initialized');
      return async ({ iterationIndex } = {}) => {
        console.log({ iterationIndex });
        const records = await getNextBatch();
        console.log(`Loaded ${records.length} records.`);
        return { trainData: records };
      };
    })();

    trainCode = await fs.readFile('./trainMergedSoftmaxModel.mjs', 'utf8');
    transformCode = await fs.readFile('./transform.js', 'utf8');

    const sourceModelFolder = path.resolve(sourceModelDirName);
    const model = await loadModel({ folder: sourceModelFolder });
    model.summary();

    const fullModelDirname = path.resolve(modelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });
    await fs.writeFile(path.resolve(fullModelDirname, 'trainMergedSoftmaxModel.mjs'), trainCode, 'utf8');
    await fs.writeFile(path.resolve(fullModelDirname, 'transform.js'), transformCode, 'utf8');
    await loadTrainingMeta();

    await loadTestData();

    console.log('Starting initial evaluation...');
    const { categoricalCrossentropy } = await evaluateModel({ model, testData });
    console.log(`Initial categoricalCrossentropy: ${categoricalCrossentropy}`);

    return { model };
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
