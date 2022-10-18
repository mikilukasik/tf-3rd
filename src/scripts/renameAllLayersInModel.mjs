import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';
import { createSinglePModel } from '../utils/createSinglePModel.mjs';

const progress = 2;

const sourceModelDirNames = [
  'models/2sizesNewV2_p0_v2_04/0.03839-e1-1653577774895',
  'models/2sizesNewV2_p1_v2_03/0.03550-e1-1653741265601',
  'models/2sizesNewV2_p2_v6/0.03507-e1-1654062244911',
];

const sourceModelDirName = sourceModelDirNames[progress];
const targetModelDirName = `${sourceModelDirNames[progress]}__p${progress}`;

const filesToCopy = ['train.js', 'createModel.js', 'transform.js', 'constants.json'];

const getTweakedModel = ({ sourceModel }) => {
  // console.log('oioioioi');
  const blankModel = createSinglePModel({ layerNamePrefix: `p${progress}` });
  blankModel.summary();

  // for (const [index, layer] of sourceModel.layers.entries()) {
  //   console.log(`${layer.name} - ${blankModel.layers[index].name}`);
  // }

  // process.exit(0);

  for (const [index, layer] of sourceModel.layers.entries()) {
    // layer._trainableWeights.forEach((tw) => {
    //   tw.name = `p${progress}__${tw.name}`;
    //   tw.originalName = `p${progress}__${tw.originalName}`;
    // });

    const weights = layer.getWeights();
    blankModel.layers[index].setWeights(weights);

    // if (layer.kernel) {
    //   layer.kernel.val.name = `p${progress}__${layer.kernel.val.name}`;
    //   layer.kernel.name = `p${progress}__${layer.kernel.name}`;
    //   layer.kernel.originalName = `p${progress}__${layer.kernel.originalName}`;
    // }

    // layer.name = `p${progress}__${layer.name}`;
    // console.log(layer);
    // console.log(layer.getConfig(), layer.kernel, layer.inputSpec);

    // if (layer.kernel) layer.build(layer.kernel.shape);

    // layer.setWeights(weights);
  }
  // process.exit(0);
  // const lastConvLayer = sourceModel.getLayer(lastConvLayerName);

  // const convModel = tf.model({
  //   inputs: sourceModel.inputs,
  //   outputs: lastConvLayer.output,
  // });

  // const firstDenseLayerIndex = sourceModel.layers.findIndex((layer) => layer.name === firstDenseLayerName); //sourceModel.getLayer('dense_Dense1');
  // const denseModel = tf.sequential({
  //   layers: sourceModel.layers.slice(firstDenseLayerIndex),
  // });

  // const tweakedModel = tf.sequential({
  //   layers: [...convModel.layers, ...layersToAdd, ...denseModel.layers],
  // });

  // sourceModel.compile({
  //   optimizer: 'adam',
  //   loss: 'meanSquaredError',
  //   metrics: [tf.metrics.meanAbsoluteError],
  // });

  return blankModel;
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
