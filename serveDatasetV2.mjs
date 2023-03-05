import { datasetReader } from './src/scripts/utils/getMovesDatasetPgV16.mjs';
import { getXsAsString } from './src/utils/getXs.js';

import compression from 'compression';

const filter = (data) => Number(data[2]) >= 0;
const groupTransformer = (groups) => groups;

const datasetReaders = {};

const getDatasetReader = async (optionalId) => {
  if (optionalId && datasetReaders[optionalId]) return datasetReaders[optionalId];

  const reader = await datasetReader({
    filter,
    groupTransformer,
    getXs: getXsAsString,
    id: optionalId,
  });

  datasetReaders[reader.id] = reader;

  return reader;
};

export const serveDataset = async (app) => {
  app.use(compression());

  app.get('/datasetReader/:id/dataset', async ({ query: { format = 'columns' }, params: { id }, headers }, res) => {
    try {
      const reader = await getDatasetReader(id);
      res[format === 'csv' ? 'send' : 'json'](await reader.getNextBatch({ format }));
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message + e.stack);
    }
  });

  // app.get('/datasetReader/:id/testDataset', async ({ query: { format = 'columns' }, params: { id } }, res) => {
  //   try {
  //     await getDatasetReader(id);
  //     res[format === 'csv' ? 'send' : 'json'](await datasetReaders[id].getNextTestBatch({ format }));
  //   } catch (e) {
  //     res.status(500).send(e.message + e.stack);
  //   }
  // });

  app.get('/datasetReader/:id?', async ({ params: { id: optionalId } }, res) => {
    try {
      const { id } = await getDatasetReader(optionalId);
      res.json({ a: 1, id });
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message + e.stack);
    }
  });
};
