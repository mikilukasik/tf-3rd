// import path from 'path';
import { datasetReader } from './src/scripts/utils/getMovesDatasetPgV15.mjs';
// import { getXs as getXsAsString } from './src/utils/getXs.js';
import { getXsAsString } from './src/utils/getXs.js';
// import { getXsAsString as gxas, getXs } from './src/utils/getXs.js';

// const getXsAsString = (...args) => {
//   const strResult = gxas(...args);

//   const objResult = getXs(...args).join(',');

//   if (objResult === strResult) return strResult;
//   console.log(objResult, strResult, objResult === strResult);
//   process.exit(0);
// };

import compression from 'compression';

// const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const filter = (data) => Number(data[2]) >= 0;
const groupTransformer = (groups) => groups;

export const serveDataset = (app) => {
  app.use(compression());
  const datasetReaders = {};

  const ensureDatasetReader = async (id) => {
    if (!datasetReaders[id])
      datasetReaders[id] = await datasetReader({
        filter,
        groupTransformer,
        getXs: getXsAsString,
        id,
      });
  };

  app.get('/datasetReader/:id/dataset', async ({ query: { format = 'columns' }, params: { id }, headers }, res) => {
    console.log(headers);

    try {
      await ensureDatasetReader(id);
      res[format === 'csv' ? 'send' : 'json'](await datasetReaders[id].getNextBatch({ format }));
    } catch (e) {
      console.error(e);
      res.status(500).send(e.message + e.stack);
    }
  });

  app.get('/datasetReader/:id/testDataset', async ({ query: { format = 'columns' }, params: { id } }, res) => {
    try {
      await ensureDatasetReader(id);
      res[format === 'csv' ? 'send' : 'json'](await datasetReaders[id].getNextTestBatch({ format }));
    } catch (e) {
      res.status(500).send(e.message + e.stack);
    }
  });

  // get CSV filenames only

  // app.get('/datasetReader/:id/datasetFilename', async ({ params: { id }, headers }, res) => {
  //   console.log(headers);

  //   try {
  //     await ensureDatasetReader(id);
  //     const csvData = await datasetReaders[id].getNextBatch({ responseFormat: 'csv' });
  //     res.send(csvData);
  //   } catch (e) {
  //     res.status(500).send(e.message + e.stack);
  //   }
  // });

  // app.get('/datasetReader/:id/testDatasetFilename', async ({ params: { id } }, res) => {
  //   try {
  //     await ensureDatasetReader(id);

  //     const csvData = await datasetReaders[id].getNextTestBatch({ responseFormat: 'csv' });
  //     res.send(csvData);
  //   } catch (e) {
  //     res.status(500).send(e.message + e.stack);
  //   }
  // });

  app.get('/datasetReader', async (req, res) => {
    console.log(req.headers);

    const dReader = await datasetReader({
      filter,
      groupTransformer,
      getXs: getXsAsString,
    });
    datasetReaders[dReader.id] = dReader;

    res.json({ id: dReader.id });
  });
};
