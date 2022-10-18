import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/inc1_v3_final';
const layerNamePrefix = 'inc1_v4';

const targetModelDirName = `models/${layerNamePrefix}`;

// const filesToCopy = ['createModel.js', 'trainIncModel.js', 'trainingMeta.json', 'transform.js', 'constants.json'];

const getLastNewLayer = ({ input }) => {
  const conv = ({ filters, kernelSize }) =>
    tf.layers.conv2d({
      filters,
      kernelSize,
      padding: 'same',
      // activation,
      useBias: false,
      name: `${layerNamePrefix}__conv2d-${Math.random().toString().slice(2)}`,
    });

  const convBlock = ({ input, filters, kernelSize }) => {
    const conv1 = conv({ filters, kernelSize }).apply(input);
    const activated = tf.layers
      .reLU({ name: `${layerNamePrefix}__reLU-${Math.random().toString().slice(2)}` })
      .apply(conv1);
    return activated;
  };

  // const buildModel = function ({ layerNamePrefix }) {
  // const input = tf.input({ shape: [8, 8, inputLength], name: `${layerNamePrefix}__input` });

  // const conv3a = convBlock({ input, kernelSize: 4, filters: 13, layerNamePrefix });
  // const flat3a = tf.layers
  //   .flatten({
  //     name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
  //   })
  //   .apply(conv3a);

  // const conv3b = convBlock({ input: conv3a, kernelSize: 4, filters: 32, layerNamePrefix });
  // const flat3b = tf.layers
  //   .flatten({
  //     name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
  //   })
  //   .apply(conv3b);

  // const conv3c = convBlock({ input: conv3b, kernelSize: 4, filters: 64, layerNamePrefix });
  // const flat3c = tf.layers
  //   .flatten({
  //     name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
  //   })
  //   .apply(conv3c);

  // const concatenated1 = tf.layers
  //   .concatenate({ name: `${layerNamePrefix}__concatenate-${Math.random().toString().slice(2)}` })
  //   .apply([flat3a, flat3b]);
  const flat3b = tf.layers
    .flatten({
      name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

  const dense1 = tf.layers
    .dense({
      units: 640,
      activation: tf.reLu,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(flat3b);
  const dense2 = tf.layers
    .dense({
      units: 1500,
      activation: tf.reLu,
      useBias: false,
      name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
    })
    .apply(dense1);

  // const output = tf.layers
  //   .dense({
  //     units: outUnits,
  //     useBias: false,
  //     activation: 'softmax',
  //     name: `${layerNamePrefix}__dense-${Math.random().toString().slice(2)}`,
  //   })
  //   .apply(dense2);

  // const model = tf.model({ inputs: input, outputs: output });
  return dense2;
  // };
};

const getTweakedModel = ({ sourceModel }) => {
  // console.log('yo');
  for (const layer of sourceModel.layers) {
    layer.trainable = false;
  }

  const newInputLayer = tf.layers.input({ shape: [8, 8, 14] });

  const copiedLayers = sourceModel.layers.slice(1, -2);

  for (const [index, layer] of copiedLayers.entries()) {
    if (
      // layer.input.sourceLayer?.name === 'input1' ||
      (layer.input.sourceLayer?.name || '').split('__').pop() === 'input' ||
      layer.input.sourceLayer?.name === 'input1'
    ) {
      copiedLayers[index] = layer.apply(newInputLayer);
      // layer.name = `${i}___${layer.name}`;

      continue;
    }

    // console.log(layer.input.name, '<---');
    // console.log(copiedLayers.map((l) => l.name));

    let inputToApply;
    if (Array.isArray(layer.input)) {
      // console.log(layer.input);
      // throw new Error('NOT IMPLEMENTED');
      // // process.exit(0);

      inputToApply = copiedLayers.filter(
        (l) => layer.input.find((li) => l.name.includes(li.name)) || layer.input.find((li) => li.name.includes(l.name)),
      );
    } else {
      inputToApply = copiedLayers.find((l) => l.name.includes(layer.input.name) || layer.input.name.includes(l.name));
      // console.log({ inputToApply });
    }

    if (!inputToApply) {
      console.log(layer.input);
      throw new Error('NOT IMPLEMENTED');
    }

    copiedLayers[index] = layer.apply(inputToApply);
    // layer.name = `${i}___${layer.name}`;
  }

  const lastNewLayer = getLastNewLayer({ input: newInputLayer });

  const concatenatedLastLayer = tf.layers
    .concatenate({
      name: `${layerNamePrefix}__concatenate-${Math.random().toString().slice(2)}`,
    })
    .apply([copiedLayers[copiedLayers.length - 1], lastNewLayer]);

  const newDenseLayer1 = tf.layers
    .dense({
      units: 3584,
      activation: tf.reLU,
      useBias: false,
      name: 'additional_d1',
    })
    .apply(concatenatedLastLayer);

  // const newDenseLayer2 = tf.layers
  //   .dense({
  //     units: 2048,
  //     activation: tf.leakyReLU,
  //     useBias: false,
  //     name: 'additional_d2',
  //   })
  //   .apply(newDenseLayer1);

  const outputLayer = tf.layers
    .dense({
      units: 1792,
      activation: 'softmax',
      useBias: false,
      name: 'additional_out',
    })
    .apply(newDenseLayer1);

  const tweakedModel = tf.model({ inputs: newInputLayer, outputs: outputLayer });
  return tweakedModel;
};

const loadModel = async ({ folder }) => {
  console.log({ folder });
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  // console.log('ff');
  return model;
};

const saveModel = async ({ model }) => {
  console.log('Saving model...');

  const modelFolder = path.resolve(targetModelDirName);

  await model.save(`file://${modelFolder}`);
};

const run = async () => {
  try {
    const fullModelDirname = path.resolve(targetModelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });

    // for (const fileName of filesToCopy) {
    //   for (const [index, sourceModelDirName] of sourceModelDirNames.entries()) {
    //     await fs.copyFile(
    //       path.resolve(sourceModelDirName, '..', fileName),
    //       path.resolve(targetModelDirName, `p${index}-${fileName}`),
    //     );
    //   }

    //   await fs.copyFile(
    //     path.resolve(progressModelDirName, '..', fileName),
    //     path.resolve(targetModelDirName, `progressModel-${fileName}`),
    //   );
    // }

    const sourceModelFolder = path.resolve(sourceModelDirName);
    const sourceModel = await loadModel({ folder: sourceModelFolder });

    console.log('source:');
    sourceModel.summary();

    const tweakedModel = getTweakedModel({ sourceModel });

    console.log('Tweaked model:');
    tweakedModel.summary();

    await saveModel({ model: tweakedModel });
  } catch (e) {
    console.error(e);
  }
};

run();
