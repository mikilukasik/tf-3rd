const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');
const { fen2flatArray } = require('./transform');
// require('@tensorflow/tfjs-backend-wasm');

const datasetDirName = 'data/datasets/engines_frontSpread_cm+sm_noResign_noDrawSmOnly';
const _modelDirName = 'models/109_smoothAhead_from+2moves_c17t_d544t_d68t';

const filesPerDataset = 10;
const outUnits = 1;
const castlingIndex = 7;
const enPassantIndex = 0; //8;
const inputLength = 7 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);
const batchSize = 1000;
const epochsValue = 25;
const patience = 2;
const startTime = Date.now();

const modelDirName = `${_modelDirName}-cai${castlingIndex}eni${enPassantIndex}-ep${epochsValue}`;

// const tensorsToDispose = [];
let sourceCode;
let transformCode;
let trainingMeta = {};
let allDatasetFiles;

const constants = {
  datasetDirName,
  modelDirName,
  outUnits,
  castlingIndex,
  enPassantIndex,
  inputLength,
  batchSize,
  epochsValue,
  patience,
  startTime,
  filesPerDataset,
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

// Define the model architecture
const conv = (filters, activation, kernelSize = 8) =>
  tf.layers.conv2d({
    filters,
    kernelSize,
    padding: 'same',
    activation,
  });

const buildModel = function () {
  const input = tf.input({ shape: [8, 8, inputLength] });

  const conv1 = conv(17, 'tanh').apply(input);
  const flat1 = tf.layers.flatten().apply(conv1);
  const dense2 = tf.layers.dense({ units: 544, activation: 'tanh' }).apply(flat1);
  const dense3 = tf.layers.dense({ units: 68, activation: 'tanh' }).apply(dense2);

  const output = tf.layers.dense({ units: outUnits, activation: 'tanh' }).apply(dense3);

  // compile the model
  const model = tf.model({ inputs: input, outputs: output });
  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: [tf.metrics.meanAbsoluteError],
  });

  return model;
};

const smoothen = (arr) => {
  const smoothArr = arr.slice();

  let i = 0;
  while (i++ < arr.length - 2) {
    if (Math.abs(arr[i - 1] - arr[i + 1]) < 75) smoothArr[i] = (arr[i - 1] + arr[i + 1]) / 2;
  }

  return smoothArr;
};

const getBalanceScore = ({ result, balancesAhead }) => {
  const balanceFiller = result * 5000;
  const smootherBalancesArray = smoothen(balancesAhead.concat(Array(30).fill(balanceFiller)));
  return smootherBalancesArray.slice(2, 30).reduce((p, c, i) => p + c / Math.pow(2, i), 0) / 10000;
};

const transformRecord = (record) => {
  // console.log(22);
  const {
    fen, // : "2q5/6p1/p3q3/P7/k7/8/3K4/8 b - -",
    result, // : 0,
    wNext, // : false,
    nextMove, // : "Kxa5",
    prevMove, // : "Kd2",
    nextFen, // : "2q5/6p1/p3q3/k7/8/8/3K4/8 w - -",
    prevFen, // : "2q5/6p1/p3q3/P7/k7/8/8/3K4 w - -",
    fenIndex, // : 131,
    isStrart, // : false,
    isMate, // : false
    fensLength, // : 147,
    isStall, // : false,
    balance, // : -19,
    balancesAhead, // : [-19, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -28, -28, -28],
    fileName, // : "esn_6483.html"
  } = record;

  const xs = fen2flatArray({ fenStr: fen, inputLength, castlingIndex, enPassantIndex });

  if (isStrart || isStall) return { xs, ys: [0] };
  // if (isMate) return { xs, ys: [result] };

  // const resultScore = result / (fensLength - fenIndex - 1);

  const balanceScore = getBalanceScore({ result, balancesAhead });
  const ys = [balanceScore];

  if (ys[0] < -1 || ys[0] > 1) console.warn({ balancesAhead, result });

  return { xs, ys };
};

// load and normalize data
const loadData = function (data) {
  const transform = ({ xs, ys }) => {
    xs = tf.tensor(xs, [8, 8, inputLength]);
    ys = tf.tensor1d(ys);

    // tensorsToDispose.push(xs, ys);
    return {
      xs,
      ys,
    };
  };

  // load, normalize, transform, batch
  return tf.data.array(data).map(transform).batch(batchSize);
};

// train the model against the training data
const trainModel = async function ({ model, trainData, epochs = epochsValue, iterationIndex, remainingRatio }) {
  let started;
  // console.log
  const options = {
    epochs,
    verbose: 0,
    callbacks: [
      tf.callbacks.earlyStopping({ monitor: 'meanAbsoluteError', patience }),

      new tf.CustomCallback({
        onEpochBegin: async (epoch) => {
          console.log(`Epoch ${epoch + 1} of ${epochs} ...`);
          if (!started) started = Date.now();
        },
      }),

      new tf.CustomCallback({
        onEpochEnd: async (epoch, logs) => {
          const elapsed = Date.now() - started;

          // let msPerIteration;
          // let speed;
          const remainingEpochs = epochsValue - epoch - 1;
          // let remainingHours;

          const msPerIteration = elapsed / (epoch + 1);
          const speed = `${((60 * 60 * 1000) / msPerIteration).toFixed(1)}/h`;
          const remainingHours = (msPerIteration * remainingEpochs) / 1000 / 60 / 60; //.toFixed(2);
          const totalRemainingHours = remainingHours + (msPerIteration * epochsValue * remainingRatio) / 1000 / 60 / 60; //.toFixed(2);

          console.log({
            ...logs,
            completed: `${epoch + 1} / ${epochsValue}`,
            speed,
            remainingHours: remainingHours.toFixed(2),
            totalRemainingHours: totalRemainingHours.toFixed(2),
            _modelDirName,
          });
        },
      }),
    ],
  };

  console.log(tf.memory());
  const result = await model.fitDataset(trainData, options);
  console.log(tf.memory());
  return result;
};

// verify the model against the test data
const evaluateModel = async function ({ model, testData, tempFolder }) {
  const evalResult = await model.evaluateDataset(testData);
  const [loss, meanAbsoluteError] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(5))
      .join(', '),
  );

  model.summary();
  const result = { loss, meanAbsoluteError };
  console.log(result);
  await fs.writeFile(
    path.resolve(tempFolder, 'evaluation.json'),
    JSON.stringify({ ...result, evalResult }, null, 2),
    'utf8',
  );

  return result;
};

const getNextDatasets = async () => {
  const filesLoaded = [];

  let records = [];
  for (let nextFileIndex = 0; nextFileIndex < filesPerDataset; nextFileIndex += 1) {
    const fileName = allDatasetFiles.pop();
    if (!fileName) return null;

    filesLoaded.push(fileName);

    const fullFileName = path.resolve(datasetDirName, fileName);
    console.log(`Loading dataset from ${fullFileName}`);

    records = records.concat(JSON.parse(await fs.readFile(fullFileName, 'utf8')));
  }

  records.sort(() => Math.random() - 0.5);
  const tenProcent = Math.floor(records.length / 10);

  const trainData = records.splice(tenProcent);
  return { trainData, testData: records, filesLoaded, remainingFiles: allDatasetFiles.length };
};

const saveModel = async ({ model, tempFolder, info }) => {
  console.log('Saving model...');
  await model.save(`file://${tempFolder}`);
  await fs.writeFile(path.resolve(tempFolder, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  await fs.writeFile(path.resolve(tempFolder, 'source.js'), sourceCode, 'utf8');
  await fs.writeFile(path.resolve(tempFolder, 'transform.js'), transformCode, 'utf8');
  await fs.writeFile(path.resolve(tempFolder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
};

const saveTestData = async ({ testData, iterationIndex }) =>
  fs.writeFile(path.resolve(trainingMeta.testDataFolder, `i${iterationIndex}.json`), JSON.stringify(testData), 'utf8');

const runIteration = async ({ model, iterationIndex }) => {
  // tf.engine().startScope();
  const iterationStart = Date.now();

  const tempFolder = path.resolve(modelDirName, iterationStart.toString());
  await fs.mkdir(tempFolder, { recursive: true });

  const dataset = await getNextDatasets();
  if (!dataset) {
    // TODO: rename fullModelDirName here
    return { finished: true };
  }

  const { trainData: rawTrainData, testData: rawTestData, filesLoaded, remainingFiles } = dataset;

  const trainData = loadData(rawTrainData.map(transformRecord));
  const testData = loadData(rawTestData.map(transformRecord));

  const info = await trainModel({
    model,
    trainData,
    iterationIndex,
    remainingRatio: remainingFiles / filesLoaded.length,
  });
  console.log(info);

  await saveModel({ model, tempFolder, info });

  const samplesLearned = trainingMeta.samplesLearned + rawTrainData.length;
  await updateTrainingMeta({ filesLearned: trainingMeta.filesLearned.concat(filesLoaded), samplesLearned });

  console.log('Evaluating model...');
  const { meanAbsoluteError } = await evaluateModel({ model, testData, tempFolder });

  const iterationFolderName = tempFolder.replace(
    iterationStart.toString(),
    `${_modelDirName.split('/').pop()}-${meanAbsoluteError}-s${(samplesLearned / 1000000).toFixed(
      2,
    )}M-e${epochsValue}-${iterationStart.toString()}`,
  );
  await fs.rename(tempFolder, iterationFolderName);

  await updateTrainingMeta({
    iterations: trainingMeta.iterations.concat({
      ...info,
      meanAbsoluteError,
      folder: iterationFolderName,
    }),
    completedIterations: trainingMeta.completedIterations + 1,
    completedEpochs: trainingMeta.completedEpochs + info.params.epochs,
    samplesLearned,
  });

  await saveTestData({ testData: rawTestData, iterationIndex });

  // tensorsToDispose.forEach((t) => {
  //   try {
  //     t.dispose();
  //   } catch (e) {
  //     /* */
  //   }
  // });
  // tensorsToDispose.length = 0;

  // tf.engine().endScope();
  return { finished: false };
};

// run
const run = async function () {
  await init();

  // TODO: should load prev model here!
  const model = buildModel();
  model.summary();

  let iteraiterationIndex = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let { finished } = await runIteration({ model, iterationIndex: iteraiterationIndex++ });
    if (finished) break;
  }

  console.log('DONE');
};

const init = async () => {
  try {
    // if (await tf.setBackend('wasm')) console.log('TF will use WASM.');

    sourceCode = await fs.readFile('./train.js', 'utf8');
    transformCode = await fs.readFile('./transform.js', 'utf8');

    const fullModelDirname = path.resolve(modelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });
    await fs.writeFile(path.resolve(fullModelDirname, 'source.js'), sourceCode, 'utf8');
    await fs.writeFile(path.resolve(fullModelDirname, 'transform.js'), transformCode, 'utf8');
    await fs.writeFile(path.resolve(fullModelDirname, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');

    const testDataFolder = path.resolve(fullModelDirname, 'testDataUsed');
    await fs.mkdir(testDataFolder, { recursive: true });

    await loadTrainingMeta();
    await updateTrainingMeta({ testDataFolder });

    allDatasetFiles = (await fs.readdir(datasetDirName))
      .filter((fileName) => !trainingMeta.filesLearned.includes(fileName))
      .sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]));
  } catch (e) {
    console.error(e);
  }
};

run();
