import tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { datasetReaderV2 } from './src/scripts/utils/getMovesDatasetFromDisc.mjs';
import { getXs } from './transform.js';

const datasetFolder = './data/randomizedAll/randomOrder';

const initialSourceModelDirName = 'models/oneHot_nodupe_v1y_0.000025/2.25554895-1665743670706';

const targetModelName = 'models/oneHot_nodupe_v1z';

// [wr, wf, i, p, o2, lmf, lmt, wm ? movesToOneHot[wm[0]][wm[1]] : '-', s]
const filter = (data) => data[0] === '1' || Math.random() < 0.05; //mostly wins

const filesToCopy = {
  // 'createModelInc.js': path.resolve(initialSourceModelDirName, 'createModelInc.js'),
  'train.mjs': './train.mjs', // todo: read only once at the beginning, in case file changes during training
  'transforms.js': 'src/lib/bundledTransforms/oneHot_transforms.js',
};

const recordsPerDataset = 30000;
const testRecordsPerDataset = 15000;
const batchSize = 5000;
const maxIterationsWithoutImprovement = 10;
const iterationsPerEval = 5;

const initialLearningRate = 0.000025;
const finalLearningRate = 0.000002;
const makeTrainableBelowLr = 0.00001;

const inUnits = 38;

let testData;
let alreadySetTrainable = false;

const loadTestData = async () => {
  const { getNextBatch } = await datasetReaderV2({
    folder: path.resolve(datasetFolder),
    test: true,
    batchSize: testRecordsPerDataset,
    filter,
    noDupes: true,
  });

  console.log('datasetReaderV2 for test samples initialized, getting test samples...');
  const rawTestData = await getNextBatch();
  console.log(`Loaded ${rawTestData.length} test samples.`);
  testData = loadData(rawTestData.map(transformRecord).filter(Boolean));
};

const loadModel = async ({ folder }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);

  return model;
};

const transformRecord = (record) => {
  const [, fen, , , , lmf, lmt, oneHotIndex] = record;

  const ys = new Array(1792).fill(0);
  ys[Number(oneHotIndex)] = 1;

  const xs = getXs({ fens: [/*prevFen1, prevFen3,*/ fen, fen, fen], lmf, lmt });

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

// train the model against the training data
const trainModel = async function ({ model, trainData }) {
  let started;

  const options = {
    epochs: 1,
    verbose: 1,
    callbacks: [
      // tf.callbacks.earlyStopping({ monitor: 'loss', patience }),

      new tf.CustomCallback({
        onEpochBegin: async (epoch) => {
          if (!started) started = Date.now();
        },
      }),

      new tf.CustomCallback({
        onEpochEnd: async (epoch, logs) => {
          console.log({
            ...logs,
            // modelDirName,
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
const evaluateModel = async function ({ model, tempFolder }) {
  console.log(`Tensors in memory before eval: ${tf.memory().numTensors}`);

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

const saveModel = async ({ model, modelDirName }) => {
  console.log('\n--------------------------------');
  console.log('Saving model...', { modelDirName });

  await model.save(`file://${modelDirName}`);

  await Promise.all(
    Object.keys(filesToCopy).map((targetFileName) =>
      fs.copyFile(path.resolve(filesToCopy[targetFileName]), path.resolve(modelDirName, targetFileName)),
    ),
  );

  console.log('done');
  console.log('--------------------------------\n');
};

const runIteration = async ({ model, iterationIndex }) => {
  tf.engine().startScope();

  const dataset = await getNextDatasets({ iterationIndex });
  if (!dataset) {
    throw new Error('no dataset loaded');
  }

  const { trainData: rawTrainData } = dataset;

  const trainData = loadData(rawTrainData.map(transformRecord).filter(Boolean));

  await trainModel({
    model,
    trainData,
    iterationIndex,
  });

  tf.engine().endScope();
};

// run
let currentBest;

const run = async function () {
  let learningRate = initialLearningRate;
  let sourceModelDirName = initialSourceModelDirName;
  const previousBestFolders = [];

  while (learningRate >= finalLearningRate) {
    const modelDirName = `${targetModelName}_${learningRate}`;
    console.log('starting iteration...', { learningRate, sourceModelDirName, modelDirName });

    const { model } = await init({ learningRate, sourceModelDirName, modelDirName });

    let iterationsWithNoImprovement = 0;
    let nextEvalIn = 0;
    do {
      await await runIteration({ model });

      if (nextEvalIn > 0) {
        console.log({ nextEvalIn });
        nextEvalIn -= 1;
        continue;
      }

      nextEvalIn = iterationsPerEval;
      console.log('evaluating...');

      const { categoricalCrossentropy } = await evaluateModel({ model });
      console.log(`categoricalCrossentropy: ${categoricalCrossentropy}`);

      const modelFolderForSaving = path.resolve(
        `${modelDirName}${alreadySetTrainable ? 't' : ''}`,
        `${categoricalCrossentropy}-${Date.now()}`,
      );

      if (typeof currentBest === 'undefined' || categoricalCrossentropy <= currentBest) {
        currentBest = categoricalCrossentropy;

        await saveModel({ model, categoricalCrossentropy, modelDirName: modelFolderForSaving });

        for (const folder of previousBestFolders) {
          console.log('deleting worse model:', { folder });
          fs.rm(folder, { recursive: true, force: true });
        }
        previousBestFolders.length = 0;

        previousBestFolders.push(modelFolderForSaving);

        sourceModelDirName = modelFolderForSaving;
        iterationsWithNoImprovement = 0;
        continue;
      }

      iterationsWithNoImprovement += 1;

      console.log({
        categoricalCrossentropy,
        currentBest,
        iterationsWithNoImprovement,
        learningRate,
      });

      // if (Math.random() > 0.9) {
      //   await saveModel({ model, categoricalCrossentropy, modelDirName: modelFolderForSaving });
      //   previousBestFolders.push(modelFolderForSaving);
      // }
    } while (iterationsWithNoImprovement < maxIterationsWithoutImprovement);

    try {
      model.dispose();
    } catch (e) {
      console.error(`couldn't dispose model:`, e);
    }

    previousBestFolders.length = 0; // won't delete the best model for each learningRate

    learningRate /= 2;
    console.log('new iteration will start', { learningRate, sourceModelDirName });
  }
  console.log('DONE');
};

let alreadyInited = false;
const init = async ({ learningRate, modelDirName, sourceModelDirName }) => {
  try {
    if (!alreadyInited)
      getNextDatasets = await (async () => {
        const { getNextBatch } = await datasetReaderV2({
          folder: path.resolve(datasetFolder),
          test: false,
          batchSize: recordsPerDataset,
          filter,
          noDupes: true, //per batch
        });
        console.log('datasetReaderV2 for lessons initialized');
        return async ({ iterationIndex } = {}) => {
          // console.log({ iterationIndex });
          const records = await getNextBatch();
          console.log(`Loaded ${records.length} training records.`);
          return { trainData: records };
        };
      })();

    const sourceModelFolder = path.resolve(sourceModelDirName);
    const model = await loadModel({ folder: sourceModelFolder, learningRate });

    if (!alreadySetTrainable && makeTrainableBelowLr && learningRate <= makeTrainableBelowLr) {
      console.log(`learningRate fell below ${makeTrainableBelowLr}, making all layers trainable...`);
      model.layers.forEach((l) => (l.trainable = true));
      alreadySetTrainable = true;
    }
    model.compile({
      optimizer: tf.train.adam(learningRate),
      loss: 'categoricalCrossentropy',
      metrics: [tf.metrics.categoricalCrossentropy],
    });
    model.summary();

    const fullModelDirname = path.resolve(modelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });

    await Promise.all(
      Object.keys(filesToCopy).map((targetFileName) =>
        fs.copyFile(path.resolve(filesToCopy[targetFileName]), path.resolve(modelDirName, targetFileName)),
      ),
    );

    if (!alreadyInited) {
      await loadTestData();

      console.log('Starting initial evaluation...');
      const { categoricalCrossentropy } = await evaluateModel({ model, testData });
      console.log(`Initial categoricalCrossentropy: ${categoricalCrossentropy}`);
    }

    alreadyInited = true;

    return { model };
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
