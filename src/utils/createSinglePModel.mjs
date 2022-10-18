import * as tf from '@tensorflow/tfjs-node';
// const fs = require('fs').promises;
// const path = require('path');

const outUnits = 134;
const castlingIndex = 0;
const enPassantIndex = 0;
const inputLength = 12 * 3 + 2; //12 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);

const needsWNext = true;
const needsPieceVals = true;

let createCode;
// let transformCode;

const constants = {
  // modelDirName,
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
    .leakyReLU({ name: `${layerNamePrefix}__leakyReLU-${Math.random().toString().slice(2)}` })
    .apply(conv1);
  return activated;
};

const buildModel = function ({ layerNamePrefix }) {
  const input = tf.input({ shape: [8, 8, inputLength], name: `${layerNamePrefix}__input` });

  const conv1a = convBlock({ input, kernelSize: 8, filters: 64, layerNamePrefix });
  const conv1b = convBlock({ input: conv1a, kernelSize: 8, filters: 128, layerNamePrefix });
  const flat1 = tf.layers
    .flatten({ name: `${layerNamePrefix}__flat-${Math.random().toString().slice(2)}` })
    .apply(conv1b);

  const conv2a = convBlock({ input, kernelSize: 5, filters: 64, layerNamePrefix });
  const conv2b = convBlock({ input: conv2a, kernelSize: 5, filters: 128, layerNamePrefix });
  const flat2 = tf.layers
    .flatten({ name: `${layerNamePrefix}__flat-${Math.random().toString().slice(2)}` })
    .apply(conv2b);

  // const conv3a = convBlock({ input, kernelSize: 3, filters: 32 });
  // const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 48 });
  // const flat3 = tf.layers.flatten().apply(conv3b);

  const concatenated1 = tf.layers
    .concatenate({ name: `${layerNamePrefix}__concatenate-${Math.random().toString().slice(2)}` })
    .apply([flat1, flat2]);
  // const norm1 = tf.layers.batchNormalization().apply(concatenated1);

  const dense1 = tf.layers
    .dense({
      units: 1024,
      activation: tf.leakyReLU,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(concatenated1);
  const dense2 = tf.layers
    .dense({
      units: 512,
      activation: tf.leakyReLU,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(dense1);

  const output = tf.layers
    .dense({ units: outUnits, useBias: false, name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}` })
    .apply(dense2);

  const model = tf.model({ inputs: input, outputs: output });
  return model;
};

// const saveModel = async ({ model, folder, info }) => {
//   console.log('Saving model...');
//   await model.save(`file://${folder}`);
//   if (info) await fs.writeFile(path.resolve(folder, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
//   await fs.writeFile(path.resolve(folder, 'createModel.js'), createCode, 'utf8');
//   // await fs.writeFile(path.resolve(folder, 'transform.js'), transformCode, 'utf8');
//   await fs.writeFile(path.resolve(folder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
// };

export const createSinglePModel = function ({ layerNamePrefix = Math.random().toString().slice(2) }) {
  // const { folder } = await init();

  const model = buildModel({ layerNamePrefix });
  // model.summary();

  // await saveModel({ model, folder: folder });

  // console.log('DONE');
  return model;
};

// const init = async () => {
//   try {
//     createCode = await fs.readFile('./createModel.js', 'utf8');
//     // transformCode = await fs.readFile('./transform.js', 'utf8');

//     const folder = path.resolve(modelDirName);
//     await fs.mkdir(folder, { recursive: true });
//     // await fs.writeFile(path.resolve(folder, 'source.js'), createCode, 'utf8');
//     // await fs.writeFile(path.resolve(folder, 'transform.js'), transformCode, 'utf8');
//     // await fs.writeFile(path.resolve(folder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');

//     return { folder };
//   } catch (e) {
//     console.error(e);
//   }
// };

// run();
