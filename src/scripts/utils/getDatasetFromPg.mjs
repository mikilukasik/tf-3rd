// import * as path from 'path';
// import { promises as fs } from 'fs';

// import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

import pkg from 'pg';
const { Client } = pkg;
const pgClient = new Client({
  user: 'chss',
  host: 'localhost',
  database: 'chss',
  password: 'password',
  port: 54320,
});

let initStarted;
let inited;
const pgClientResolvers = [];
const init = () =>
  new Promise((r) => {
    if (inited) return r();
    if (initStarted) return pgClientResolvers.push(r);

    initStarted = true;
    pgClient
      .connect()
      .then(() => {
        inited = true;
        return pgClient.query('SELECT $1::text as message', ['Postgres connected']);
      })
      .then((res) => {
        console.log(res.rows[0].message);
        r();
        while (pgClientResolvers.length) pgClientResolvers.pop()();
      })
      .catch(console.error);

    // const res = await ;
    // ; // Hello world!
  });
init();
// const datasetFolder = './data/newestCsvsWMoveindex/newest2'; //  /newest and /newest2

// const inUnits = 12;
// const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

// const getNextFileName = async (fileName, rootFolder, deepFileName, subCall = false, beginningToEnd) => {
//   if (fileName === rootFolder) {
//     console.log(`finished reading dataset at file ${deepFileName}`);
//     if (beginningToEnd) throw false;

//     return fileName;
//   }

//   const split = fileName.split('/');
//   const folderName = split.slice(0, -1).join('/');
//   const dirContents = (await fs.readdir(folderName)).sort();
//   const currentIndex = dirContents.findIndex((file) => file === split[split.length - 1]);

//   if (currentIndex < dirContents.length - 1) {
//     return split
//       .slice(0, -1)
//       .concat(dirContents[currentIndex + 1])
//       .join('/');
//   }

//   const nextFolder = await getNextFileName(folderName, rootFolder, deepFileName || fileName, true, beginningToEnd);
//   const firstFileNameInNextFolder = path.resolve(nextFolder, (await fs.readdir(nextFolder)).sort()[0]);

//   if (!subCall) console.log(`reading from folder: ${nextFolder}`);

//   return firstFileNameInNextFolder;
// };

const rowMapper = ({ id, fen, moves }) => ({
  id,
  fen,
  moves: JSON.parse(moves).map(([onehot_move, count, hit_soon, result]) => ({
    onehot_move,
    count,
    hit_soon,
    result,
  })),
});

const readMore = async ({ takeMax, pointers, pointerKey }) => {
  const rawData = await pgClient.query(`
    SELECT id, fen, moves FROM public.mytable
    WHERE id > ${pointers[pointerKey].id}
    ORDER BY id
    limit ${Math.min(5000, takeMax)};
  `);

  const parsedData = rawData.rows.map(rowMapper);

  pointers[pointerKey].id = parsedData.length ? parsedData[parsedData.length - 1].id : 0;

  return parsedData;
};

const readFromGroup = async ({
  pointers,
  pointerKey,
  take,
  // folder,
  filter = () => true,
  // isDupe,
  // beginningToEnd,
  // singleMoveRatio,
  // singleProgressGroupRatio,
  // singleBalanceGroupRatio,
  // dontLogDupes,
}) => {
  // const maxCountPerMove = Math.ceil((take / outUnits) * singleMoveRatio);
  // const maxCountPerProgressGroup = Math.ceil((take / 3) * singleProgressGroupRatio);
  // const maxCountPerBalanceGroup = Math.ceil((take / 3) * singleBalanceGroupRatio);

  // const moveCounts = {};
  // const progressGroupCounts = [];
  // const balanceGroupCounts = [];
  // const fensInThisBatch = {};

  // const moveExceededRatio = singleMoveRatio ? (line) => (moveCounts[line[1]] || 0) > maxCountPerMove : () => false;
  // const progressGroupExceededRatio = (line) => progressGroupCounts[line[7]] > maxCountPerProgressGroup;
  // const balanceGroupExceededRatio = (line) =>
  //   balanceGroupCounts[getBalanceGroupFromFen(line[0])] > maxCountPerBalanceGroup;

  // const registerRecordForCounts = (line) => {
  //   moveCounts[line[1]] = (moveCounts[line[1]] || 0) + 1;
  //   progressGroupCounts[line[7]] = (progressGroupCounts[line[7]] || 0) + 1;

  //   const balanceGroup = getBalanceGroupFromFen(line[0]);
  //   balanceGroupCounts[balanceGroup] = (balanceGroupCounts[balanceGroup] || 0) + 1;
  // };

  const result = [];
  if (!take) return result;

  // console.log({ pointers, pointerKey, take, folder, filter, noDupes }, 'a');
  // process.exit(0);

  // const groupFolder = path.resolve(folder, pointerKey);

  if (!pointers[pointerKey]) {
    const largestId = Number(
      (
        await pgClient.query(`
          SELECT id FROM public.mytable
          ORDER BY id DESC
          limit 1
        `)
      ).rows[0].id,
    );

    // we only get here on 1st run if inited without pointers
    // const fileName = await getRandomFileFromDir(groupFolder, beginningToEnd);
    const id = Math.floor(Math.random() * largestId); //row count hardcoded

    console.log(`starting to read dataset from id ${id}`);

    pointers[pointerKey] = {
      // fileName,
      id,
    };
  }

  // let removedDupes = 0;
  let remaining = take;
  while (remaining) {
    // console.log({ remaining });

    const records = (await readMore({ takeMax: remaining, pointers, pointerKey })).filter((line) => {
      if (
        // moveExceededRatio(line) ||
        // progressGroupExceededRatio(line) ||
        // balanceGroupExceededRatio(line) ||
        // eslint-disable-next-line no-constant-condition
        false
        // !filter(line)
      )
        return false;

      // if (isDupe(line[0]) || fensInThisBatch[line[0]]) {
      //   removedDupes += 1;
      //   return false;
      // }

      // if() return false;
      // registerRecordForCounts(line);
      // fensInThisBatch[line[0]] = true;

      return true;
    });
    remaining -= records.length;
    result.push(...records);
  }

  // if (removedDupes && !dontLogDupes) console.log(`Filtered out ${removedDupes} duplicate fens`);

  return result;
};

// const getBalanceGroupFromFen = (fen) => {
//   const [pieces] = fen.split(' ');

//   const whitePieceCount = pieces.replace(/[^A-Z]/g, '').length;
//   const blackPieceCount = pieces.replace(/[^a-z]/g, '').length;

//   if (blackPieceCount > whitePieceCount) return 0;
//   if (blackPieceCount < whitePieceCount) return 1;
//   return 2;
// };

export const getDatasetFromPg = async ({
  // folder,
  batchSize = 5000,
  pointers: _pointers = {},
  filter,
  // test = false,
  // dupeCacheMinutes = 1,
  // dupeCacheSize = 0,
  // preReadDupeCache = true,
  // beginningToEnd = false,
  // singleMoveRatio = outUnits,
  // singleProgressGroupRatio = 3,
  // singleBalanceGroupRatio = 3,
}) => {
  await init();
  // const folder = path.resolve(datasetFolder);
  const pointers = Object.assign({}, _pointers);

  // let isDupe = () => false;
  // if (dupeCacheSize) {
  //   const dupeCacheBlockSize = Math.ceil(dupeCacheSize / 100);
  //   let activeDupeBlockLength = 0;
  //   const dupeCacheBlocks = [{}];

  //   const processDupeCache = () => {
  //     if (activeDupeBlockLength < dupeCacheBlockSize) return;

  //     dupeCacheBlocks.unshift({});
  //     if (dupeCacheBlocks.length > 100) dupeCacheBlocks.pop();
  //     activeDupeBlockLength = 0;
  //   };

  //   const shuffleDupeCache = () => {
  //     const allKeys = shuffle(dupeCacheBlocks.reduce((p, c) => p.concat(Object.keys(c)), []));
  //     dupeCacheBlocks.length = 0;
  //     dupeCacheBlocks.push({});
  //     activeDupeBlockLength = 0;

  //     allKeys.forEach((key) => {
  //       dupeCacheBlocks[0][key] = true;
  //       activeDupeBlockLength += 1;
  //       processDupeCache();
  //     });
  //   };

  //   isDupe = (key) => {
  //     if (!dupeCacheSize) return false;

  //     const seenAlready = dupeCacheBlocks.reduce((p, c) => {
  //       return p || c[key];
  //     }, false);

  //     if (seenAlready) return true;

  //     dupeCacheBlocks[0][key] = true;
  //     activeDupeBlockLength += 1;
  //     processDupeCache();

  //     return false;
  //   };

  //   if (preReadDupeCache) {
  //     while (dupeCacheBlocks.length < 100) {
  //       await readFromGroup({
  //         pointers,
  //         pointerKey: test ? 'test-true' : 'test-false',
  //         take: Math.ceil(dupeCacheSize / 300), //todo: should take until cache is full
  //         folder,
  //         filter,
  //         isDupe,
  //         singleMoveRatio,
  //         singleProgressGroupRatio,
  //         beginningToEnd,
  //         singleBalanceGroupRatio,
  //         dontLogDupes: true,
  //       });

  //       // console.log({ dupeCacheBlocks: dupeCacheBlocks.length });
  //     }

  //     shuffleDupeCache();
  //   }
  // }

  // let finished = false;

  const getNextBatch = async () => {
    // if (finished) return [];

    // const pointerKey = test ? 'test-true' : 'test-false';

    const result = await readFromGroup({
      pointers,
      pointerKey: 'default', //: test ? 'test-true' : 'test-false',
      take: batchSize,
      // folder,
      filter,
      // isDupe,
      // beginningToEnd,
      // singleMoveRatio,
      // singleProgressGroupRatio,
      // singleBalanceGroupRatio,
    });

    // if (!pointers[pointerKey].fileName) finished = true;

    return result;
  };

  const getTestData = async ({ sample = 0.02 }) => {
    const rawTestData = await pgClient.query(`
      SELECT id, fen, moves FROM public.mytable tablesample system(${sample});
    `);

    return rawTestData.rows.map(rowMapper);
  };

  return {
    getNextBatch,
    getTestData,
  };
};
