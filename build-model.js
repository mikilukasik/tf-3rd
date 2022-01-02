const tf = require('@tensorflow/tfjs-node');
const StreamArray = require('stream-json/streamers/StreamArray');
const { readGames } = require('./src/utils/read-games');
const fs = require('fs').promises;
const path = require('path');

const folderName = 'otb_2000+_chkmt/2000+chkmt';
const maxSampleSize = 330000;

const outUnits = 1;
const inUnits = 7; //9;

const batchSize = 100;
const epochsValue = 30;

const depthToLearn = 1;

const conv = (filters, activation, inputShape) =>
  tf.layers.conv2d({
    ...(inputShape && { inputShape }),
    filters,
    kernelSize: 8,
    padding: 'same',
    activation,
  });

const modelFormat = [
  conv(64, 'sigmoid', [8, 8, inUnits]),
  conv(64, 'sigmoid'),
  tf.layers.flatten(),
  tf.layers.dense({ units: 64, activation: 'sigmoid' }),
];

const buildModel = function () {
  const model = tf.sequential();

  modelFormat.forEach(model.add.bind(model));

  model.add(
    tf.layers.dense({
      units: outUnits,
      activation: 'sigmoid',
    }),
  );

  // compile the model
  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    // loss: 'meanAbsoluteError',
    metrics: [tf.metrics.meanAbsoluteError],
  });

  return model;
};

let sourceCode;

const startTime = Date.now();
const saveModelPath = path.resolve(`./results/${startTime}_s${Math.floor(maxSampleSize / 1000)}k_e${epochsValue}`);

const lesson = {
  train: [],
  test: [],
};

const jsonStream = StreamArray.withParser();

// Build, train a model with a subset of the data

// load and normalize data
const loadData = function (data) {
  const transform = ({ xs, ys }) => {
    return {
      xs: tf.tensor(xs, [8, 8, inUnits]),
      ys: tf.tensor1d(ys),
    };
  };

  // load, normalize, transform, batch
  return tf.data.array(data).map(transform).batch(batchSize);
};

// train the model against the training data
const trainModel = async function (model, trainingData, epochs = epochsValue) {
  let started;

  const options = {
    epochs,
    verbose: 0,
    callbacks: [
      // tf.callbacks.earlyStopping({ monitor: 'meanAbsoluteError' }),
      new tf.CustomCallback({
        onEpochBegin: async (epoch) => {
          console.log(`Epoch ${epoch + 1} of ${epochs} ...`);
          if (!started && epoch > 0) started = Date.now();
        },
      }),
      new tf.CustomCallback({
        onEpochEnd: async (epoch, logs) => {
          // console.log({ logs });
          // console.log(`  train-set loss: ${logs.loss.toFixed(4)}`);
          // console.log(`  train-set accuracy: ${logs.acc.toFixed(4)}`)
          const elapsed = Date.now() - started;

          let msPerIteration;
          let speed;
          const remainingIterations = epochsValue - epoch - 1;
          let remainingHours;

          if (epoch > 0) {
            msPerIteration = elapsed / epoch;
            speed = `${((60 * 60 * 1000) / msPerIteration).toFixed(1)}/h`;
            remainingHours = ((msPerIteration * remainingIterations) / 1000 / 60 / 60).toFixed(2);
          }

          //  lastLog = { lessonType, lessonName, error, iterations, speed };
          console.log({
            ...logs,
            completed: `${epoch + 1} / ${epochsValue}`,
            speed,
            remainingHours,
          });
        },
      }),
    ],
  };

  return await model.fitDataset(trainingData, options);
};

// verify the model against the test data
const evaluateModel = async function (model, testingData) {
  const evalResult = await model.evaluateDataset(testingData);
  const [loss, meanAbsoluteError] = evalResult.map((r) =>
    r
      .dataSync()
      .join()
      .split()
      .map((n) => Number(n).toFixed(5))
      .join(', '),
  );

  const result = { loss, meanAbsoluteError };
  console.log(result);
  await fs.writeFile(
    path.resolve(saveModelPath, 'evaluation.json'),
    JSON.stringify({ ...result, evalResult }, null, 2),
    'utf8',
  );

  return result;
};

// run
const run = async function () {
  const trainData = loadData(lesson.train);
  const testData = loadData(lesson.test);

  const model = buildModel();
  model.summary();

  // console.log(summary);

  const info = await trainModel(model, trainData);
  console.log(info);

  console.log('Saving model...');
  await model.save(`file://${saveModelPath}`);
  await fs.writeFile(path.resolve(saveModelPath, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  await fs.writeFile(path.resolve(saveModelPath, 'source.js'), sourceCode, 'utf8');

  console.log('Evaluating model...');
  const { meanAbsoluteError } = await evaluateModel(model, testData);

  await fs.rename(saveModelPath, saveModelPath.replace(startTime, `${meanAbsoluteError}-${startTime}`));
};

let ran = false;
const logAndRun = () => {
  if (ran) return;
  ran = true;
  jsonStream.destroy();

  console.log('loading completed.');
  console.log(`loaded ${lesson.train.length} training samples.`);
  console.log(`loaded ${lesson.test.length} test samples.`);

  run();
};

const addCastling = ({ arr, castling }) => {
  // mutating for performance
  const setTo1 = (index) => (arr[(index + 1) * inUnits - 2] = 1);

  // if (castling.includes('q')) [0, 1, 2, 3, 4].forEach(setTo1);
  // if (castling.includes('k')) [4, 5, 6, 7].forEach(setTo1);
  // if (castling.includes('Q')) [56, 57, 58, 59, 60].forEach(setTo1);
  // if (castling.includes('K')) [60, 61, 62, 63].forEach(setTo1);

  if (castling.includes('q')) [0, 4].forEach(setTo1);
  if (castling.includes('k')) [4, 7].forEach(setTo1);
  if (castling.includes('Q')) [56, 60].forEach(setTo1);
  if (castling.includes('K')) [60, 63].forEach(setTo1);
};

const addEnPassant = ({ arr, enPassant }) => {
  if (enPassant === '-') return;

  const index = 8 * (8 - Number(enPassant[1])) + (enPassant.charCodeAt(0) - 97);
  arr[(index + 1) * inUnits - 1] = 1;
};

const fenToFlatArray = ({ fenStr }) => {
  const [board, nextChar, castling, enPassant] = fenStr.split(' ');
  const wn = nextChar === 'w';
  const arr = [];

  board.split('').forEach((char) => {
    switch (char) {
      case 'p':
        arr.push(wn, 1, 0, 0, 0, 0, 0); //, 0, 0);
        break;
      case 'b':
        arr.push(wn, 0, 1, 0, 0, 0, 0); //, 0, 0);
        break;
      case 'n':
        arr.push(wn, 0, 0, 1, 0, 0, 0); //, 0, 0);
        break;
      case 'r':
        arr.push(wn, 0, 0, 0, 1, 0, 0); //, 0, 0);
        break;
      case 'q':
        arr.push(wn, 0, 0, 0, 0, 1, 0); //, 0, 0);
        break;
      case 'k':
        arr.push(wn, 0, 0, 0, 0, 0, 1); //, 0, 0);
        break;

      case 'P':
        arr.push(wn, -1, 0, 0, 0, 0, 0); //, 0, 0);
        break;
      case 'B':
        arr.push(wn, 0, -1, 0, 0, 0, 0); //, 0, 0);
        break;
      case 'N':
        arr.push(wn, 0, 0, -1, 0, 0, 0); //, 0, 0);
        break;
      case 'R':
        arr.push(wn, 0, 0, 0, -1, 0, 0); //, 0, 0);
        break;
      case 'Q':
        arr.push(wn, 0, 0, 0, 0, -1, 0); //, 0, 0);
        break;
      case 'K':
        arr.push(wn, 0, 0, 0, 0, 0, -1); //, 0, 0);
        break;

      case '/':
        break;

      default:
        // arr.push(...Array.from({ length: Number(char) }).map(() => 0.5));
        for (let emptyIndex = 0; emptyIndex < Number(char); emptyIndex += 1) arr.push(wn, 0, 0, 0, 0, 0, 0); //, 0, 0);
      // arr.push(...new Array(Number(char) * 12).fill(0));
    }
  });

  // addCastling({ arr, castling });
  // addEnPassant({ arr, enPassant });

  return arr;
};

// const getScoresForDepths = (scoresPerDepth, depths, fileName) => {
//   try {
//     return depths
//       .map((depth) => {
//         const { cp, mate, bmc } = scoresPerDepth[depth];
//         return [mate === null ? cp : (1 / mate) * 1000, bmc];
//       })
//       .flat();
//   } catch (e) {
//     console.log({ scoresPerDepth, depths, e, fileName });
//     throw e;
//   }
// };
// const stats = { minCp: 0, maxCp: 0, minMate: 0, maxMate: 0, minBmc: 0, maxBmc: 0 };
const getScoreForDepth = (scoresPerDepth, wNext, depth) => {
  try {
    const { cp, mate, bmc } = scoresPerDepth[depth];
    // if (cp < stats.minCp) stats.minCp = cp;
    // if (cp > stats.maxCp) stats.maxCp = cp;
    // if (mate < stats.minMate) stats.minMate = mate;
    // if (mate > stats.maxMate) stats.maxMate = mate;
    // if (bmc < stats.minBmc) stats.minBmc = bmc;
    // if (bmc > stats.maxBmc) stats.maxBmc = bmc;
    // if (Math.random() > 0.99) console.log(stats);

    let score =
      mate === null ? Math.min(7000, Math.max(-7000, cp)) / 16000 + 0.5 : mate > 0 ? 1 - mate / 100 : 0 - mate / 100;

    if (!wNext) score = 1 - score;
    return score;
  } catch (e) {
    console.log({ scoresPerDepth, wNext, depth });
    throw e;
  }
};

const start = async () => {
  try {
    sourceCode = await fs.readFile('./build-model.js', 'utf8');

    const { getNextGame } = await readGames({ folderName });

    while (lesson.train.length < maxSampleSize) {
      const { game, gameIndex, fileName } = await getNextGame();
      if (!game) break;

      const { fens, result } = game;

      // fens.pop();

      for (const {
        fenStr,
        stockfishScores: {
          eval: _eval,
          search: { scoresPerDepth },
        },
      } of fens) {
        // console.log({ index, fenStr, wn, bn });

        // we don't learn mate now. The engine will know what to do anyways
        if (!scoresPerDepth || scoresPerDepth.length === 0) continue;

        // if (bn){
        lesson[gameIndex % 50 === 0 ? 'test' : 'train'].push({
          xs: fenToFlatArray({ fenStr }),
          ys: [_eval / 168 + 0.5],
          // ys: [getScoreForDepth(scoresPerDepth, fenStr.split(' ')[1] === 'w', depthToLearn)],
          // ys: [_eval, ...getScoresForDepths(scoresPerDepth, [0, 1, 2, 3], fileName)],
        });
        // }
        if (lesson.train.length % 5000 === 0 /*&& bn*/) {
          console.log(`loaded ${lesson.train.length} training samples.`);
          console.log(`loaded ${lesson.test.length} test samples.`);
          console.log('');
        }
      }
    }

    // await fs.writeFile('./samplesBn500k.json', JSON.stringify(lesson), 'utf8');

    logAndRun();
  } catch (e) {
    console.error(e);
  }
};

start();
