const tf = require('@tensorflow/tfjs-node');
const { readGames } = require('./src/utils/read-games');
const fs = require('fs').promises;
const path = require('path');

const { transform } = require('./transform');

const folderName = 'recent/OTB-HQ/otb_1800_chkmt';

const maxSampleSize = 10000000;
const dataSetSize = 1000000;
const outputMultiplier = 1.5;
const outUnits = 1;

const castlingIndex = 0;
const enPassantIndex = 0;
const inputLength = 7 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);

const batchSize = 800;
const epochsValue = 30;
const patience = 30;
const dropoutRate = 0.1;
const bucketConfig = {
  '>  0.002': (x) => x > 0.002,
  '     ~ 0': (x) => x >= -0.002 && x <= 0.002,
  '< -0.002': (x) => x < -0.002,
};

const startTime = Date.now();
const saveModelPath = path.resolve(`./results/${startTime}_s${Math.floor(maxSampleSize / 1000)}k_e${epochsValue}`);

let sourceCode;
let transformCode;

const constants = {
  folderName,
  maxSampleSize,
  outUnits,
  castlingIndex,
  enPassantIndex,
  inputLength,
  batchSize,
  epochsValue,
  patience,
  outputMultiplier,
  dropoutRate,
  bucketConfig,
  dataSetSize,
  startTime,
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

  const conv1 = conv(48, 'tanh').apply(input);
  const flat1 = tf.layers.flatten().apply(conv1);
  const dense2 = tf.layers.dense({ units: 64, activation: 'linear' }).apply(flat1);

  const output = tf.layers.dense({ units: outUnits, activation: 'tanh' }).apply(dense2);

  // compile the model
  const model = tf.model({ inputs: input, outputs: output });
  model.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: [tf.metrics.meanAbsoluteError],
  });

  return model;
};

const lesson = {
  buckets: {},
  train: [],
  test: [],
  fileNames: {},
};

const outputStats = {
  min: 0,
  max: 0,
};

// const bucketBoundries = Array(buckets + 1)
//   .fill(0)
//   .map((e, index) => 1 - (index * 2) / buckets);
const bucketNames = Object.keys(bucketConfig);
const bucketNameCount = bucketNames.length;
const getBucketName = (val) => bucketNames.find((bucketName) => bucketConfig[bucketName](val));

let ignoredSamples = 0;
let acceptedSamples = 0;
const addToBucket = ({ input, output: _output, fileName }) => {
  const output = _output * outputMultiplier;
  // if (output < -1 || output > 1) {
  //   // console.warn(`Output ${output} is out of range in ${fileName}`);
  //   ignoredSamples += 1;
  //   return;
  // }

  // if (output <= -0.6 || output >= 0.6) {
  //   // console.warn(`Output ${output} is out of range in ${fileName}`);
  //   ignoredSamples += 1;
  //   return;
  // }

  // if (output !== 1 && output !== -1) {
  //   output = Math.min(Math.max(output * outputMultiplier, -0.99), 0.99);
  // }

  const bucketName = getBucketName(output);
  // const bucketName = Math.floor(output * (buckets / 2));
  if (!lesson.buckets[bucketName]) lesson.buckets[bucketName] = [];

  if (lesson.buckets[bucketName].length >= maxSampleSize / bucketNameCount) {
    // bucket is full
    ignoredSamples += 1;

    return;
  }

  acceptedSamples += 1;
  lesson.fileNames[fileName] = true;
  lesson.buckets[bucketName].push({
    xs: input,
    ys: [output],
  });

  if (outputStats.min > output) outputStats.min = output;
  if (outputStats.max < output) outputStats.max = output;
};

const pourBuckets = async () => {
  console.log('Creating train and test datasets');
  console.log({ outputStats });

  Object.keys(lesson.buckets).forEach((bucketName) => {
    console.log(`${bucketName} ${lesson.buckets[bucketName].length}`);
    lesson.buckets[bucketName].sort(() => Math.random() - 0.5);

    const tenProcent = Math.floor(lesson.buckets[bucketName].length / 10);
    lesson.train = lesson.train.concat(lesson.buckets[bucketName].splice(tenProcent));
    lesson.test = lesson.test.concat(lesson.buckets[bucketName]);
  });
  delete lesson.buckets;

  await fs.writeFile(
    path.resolve(saveModelPath, 'fileNames.json'),
    JSON.stringify(Object.keys(lesson.fileNames)),
    'utf8',
  );
};

// Build, train a model with a subset of the data

// load and normalize data
const loadData = function (data) {
  const transform = ({ xs, ys }) => {
    return {
      xs: tf.tensor(xs, [8, 8, inputLength]),
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

          let msPerIteration;
          let speed;
          const remainingIterations = epochsValue - epoch - 1;
          let remainingHours;

          // if (epoch > 0) {
          msPerIteration = elapsed / (epoch + 1);
          speed = `${((60 * 60 * 1000) / msPerIteration).toFixed(1)}/h`;
          remainingHours = ((msPerIteration * remainingIterations) / 1000 / 60 / 60).toFixed(2);
          // }

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

  const info = await trainModel(model, trainData);
  console.log(info);

  console.log('Saving model...');
  await model.save(`file://${saveModelPath}`);
  await fs.writeFile(path.resolve(saveModelPath, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  await fs.writeFile(path.resolve(saveModelPath, 'source.js'), sourceCode, 'utf8');
  await fs.writeFile(path.resolve(saveModelPath, 'transform.js'), transformCode, 'utf8');
  await fs.writeFile(path.resolve(saveModelPath, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');

  console.log('Evaluating model...');
  const { meanAbsoluteError } = await evaluateModel(model, testData);

  await fs.rename(saveModelPath, saveModelPath.replace(startTime, `${meanAbsoluteError}-${startTime}`));
};

let ran = false;
const logAndRun = () => {
  if (ran) return;
  ran = true;

  console.log('loading completed.');
  console.log(`loaded ${lesson.train.length} training samples.`);
  console.log(`loaded ${lesson.test.length} test samples.`);

  run();
};

const start = async () => {
  try {
    sourceCode = await fs.readFile('./train.js', 'utf8');
    transformCode = await fs.readFile('./transform.js', 'utf8');
    await fs.mkdir(path.resolve(saveModelPath), { recursive: true });

    const { getNextGame } = await readGames({ folderName });

    // const outputStats = {
    //   min: 0,
    //   max: 0,
    // };

    while (acceptedSamples < maxSampleSize) {
      const { game, gameIndex, fileName } = await getNextGame();
      if (!game) break;

      const { fens, result } = game;
      const fensCount = fens.length;

      for (const [
        fenIndex,
        {
          fenStr,
          stockfishScores: { eval: _eval },
          balanceDiffsAhead,
          balance,
        },
      ] of fens.entries()) {
        // const output = _eval / 180 + 0.5; // / 168 + 0.5;

        // const progress = Math.pow((fenIndex + 1) / fensCount, 3) / 2;
        // const output = 0.5 + (result.bw ? -progress : 0) + (result.ww ? progress : 0);

        const output =
          (balance +
            balanceDiffsAhead[2] / 2 +
            balanceDiffsAhead[4] / 4 +
            balanceDiffsAhead[6] / 8 +
            balanceDiffsAhead[8] / 16 +
            balanceDiffsAhead[10] / 32 +
            balanceDiffsAhead[12] / 64 +
            balanceDiffsAhead[14] / 128 +
            balanceDiffsAhead[16] / 256 +
            balanceDiffsAhead[18] / 521) /
          80;

        // const output =
        //   fenIndex === fensCount - 1
        //     ? result.ww
        //       ? 1
        //       : result.bw
        //       ? -1
        //       : 0
        //     : balance /*+ balanceDiffsAhead[2]*/ / //+
        //       // balanceDiffsAhead[4] / 2 +
        //       // balanceDiffsAhead[6] / 3 +
        //       // balanceDiffsAhead[8] / 4) /
        //       59;

        // if (outputStats.min > output) outputStats.min = output;
        // if (outputStats.max < output) outputStats.max = output;

        addToBucket({ input: transform({ fenStr, castlingIndex, enPassantIndex, inputLength }), output, fileName });

        if ((acceptedSamples + ignoredSamples) % 100000 === 0) {
          console.log(acceptedSamples, maxSampleSize);
          console.log(`accepted ${acceptedSamples} samples.`);
          console.log(`ignored ${ignoredSamples} samples.`);
          Object.keys(lesson.buckets).forEach((bucketName) => {
            console.log(`${bucketName} ${(lesson.buckets[bucketName] || []).length}`);
          });
          console.log('');
        }
      }
    }

    await pourBuckets();
    // console.log({ outputStats });

    // await fs.writeFile('./samplesBn500k.json', JSON.stringify(lesson), 'utf8');

    logAndRun();
  } catch (e) {
    console.error(e);
  }
};

start();
