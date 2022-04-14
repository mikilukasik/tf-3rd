import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/451_dropout';
const targetModelDirName = 'models/451_dropout';

const filesToCopy = ['source.js', 'transform.js', 'constants.json'];

const keepUpToLayer = 'dense_Dense2';
const keepFromLayer = 'dense_Dense3';

const layersToAdd = [tf.layers.dropout({ rate: 0.1, name: 'additional_dropout_3' })];

const getTweakedModel = ({ sourceModel }) => {
  for (const layer of sourceModel.layers) {
    layer.trainable = false;
  }

  const lastKeptLayer = sourceModel.getLayer(keepUpToLayer);

  const convModel = tf.model({
    inputs: sourceModel.inputs,
    outputs: lastKeptLayer.output,
  });

  const keepFromLayerIndex = sourceModel.layers.findIndex((layer) => layer.name === keepFromLayer); //sourceModel.getLayer('dense_Dense1');
  const denseModel = tf.sequential({
    layers: sourceModel.layers.slice(keepFromLayerIndex),
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
    const sourceModelFolder = path.resolve(sourceModelDirName);
    const sourceModel = await loadModel({ folder: sourceModelFolder });

    console.log('Source model:');
    sourceModel.summary();

    // process.exit(0);

    const fullModelDirname = path.resolve(targetModelDirName);
    await fs.mkdir(fullModelDirname, { recursive: true });

    for (const fileName of filesToCopy) {
      await fs.copyFile(path.resolve(sourceModelDirName, fileName), path.resolve(targetModelDirName, fileName));
    }

    const tweakedModel = getTweakedModel({ sourceModel });

    console.log('Tweaked model:');
    tweakedModel.summary();

    await saveModel({ model: tweakedModel });
  } catch (e) {
    console.error(e);
  }
};

run();
