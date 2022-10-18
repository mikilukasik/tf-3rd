import * as tf from '@tensorflow/tfjs-node';

const outUnits = 1792;
const inputLength = 12 + 2; //pieces + cellHistory (lmf & lmt)

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
    .relu({ name: `${layerNamePrefix}__relu-${Math.random().toString().slice(2)}` })
    .apply(conv1);
  return activated;
};

const buildModel = function ({ layerNamePrefix }) {
  const input = tf.input({ shape: [8, 8, inputLength], name: `${layerNamePrefix}__input` });

  const conv3a = convBlock({ input, kernelSize: 4, filters: 64, layerNamePrefix });
  const flat3a = tf.layers
    .flatten({
      name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(conv3a);

  const conv3b = convBlock({ input: conv3a, kernelSize: 4, filters: 64, layerNamePrefix });
  const flat3b = tf.layers
    .flatten({
      name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(conv3b);

  const conv3c = convBlock({ input: conv3b, kernelSize: 4, filters: 64, layerNamePrefix });
  const flat3c = tf.layers
    .flatten({
      name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(conv3c);

  const concatenated1 = tf.layers
    .concatenate({ name: `${layerNamePrefix}__concatenate-${Math.random().toString().slice(2)}` })
    .apply([flat3a, flat3b, flat3c]);

  const dense1 = tf.layers
    .dense({
      units: outUnits * 4,
      activation: tf.relu,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(concatenated1);
  const dense2 = tf.layers
    .dense({
      units: outUnits * 2,
      activation: tf.relu,
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

// const saveModel = async ({ model, folder, info }) => {
//   console.log('Saving model...');
//   await model.save(`file://${folder}`);
//   if (info) await fs.writeFile(path.resolve(folder, 'info.json'), JSON.stringify(info, null, 2), 'utf8');
//   await fs.writeFile(path.resolve(folder, 'createModel.js'), createCode, 'utf8');
//   // await fs.writeFile(path.resolve(folder, 'transform.js'), transformCode, 'utf8');
//   await fs.writeFile(path.resolve(folder, 'constants.json'), JSON.stringify(constants, null, 2), 'utf8');
// };

export const createSmallOneHotModel = function ({ layerNamePrefix = Math.random().toString().slice(2) }) {
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
