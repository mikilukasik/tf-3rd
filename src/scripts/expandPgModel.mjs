import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/pg1_tiny_v1y_0.0000078125/2.36748624-1666398345069';
const versionName = 'v2';

const targetModelDirName = `models/pg1_tiny_${versionName}`;

const filesToCopy = ['transforms.js'];
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

const outputLayer = ({ input }) =>
  tf.layers
    .dense({
      units: outUnits,
      useBias: false,
      activation: 'softmax',
      name: `${versionName}__softmax_output-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const getLastOldLayer = ({ sourceModel, newInputLayer }) => {
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
      throw new Error('NOT IMPLEMENTED');
    }

    copiedLayers[index] = layer.apply(inputToApply);
  }

  return copiedLayers[copiedLayers.length - 1];
};

const getTweakedModel = ({ sourceModel }) => {
  const newInputLayer = tf.layers.input({ shape: [8, 8, inputLength] });
  const lastOldLayer = getLastOldLayer({ sourceModel, newInputLayer });

  const conv3a = convBlock({ input: newInputLayer, kernelSize: 8, filters: 13 });
  const conv3b = convBlock({ input: conv3a, kernelSize: 8, filters: 24 });

  const flat = flattenLayer({ input: conv3b });

  const concatenated = concatLayer([lastOldLayer, flat]);

  const dense1 = denseLayer({ input: concatenated, units: 256 });
  const dense2 = denseLayer({ input: dense1, units: 128 });

  const output = outputLayer({ input: dense2 });

  return tf.model({ inputs: newInputLayer, outputs: output });
};

const loadModel = async ({ folder }) => {
  console.log({ folder });
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  return model;
};

const saveModel = async ({ model, folder }) => {
  console.log('Saving model...');

  await model.save(`file://${folder}`);
};

const run = async () => {
  try {
    const targetFolder = path.resolve(targetModelDirName);
    await fs.mkdir(targetFolder, { recursive: true });

    for (const fileName of filesToCopy) {
      await fs.copyFile(path.resolve(sourceModelDirName, fileName), path.resolve(targetModelDirName, fileName));
    }

    const sourceModel = await loadModel({ folder: path.resolve(sourceModelDirName) });

    console.log('source:');
    sourceModel.summary();

    const tweakedModel = getTweakedModel({ sourceModel });

    console.log('Tweaked model:');
    tweakedModel.summary();

    await saveModel({ model: tweakedModel, folder: targetFolder });
  } catch (e) {
    console.error(e);
  }
};

run();
