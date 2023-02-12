import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirNames = [
  'models/newest_tV13-p0_v2_0.0001/1.78347576-1676059536847',
  'models/newest_tV13-p1_v1_0.0005/2.25634074-1676060740841',
  'models/newest_tV13-p2_v1_0.00025/2.21247697-1676042555417',
  'models/newest_tV13-p3_v1_0.00025/2.01214457-1676062606287',
];
const progressModelDirName = 'models/newest_tV13-progress_v1_0.000001953125/0.07373594-1676060287974';
const targetModelDirName = 'models/merged_tV13_SM';
const filesToCopy = ['train.mjs', 'datasetReader.mjs', 'transforms.js', 'loader.js'];

const inUnits = 14;
const outUnits = 1837;

// const addRndToLayerName = (obj, layerName) => {
//   if (!obj) return;
//   Object.keys(obj).forEach((key) => {
//     if (typeof obj[key] === 'string') obj[key] = obj[key].replace(layerName, `${layerName} ${Math.random()}`);
//     if (typeof obj[key] === 'object') addRndToLayerName(obj[key], layerName);
//   });
// };

const addRndToLayerName = (layer) => {};

const getTweakedModel = ({ sourceModels, progressModel }) => {
  // console.log('yo');
  for (const layer of [...progressModel.layers, ...sourceModels.map((sourceModel) => sourceModel.layers).flat()]) {
    layer.trainable = false;
    addRndToLayerName(layer, layer.name);
    console.log(layer);
  }
  process.exit(0);
  const newInputLayer = tf.layers.input({ shape: [8, 8, inUnits] });

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

  const newDenseUnits = Math.ceil((concatenatedLastLayer.shape[1] + outUnits) / 2);

  const newDenseLayer1 = tf.layers
    .dense({
      units: newDenseUnits,
      activation: tf.leakyReLU,
      useBias: false,
      name: 'additional_d1',
    })
    .apply(concatenatedLastLayer);

  // const newDenseLayer2 = tf.layers
  //   .dense({
  //     units: 512,
  //     activation: tf.leakyReLU,
  //     useBias: false,
  //     name: 'additional_d2',
  //   })
  //   .apply(newDenseLayer1);

  const outputLayer = tf.layers
    .dense({
      units: outUnits,
      activation: tf.leakyReLU,
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
