import { datasetReader as dr16 } from './src/scripts/utils/getMovesDatasetPgV16.mjs';
import { datasetReader as dr17 } from './src/scripts/utils/getMovesDatasetPgV17.mjs';
import { datasetReader as dr18 } from './src/scripts/utils/getMovesDatasetPgV18.mjs';
// import { getXsAsString } from './src/utils/getXs.js';

const datasetReaderVersions = {
  16: dr16,
  17: dr17,
  18: dr18,
};

import compression from 'compression';
// 0 fen,
// 1 onehot_move,
// 2 hit_soon,
// 3 hit_or_win_soon,
// 4 chkmate_soon,
// 5 result,
// 6 chkmate_ending ? '1' : '',
// 7 stall_ending ? '1' : '',
// 8 lmf.map((val) => val.toString(16).padStart(2, '0')).join(''),
// 9 lmt.map((val) => val.toString(16).padStart(2, '0')).join(''),
// 10 chkmate_ending || stall_ending ? progress : '',
// 11 chkmate_ending || stall_ending ? progress : progress * 0.8, // adjusted progress for games that were not completed
// 12 w_rating,
// 13 b_rating,
// 14 min_rating_diff,
// 15 max_rating_diff,
// 16 nextBalance,
// 17 nextBalanceDistance,
// 18 balAhead[0],
//    balAhead[2],
//    balAhead[4],
//    balAhead[6],
//    balAhead[8],
//    balAhead[10],
//    balAhead[12],
//    balAhead[14],
//    balAhead[16],
//    balAhead[18],
const filters = {
  // chkmtEnding: (data) => {
  //   // console.log(data);
  //   // console.log('filtyo');
  //   return data[10] && data[5] !== '0';
  // },
  // chkmtOrStallEnding: (data) => {
  //   // console.log(data);
  //   // console.log('filtyo');
  //   return data[10] !== '';
  // },
  // chkmtOrStallEndingOrHasBal8: (data) => {
  //   return data[10] !== '' || data[21];
  // },
  // winner: (data) => {
  //   return data[4] !== '0';
  // },
  // default: (data) => {
  //   return (
  //     data[1] && // got move
  //     data[1] !== '1836' && // not mate/stall/resigh/abort
  //     (Number(data[12]) >= 2900 || // 2900+ we learn all their moves
  //       ((Number(data[12]) >= 2700 || Number(data[14]) >= 200) && // 2700 + or min 200 diff AND
  //         (data[4] === '1' || Number(data[2]) > 0))) // won or is taking next piece
  //   );
  // },
  // 2900: (data) => {
  //   return (
  //     data[1] && // got move
  //     data[1] !== '1836' && // not mate/stall/resigh/abort
  //     (Number(data[12]) >= 3000 || // 3000+ we learn all their moves
  //       (Number(data[12]) >= 2900 && data[4] === '1')) // 2900 + AND winning
  //   );
  // },
  hasAnyNextBal: (data) => Number(data[17]) >= 0,
};

const getFilter = (filterName) => {
  if (filters[filterName]) return filters[filterName];

  if (filterName && filterName.startsWith('hasNextBal')) {
    const nextBalIndex = Number(filterName.replace('hasNextBal', ''));
    return (data) => {
      const nextBalanceDistance = Number(data[17]);
      return nextBalanceDistance >= 0 && nextBalanceDistance <= nextBalIndex;
    };
  }
};

const groupTransformer = (groups) => groups;

const datasetReaders = {};

const getDatasetReader = async (optionalId, filterName = '2900', readerVersion = '17') => {
  if (optionalId && datasetReaders[optionalId]) return datasetReaders[optionalId];
  console.log({ filterName });

  const reader = await datasetReaderVersions[readerVersion]({
    filter: getFilter(filterName), //filters[filterName],
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
        console.log({ filterName });

        const reader = await getDatasetReader(id, filterName, readerVersion);
        const batch = await reader.getNextBatch({ format, ysformat, xsformat });
        reader.metadata.samplesServed =
          (reader.metadata.samplesServed || 0) + (format === 'csv' ? batch : batch.xs).length;

        if (format === 'csv') {
          process.stdout.write('joining and sending csv lines..');
          const started = Date.now();

          // console.log(batch[0]);

          while (batch.length) {
            const shard = batch.splice(-1000);
            res.write(shard.join('\n') + '\n');
          }

          res.end();
          console.log(`  - done in ${Date.now() - started} ms.`);

          return;
        }

        res.json(batch);
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
