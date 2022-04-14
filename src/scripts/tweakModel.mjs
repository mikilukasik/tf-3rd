import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/451_r4-e4/451_r4-0.03596-s2.59M-e4-1643781012930';
const targetModelDirName = 'models/451_deep1';

const filesToCopy = ['source.js', 'transform.js', 'constants.json'];

const lastConvLayerName = 'leaky_re_lu_LeakyReLU3';
const firstDenseLayerName = 'dense_Dense1';

const layersToAdd = [
  tf.layers.conv2d({
    inputShape: [8, 8, 32],
    filters: 64,
    kernelSize: 8,
    padding: 'same',
    useBias: false,
    name: 'additional_c1',
  }),
  tf.layers.leakyReLU({ name: 'additional_lr1' }),
  tf.layers.flatten(),
  tf.layers.dense({
    units: 2048,
    activation: tf.leakyReLU,
    useBias: false,
    name: 'additional_d1',
  }),
];

const getTweakedModel = ({ sourceModel }) => {
  for (const layer of sourceModel.layers) {
    layer.trainable = false;
  }

  const lastConvLayer = sourceModel.getLayer(lastConvLayerName);

  const convModel = tf.model({
    inputs: sourceModel.inputs,
    outputs: lastConvLayer.output,
  });

  const firstDenseLayerIndex = sourceModel.layers.findIndex((layer) => layer.name === firstDenseLayerName); //sourceModel.getLayer('dense_Dense1');
  const denseModel = tf.sequential({
    layers: sourceModel.layers.slice(firstDenseLayerIndex),
  });

  const tweakedModel = tf.sequential({
    layers: [...convModel.layers, ...layersToAdd, ...denseModel.layers],
  });

  tweakedModel.compile({
    optimizer: 'adam',
    loss: 'meanSquaredError',
    metrics: [tf.metrics.meanAbsoluteError],
  });

  return tweakedModel;
};

const loadModel = async ({ folder }) => {
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

    console.log('Source model:');
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
