import * as tf from '@tensorflow/tfjs-node';
import { promises as fs } from 'fs';
import * as path from 'path';

const sourceModelDirNames = [
  'models/pg1_large_v1z_0.00000390625/1.95371997-1666917047085',
  'models/pg1_medium_v1x_0.00000390625/2.14530516-1666679521889',
  'models/pg1_small_v1z_0.00000390625/2.16854405-1666359554325',
  'models/openings_small_v1x_0.00000390625/1.25092518-1666850289277',
  'models/OME_small_v1_0.0000078125/0.01195987-1666746506963',
];

const layerNamePrefix = 'pg1_sml_v2';
const targetModelDirName = `models/pg1_sml_v2`; //_${layerNamePrefix}`;

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const flatLayerTest = (str) => /flatten/.test(str);

const concatLayer = (inputs) =>
  tf.layers
    .concatenate({
      name: `${layerNamePrefix}__concat-${Math.random().toString().slice(2)}`,
    })
    .apply(inputs);

const denseLayer = ({ input, units }) =>
  tf.layers
    .dense({
      units,
      activation: tf.leakyReLU,
      useBias: false,
      name: `${layerNamePrefix}__dense_leakyReLU_u${units}-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

const outputLayer = ({ input, activation = 'softmax' }) =>
  tf.layers
    .dense({
      units: outUnits,
      useBias: false,
      activation,
      name: `${layerNamePrefix}__${activation}_output-${Math.random().toString().slice(2)}`,
    })
    .apply(input);

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

const getConcatenatedFlatLayers = async ({ input }) => {
  const flatLayers = [];

  for (const sourceModelDirName of sourceModelDirNames) {
    const sourceModelFolder = path.resolve(sourceModelDirName);
    const sourceModel = await loadModel({ folder: sourceModelFolder });

    const attachedLayers = attachLayersToNewInputLayer({ layers: sourceModel.layers, input });
    flatLayers.push(...attachedLayers.filter(({ name }) => flatLayerTest(name)));
  }

  return concatLayer(flatLayers);
};

const getTweakedModel = async () => {
  const input = tf.layers.input({ shape: [8, 8, inUnits] });

  const concatenatedLastLayer = await getConcatenatedFlatLayers({ input });

  const dense1 = denseLayer({ input: concatenatedLastLayer, units: outUnits * 4 });
  const dense2 = denseLayer({ input: dense1, units: Math.ceil(outUnits * 2) });
  const output = outputLayer({ input: dense2 });

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
