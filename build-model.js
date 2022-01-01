const tf = require('@tensorflow/tfjs-node-gpu');
const StreamArray = require('stream-json/streamers/StreamArray');
const { readGames } = require('./src/utils/read-games');
const fs = require('fs').promises;
const path = require('path');

const folderName = 'otb_2000+_chkmt/2000+chkmt';
const maxSampleSize = 2500000;

const numOfClasses = 1;

const imageWidth = 8;
const imageHeight = 8;
const imageChannels = 7;

const batchSize = 1000;
const epochsValue = 400;

// Define the model architecture
const buildModel = function () {
  const model = tf.sequential();

  // add the model layers
  // model.add(
  //   tf.layers.conv2d({
  //     inputShape: [imageWidth, imageHeight, imageChannels],
  //     filters: 32,
  //     kernelSize: 5,
  //     padding: 'same',
  //     activation: 'sigmoid',
  //   }),
  // );

  model.add(
    tf.layers.conv2d({
      inputShape: [imageWidth, imageHeight, imageChannels],
      filters: 64,
      kernelSize: 8,
      padding: 'same',
      activation: 'sigmoid',
      // strides: 1,
    }),
  );

  // model.add(
  //   tf.layers.maxPooling2d({
  //     poolSize: 2,
  //     strides: 2,
  //   }),
  // );

  model.add(
    tf.layers.conv2d({
      filters: 64,
      kernelSize: 8,
      padding: 'same',
      activation: 'sigmoid',
      // strides: 1,
    }),
  );

  // model.add(
  //   tf.layers.maxPooling2d({
  //     poolSize: 2,
  //     strides: 2,
  //   }),
  // );

  model.add(tf.layers.flatten());

  model.add(
    tf.layers.dense({
      units: 64,
      activation: 'sigmoid',
    }),
  );

  // model.add(
  //   tf.layers.dense({
  //     units: 64,
  //     activation: 'sigmoid',
  //   }),
  // );

  model.add(
    tf.layers.dense({
      units: numOfClasses,
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
      xs: tf.tensor(xs, [imageWidth, imageHeight, imageChannels]),
      ys: tf.tensor1d(ys),
    };
  };

  // load, normalize, transform, batch
  return (
    tf.data
      .array(data)
      // .csv(dataUrl, {columnConfigs: {label: {isLabel: true}}})
      .map(transform)
      .batch(batchSize)
  );
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

const fenToFlatArray = ({ fenStr, wn: _wn }) => {
  const wn = _wn ? 1 : 0;
  const resultingArray = [];
  fenStr.split('').forEach((char) => {
    // switch (char) {
    //   case 'p':
    //     resultingArray.push(0, 0.1);
    //     break;
    //   case 'b':
    //     resultingArray.push(0, 0.2);
    //     break;
    //   case 'n':
    //     resultingArray.push(0, 0.3);
    //     break;
    //   case 'r':
    //     resultingArray.push(0, 0.4);
    //     break;
    //   case 'q':
    //     resultingArray.push(0, 0.6);
    //     break;
    //   case 'k':
    //     resultingArray.push(0, 1);
    //     break;

    //   case 'P':
    //     resultingArray.push(0.1, 0);
    //     break;
    //   case 'B':
    //     resultingArray.push(0.2, 0);
    //     break;
    //   case 'N':
    //     resultingArray.push(0.3, 0);
    //     break;
    //   case 'R':
    //     resultingArray.push(0.4, 0);
    //     break;
    //   case 'Q':
    //     resultingArray.push(0.6, 0);
    //     break;
    //   case 'K':
    //     resultingArray.push(1, 0);
    //     break;

    //   case '/':
    //     break;

    //   default:
    //     resultingArray.push(...new Array(Number(char) * 2).fill(0));
    // }

    switch (char) {
      case 'p':
        resultingArray.push(wn, 1, 0, 0, 0, 0, 0);
        break;
      case 'b':
        resultingArray.push(wn, 0, 1, 0, 0, 0, 0);
        break;
      case 'n':
        resultingArray.push(wn, 0, 0, 1, 0, 0, 0);
        break;
      case 'r':
        resultingArray.push(wn, 0, 0, 0, 1, 0, 0);
        break;
      case 'q':
        resultingArray.push(wn, 0, 0, 0, 0, 1, 0);
        break;
      case 'k':
        resultingArray.push(wn, 0, 0, 0, 0, 0, 1);
        break;

      case 'P':
        resultingArray.push(wn, -1, 0, 0, 0, 0, 0);
        break;
      case 'B':
        resultingArray.push(wn, 0, -1, 0, 0, 0, 0);
        break;
      case 'N':
        resultingArray.push(wn, 0, 0, -1, 0, 0, 0);
        break;
      case 'R':
        resultingArray.push(wn, 0, 0, 0, -1, 0, 0);
        break;
      case 'Q':
        resultingArray.push(wn, 0, 0, 0, 0, -1, 0);
        break;
      case 'K':
        resultingArray.push(wn, 0, 0, 0, 0, 0, -1);
        break;

      case '/':
        break;

      default:
        // resultingArray.push(...Array.from({ length: Number(char) }).map(() => 0.5));
        for (let emptyIndex = 0; emptyIndex < Number(char); emptyIndex += 1) resultingArray.push(wn, 0, 0, 0, 0, 0, 0);
      // resultingArray.push(...new Array(Number(char) * 12).fill(0));
    }
  });
  return resultingArray;
};

const start = async () => {
  try {
    sourceCode = await fs.readFile('./build-model.js', 'utf8');

    const { getNextGame } = await readGames({ folderName });

    while (lesson.train.length < maxSampleSize) {
      const { game, gameIndex } = await getNextGame();
      if (!game) break;

      const { fens, result } = game;
      for (const {
        fenStr,
        stockfishScores: { wn, bn },
      } of fens) {
        // console.log({ index, fenStr, wn, bn });

        // if (bn){
        lesson[gameIndex % 50 === 0 ? 'test' : 'train'].push({
          xs: fenToFlatArray({ fenStr, wn, bn }),
          ys: [bn],
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
