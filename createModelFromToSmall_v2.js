const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

const versionName = 'v2';
const modelName = 'fromto_S';

const modelDirName = `models/${modelName}_${versionName}`;
const outUnits = 128; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign
const inputLength = 14; //pieces + cellHistory (lmf & lmt)

const conv = ({ filters, kernelSize }) =>
  tf.layers.conv2d({
    filters,
    kernelSize,
    padding: 'same',
    useBias: false,
    name: `${versionName}__conv2d_k${kernelSize}f${filters}-${Math.random().toString().slice(2)}`,
    // kernelInitializer: tf.initializers.randomUniform({ minval: -0.1, maxval: 1.5 }),
  });

const convBlock = ({ input, filters, kernelSize }) => {
  const conv1 = conv({ filters, kernelSize }).apply(input);
  const activated = tf.layers
    .leakyReLU({
      name: `${versionName}__leakyReLU-${Math.random().toString().slice(2)}`,

      // kernelInitializer: tf.initializers.randomUniform({ minval: -0.1, maxval: 1.5 }),
    })
    .apply(conv1);
  return activated;
};

const denseLayer = ({ input, units, activation }) =>
  tf.layers
    .dense({
      units,
      activation: activation ?? tf.leakyReLU,
      useBias: false,
      name: `${versionName}__dense_${activation ?? 'leakyReLU'}_u${units}-${Math.random().toString().slice(2)}`,
      // kernelInitializer: tf.initializers.randomUniform({ minval: -0.1, maxval: 1.5 }),
    })
    .apply(input);

const flattenLayer = ({ input }) =>
  tf.layers
    .flatten({
      name: `${versionName}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const concatLayer = (inputs) =>
  tf.layers
    .concatenate({
      name: `${versionName}__concat-${Math.random().toString().slice(2)}`,
    })
    .apply(inputs);

const outputLayer = ({ input }) =>
  tf.layers
    .dense({
      units: outUnits,
      useBias: false,
      activation: 'softmax',
      name: `${versionName}__softmax_output-${Math.random().toString().slice(2)}`,
      // kernelInitializer: tf.initializers.randomUniform({ minval: -0.1, maxval: 1.5 }),
    })
    .apply(input);

const buildModel = function () {
  const input = tf.input({ shape: [8, 8, inputLength], name: `${versionName}__input` });

  const conv3a = convBlock({ input, kernelSize: 3, filters: 16 });
  const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 48 });

  const conv8a = convBlock({ input, kernelSize: 8, filters: 16 });
  const conv8b = convBlock({ input: conv8a, kernelSize: 8, filters: 48 });

  const flatInput = flattenLayer({ input });
  const flat3 = flattenLayer({ input: conv3b });
  const flat8 = flattenLayer({ input: conv8b });

  const concatted = concatLayer([flatInput, flat3, flat8]);

  const denseFrom1 = denseLayer({ input: concatted, units: 768 });
  const denseTo1 = denseLayer({ input: concatted, units: 256 });

  const denseFrom2 = denseLayer({ input: denseFrom1, units: 768 });
  const denseTo2 = denseLayer({ input: denseTo1, units: 256 });

  const softMaxFrom = denseLayer({ input: concatLayer([flatInput, denseFrom2]), units: 64, activation: 'softmax' });
  const softMaxTo = denseLayer({ input: concatLayer([flatInput, denseTo2]), units: 64, activation: 'softmax' });

  const concatenatedOut = concatLayer([softMaxFrom, softMaxTo]);

  // const output = outputLayer({ input: dense2 });

  return tf.model({ inputs: input, outputs: concatenatedOut });
};

const saveModel = async ({ model }) => {
  console.log('Saving model...');
  const folder = path.resolve(modelDirName);
  await fs.mkdir(folder, { recursive: true });

  await model.save(`file://${folder}`);
  await fs.copyFile(path.resolve(__filename), path.resolve(folder, `createModel${path.extname(__filename)}`));
};

const run = async function () {
  const model = buildModel();
  model.summary();

  await saveModel({ model });

  console.log('DONE');
};

run();