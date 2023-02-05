import tf from '@tensorflow/tfjs-node';
import { promises as fs, readFileSync } from 'fs';
import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetPgV6.mjs';
import { getXs } from './transform.js';

// const initialSourceModelDirName = 'models/pg1_large_v1'; // gone :(
const initialSourceModelDirName = 'models/small_tV5_mUpUbUd100k_0.001/2.36505580-1670062022308';
const targetModelName = 'models/small_tV6_mUpUbU_v1';

const singleMoveRatio = undefined; // 7.5;
const singleProgressGroupRatio = undefined; // 1.48;
const singleBalanceGroupRatio = undefined; //1;

const initialLearningRate = 0.0001; //0.0001; //0.001; //0.0005; //0.0005; //0.0005; //0.000125; //0.000015625; //0.001;
const finalLearningRate = 0.0000001;
const makeTrainableBelowLr = 0; // 0.0001; //0.00005;

const recordsPerDataset = 30000;
const testRecordsPerDataset = 20000;
const batchSize = 5000;
const maxIterationsWithoutImprovement = 15; //10;
const iterationsPerEval = 10;
// const dupeCacheSize = 50000;

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

// all
// const filter = (data) => Number(data[2]) >= 0; //|| data[4] === '1'; //||
// some other moves too
// Math.random() < 0.005;

// midegame
// const filter = (data) => data[7] === '1' && (Number(data[2]) >= 0 || Number(data[3]) > 0.0001); //|| Math.random() < 0.01;

//openings
// const filter = (data) => Number(data[2]) >= 0 && data[7] === '0'; //|| Math.random() < 0.01;

const fileNamesToCopy = {
  'train.mjs': './trainV6.mjs',
  'loader.js': './dist/pg_loader.js',
  'datasetReader.mjs': './src/scripts/utils/getMovesDatasetPgV6.mjs',
  'transforms.js': './transform.js',
};

const filesToCopy = Object.keys(fileNamesToCopy).reduce((p, c) => {
  p[c] = readFileSync(path.resolve(fileNamesToCopy[c]), 'utf-8');
  return p;
}, {});

const generateProgressGroups = (divider, minimum) => {
  const groups = {};
  let minVal = 1 / divider;
  let maxVal;

  while (minVal > minimum) {
    const groupName = `${minVal.toFixed(3)} - ${maxVal ? maxVal.toFixed(3) : '1'}`;
    groups[groupName] = {
      filter: (record) => {
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
          move_index,
          total_moves,
        ] = record;

        if (Number(hit_soon) < 0) return false;

        const progress = Number(move_index) / Number(total_moves);

        return progress > minVal && progress <= (maxVal || 1);
      },
      // preFilter: `progress > ${minVal}${maxVal ? ` AND progress < ${maxVal}` : ''}`,
      // postFilter,
      take: (maxVal || 1) - minVal,
    };
    maxVal = minVal;
    minVal /= divider;
  }

  groups[`0 - ${maxVal.toFixed(3)}`] = {
    filter: (record) => {
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
        move_index,
        total_moves,
      ] = record;

      if (Number(hit_soon) < 0) return false;

      const progress = Number(move_index) / Number(total_moves);

      return progress <= maxVal;
    },
    // preFilter: `progress < ${maxVal}`,
    // postFilter,
    take: maxVal,
  };

  return groups;
};

const groups = generateProgressGroups(1.7, 0.04);

let learningRate = initialLearningRate;
let testData;
let alreadySetTrainable = false;

const loadTestData = async () => {
  const { getNextBatch } = await datasetReader({
    test: true,
    batchSize: testRecordsPerDataset,
    groups,
    // filter: (data) => Number(data[2]) >= 0,
    // dupeCacheSize,
    singleMoveRatio,
    singleProgressGroupRatio,
    singleBalanceGroupRatio,
  });

  console.log('datasetReaderV5 for test samples initialized, getting test samples...');
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
    move_index,
    total_moves,
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
      fs.writeFile(path.resolve(modelDirName, targetFileName), filesToCopy[targetFileName], 'utf-8'),
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
        const { getNextBatch } = await datasetReader({
          // folder: path.resolve(datasetFolder),
          test: false,
          batchSize: recordsPerDataset,
          groups,
          //noDupes: true, //per batch
          // dupeCacheSize,
          singleMoveRatio,
          singleProgressGroupRatio,
          singleBalanceGroupRatio,
        });
        console.log('datasetReaderV5 for lessons initialized');
        return async ({ iterationIndex } = {}) => {
          // console.log({ iterationIndex });
          const records = await getNextBatch();
          console.log(`Loaded ${records.length} training records.`);
          return { trainData: records };
        };
      })();

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
      await loadTestData();

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
