const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

const modelDirName = 'models/2sizesNewV2';

const outUnits = 134;
const castlingIndex = 0;
const enPassantIndex = 0;
const inputLength = 12 * 3 + 2; //12 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);

const needsWNext = true;
const needsPieceVals = true;

let createCode;
// let transformCode;

const constants = {
  modelDirName,
  outUnits,
  castlingIndex,
  enPassantIndex,
  inputLength,
  needsWNext,
  needsPieceVals,
};

const conv = ({ filters, kernelSize }) =>
  tf.layers.conv2d({
    filters,
    kernelSize,
    padding: 'same',
    // activation,
    useBias: false,
  });

const convBlock = ({ input, filters, kernelSize }) => {
  const conv1 = conv({ filters, kernelSize }).apply(input);
  const activated = tf.layers.leakyReLU().apply(conv1);
  return activated;
};

const buildModel = function () {
  const input = tf.input({ shape: [8, 8, inputLength] });

  const conv1a = convBlock({ input, kernelSize: 8, filters: 64 });
  const conv1b = convBlock({ input: conv1a, kernelSize: 8, filters: 128 });
  const flat1 = tf.layers.flatten().apply(conv1b);

  const conv2a = convBlock({ input, kernelSize: 5, filters: 64 });
  const conv2b = convBlock({ input: conv2a, kernelSize: 5, filters: 128 });
  const flat2 = tf.layers.flatten().apply(conv2b);

  // const conv3a = convBlock({ input, kernelSize: 3, filters: 32 });
  // const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 48 });
  // const flat3 = tf.layers.flatten().apply(conv3b);

  const concatenated1 = tf.layers.concatenate().apply([flat1, flat2]);
  // const norm1 = tf.layers.batchNormalization().apply(concatenated1);

  const dense1 = tf.layers.dense({ units: 1024, activation: tf.leakyReLU, useBias: false }).apply(concatenated1);
  const dense2 = tf.layers.dense({ units: 512, activation: tf.leakyReLU, useBias: false }).apply(dense1);

  const output = tf.layers.dense({ units: outUnits, useBias: false }).apply(dense2);

  const model = tf.model({ inputs: input, outputs: output });
  return model;
};

const saveModel = async ({ model, folder, info }) => {
  console.log('Saving model...');
  await model.save(`file://${folder}`);
  if (info) await fs.writeFile(path.resolve(folder, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
  await fs.writeFile(path.resolve(folder, 'createModel.js'), createCode, 'utf8');
  // await fs.writeFile(path.resolve(folder, 'transform.js'), transformCode, 'utf8');
  await fs.writeFile(path.resolve(folder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
};

const run = async function () {
  const { folder } = await init();

  const model = buildModel();
  model.summary();

  await saveModel({ model, folder: folder });

  console.log('DONE');
};

const init = async () => {
  try {
    createCode = await fs.readFile('./createModel.js', 'utf8');
    // transformCode = await fs.readFile('./transform.js', 'utf8');

    const folder = path.resolve(modelDirName);
    await fs.mkdir(folder, { recursive: true });
    // await fs.writeFile(path.resolve(folder, 'source.js'), createCode, 'utf8');
    // await fs.writeFile(path.resolve(folder, 'transform.js'), transformCode, 'utf8');
    // await fs.writeFile(path.resolve(folder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');

    return { folder };
  } catch (e) {
    console.error(e);
  }
};

run();
