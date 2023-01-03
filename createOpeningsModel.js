const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

const creatorFilename = 'createOpeningsModel.js';

const versionName = 'v1';
const modelName = 'openings_small';

const modelDirName = `models/${modelName}_${versionName}`;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign
const inputLength = 14; //pieces + cellHistory (lmf & lmt)

const conv = ({ filters, kernelSize }) =>
  tf.layers.conv2d({
    filters,
    kernelSize,
    padding: 'same',
    useBias: false,
    name: `${versionName}__conv2d_k${kernelSize}f${filters}-${Math.random().toString().slice(2)}`,
  });

const convBlock = ({ input, filters, kernelSize }) => {
  const conv1 = conv({ filters, kernelSize }).apply(input);
  const activated = tf.layers
    .leakyReLU({ name: `${versionName}__leakyReLU-${Math.random().toString().slice(2)}` })
    .apply(conv1);
  return activated;
};

const denseLayer = ({ input, units }) =>
  tf.layers
    .dense({
      units,
      activation: tf.leakyReLU,
      useBias: false,
      name: `${versionName}__dense_leakyReLU_u${units}-${Math.random().toString().slice(2)}`,
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

const outputLayer = ({ input, activation = 'softmax' }) =>
  tf.layers
    .dense({
      units: outUnits,
      useBias: false,
      activation,
      name: `${versionName}__${activation}_output-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const buildModel = function () {
  const input = tf.input({ shape: [8, 8, inputLength], name: `${versionName}__input` });

  const conv3a = convBlock({ input, kernelSize: 3, filters: 16 });
  const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 64 });

  const conv8a = convBlock({ input, kernelSize: 8, filters: 16 });
  const conv8b = convBlock({ input: conv8a, kernelSize: 8, filters: 64 });

  const flat3 = flattenLayer({ input: conv3b });
  const flat8 = flattenLayer({ input: conv8b });

  const concatenated = concatLayer([flat3, flat8]);

  const dense1 = denseLayer({ input: concatenated, units: 256 });
  const dense2 = denseLayer({ input: dense1, units: 128 });

  const output = outputLayer({ input: dense2 });

  return tf.model({ inputs: input, outputs: output });
};

const saveModel = async ({ model }) => {
  console.log('Saving model...');
  const folder = path.resolve(modelDirName);
  await fs.mkdir(folder, { recursive: true });

  await model.save(`file://${folder}`);
  await fs.copyFile(path.resolve(creatorFilename), path.resolve(folder, creatorFilename));
};

const run = async function () {
  const model = buildModel();
  model.summary();

  await saveModel({ model });

  console.log('DONE');
};

run();