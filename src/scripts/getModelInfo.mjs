import * as tf from '@tensorflow/tfjs-node';
import * as path from 'path';

const sourceModelDirName = 'models/pg1_small_v1z_0.00000390625/2.16854405-1666359554325';

const loadModel = async ({ folder }) => {
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);

  return model;
};

const run = async () => {
  try {
    const sourceModelFolder = path.resolve(sourceModelDirName);
    const sourceModel = await loadModel({ folder: sourceModelFolder });

    console.log(sourceModelDirName);
    sourceModel.summary();

    sourceModel.layers.forEach((l, i) => {
      console.log(`layer ${i}`);
      console.log(l.getConfig());
    });
  } catch (e) {
    console.error(e);
  }
};

run();
