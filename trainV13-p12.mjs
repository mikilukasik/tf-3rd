import tf from '@tensorflow/tfjs-node';
import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetPgV13.mjs';
import { getXs } from './transform.js';

const datasetFolder = './data/csv_v2/default'; //  /newest and /newest2

// const initialSourceModelDirName = 'models/newest_M_v1';
const initialSourceModelDirName = 'models/newest_M_tV13-p12_v1_0.0005/2.45479345-1676151288999';
const targetModelName = 'models/newest_M_tV13-p12_v1';

// const singleMoveRatio = undefined; // 7.5;
// const singleProgressGroupRatio = undefined; // 1.48;
// const singleBalanceGroupRatio = undefined; //1;

const initialLearningRate = 0.0001; //0.0001; //0.001; //0.0005; //0.0005; //0.0005; //0.000125; //0.000015625; //0.001;
const finalLearningRate = 0.000001;
const makeTrainableBelowLr = 0; // 0.0001; //0.00005;

const recordsPerDataset = 50000;
const testRecordsPerDataset = 20000;
const batchSize = 10000;
const maxIterationsWithoutImprovement = 10; //10;
const iterationsPerEval = 10;
// const dupeCacheSize = 50000;

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

// all
const filter = (data) => Number(data[2]) >= 0;
// some other moves too
// Math.random() < 0.005;

// midegame
// const filter = (data) => data[7] === '1' && (Number(data[2]) >= 0 || Number(data[3]) > 0.0001); //|| Math.random() < 0.01;

//openings
// const filter = (data) => Number(data[2]) >= 0 && data[7] === '0'; //|| Math.random() < 0.01;

const groupTransformer = (groups) => [groups[1], groups[2]]; //[{ pointerKey: '.', ratio: 1 }];

const getIsDupe = () => {
  const dupeCache = {};

  return (record) => {
    if (dupeCache[record[0]]) return true;

    dupeCache[record[0]] = true;
    return false;
  };
};

// const getIsDupe = () => {
//   const dupeCache = {};

//   return (record) => {
//     const [fen, move, valueAsStr] = record;
//     const value = Number(valueAsStr);

//     if (!dupeCache[fen]) {
//       dupeCache[fen] = { [move]: value, max: value };
//       return false;
//     }

//     if (dupeCache[fen].max > value) return true; // existing is better

//     // we now got a new best val for that fen

//     const result = typeof dupeCache[fen][move] !== 'undefined';

//     dupeCache[fen].max = value;
//     dupeCache[fen][move] = value;

//     return result;
//   };
// };

const fileNamesToCopy = {
  'train.mjs': './trainV13-p12.mjs',
  'loader.js': './dist/pg_loader.js',
  'datasetReader.mjs': './src/scripts/utils/getMovesDatasetPgV13.mjs',
  'transforms.js': './transform.js',
};

const filesToCopy = Object.keys(fileNamesToCopy).reduce((p, c) => {
  p[c] = readFileSync(path.resolve(fileNamesToCopy[c]), 'utf-8');
  return p;
}, {});

let learningRate = initialLearningRate;
let testData;
let alreadySetTrainable = false;

let getNextDatasets;
let getNextTestBatch;

const loadTestData = async () => {
  console.log('loading new testData...');
  const rawTestData = await getNextTestBatch({ batchSize: testRecordsPerDataset, isDupe: getIsDupe() });
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
    // chkmate_soon,
    result,
    chkmate_ending,
    stall_ending,
    // p, // ? 0 : is_midgame ? 1 : 2,
    // is_last,
    lmf, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
    lmt, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // move_index,
    // total_moves,
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

      // new tf.CustomCallback({
      //   onEpochEnd: async (epoch, logs) => {
      //     console.log({
      //       ...logs,
      //       // modelDirName,
      //     });
      //   },
      // }),
    ],
  };

  // console.log(`Tensors in memory before training: ${tf.memory().numTensors}`);
  const result = await model.fitDataset(trainData, options);
  console.log(`Tensors in memory after training: ${tf.memory().numTensors}`);
  return result;
};

// verify the model against the test data
const evaluateModel = async function ({ model, tempFolder }) {
  // console.log(`Tensors in memory before eval: ${tf.memory().numTensors}`);
  if (!testData) await loadTestData();

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

  await loadTestData();

  return result;
};

const saveModel = async ({ model, modelDirName }) => {
  console.log('\n--------------------------------');
  console.log('Saving model...', { modelDirName });

  await model.save(`file://${modelDirName}`);

  await Promise.all(
    Object.keys(filesToCopy).map((targetFileName) =>
      fs.writeFile(path.resolve(modelDirName, targetFileName), filesToCopy[targetFileName], 'utf-8'),
    ),
  );

  console.log('done');
  console.log('--------------------------------\n');
};

const runIteration = async ({ model, iterationIndex }) => {
  tf.engine().startScope();

  const rawTrainData = await getNextDatasets({ isDupe: getIsDupe() });
  if (!rawTrainData) {
    throw new Error('no dataset loaded');
  }

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
        console.log({ nextEvalIn, currentBest, iterationsWithNoImprovement });
        nextEvalIn -= 1;
        continue;
      }

      nextEvalIn = iterationsPerEval;
      console.log('evaluating...');

      const { categoricalCrossentropy } = await evaluateModel({ model });
      console.log(`categoricalCrossentropy: ${categoricalCrossentropy}`);

      // await loadTestData();

      const modelFolderForSaving = path.resolve(modelDirName, `${categoricalCrossentropy}-${Date.now()}`);

      if (typeof currentBest === 'undefined' || Number(categoricalCrossentropy) <= Number(currentBest)) {
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

        // await loadTestData();

        continue;
      }

      iterationsWithNoImprovement += 1;

      console.log({
        categoricalCrossentropy,
        currentBest,
        iterationsWithNoImprovement,
        learningRate,
      });

      // await loadTestData();

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
      ({ getNextDatasets, getNextTestBatch } = await (async () => {
        const { getNextBatch, getNextTestBatch } = await datasetReader({
          // folder: path.resolve(datasetFolder),
          // test: false,
          batchSize: recordsPerDataset,
          filter,
          //noDupes: true, //per batch
          // dupeCacheSize,
          // singleMoveRatio,
          // singleProgressGroupRatio,
          // singleBalanceGroupRatio,

          datasetFolder,
          groupTransformer,
        });
        console.log('datasetReaderV13 initialized');
        return {
          getNextDatasets: async (options) => {
            // console.log({ iterationIndex });
            const records = await getNextBatch(options);
            console.log(`Loaded ${records.length} records.`);
            return records;
          },

          getNextTestBatch,
        };
      })());

    const sourceModelFolder = path.resolve(sourceModelDirName);
    const model = await loadModel({ folder: sourceModelFolder, learningRate });

    if (makeTrainableBelowLr && learningRate <= makeTrainableBelowLr) {
      if (!alreadySetTrainable)
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
        fs.writeFile(path.resolve(modelDirName, targetFileName), filesToCopy[targetFileName], 'utf-8'),
      ),
    );

    if (!alreadyInited) {
      // await loadTestData();

      console.log('Starting initial evaluation...');
      const { categoricalCrossentropy } = await evaluateModel({ model, testData });
      console.log({ 'Initial categoricalCrossentropy': categoricalCrossentropy });
    }

    alreadyInited = true;

    return { model };
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
