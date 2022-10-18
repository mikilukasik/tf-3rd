import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirNames = [
  'models/2sizesNewV2_p0_v2_04/0.03839-e1-1653577774895__p0',
  'models/2sizesNewV2_p1_v2_03/0.03550-e1-1653741265601__p1',
  'models/2sizesNewV2_p2_v6/0.03507-e1-1654062244911__p2',
];
const progressModelDirName = 'models/2sizesNewV2Progress_02/0.05050-e1-1654068095905';

const targetModelDirName = 'models/2sizesMerged_v2__big';

const filesToCopy = ['createModel.js', 'train.js', 'trainingMeta.json', 'transform.js', 'constants.json'];

const getTweakedModel = ({ sourceModels, progressModel }) => {
  // console.log('yo');
  for (const layer of [...progressModel.layers, ...sourceModels.map((sourceModel) => sourceModel.layers).flat()]) {
    layer.trainable = false;
  }

  const newInputLayer = tf.layers.input({ shape: [8, 8, 38] });

  const paralellLayers = [progressModel, ...sourceModels].map((model, i) => {
    const newLayers = model.layers.slice(1, -1);

    for (const [index, layer] of newLayers.entries()) {
      if (
        layer.input.sourceLayer?.name === 'input1' ||
        (layer.input.sourceLayer?.name || '').split('__').pop() === 'input'
      ) {
        newLayers[index] = layer.apply(newInputLayer);
        // layer.name = `${i}___${layer.name}`;

        continue;
      }

      let inputToApply;
      if (Array.isArray(layer.input)) {
        inputToApply = newLayers.filter(
          (l) =>
            layer.input
              .map((inp) => inp.name.split('/')[0].split('___').pop())
              .includes(l.name.split('/')[0].split('___').pop()),
          console.log({ inputToApply }),
        );
      } else {
        inputToApply = newLayers.find(
          (l) => l.name.split('/')[0].split('___').pop() === layer.input.name.split('/')[0].split('___').pop(),
        );
      }

      newLayers[index] = layer.apply(inputToApply);
      // layer.name = `${i}___${layer.name}`;
    }

    return newLayers;
  });

  const concatenatedLastLayer = tf.layers
    .concatenate()
    .apply(paralellLayers.map((layers) => layers[layers.length - 1]));

  const newDenseLayer1 = tf.layers
    .dense({
      units: 1024,
      activation: tf.leakyReLU,
      useBias: false,
      name: 'additional_d1',
    })
    .apply(concatenatedLastLayer);

  const newDenseLayer2 = tf.layers
    .dense({
      units: 512,
      activation: tf.leakyReLU,
      useBias: false,
      name: 'additional_d2',
    })
    .apply(newDenseLayer1);

  const outputLayer = tf.layers
    .dense({
      units: 134,
      activation: tf.leakyReLU,
      useBias: false,
      name: 'additional_out',
    })
    .apply(newDenseLayer2);

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

    for (const fileName of filesToCopy) {
      for (const [index, sourceModelDirName] of sourceModelDirNames.entries()) {
        await fs.copyFile(
          path.resolve(sourceModelDirName, '..', fileName),
          path.resolve(targetModelDirName, `p${index}-${fileName}`),
        );
      }

      await fs.copyFile(
        path.resolve(progressModelDirName, '..', fileName),
        path.resolve(targetModelDirName, `progressModel-${fileName}`),
      );
    }

    const sourceModelFolders = sourceModelDirNames.map((sourceModelDirName) => path.resolve(sourceModelDirName));
    // console.log('a1');
    const sourceModels = await Promise.all(
      sourceModelFolders.map((sourceModelFolder) => loadModel({ folder: sourceModelFolder })),
    );
    // console.log('a2');

    const progressModel = await loadModel({ folder: path.resolve(progressModelDirName) });
    // console.log('a3');

    console.log('Will merge these models:');
    [...sourceModels, progressModel].forEach((model, index) => {
      console.log(`${index}:`);
      model.summary();
    });

    const tweakedModel = getTweakedModel({ sourceModels, progressModel });

    console.log('Tweaked model:');
    tweakedModel.summary();

    await saveModel({ model: tweakedModel });
  } catch (e) {
    console.error(e);
  }
};

run();
