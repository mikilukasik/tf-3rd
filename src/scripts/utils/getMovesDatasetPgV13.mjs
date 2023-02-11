import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const getGroups = async ({ datasetFolder, groupTransformer }) => {
  const dirContents = (await fs.readdir(datasetFolder)).sort();
  // const ratio = 1 / dirContents.length;
  const groups = dirContents.map((pointerKey) => ({ pointerKey /* , ratio */ }));
  const transformedGroups = groupTransformer(groups);
  const ratio = 1 / transformedGroups.length;

  return transformedGroups.map(({ pointerKey }) => ({ pointerKey, ratio }));
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

const readMore = async ({ takeMax, pointers, pointerKey, folder, beginningToEnd, randomFileOrder }) => {
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
      fileName: randomFileOrder
        ? await getRandomFileFromDir(folder, beginningToEnd)
        : await getNextFileName(pointers[pointerKey].fileName, folder, '', false, beginningToEnd),
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
  pointers = {},
  pointerKey,
  take,
  folder,
  filter = () => true,
  isDupe,
  beginningToEnd,
  // singleMoveRatio,
  // singleProgressGroupRatio,
  // singleBalanceGroupRatio,
  dontLogDupes,
  fensInLastTestBatch = {},
  randomFileOrder,
}) => {
  console.log('------', Object.keys(fensInLastTestBatch).sort()[0]);

  // const maxCountPerMove = Math.ceil((take / outUnits) * singleMoveRatio);
  // const maxCountPerProgressGroup = Math.ceil((take / 3) * singleProgressGroupRatio);
  // const maxCountPerBalanceGroup = Math.ceil((take / 3) * singleBalanceGroupRatio);

  // const moveCounts = {};
  // const progressGroupCounts = [];
  // const balanceGroupCounts = [];

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

  const groupFolder = path.resolve(folder, pointerKey);

  const resetPointer = async (currentPointers) => {
    const fileName = await getRandomFileFromDir(groupFolder, beginningToEnd);

    if (!randomFileOrder) console.log(`starting to read dataset from file ${fileName}`);

    currentPointers[pointerKey] = {
      fileName,
      index: 0,
    };

    return currentPointers;
  };

  if (!pointers[pointerKey]) {
    await resetPointer(pointers);
  }

  let removedDupes = 0;
  let removedTestFens = 0;
  let remaining = take;
  while (remaining && pointers[pointerKey].fileName) {
    const records = (
      await readMore({
        takeMax: remaining,
        pointers: randomFileOrder ? await resetPointer({}) : pointers,
        pointerKey,
        folder: groupFolder,
        beginningToEnd,
        randomFileOrder,
      })
    ).filter((line) => {
      if (!filter(line)) return false;

      if (isDupe(line)) {
        removedDupes += 1;
        return false;
      }

      if (fensInLastTestBatch[line[0]]) {
        removedTestFens += 1;
        return false;
      }

      // registerRecordForCounts(line);

      return true;
    });
    remaining -= records.length;
    result.push(...records);
  }

  if (removedDupes && !dontLogDupes) console.log(`${pointerKey}: ${removedDupes} duplicate fens`);
  if (removedTestFens && !dontLogDupes) console.log(`${pointerKey}: ${removedTestFens} test fens`);

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

// const getBalanceGroupFromFen = (fen) => {
//   const [pieces] = fen.split(' ');

//   const whitePieceCount = pieces.replace(/[^A-Z]/g, '').length;
//   const blackPieceCount = pieces.replace(/[^a-z]/g, '').length;

//   if (blackPieceCount > whitePieceCount) return 0;
//   if (blackPieceCount < whitePieceCount) return 1;
//   return 2;
// };

export const datasetReader = async ({
  batchSize: globalBatchSize = 5000,
  filter,
  datasetFolder,
  groupTransformer = (gs) => gs,
}) => {
  const folder = path.resolve(datasetFolder);
  const pointers = {};

  const groups = await getGroups({ datasetFolder, groupTransformer });

  let fensInLastTestBatch = {};

  const getNextBatch = async ({ isDupe = getDefaultIsDupe() } = {}) => {
    const results = await Promise.all(
      groups.map(({ pointerKey, ratio }) =>
        readFromGroup({
          pointers,
          pointerKey,
          take: Math.ceil(globalBatchSize * ratio),
          folder,
          filter,
          isDupe,
          fensInLastTestBatch,
        }),
      ),
    );

    return shuffle(results.flat());
  };

  const getNextTestBatch = async ({ isDupe = getDefaultIsDupe(), batchSize = globalBatchSize } = {}) => {
    const tempPointers = {};

    const results = await Promise.all(
      groups.map(({ pointerKey, ratio }) =>
        readFromGroup({
          pointers: tempPointers,
          pointerKey,
          take: Math.ceil(globalBatchSize * ratio),
          folder,
          filter: (line) => Math.random() > 0.9 && filter(line),
          isDupe,
          randomFileOrder: true,
        }),
      ),
    );

    const result = shuffle(results.flat()).slice(0, batchSize);

    fensInLastTestBatch = result.reduce((p, c) => {
      p[c[0]] = true;
      return p;
    }, {});

    return result;
  };

  return {
    getNextBatch,
    getNextTestBatch,
  };
};
