const tf = require('@tensorflow/tfjs-node');
const fs = require('fs').promises;
const path = require('path');

const modelDirName = 'models/inc2';
const outUnits = 1792;
const inputLength = 12 + 2; //pieces + cellHistory (lmf & lmt)

const castlingIndex = 0;
const enPassantIndex = 0;

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

const conv = ({ filters, kernelSize, layerNamePrefix }) =>
  tf.layers.conv2d({
    filters,
    kernelSize,
    padding: 'same',
    // activation,
    useBias: false,
    name: `${layerNamePrefix}__conv2d-${Math.random().toString().slice(2)}`,
  });

const convBlock = ({ input, filters, kernelSize, layerNamePrefix }) => {
  const conv1 = conv({ filters, kernelSize, layerNamePrefix }).apply(input);
  const activated = tf.layers
    .reLU({ name: `${layerNamePrefix}__reLU-${Math.random().toString().slice(2)}` })
    .apply(conv1);
  return activated;
};
const buildModel = function ({ layerNamePrefix }) {
  const input = tf.input({ shape: [8, 8, inputLength], name: `${layerNamePrefix}__input` });

  const conv3a = convBlock({ input, kernelSize: 3, filters: 32, layerNamePrefix });
  const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 64, layerNamePrefix });
  const conv3c = convBlock({ input: conv3b, kernelSize: 3, filters: 128, layerNamePrefix });
  const conv3d = convBlock({ input: conv3c, kernelSize: 3, filters: 256, layerNamePrefix });
  // const flat3a = tf.layers
  //   .flatten({
  //     name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
  //   })
  //   .apply(conv3a);

  // const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 64, layerNamePrefix });
  const flat3b = tf.layers
    .flatten({
      name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(conv3d);

  // const conv3c = convBlock({ input: conv3b, kernelSize: 4, filters: 64, layerNamePrefix });
  // const flat3c = tf.layers
  //   .flatten({
  //     name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
  //   })
  //   .apply(conv3c);

  // const concatenated1 = tf.layers
  //   .concatenate({ name: `${layerNamePrefix}__concatenate-${Math.random().toString().slice(2)}` })
  //   .apply([flat3a, flat3b]);

  const dense1 = tf.layers
    .dense({
      units: outUnits * 2,
      activation: tf.reLU,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(flat3b);
  const dense2 = tf.layers
    .dense({
      units: outUnits * 2,
      activation: tf.reLU,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(dense1);

  const output = tf.layers
    .dense({
      units: outUnits,
      useBias: false,
      activation: 'softmax',
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(dense2);

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

  const model = buildModel({ layerNamePrefix: modelDirName });
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
