const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');
const { fen2flatArray, getWhiteNextFen } = require('./transform');

const datasetDirName = 'data/datasets/engines_frontSpread_cm+sm_noResign_noDrawSmOnly';
const _modelDirName = 'models/451_d2-14';

const filesPerDataset = 3;
const outUnits = 1;
const castlingIndex = 12;
const enPassantIndex = 0;
const inputLength = 12 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);
const batchSize = 1000;
const epochsValue = 25;
const patience = 1;
const startTime = Date.now();
const needsWNext = true;
const needsPieceVals = true;

const modelDirName = `${_modelDirName}-e${epochsValue}`;

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
  needsWNext,
  needsPieceVals,
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
    // activation,
    useBias: false,
  });

const convBlock = (input, filters = 32) => {
  const conv1 = conv(filters).apply(input);
  const activated = tf.layers.leakyReLU().apply(conv1);
  return activated;
};

const buildModel = function () {
  const input = tf.input({ shape: [8, 8, inputLength] });

  const conv1 = convBlock(input, 32);
  const conv2 = convBlock(conv1, 32);
  const conv3 = convBlock(conv2, 32);

  // const flat1 = tf.layers.flatten().apply(conv1);
  // const flat2 = tf.layers.flatten().apply(conv2);
  const flat3 = tf.layers.flatten().apply(conv3);

  // const concatenated1 = tf.layers.concatenate().apply([flat3, flat2]);
  // const norm1 = tf.layers.batchNormalization().apply(concatenated1);
  const dense1 = tf.layers.dense({ units: 512, activation: tf.leakyReLU, useBias: false }).apply(flat3);
  const dense2 = tf.layers.dense({ units: 256, activation: tf.leakyReLU, useBias: false }).apply(dense1);

  const output = tf.layers.dense({ units: outUnits, useBias: false }).apply(dense2);

  // compile the model
  const model = tf.model({ inputs: input, outputs: output });
  model.compile({
    optimizer: tf.train.adam(0.00015),
    loss: 'meanSquaredError',
    metrics: [tf.metrics.meanAbsoluteError],
  });

  // console.log(model, model.learningRate);

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

const getBalanceScore = ({ result: _result, balancesAhead: _balancesAhead, mirrored }) => {
  const balancesAhead = mirrored ? _balancesAhead.map((x) => -x) : _balancesAhead.slice();
  const balanceDiffsAhead = balancesAhead.map((bal) => bal - balancesAhead[0]);

  const result = _result * (mirrored ? -1 : 1);

  const balanceFiller = result === 0 ? 0 : balanceDiffsAhead[balanceDiffsAhead.length - 1] + result * 2500;

  // const smootherBalancesArray = smoothen(balancesAhead.slice(2).concat(Array(30).fill(balanceFiller)));
  const extendedArr = balanceDiffsAhead.concat(Array(16).fill(balanceFiller)).slice(2, 14);
  const smootherBalancesArray = smoothen(extendedArr);

  return smootherBalancesArray.reduce((p, c, i) => p + c / Math.pow(1.25, i), 0) / 25000;

  // return (
  //   balanceDiffsAhead
  //     .concat(Array(30).fill(balanceFiller))
  //     .slice(2, 30)
  //     .reduce((p, c, i) => p + c / Math.pow(1.5, i), 0) / 15000
  // );

  // a=(l,x)=>Array(l).fill(1).reduce((p, c, i) => p + c / Math.pow(x, i), 0)
  // a(833,1.5)
  // 2.9999999999999987
};
const getBalanceScore2 = ({ result: _result, balancesAhead: _balancesAhead, mirrored }) => {
  const balancesAhead = mirrored ? _balancesAhead.map((x) => -x) : _balancesAhead.slice();
  const result = _result * (mirrored ? -1 : 1);

  const balanceFiller = result === 0 ? 0 : balancesAhead[balancesAhead.length - 1] + result * 2500;

  // const smootherBalancesArray = smoothen(balancesAhead.slice(2).concat(Array(30).fill(balanceFiller)));
  // return smootherBalancesArray.slice(0, 30).reduce((p, c, i) => p + c / Math.pow(1.5, i), 0) / 15000;
  const arr = balancesAhead.concat(Array(5).fill(balanceFiller));
  return (arr[1] - arr[0]) / 6000;

  // a=(l,x)=>Array(l).fill(1).reduce((p, c, i) => p + c / Math.pow(x, i), 0)
  // a(833,1.5)
  // 2.9999999999999987
};

const transformRecord = (record) => {
  // console.log(22);
  const {
    fen: _fen, // : "2q5/6p1/p3q3/P7/k7/8/3K4/8 b - -",
    result, // : 0,
    wNext, // : false,
    nextMove, // : "Kxa5",
    prevMove, // : "Kd2",
    nextFen, // : "2q5/6p1/p3q3/k7/8/8/3K4/8 w - -",
    prevFen, // : "2q5/6p1/p3q3/P7/k7/8/8/3K4 w - -",
    fenIndex, // : 121,
    isStrart, // : false,
    isMate, // : false
    fensLength, // : 147,
    isStall, // : false,
    balance, // : -19,
    balancesAhead, // : [-19, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -20, -28, -28, -28],
    fileName, // : "esn_6483.html"
  } = record;

  const { fen, mirrored } = getWhiteNextFen({ fen: _fen });

  // if (mirrored) return null;

  const xs = fen2flatArray({ fenStr: fen, inputLength, castlingIndex, enPassantIndex });

  // if (isStrart || isStall) return { xs, ys: [0] };
  // if (isMate) return { xs, ys: [result] };

  const balanceScore = getBalanceScore({ result, balancesAhead, mirrored });
  // console.log(balancesAhead[4], balancesAhead[4] / 500);
  const ys = [balanceScore];

  if (ys[0] < -1 || ys[0] > 1) console.warn({ balancesAhead, result, ys });

  return { xs, ys };
};

const noMoreCastling = ({ fen }) => {
  const castling = fen.split(' ')[2];
  return castling === '-';
};

const noMorePawns = ({ fen }) => {
  const board = fen.split(' ')[0];
  const hasBlackPawns = board.indexOf('p') >= 0;
  const hasWhitePawns = board.indexOf('P') >= 0;
  return !(hasBlackPawns || hasWhitePawns);
};

const rowReverser = (row) => row.split('').reverse().join('');

const mirrorOnX = (record) => {
  const { fen } = record;
  const [board, ...restOfFen] = fen.split(' ');

  const newBoard = board.split('/').map(rowReverser).join('/');
  return Object.assign({}, record, { fen: [newBoard, ...restOfFen].join(' ') });
};

const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

const mergeBlanks = (rowStr) => rowStr.replace(/[1]+/g, (blanks) => blanks.length);

const rotate90 = (record) => {
  const { fen } = record;
  const [board, ...restOfFen] = fen.split(' ');

  const lines = board.split('/').map((line) => expandGroupedBlanks(line).split(''));

  const newLines = [];
  for (let i = 0; i < 8; i += 1) {
    newLines[i] = [];
    for (let j = 0; j < 8; j += 1) {
      newLines[i][j] = lines[j][7 - i];
    }
  }

  const newBoard = newLines.map((lineArr) => mergeBlanks(lineArr.join(''))).join('/');
  return Object.assign({}, record, { fen: [newBoard, ...restOfFen].join(' ') });
};

const getRotatedRecords = (record) => {
  const resultingRecords = [record];

  for (let i = 0; i < 3; i += 1) {
    const recordToRotate = resultingRecords[resultingRecords.length - 1];
    resultingRecords.push(rotate90(recordToRotate));
  }

  return resultingRecords.slice(1);
};

const addFlippedAndRotated = (dataArr) => {
  // TODO: do we need to touch prev/next fen?
  const newDataArr = [];

  for (const data of dataArr) {
    const resultingRecords = [data];

    if (noMoreCastling(data)) {
      resultingRecords.push(mirrorOnX(data));
      if (noMorePawns(data))
        resultingRecords.push(...getRotatedRecords(resultingRecords[0]), ...getRotatedRecords(resultingRecords[1]));
    }

    newDataArr.push(...resultingRecords);
  }

  return newDataArr;
};

// load and normalize data
const loadData = function (data) {
  // const data = addFlippedAndRotated(_data);

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
const trainModel = async function ({ model, trainData, epochs = epochsValue, iterationIndex, remainingRatio }) {
  let started;
  // console.log
  const options = {
    epochs,
    verbose: 1,
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

  const largeRawTrainData = addFlippedAndRotated(rawTrainData);
  const largeRawTestData = addFlippedAndRotated(rawTestData);

  const samplesAdded = largeRawTestData.length + largeRawTrainData.length - rawTestData.length - rawTrainData.length;
  console.log(`Added ${samplesAdded} samples.`);

  const trainData = loadData(largeRawTrainData.map(transformRecord).filter(Boolean));
  const testData = loadData(largeRawTestData.map(transformRecord).filter(Boolean));

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

  //   try {
  //     t.dispose();
  //   } catch (e) {
  //     /* */
  //   }
  // });

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
