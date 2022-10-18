import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/2sizesMerged_v3';
const targetModelDirName = 'models/2sizesMerged_clean_v5';

const filesToCopy = ['train.js', 'transform.js'];

const getTweakedModel = ({ sourceModel }) => {
  for (const layer of sourceModel.layers) {
    layer.trainable = true;

    const weights = layer.getWeights();
    if (!weights || !weights.length) continue;
    // console.log(weights);
    // layer.setWeights(weights.map((w) => tf.rand(w.shape, Math.random)));
    layer.setWeights(weights.map((w) => tf.zerosLike(w)));

    // layer.setWeights(tf.zeros());
  }

  return sourceModel;
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
