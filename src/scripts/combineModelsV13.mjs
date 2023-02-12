import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const layerNamePrefix = 'v13_merged_ML_v1';
const targetModelDirName = `models/v13_merged_ML_v1`;

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

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
    .leakyReLU({
      name: `${layerNamePrefix}__leakyReLU-${Math.random().toString().slice(2)}`,
    })
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

const concatLayer = (inputs) =>
  tf.layers
    .concatenate({
      name: `${layerNamePrefix}__concat-${Math.random().toString().slice(2)}`,
    })
    .apply(inputs);

const outputLayer = ({ input, activation = 'softmax', units = outUnits }) =>
  tf.layers
    .dense({
      units,
      useBias: false,
      activation,
      name: `${layerNamePrefix}__${activation}_output-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const createSModel = () => {
  const input = tf.input({ shape: [8, 8, inUnits], name: `${layerNamePrefix}__input` });

  const conv3a = convBlock({ input, kernelSize: 3, filters: 13 });
  const conv3b = convBlock({ input: conv3a, kernelSize: 3, filters: 48 });

  const conv8a = convBlock({ input, kernelSize: 8, filters: 13 });
  const conv8b = convBlock({ input: conv8a, kernelSize: 8, filters: 48 });

  const flat3 = flattenLayer({ input: conv3b });
  const flat8 = flattenLayer({ input: conv8b });

  const concatenated = concatLayer([flat3, flat8]);

  const dense1 = denseLayer({ input: concatenated, units: 1024 });
  const dense2 = denseLayer({ input: dense1, units: 512 });

  const output = outputLayer({ input: dense2 });

  return tf.model({ inputs: input, outputs: output });
};

const createPModel = () => {
  const input = tf.input({ shape: [8, 8, inUnits], name: `${layerNamePrefix}__input` });

  const conv8a = convBlock({ input, kernelSize: 8, filters: 32 });
  const conv8b = convBlock({ input: conv8a, kernelSize: 8, filters: 96 });

  const flat8 = flattenLayer({ input: conv8b });

  const dense1 = denseLayer({ input: flat8, units: 1024 });
  const dense2 = denseLayer({ input: dense1, units: 512 });

  const output = outputLayer({ input: dense2, activation: 'linear', units: 1 });

  return tf.model({ inputs: input, outputs: output });
};

const sourceModels = {
  'models/newest_tV13-p0_v2_0.0001/1.78347576-1676059536847': {
    createModel: createSModel,
  },
  'models/newest_tV13-p1_v1_0.0005/2.25634074-1676060740841': {
    createModel: createSModel,
  },
  'models/newest_tV13-p2_v1_0.00025/2.21247697-1676042555417': {
    createModel: createSModel,
  },
  'models/newest_tV13-p3_v1_0.00025/2.01214457-1676062606287': {
    createModel: createSModel,
  },
  'models/newest_tV13-progress_v1_0.000005/0.07604351-1676229068377': {
    createModel: createPModel,
  },
};

const attachLayersToNewInputLayer = ({ layers, input }) => {
  const copiedLayers = layers.slice(1, -1);

  for (const layer of copiedLayers) {
    layer.trainable = false;
  }

  for (const [index, layer] of copiedLayers.entries()) {
    if (
      (layer.input.sourceLayer?.name || '').split('__').pop() === 'input' ||
      layer.input.sourceLayer?.name === 'input1'
    ) {
      copiedLayers[index] = layer.apply(input);

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

  return copiedLayers;
};

const loadModel = async ({ folder }) => {
  console.log({ folder });
  const model = await tf.loadLayersModel(`file://${folder}/model.json`);
  return model;
};

const copyModel = async ({ sourceModelDirName, sourceModel }) => {
  const blankModel = sourceModels[sourceModelDirName].createModel({ layerNamePrefix });
  blankModel.summary();

  for (const [index, layer] of sourceModel.layers.entries()) {
    const weights = layer.getWeights();
    blankModel.layers[index].setWeights(weights);
  }

  return blankModel;
};

const getConcatenatedLayers = async ({ input }) => {
  const beforeLastLayers = [];

  for (const sourceModelDirName of Object.keys(sourceModels)) {
    const sourceModelFolder = path.resolve(sourceModelDirName);
    const sourceModel = await loadModel({ folder: sourceModelFolder });

    const copiedModel = await copyModel({ sourceModelDirName, sourceModel });

    const attachedLayers = attachLayersToNewInputLayer({ layers: copiedModel.layers, input });
    beforeLastLayers.push(attachedLayers[attachedLayers.length - 1]);
  }

  return concatLayer(beforeLastLayers);
};

const getTweakedModel = async () => {
  const input = tf.layers.input({ shape: [8, 8, inUnits] });

  const concatenatedLastLayer = await getConcatenatedLayers({ input });

  const newDenseUnits = Math.ceil((concatenatedLastLayer.shape[1] + outUnits) / 2);

  const dense1 = denseLayer({ input: concatenatedLastLayer, units: newDenseUnits });
  // const dense2 = denseLayer({ input: concatenatedLastLayer, units: Math.ceil(outUnits * 2) });
  const output = outputLayer({ input: dense1 });

  const tweakedModel = tf.model({ inputs: input, outputs: output });
  return tweakedModel;
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

    const tweakedModel = await getTweakedModel();

    console.log('Tweaked model:');
    tweakedModel.summary();

    await saveModel({ model: tweakedModel });
  } catch (e) {
    console.error(e);
  }
};

run();
