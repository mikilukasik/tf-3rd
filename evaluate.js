const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');
const { fen2flatArray, getWhiteNextFen } = require('./transform');

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

let model;

const modelDirName = `${_modelDirName}-e${epochsValue}`;

let trainingMeta = {};

const constants = {
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

  const extendedArr = balanceDiffsAhead.concat(Array(16).fill(balanceFiller)).slice(2, 14);
  const smootherBalancesArray = smoothen(extendedArr);

  return smootherBalancesArray.reduce((p, c, i) => p + c / Math.pow(1.25, i), 0) / 25000;

  // a=(l,x)=>Array(l).fill(1).reduce((p, c, i) => p + c / Math.pow(x, i), 0)
  // a(833,1.5)
  // 2.9999999999999987
};

const transformRecord = (record) => {
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

  const xs = fen2flatArray({ fenStr: fen, inputLength, castlingIndex, enPassantIndex });

  const balanceScore = getBalanceScore({ result, balancesAhead, mirrored });
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

// verify the model against the test data
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

  return { loss, meanAbsoluteError };
};

const evaluateIteration = async ({ iterationIndex }) => {
  const testDataFileName = path.resolve(modelDirName, 'testDataUsed', `i${iterationIndex}.json`);
  const rawTestData = JSON.parse(await fs.readFile(testDataFileName, 'utf8'));

  const largeRawTestData = addFlippedAndRotated(rawTestData);
  const testData = loadData(largeRawTestData.map(transformRecord).filter(Boolean));

  const { meanAbsoluteError } = await evaluateModel({ model, testData });
  const originalMeanAbsError = trainingMeta.iterations[iterationIndex].meanAbsoluteError;

  console.log(`i${iterationIndex}: ${originalMeanAbsError} --> ${meanAbsoluteError}`);
};

// run
const run = async function () {
  await init();

  let iterationIndex = 0;
  while (iterationIndex < trainingMeta.iterations.length) {
    await evaluateIteration({ iterationIndex });
    iterationIndex += 1;
  }

  console.log('DONE');
};

const loadModel = async ({ folder }) => {
  model = await tf.loadLayersModel(`file://${folder}/model.json`);
};

const init = async () => {
  try {
    await loadTrainingMeta();

    const lastIteration = trainingMeta.iterations[trainingMeta.iterations.length - 1];
    const latestModelFolder = lastIteration.folder;

    await loadModel({ folder: latestModelFolder });
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
      metrics: [tf.metrics.meanAbsoluteError],
    });

    model.summary();
  } catch (e) {
    console.error(e);
  }
};

run();
