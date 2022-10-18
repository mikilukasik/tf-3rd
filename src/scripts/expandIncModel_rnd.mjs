import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/rnd_nodupe_v4t_0.00000390625/2.33154893-1665861122483';
const layerNamePrefix = 'v5';

const targetModelDirName = `models/rnd_nodupe_${layerNamePrefix}`;

const filesToCopy = ['createModelInc.js', 'train.mjs', 'transforms.js'];

const conv = ({ filters, kernelSize }) =>
  tf.layers.conv2d({
    filters,
    kernelSize,
    padding: 'same',
    useBias: false,
    name: `${layerNamePrefix}__conv2d_k${kernelSize}f${filters}-${Math.random().toString().slice(2)}`,
  });

const convBlock = ({ input, filters, kernelSize }) => {
  const conv1 = conv({ filters, kernelSize }).apply(input);
  const activated = tf.layers
    .leakyReLU({ name: `${layerNamePrefix}__leakyReLU-${Math.random().toString().slice(2)}` })
    .apply(conv1);
  return activated;
};

const denseLayer = ({ input, units }) =>
  tf.layers
    .dense({
      units,
      activation: tf.leakyReLU,
      useBias: false,
      name: `${layerNamePrefix}__dense_leakyReLU_u${units}-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const flattenLayer = ({ input }) =>
  tf.layers
    .flatten({
      name: `${layerNamePrefix}__flatten-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const outputLayer = ({ input, units }) =>
  tf.layers
    .dense({
      units,
      useBias: false,
      activation: 'softmax',
      name: `${layerNamePrefix}__softmax_output-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const getLastNewLayer = ({ input }) => {
  const conv3a = convBlock({ input, kernelSize: 3, filters: 13, layerNamePrefix });
  const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 64, layerNamePrefix });

  const flat = flattenLayer({ input: conv3b });
  const dense1 = denseLayer({ input: flat, units: 1024 });
  const dense2 = denseLayer({ input: dense1, units: 512 });

  return dense2;
};

const getLastCopiedLayer = ({ sourceModel, newInputLayer }) => {
  for (const layer of sourceModel.layers) {
    layer.trainable = false;
  }

  const copiedLayers = sourceModel.layers.slice(1, -1);

  for (const [index, layer] of copiedLayers.entries()) {
    if (
      (layer.input.sourceLayer?.name || '').split('__').pop() === 'input' ||
      layer.input.sourceLayer?.name === 'input1'
    ) {
      copiedLayers[index] = layer.apply(newInputLayer);
      continue;
    }

    let inputToApply;
    if (Array.isArray(layer.input)) {
      inputToApply = copiedLayers.filter(
        (l) => layer.input.find((li) => l.name.includes(li.name)) || layer.input.find((li) => li.name.includes(l.name)),
      );
    } else {
      inputToApply = copiedLayers.find((l) => l.name.includes(layer.input.name) || layer.input.name.includes(l.name));
    }

    if (!inputToApply) {
      console.log(layer.input);
      throw new Error('Did not find input for layer', layer);
    }

    copiedLayers[index] = layer.apply(inputToApply);
  }

  return copiedLayers.pop();
};

const getTweakedModel = ({ sourceModel }) => {
  const newInputLayer = tf.layers.input({ shape: [8, 8, 14] });

  const lastCopiedLayer = getLastCopiedLayer({ sourceModel, newInputLayer });
  const lastNewLayer = getLastNewLayer({ input: newInputLayer });

  const concatenatedLastLayer = tf.layers
    .concatenate({
      name: `${layerNamePrefix}__concatenate-${Math.random().toString().slice(2)}`,
    })
    .apply([lastCopiedLayer, lastNewLayer]);

  const outputs = outputLayer({ input: concatenatedLastLayer, units: 1792 });

  const tweakedModel = tf.model({ inputs: newInputLayer, outputs });
  return tweakedModel;
};

const loadModel = async ({ folder }) => {
  console.log({ folder });
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
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

    for (const fileName of filesToCopy) {
      await fs.copyFile(path.resolve(sourceModelDirName, fileName), path.resolve(targetModelDirName, fileName));
    }

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
