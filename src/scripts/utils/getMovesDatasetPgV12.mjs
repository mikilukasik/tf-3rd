import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

// const datasetFolder = './data/csv_v2/default'; //  /newest and /newest2

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const getGroups = async ({ datasetFolder, groupTransformer }) => {
  const dirContents = (await fs.readdir(datasetFolder)).sort();
  const ratio = 1 / dirContents.length;
  const groups = dirContents.map((pointerKey) => ({ pointerKey, ratio }));
  return groupTransformer(groups);
};

const getNextFileName = async (fileName, rootFolder, deepFileName, subCall = false, beginningToEnd) => {
  if (fileName === rootFolder) {
    console.log(`finished reading dataset at file ${deepFileName}`);
    if (beginningToEnd) throw false;

    return fileName;
  }

  const split = fileName.split('/');
  const folderName = split.slice(0, -1).join('/');
  const dirContents = (await fs.readdir(folderName)).sort();
  const currentIndex = dirContents.findIndex((file) => file === split[split.length - 1]);

  if (currentIndex < dirContents.length - 1) {
    return split
      .slice(0, -1)
      .concat(dirContents[currentIndex + 1])
      .join('/');
  }

  const nextFolder = await getNextFileName(folderName, rootFolder, deepFileName || fileName, true, beginningToEnd);
  const firstFileNameInNextFolder = path.resolve(nextFolder, (await fs.readdir(nextFolder)).sort()[0]);

  if (!subCall) console.log(`reading from folder: ${nextFolder}`);

  return firstFileNameInNextFolder;
};

const readMore = async ({ takeMax, pointers, pointerKey, folder, beginningToEnd }) => {
  const rawData = await fs.readFile(pointers[pointerKey].fileName, 'utf-8');
  const parsedData = rawData
    .trim()
    .split('\n')
    .slice(pointers[pointerKey].index)
    .map((row) => row.split(',')); // Number() ?

  if (parsedData.length > takeMax) {
    pointers[pointerKey] = {
      fileName: pointers[pointerKey].fileName,
      index: pointers[pointerKey].index + takeMax,
    };

    return parsedData.slice(0, takeMax);
  }

  try {
    pointers[pointerKey] = {
      fileName: await getNextFileName(pointers[pointerKey].fileName, folder, '', false, beginningToEnd),
      index: 0,
    };
  } catch (e) {
    if (e) throw e;

    // finished the dataset
    pointers[pointerKey] = {
      fileName: null,
      index: 0,
    };
  }

  return parsedData;
};

const readFromGroup = async ({
  pointers,
  pointerKey,
  take,
  folder,
  filter = () => true,
  isDupe,
  beginningToEnd,
  singleMoveRatio,
  singleProgressGroupRatio,
  singleBalanceGroupRatio,
  dontLogDupes,
}) => {
  const maxCountPerMove = Math.ceil((take / outUnits) * singleMoveRatio);
  const maxCountPerProgressGroup = Math.ceil((take / 3) * singleProgressGroupRatio);
  const maxCountPerBalanceGroup = Math.ceil((take / 3) * singleBalanceGroupRatio);

  const moveCounts = {};
  const progressGroupCounts = [];
  const balanceGroupCounts = [];
  // const fensInThisBatch = {};

  const moveExceededRatio = singleMoveRatio ? (line) => (moveCounts[line[1]] || 0) > maxCountPerMove : () => false;
  const progressGroupExceededRatio = (line) => progressGroupCounts[line[7]] > maxCountPerProgressGroup;
  const balanceGroupExceededRatio = (line) =>
    balanceGroupCounts[getBalanceGroupFromFen(line[0])] > maxCountPerBalanceGroup;

  const registerRecordForCounts = (line) => {
    moveCounts[line[1]] = (moveCounts[line[1]] || 0) + 1;
    progressGroupCounts[line[7]] = (progressGroupCounts[line[7]] || 0) + 1;

    const balanceGroup = getBalanceGroupFromFen(line[0]);
    balanceGroupCounts[balanceGroup] = (balanceGroupCounts[balanceGroup] || 0) + 1;
  };

  const result = [];
  if (!take) return result;

  // console.log({ pointers, pointerKey, take, folder, filter, noDupes }, 'a');
  // process.exit(0);

  const groupFolder = path.resolve(folder, pointerKey);

  if (!pointers[pointerKey]) {
    // we only get here on 1st run if inited without pointers
    const fileName = await getRandomFileFromDir(groupFolder, beginningToEnd);

    console.log(`starting to read dataset from file ${fileName}`);

    pointers[pointerKey] = {
      fileName,
      index: 0,
    };
  }

  let removedDupes = 0;
  let remaining = take;
  while (remaining && pointers[pointerKey].fileName) {
    const records = (
      await readMore({ takeMax: remaining, pointers, pointerKey, folder: groupFolder, beginningToEnd })
    ).filter((line) => {
      if (
        moveExceededRatio(line) ||
        progressGroupExceededRatio(line) ||
        balanceGroupExceededRatio(line) ||
        !filter(line)
      )
        return false;

      if (isDupe(line)) {
        removedDupes += 1;
        return false;
      }

      // if() return false;
      registerRecordForCounts(line);
      // fensInThisBatch[line[0]] = true;

      return true;
    });
    remaining -= records.length;
    result.push(...records);
  }

  if (removedDupes && !dontLogDupes) console.log(`Filtered out ${removedDupes} duplicate fens`);

  return result;
};

const getDefaultIsDupe = () => {
  const dupeCache = {};

  return (record) => {
    if (dupeCache[record[0]]) return true;

    dupeCache[record[0]] = true;
    return false;
  };
};

const getBalanceGroupFromFen = (fen) => {
  const [pieces] = fen.split(' ');

  const whitePieceCount = pieces.replace(/[^A-Z]/g, '').length;
  const blackPieceCount = pieces.replace(/[^a-z]/g, '').length;

  if (blackPieceCount > whitePieceCount) return 0;
  if (blackPieceCount < whitePieceCount) return 1;
  return 2;
};

export const datasetReader = async ({
  // folder,
  batchSize: globalBatchSize = 5000,
  // pointers: _pointers = {},
  filter,

  // balanceGroups = 20,

  datasetFolder,

  groupTransformer = (gs) => gs,

  // test = false,
  // dupeCacheMinutes = 1,
  // dupeCacheSize = 0,
  // preReadDupeCache = true,
  // beginningToEnd = false,
  // singleMoveRatio = outUnits,
  // singleProgressGroupRatio = 3,
  // singleBalanceGroupRatio = 3,
}) => {
  const folder = path.resolve(datasetFolder);
  const pointers = {}; //Object.assign({}, _pointers);

  const groups = await getGroups({ datasetFolder, groupTransformer });

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

  const getNextBatch = async ({ isDupe = getDefaultIsDupe(), batchSize = globalBatchSize } = {}) => {
    // if (finished) return [];

    // const pointerKey = test ? 'test-true' : 'test-false';

    const results = await Promise.all(
      groups.map(({ pointerKey, ratio }) =>
        readFromGroup({
          pointers,
          pointerKey, //: test ? 'test-true' : 'test-false',
          take: Math.ceil(batchSize * ratio),
          folder,
          filter,
          isDupe,
          // beginningToEnd,
          // singleMoveRatio,
          // singleProgressGroupRatio,
          // singleBalanceGroupRatio,
        }),
      ),
    );

    // if (!pointers[pointerKey].fileName) finished = true;

    return shuffle(results.flat());
  };
  return {
    getNextBatch,
  };
};
