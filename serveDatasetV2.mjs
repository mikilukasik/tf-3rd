import { datasetReader as dr16 } from './src/scripts/utils/getMovesDatasetPgV16.mjs';
import { datasetReader as dr17 } from './src/scripts/utils/getMovesDatasetPgV17.mjs';
// import { getXsAsString } from './src/utils/getXs.js';

const datasetReaderVersions = {
  16: dr16,
  17: dr17,
};

import compression from 'compression';

const filters = {
  default: (data) => {
    // fen,
    // onehot_move,
    // 2 hit_soon,
    // 3 chkmate_soon,
    // 4 result,
    // 5 chkmate_ending ? '1' : '',
    // 6 stall_ending ? '1' : '',
    // 7 is_last ? '1' : '',
    // lmf.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // lmt.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // chkmate_ending || stall_ending ? progress : '',
    // chkmate_ending || stall_ending ? '' : progress * 0.8, // adjusted progress for games that were not completed
    // 12 w_rating,
    // 13 b_rating,
    // 14 min_rating_diff,
    // max_rating_diff,

    // this might gives too many low quality games. min 200 diff might be the largest group and lovest quality

    return (
      data[1] && // got move
      data[1] !== '1836' && // not mate/stall/resigh/abort
      (Number(data[12]) >= 2900 || // 2900+ we learn all their moves
        ((Number(data[12]) >= 2700 || Number(data[14]) >= 200) && // 2700 + or min 200 diff AND
          (data[4] === '1' || Number(data[2]) > 0))) // won or is taking next piece
    );
  },

  2900: (data) => {
    // fen,
    // onehot_move,
    // 2 hit_soon,
    // 3 chkmate_soon,
    // 4 result,
    // 5 chkmate_ending ? '1' : '',
    // 6 stall_ending ? '1' : '',
    // 7 is_last ? '1' : '',
    // lmf.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // lmt.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // chkmate_ending || stall_ending ? progress : '',
    // chkmate_ending || stall_ending ? '' : progress * 0.8, // adjusted progress for games that were not completed
    // 12 w_rating,
    // 13 b_rating,
    // 14 min_rating_diff,
    // max_rating_diff,

    return (
      data[1] && // got move
      data[1] !== '1836' && // not mate/stall/resigh/abort
      (Number(data[12]) >= 3000 || // 3000+ we learn all their moves
        (Number(data[12]) >= 2900 && data[4] === '1')) // 2900 + AND winning
    );
  },
};
const groupTransformer = (groups) => groups;

const datasetReaders = {};

const getDatasetReader = async (optionalId, filterName = '2900', readerVersion = '17') => {
  if (optionalId && datasetReaders[optionalId]) return datasetReaders[optionalId];

  const reader = await datasetReaderVersions[readerVersion]({
    filter: filters[filterName],
    groupTransformer,
    // getXs: getXsAsString,
    id: optionalId,
  });

  datasetReaders[reader.id] = reader;

  return reader;
};

export const serveDataset = async (app) => {
  app.use(compression());

  app.get(
    '/datasetReader/:id/dataset',
    async (
      {
        query: {
          format = 'columns',
          filter: filterName = '2900',
          ysformat = 'default',
          xsformat = 'default',
          readerVersion = '17',
        },
        params: { id },
        headers,
      },
      res,
    ) => {
      console.log(1, { ysformat, xsformat });
      try {
        const reader = await getDatasetReader(id, filterName, readerVersion);
        const batch = await reader.getNextBatch({ format, ysformat, xsformat });
        reader.metadata.samplesServed =
          (reader.metadata.samplesServed || 0) + (format === 'csv' ? batch.split('\n') : batch.xs).length;

        res[format === 'csv' ? 'send' : 'json'](batch);
      } catch (e) {
        console.error(e);
        res.status(500).send(e.message + e.stack);
      }
    },
  );

  // app.get('/datasetReader/:id/testDataset', async ({ query: { format = 'columns' }, params: { id } }, res) => {
  //   try {
  //     await getDatasetReader(id);
  //     res[format === 'csv' ? 'send' : 'json'](await datasetReaders[id].getNextTestBatch({ format }));
  //   } catch (e) {
  //     res.status(500).send(e.message + e.stack);
  //   }
  // });

  app.get(
    '/datasetReader/:id?',
    async ({ params: { id: optionalId }, query: { readerVersion = '17', filter: filterName = '2900' } }, res) => {
      try {
        const { id } = await getDatasetReader(optionalId, filterName, readerVersion);
        res.json({ a: 1, id });
      } catch (e) {
        console.error(e);
        res.status(500).send(e.message + e.stack);
      }
    },
  );
};
