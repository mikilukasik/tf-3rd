import tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { datasetReaderV3 } from './src/scripts/utils/getMovesDatasetPgV3.mjs';
import { getXs } from './transform.js';

const datasetFolder = './data/newestCsvs/newest2'; //  /newest and /newest2

// const initialSourceModelDirName = 'models/pg1_small_v1x_0.000015625/2.17783642-1666323282932';
const initialSourceModelDirName = 'models/eval1_small_v1';
const targetModelName = 'models/eval1_small_v1y';

// [wr, wf, i, p, o2, lmf, lmt, wm ? movesToOneHot[wm[0]][wm[1]] : '-', s]
const filter = (data) => data[4] !== '0' && data[5] === 'true';

const filesToCopy = {
  // 'loader.js': 'src/lib/transformsSrc/eval_loader.js',
};

const recordsPerDataset = 30000;
const testRecordsPerDataset = 20000;
const batchSize = 5000;
const maxIterationsWithoutImprovement = 10;
const iterationsPerEval = 7;
const dupeCacheSize = 2000000;

const initialLearningRate = 0.001; //0.0005; //0.0005; //0.000125; //0.000015625; //0.001;
const finalLearningRate = 0.000002;
const makeTrainableBelowLr = 0; //0.00003; //0.00005;

const inUnits = 14;
const outUnits = 3; // who wins, how soon wins, will hit

let testData;
let alreadySetTrainable = false;

const loadTestData = async () => {
  const { getNextBatch } = await datasetReaderV3({
    folder: path.resolve(datasetFolder),
    test: true,
    batchSize: testRecordsPerDataset,
    filter,
    //noDupes: true,
    dupeCacheSize: 100000,
  });

  console.log('datasetReaderV3 for test samples initialized, getting test samples...');
  const rawTestData = await getNextBatch();
  console.log(`Loaded ${rawTestData.length} test samples.`);
  testData = loadData(rawTestData.map(transformRecord).filter(Boolean));
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

  // console.log({ chkmate_ending });
  // process.exit(0);

  const ys = [result, chkmate_soon, hit_soon].map(Number);
  // console.log({ ys });
  // process.exit(0);
  // ys[Number(onehot_move)] = 1;

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

  const [loss, meanSquaredError] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(8))
      .join(', '),
  );

  const result = { loss, meanSquaredError };

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
    const modelDirName = `${targetModelName}${alreadySetTrainable ? 't' : ''}_${learningRate}`;
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

      const { meanSquaredError } = await evaluateModel({ model });
      console.log(`meanSquaredError: ${meanSquaredError}`);

      const modelFolderForSaving = path.resolve(modelDirName, `${meanSquaredError}-${Date.now()}`);

      if (typeof currentBest === 'undefined' || meanSquaredError <= currentBest) {
        currentBest = meanSquaredError;

        await saveModel({ model, meanSquaredError, modelDirName: modelFolderForSaving });

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
        meanSquaredError,
        currentBest,
        iterationsWithNoImprovement,
        learningRate,
      });

      // if (Math.random() > 0.9) {
      //   await saveModel({ model, meanSquaredError, modelDirName: modelFolderForSaving });
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
        const { getNextBatch } = await datasetReaderV3({
          folder: path.resolve(datasetFolder),
          test: false,
          batchSize: recordsPerDataset,
          filter,
          //noDupes: true, //per batch
          dupeCacheSize,
        });
        console.log('datasetReaderV3 for lessons initialized');
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
      loss: 'meanSquaredError',
      metrics: [tf.metrics.meanSquaredError],
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
      const { meanSquaredError } = await evaluateModel({ model, testData });
      console.log({ 'Initial meanSquaredError': meanSquaredError });
    }

    alreadyInited = true;

    return { model };
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);