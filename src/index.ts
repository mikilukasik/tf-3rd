import * as tf from '@tensorflow/tfjs';

const numOfClasses = 1;

const imageWidth = 8;
const imageHeight = 8;
const imageChannels = 12;

const batchSize = 250;
const epochsValue = 30;

const startTime = Date.now();

const maxSampleSize = 10000;

const saveModelPath = `./results/${startTime}_2d_ch${imageChannels}_wn_s${Math.floor(
  maxSampleSize / 1000,
)}k_e${epochsValue}_b${batchSize}`;

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
      filters: 128,
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

  model.add(
    tf.layers.dense({
      units: 32,
      activation: 'sigmoid',
    }),
  );

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
    metrics: [tf.metrics.meanAbsoluteError, tf.metrics.meanAbsolutePercentageError],
  });

  return model;
};

const loadData = function (data: tf.TensorContainer[]) {
  const transform = ({ xs, ys }: { xs: any; ys: any }) => {
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
const fenToFlatArray = (fenStr: string) => {
  const resultingArray: any = [];
  fenStr.split('').forEach((char: string) => {
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
        resultingArray.push(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        break;
      case 'b':
        resultingArray.push(0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        break;
      case 'n':
        resultingArray.push(0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        break;
      case 'r':
        resultingArray.push(0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0);
        break;
      case 'q':
        resultingArray.push(0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0);
        break;
      case 'k':
        resultingArray.push(0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0);
        break;

      case 'P':
        resultingArray.push(0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0);
        break;
      case 'B':
        resultingArray.push(0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0);
        break;
      case 'N':
        resultingArray.push(0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0);
        break;
      case 'R':
        resultingArray.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0);
        break;
      case 'Q':
        resultingArray.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0);
        break;
      case 'K':
        resultingArray.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1);
        break;

      case '/':
        break;

      default:
        // resultingArray.push(...Array.from({ length: Number(char) }).map(() => 0.5));
        resultingArray.push(...new Array(Number(char) * 12).fill(0));
    }
  });
  return resultingArray;
};
const trainModel = async function (
  model: tf.Sequential,
  trainingData: tf.data.Dataset<tf.TensorContainer>,
  epochs = epochsValue,
) {
  let started: number;

  const options = {
    epochs: epochs,
    verbose: 0,
    callbacks: {
      onEpochBegin: async (epoch: number) => {
        console.log(`Epoch ${epoch + 1} of ${epochs} ...`);
        if (!started) started = Date.now();
      },
      onEpochEnd: async (epoch: number, logs: { loss: number }) => {
        console.log(logs);
        console.log(`  train-set loss: ${logs.loss.toFixed(4)}`);
        // console.log(`  train-set accuracy: ${logs.acc.toFixed(4)}`)
        const elapsed = Date.now() - started;
        const msPerIteration = elapsed / (epoch + 1);
        const speed = `${((60 * 60 * 1000) / msPerIteration).toFixed(1)}/h`;
        const remainingIterations = epochsValue - epoch - 1;
        const remainingHours = ((msPerIteration * remainingIterations) / 1000 / 60 / 60).toFixed(2);

        //  lastLog = { lessonType, lessonName, error, iterations, speed };
        console.log({
          completed: `${epoch + 1} / ${epochsValue}`,
          speed,
          remainingHours,
        });
      },
    },
  };

  return await model.fitDataset(trainingData, options);
};

const evaluateModel = async function (model: any, testingData: tf.data.Dataset<tf.TensorContainer>) {
  const evalResult = await model.evaluateDataset(testingData);
  const [loss, meanAbsoluteError, meanAbsolutePercentageError] = evalResult.map(
    (r: {
      dataSync: () => {
        (): any;
        new (): any;
        join: { (): { (): any; new (): any; split: { (): any[]; new (): any } }; new (): any };
      };
    }) =>
      r
        .dataSync()
        .join()
        .split()
        .map((n: any) => Number(n).toFixed(5))
        .join(', '),
  );

  const result = { loss, meanAbsoluteError, meanAbsolutePercentageError };
  console.log(result);
  // await fs.writeFile(
  //   path.resolve(saveModelPath, 'evaluation.json'),
  //   JSON.stringify({ ...result, evalResult }, null, 2),
  //   'utf8',
  // );

  return result;
};

const run = async function ({ lesson, model }: { lesson: any; model: any }) {
  const trainData = loadData(lesson.train);
  const testData = loadData(lesson.test);

  // const model = buildModel();
  model.summary();

  // console.log(summary);

  const info = await trainModel(model, trainData);
  console.log(info);

  console.log('Saving model...');
  await model.save(`localstorage://${saveModelPath}`);
  // await fs.writeFile(path.resolve(saveModelPath, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  // await fs.writeFile(path.resolve(saveModelPath, 'source.js'), sourceCode, 'utf8');

  console.log('Evaluating model...');
  const { meanAbsoluteError } = await evaluateModel(model, testData);

  console.log({ meanAbsoluteError });

  // await fs.rename(
  //   saveModelPath,
  //   saveModelPath.replace(startTime, `${meanAbsoluteError}-s${lesson.train.length}-e${epochsValue}-${startTime}`),
  // );
};

(async () => {
  const model = buildModel();
  console.log({ model });

  const lesson: any = { train: [], test: [] }; //(await (await fetch('/samplesWn100k.json')).json())//.slice(0, maxSampleSize);

  let nextGameIndex = 0;

  gameLoadingLoop: while (lesson.train.length < maxSampleSize) {
    console.log(`${lesson.train.length} of ${maxSampleSize}`);
    const gameBatch = await (await fetch(`/games?skip=${nextGameIndex}&limit=100`)).json();
    if (!gameBatch.length) break gameLoadingLoop;
    nextGameIndex += 100;
    // console.log({ gameBatch });
    for (const { game, gameIndex } of gameBatch) {
      // const { game, gameIndex } = await getNextGame();
      // console.log(gameIndex);
      const { fens, result } = game;
      for (const {
        fenStr,
        stockfishScores: { wn, bn },
      } of fens) {
        // console.log({ index, fenStr, wn, bn });

        if (bn)
          lesson[gameIndex % 50 === 0 ? 'test' : 'train'].push({
            xs: fenToFlatArray(fenStr),
            ys: [bn],
          });

        if (lesson.train.length % 5000 === 0 && bn) {
          console.log(`loaded ${lesson.train.length} training samples.`);
          console.log(`loaded ${lesson.test.length} test samples.`);
          console.log('');
        }
      }
    }
  }

  console.log(lesson.train.length);

  run({ lesson, model });
})();
