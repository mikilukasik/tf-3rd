import tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import path from 'path';
import { getDatasetFromDisc } from './src/scripts/utils/getDatasetFromDisc.mjs';
// import { fen2flatArray } from './transform';
// import { getDataset } from './src/scripts/utils/getDataset.mjs';
import { fen2flatArray } from './transform.js';

const sourceModelDirName = 'models/kernel8V1Smaller';
const modelDirName = 'models/kernel8V1Smaller_2';

const recordsPerDataset = 200000;
const testRecordsPerDataset = 20000;

const outUnits = 1;
const castlingIndex = 0;
const enPassantIndex = 0;
const inputLength = 12 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);
const batchSize = 1000;
const maxEpochs = 250;
const patience = 1;
const startTime = Date.now();
const needsWNext = true;
const needsPieceVals = true;
const learningRate = 0.00003;

let sourceCode;
let transformCode;
let trainingMeta = {};
let trainDatasetFiles;
let testData;

const constants = {
  // trainDatasetDirName,
  // testDatasetDirName,
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
};

const loadTestData = (() => {
  let pointers = {
    // '-0.656 to -1': Math.random(),
    // '0.641 to 0.984': Math.random(),
    // '-0.359 to -0.641': Math.random(),
    // '0.344 to 0.625': Math.random(),
    // '-0.203 to -0.344': Math.random(),
    // '0.188 to 0.328': Math.random(),
    // '-0.141 to -0.188': Math.random(),
    // '0.125 to 0.172': Math.random(),
    // '-0.078 to -0.125': Math.random(),
    // '0.063 to 0.109': Math.random(),
    // '-0.016 to -0.063': Math.random(),
    // '0 to 0.047': Math.random(),
  };

  return async () => {
    // const testFileNames = (await fs.readdir(testDatasetDirName))
    //   .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]))
    //   .slice(0, testFilesCount);

    // console.log(`Test files: ${testFileNames.join(', ')}`);

    const { result: rawTestData, newPointers } = await getDatasetFromDisc({
      testData: true,
      limit: testRecordsPerDataset,
      pointers,
    });
    pointers = newPointers;
    // for (const fileName of testFileNames) {
    //   rawTestData.push(...JSON.parse(await fs.readFile(path.resolve(testDatasetDirName, fileName))));
    // }

    console.log(`Loaded ${rawTestData.length} test samples.`);

    testData = loadData(rawTestData.map(transformRecord).filter(Boolean));
  };
})();

const loadModel = async ({ folder }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  model.compile({
    optimizer: tf.train.adam(learningRate),
    loss: 'meanSquaredError',
    metrics: [tf.metrics.meanAbsoluteError],
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

// const smoothen = (arr) => {
//   const smoothArr = arr.slice();

//   let i = 0;
//   while (i++ < arr.length - 2) {
//     if (Math.abs(arr[i - 1] - arr[i + 1]) < 75) smoothArr[i] = (arr[i - 1] + arr[i + 1]) / 2;
//   }

//   return smoothArr;
// };

// const getBalanceScore = ({ result: _result, balancesAhead: _balancesAhead, mirrored }) => {
//   const balancesAhead = mirrored ? _balancesAhead.map((x) => -x) : _balancesAhead.slice();
//   const balanceDiffsAhead = balancesAhead.map((bal) => bal - balancesAhead[0]);

//   const result = _result * (mirrored ? -1 : 1);

//   const balanceFiller = result === 0 ? 0 : balanceDiffsAhead[balanceDiffsAhead.length - 1] + result * 2500;

//   const extendedArr = balanceDiffsAhead.concat(Array(16).fill(balanceFiller)).slice(2, 14);
//   const smootherBalancesArray = smoothen(extendedArr);

//   return smootherBalancesArray.reduce((p, c, i) => p + c / Math.pow(1.25, i), 0) / 25000;
// };

const transformRecord = (record) => {
  const {
    fen, //: _fen, // : "2q5/6p1/p3q3/P7/k7/8/3K4/8 b - -",
    v2Output,
    // result, // : 0,
    // balancesAhead, // : [-19, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -28, -28, -28],
  } = record;

  // const { fen, mirrored } = getWhiteNextFen({ fen: _fen });

  const xs = fen2flatArray({ fenStr: fen, inputLength, castlingIndex, enPassantIndex });

  // const balanceScore = getBalanceScore({ result, balancesAhead, mirrored });
  const ys = [v2Output];

  // if (ys[0] < -1 || ys[0] > 1) console.warn({ balancesAhead, result, ys });

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
  return tf.data.array(data).map(transform).batch(batchSize);
};

// train the model against the training data
const trainModel = async function ({ model, trainData }) {
  let started;

  const options = {
    epochs: 1,
    verbose: 1,
    callbacks: [
      tf.callbacks.earlyStopping({ monitor: 'meanAbsoluteError', patience }),

      new tf.CustomCallback({
        onEpochBegin: async (epoch) => {
          // console.log(`Epoch ${epoch + 1} of ${epochs} ...`);
          if (!started) started = Date.now();
        },
      }),

      new tf.CustomCallback({
        onEpochEnd: async (epoch, logs) => {
          // const elapsed = Date.now() - started;

          // const remainingEpochs = maxEpochs - epoch - 1;

          // const msPerIteration = elapsed / (epoch + 1);
          // const speed = `${((60 * 60 * 1000) / msPerIteration).toFixed(1)}/h`;
          // const remainingHours = (msPerIteration * remainingEpochs) / 1000 / 60 / 60; //.toFixed(2);
          // const totalRemainingHours = remainingHours + (msPerIteration * maxEpochs * remainingRatio) / 1000 / 60 / 60; //.toFixed(2);

          console.log({
            ...logs,
            // completed: `${epoch + 1} / ${maxEpochs}`,
            // speed,
            // remainingHours: remainingHours.toFixed(2),
            // totalRemainingHours: totalRemainingHours.toFixed(2),
            modelDirName,
          });
        },
      }),
    ],
  };

  console.log(`Tensors in memory: ${tf.memory().numTensors}`);
  const result = await model.fitDataset(trainData, options);
  console.log(`Tensors in memory: ${tf.memory().numTensors}`);
  return result;
};

// verify the model against the test data
const evaluateModel = async function ({ model, testData: rawTestData, tempFolder }) {
  const evalResult = await model.evaluateDataset(testData);
  const [loss, meanAbsoluteError] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(5))
      .join(', '),
  );

  // model.summary();
  const result = { loss, meanAbsoluteError };
  // console.log(result);

  if (tempFolder)
    await fs.writeFile(
      path.resolve(tempFolder, 'evaluation.json'),
      JSON.stringify({ ...result, evalResult }, null, 2),
      'utf8',
    );

  return result;
};

const getNextDatasets = (() => {
  let pointers = {
    // '-0.656 to -1': Math.random(),
    // '0.641 to 0.984': Math.random(),
    // '-0.359 to -0.641': Math.random(),
    // '0.344 to 0.625': Math.random(),
    // '-0.203 to -0.344': Math.random(),
    // '0.188 to 0.328': Math.random(),
    // '-0.141 to -0.188': Math.random(),
    // '0.125 to 0.172': Math.random(),
    // '-0.078 to -0.125': Math.random(),
    // '0.063 to 0.109': Math.random(),
    // '-0.016 to -0.063': Math.random(),
    // '0 to 0.047': Math.random(),
  };

  return async ({ iterationIndex } = {}) => {
    // if (!trainDatasetFiles.length) return null;

    console.log({ iterationIndex });
    // const filesLoaded = [];
    // let records = [];
    const { result: records, newPointers } = await getDatasetFromDisc({
      limit: recordsPerDataset,
      pointers,
      ponder: true,
    });
    pointers = newPointers;

    console.log(`Loaded ${records.length} records.`);

    // console.log(`Loading datasets:`); // from ${fullFileName}`);
    // for (let nextFileIndex = 0; nextFileIndex < trainFilesPerDataset; nextFileIndex += 1) {
    //   const fileName = trainDatasetFiles.pop();
    //   if (!fileName) {
    //     if (!records.length) return null;
    //     break;
    //   }

    //   filesLoaded.push(fileName);

    //   const fullFileName = path.resolve(trainDatasetDirName, fileName);

    //   if (nextFileIndex > 0) process.stdout.write(', ');
    //   process.stdout.write(fileName.split('-')[0]);

    //   records = records.concat(JSON.parse(await fs.readFile(fullFileName, 'utf8')));
    // }
    // console.log(`\nLoaded ${records.length} train samples.`);
    // records.sort(() => Math.random() - 0.5);

    return { trainData: records };
  };
})();

const saveModel = async ({ model, meanAbsoluteError, totalEpochs }) => {
  console.log('Saving model...');

  const modelFolder = path.resolve(modelDirName, `${meanAbsoluteError}-e${totalEpochs}-${Date.now()}`);

  await model.save(`file://${modelFolder}`);
  // await fs.writeFile(path.resolve(modelFolder, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  await fs.writeFile(path.resolve(modelFolder, 'source.js'), sourceCode, 'utf8');
  await fs.writeFile(path.resolve(modelFolder, 'transform.js'), transformCode, 'utf8');
  await fs.writeFile(path.resolve(modelFolder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
};

const runIteration = async ({ model, iterationIndex }) => {
  //   const iterationStart = Date.now();

  //   const tempFolder = path.resolve(modelDirName, iterationStart.toString());
  //   await fs.mkdir(tempFolder, { recursive: true });

  const dataset = await getNextDatasets({ iterationIndex });
  if (!dataset) {
    return { finished: true };
  }

  const { trainData: rawTrainData } = dataset;

  const largeRawTrainData = rawTrainData;
  //   const largeRawTestData = rawTestData;

  //   const samplesAdded = largeRawTestData.length + largeRawTrainData.length - rawTestData.length - rawTrainData.length;
  //   console.log(`Added ${samplesAdded} samples.`);

  const trainData = loadData(largeRawTrainData.map(transformRecord).filter(Boolean));
  //   const testData = loadData(largeRawTestData.map(transformRecord).filter(Boolean));

  await trainModel({
    model,
    trainData,
    iterationIndex,
    // remainingRatio: remainingFiles / filesLoaded.length,
  });
  // console.log(info);

  //   await saveModel({ model, tempFolder, info });

  //   const samplesLearned = trainingMeta.samplesLearned + rawTrainData.length;
  //   await updateTrainingMeta({ filesLearned: trainingMeta.filesLearned.concat(filesLoaded), samplesLearned });

  //   console.log('Evaluating model...');
  //   const { meanAbsoluteError } = await evaluateModel({ model, testData, tempFolder });

  //   const iterationFolderName = tempFolder.replace(
  //     iterationStart.toString(),
  //     `${_modelDirName.split('/').pop()}-${meanAbsoluteError}-s${(samplesLearned / 1000000).toFixed(
  //       2,
  //     )}M-e${maxEpochs}-${iterationStart.toString()}`,
  //   );
  //   await fs.rename(tempFolder, iterationFolderName);

  //   await updateTrainingMeta({
  //     iterations: trainingMeta.iterations.concat({
  //       ...info,
  //       meanAbsoluteError,
  //       folder: iterationFolderName,
  //     }),
  //     completedIterations: trainingMeta.completedIterations + 1,
  //     completedEpochs: trainingMeta.completedEpochs + info.params.epochs,
  //     samplesLearned,
  //   });

  //   await saveTestData({ testData: rawTestData, iterationIndex });

  return { finished: false };
};

// run
const run = async function () {
  const { model } = await init();

  for (let epochIndex = 1; epochIndex <= maxEpochs; epochIndex += 1) {
    // trainDatasetFiles = (await fs.readdir(trainDatasetDirName)).sort(() => Math.random() - 0.5);

    let iterationIndex = 0;
    let finished;
    do {
      finished = await (await runIteration({ model, iterationIndex: iterationIndex++ })).finished;
      console.log('Iteration done, evaluating...');
      const { meanAbsoluteError } = await evaluateModel({ model, testData });
      console.log(`meanAbsoluteError: ${meanAbsoluteError}`);

      if (Math.random() > 0.66) await saveModel({ model, meanAbsoluteError, totalEpochs: epochIndex });
    } while (!finished);

    // console.log('Iteration done, evaluating...');
    // const { meanAbsoluteError } = await evaluateModel({ model, testData });
    // console.log(`meanAbsoluteError: ${meanAbsoluteError}`);

    // await saveModel({ model, meanAbsoluteError, totalEpochs: epochIndex });
  }
  console.log('DONE');
};

const init = async () => {
  try {
    sourceCode = await fs.readFile('./retrain2.js', 'utf8');
    transformCode = await fs.readFile('./transform.js', 'utf8');

    const fullModelDirname = path.resolve(modelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });
    await fs.writeFile(path.resolve(fullModelDirname, 'source.js'), sourceCode, 'utf8');
    await fs.writeFile(path.resolve(fullModelDirname, 'transform.js'), transformCode, 'utf8');
    await fs.writeFile(path.resolve(fullModelDirname, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
    await loadTrainingMeta();

    await loadTestData();

    const sourceModelFolder = path.resolve(sourceModelDirName);
    const model = await loadModel({ folder: sourceModelFolder });
    model.summary();

    console.log('Starting initial evaluation...');
    const { meanAbsoluteError } = await evaluateModel({ model, testData });
    console.log(`Initial meanAbsoluteError: ${meanAbsoluteError}`);

    return { model };
  } catch (e) {
    console.error(e);
  }
};

run();
