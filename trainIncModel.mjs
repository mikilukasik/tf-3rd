import tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetFromDisc.mjs';
import { movesToOneHot } from './src/scripts/utils/oneHotMovesMap.mjs';
import { getXs } from './transform.js';

const datasetFolder = './data/newCsvs3';
const initialSourceModelDirName = 'models/inc3_v1rs';

const filesToCopy = {
  'createModelInc.js': path.resolve(initialSourceModelDirName, 'createModelInc.js'),
  'train.mjs': './trainIncModel.mjs',
  'transforms.js': 'src/lib/bundledTransforms/inc_transforms.js',
};

const recordsPerDataset = 15000;
const testRecordsPerDataset = 2500;
const batchSize = 2500;
const maxIterationsWithoutImprovement = 25;

const initialLearningRate = 0.005;
const finalLearningRate = 0.0000003;

const inUnits = 14;

let testData;

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

const loadModel = async ({ folder, learningRate }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'categoricalCrossentropy',
    metrics: [tf.metrics.categoricalCrossentropy],
  });
  return model;
};

const transformRecord = (record) => {
  const [fen, , , , , , lmf, lmt, m0, m1] = record;

  const oneHotIndex = movesToOneHot[Number(m0)][Number(m1)];
  if (typeof oneHotIndex === 'undefined') throw new Error(`move is missing from onehot map: ${m0} ${m1}`);
  const ys = new Array(1792).fill(0);
  ys[Number(oneHotIndex)] = 1;

  const xs = getXs({ fens: [/*prevFen1, prevFen3,*/ fen], lmf, lmt });

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

  // console.log({ evalResult });

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
  console.log('Saving model...');

  await model.save(`file://${modelDirName}`);

  await Promise.all(
    Object.keys(filesToCopy).map((targetFileName) =>
      fs.copyFile(path.resolve(filesToCopy[targetFileName]), path.resolve(modelDirName, targetFileName)),
    ),
  );
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

  // console.log({ trainResult, trainData });

  // trainResult.dispose();
  tf.engine().endScope();
};

// run
let currentBest;

const run = async function () {
  let learningRate = initialLearningRate;
  let sourceModelDirName = initialSourceModelDirName;
  const previousBestFolders = [];

  while (learningRate >= finalLearningRate) {
    const modelDirName = `${initialSourceModelDirName}_${learningRate}`;
    console.log('starting iteration...', { learningRate, sourceModelDirName, modelDirName });

    const { model } = await init({ learningRate, sourceModelDirName, modelDirName });

    let iterationsWithNoImprovement = 0;
    do {
      await await runIteration({ model });
      console.log('evaluating...');
      const { categoricalCrossentropy } = await evaluateModel({ model });
      console.log(`categoricalCrossentropy: ${categoricalCrossentropy}`);

      const modelFolderForSaving = path.resolve(modelDirName, `${categoricalCrossentropy}-${Date.now()}`);

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

      if (Math.random() > 0.9) {
        await saveModel({ model, categoricalCrossentropy, modelDirName: modelFolderForSaving });
        previousBestFolders.push(modelFolderForSaving);
      }
    } while (iterationsWithNoImprovement < maxIterationsWithoutImprovement);

    try {
      // model.layers.forEach((l) => l.dispose());
      model.dispose();
    } catch (e) {
      console.error(`couldn't dispose model:`, e);
    }

    learningRate /= 2;
    console.log('new iteration will start', { learningRate, sourceModelDirName });
    // })
  }
  // }
  console.log('DONE');
};

let alreadyInited = false;
const init = async ({ learningRate, modelDirName, sourceModelDirName }) => {
  try {
    if (!alreadyInited)
      getNextDatasets = await (async () => {
        const { getNextBatch } = await datasetReader({
          folder: path.resolve(datasetFolder),
          test: false,
          batchSize: recordsPerDataset,
          progressGroups: [0, 1, 2],
        });
        console.log('datasetReader for lessons initialized');
        return async ({ iterationIndex } = {}) => {
          // console.log({ iterationIndex });
          const records = await getNextBatch();
          console.log(`Loaded ${records.length} training records.`);
          return { trainData: records };
        };
      })();

    // trainCode = await fs.readFile('./trainIncModel.mjs', 'utf8');
    // // createCode = await fs.readFile('./createModel.js', 'utf8');
    // transformCode = await fs.readFile('./transform.js', 'utf8');

    const sourceModelFolder = path.resolve(sourceModelDirName);
    const model = await loadModel({ folder: sourceModelFolder, learningRate });
    model.summary();

    const fullModelDirname = path.resolve(modelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });

    await Promise.all(
      Object.keys(filesToCopy).map((targetFileName) =>
        fs.copyFile(path.resolve(filesToCopy[targetFileName]), path.resolve(modelDirName, targetFileName)),
      ),
    );
    // await fs.writeFile(path.resolve(fullModelDirname, 'createModel.js'), createCode, 'utf8');
    // await fs.writeFile(path.resolve(fullModelDirname, 'trainIncModel.mjs'), trainCode, 'utf8');
    // await fs.writeFile(path.resolve(fullModelDirname, 'transform.js'), transformCode, 'utf8');
    // await loadTrainingMeta({ modelDirName });

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
