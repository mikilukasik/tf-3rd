import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirName = 'models/451_dropout';
const targetModelDirName = 'models/451_dropout';

const filesToCopy = ['source.js', 'transform.js', 'constants.json'];

const getTweakedModel = ({ sourceModel }) => {
  for (const layer of sourceModel.layers) {
    layer.trainable = true;
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
