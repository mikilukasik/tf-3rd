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
  2700: (data) => {
    return (
      data[1] && // got move
      data[1] !== '1836' && // not mate/stall/resigh/abort
      (Number(data[12]) >= 2900 || // 2900+ we learn all their moves
        ((Number(data[12]) >= 2800 || Number(data[13]) >= 2800) &&
          (data[5] === '1' || Number(data[16]) > Number(data[18]))) || // 2800+ winning or going to hit
        ((Number(data[12]) >= 2700 || Number(data[13]) >= 2700) &&
          data[5] === '1' &&
          Number(data[16]) > Number(data[18]))) // // 2700+ winning and going to hit
    );
  },
  almostall: (data) => {
    return (
      data[1] && // got move
      data[1] !== '1836'
    );
  },
  mostlyGood: (data) => {
    // logic: all 2700+ games, 2400+ games where we are winning or going to hit, 50% of rest
    return (
      data[1] && // got move
      data[1] !== '1836' && // not mate/stall/resigh/abort
      (Number(data[12]) >= 2700 || // 2700+ we learn all their moves
        (Number(data[12]) >= 2400 && (data[5] === '1' || Number(data[16]) > Number(data[18]))) || // 2500+ winning or going to hit
        Math.random() < 0.5)
    );
  },
  2900: (data) => {
    return (
      data[1] && // got move
      data[1] !== '1836' && // not mate/stall/resigh/abort
      (Number(data[12]) >= 3000 || // 3000+ we learn all their moves
        (Number(data[12]) >= 2900 && data[5] === '1')) // 2900 + AND winning
    );
  },
  hasAnyNextBal: (data) => Number(data[17]) >= 0,
};

const parseFilterObj = (inputStr) => {
  const regex = /\(([^)]+)\)/g;
  const results = [];

  let match;
  while ((match = regex.exec(inputStr)) !== null) {
    const properties = match[1].split(',').reduce((acc, property) => {
      const [key, value] = property.split(':');
      acc[key] = value;
      // acc[key] = isNaN(value) ? value : parseFloat(value);
      return acc;
    }, {});

    results.push(properties);
  }

  return results;
};

const matchesFilters = (data, filterObjs) => {
  for (const filterObj of filterObjs) {
    let allKeysMatch = true;

    for (const key of Object.keys(filterObj)) {
      switch (key) {
        case 'result':
          if (data[5] !== filterObj[key]) {
            allKeysMatch = false;
          }
          break;

        case 'progressMax':
          if (Number(data[11]) > Number(filterObj[key])) {
            allKeysMatch = false;
          }
          break;

        case 'opponentMinElo':
          if (!data[13] || Number(data[13]) < Number(filterObj[key])) {
            allKeysMatch = false;
          }
          break;

        case 'percent':
          if (Math.random() > Number(filterObj[key])) {
            allKeysMatch = false;
          }
          break;

        default:
          throw new Error(`Unknown filter key ${key}`);
      }

      // If one key doesn't match, break out of this loop and move on to the next filterObj.
      if (!allKeysMatch) break;
    }

    // If all keys for this filterObj matched, return true.
    if (allKeysMatch) return true;
  }

  // If none of the filterObjs matched in their entirety, return false.
  return false;
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

  if (filterName && filterName.startsWith('obj(')) {
    // example filtername is 'obj(result:1,progressMax:0.2,opponentMinElo:2500)(result:1,progressMax:0.2,percent:0.3)'

    const filterObjs = parseFilterObj(filterName);
    return (data) => matchesFilters(data, filterObjs);
  }

  throw new Error(`Unknown filter ${filterName}`);
};

const groupTransformer = (groups) => {
  console.log(groups);
  return [groups[0]];
};

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
