import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

const getNextFileName = async (fileName, rootFolder, deepFileName, subCall = false) => {
  if (fileName === rootFolder) {
    console.log(`finished reading dataset at file ${deepFileName}`);
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

  const nextFolder = await getNextFileName(folderName, rootFolder, deepFileName || fileName, true);
  const firstFileNameInNextFolder = path.resolve(nextFolder, (await fs.readdir(nextFolder)).sort()[0]);

  if (!subCall) console.log(`reading from folder: ${nextFolder}`);

  return firstFileNameInNextFolder;
};

const readMore = async ({ takeMax, pointers, pointerKey, folder }) => {
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

  pointers[pointerKey] = {
    fileName: await getNextFileName(pointers[pointerKey].fileName, folder),
    index: 0,
  };

  return parsedData;
};

const readFromGroup = async ({ pointers, pointerKey, take, folder, filter = () => true, isDupe }) => {
  // console.log({ pointers, pointerKey, folder });
  // process.exit(0);

  const result = [];
  if (!take) return result;

  // console.log({ pointers, pointerKey, take, folder, filter, noDupes }, 'a');
  // process.exit(0);

  const groupFolder = path.resolve(folder, pointerKey);

  if (!pointers[pointerKey]) {
    // we only get here on 1st run if inited without pointers
    const fileName = await getRandomFileFromDir(groupFolder);

    // console.log({ fileName });
    // process.exit(0);

    console.log(`starting to read dataset from file ${fileName}`);

    pointers[pointerKey] = {
      fileName,
      index: 0,
    };
  }

  let removedDupes = 0;

  let remaining = take;
  while (remaining) {
    const records = (await readMore({ takeMax: remaining, pointers, pointerKey, folder: groupFolder })).filter(
      (line) => {
        if (!filter(line)) return false;

        if (isDupe(line[0])) {
          removedDupes += 1;
          return false;
        }

        return true;
      },
    );
    remaining -= records.length;
    result.push(...records);
  }

  if (removedDupes) console.log(`Filtered out ${removedDupes} duplicate fens`);

  return result;
};

export const datasetReaderV3 = async ({
  folder,
  batchSize = 5000,
  pointers: _pointers = {},
  filter,
  test = false,
  // dupeCacheMinutes = 1,
  dupeCacheSize = 1000000,
  preReadDupeCache = true,
}) => {
  const pointers = Object.assign({}, _pointers);

  const dupeCacheBlockSize = Math.ceil(dupeCacheSize / 100);
  let activeDupeBlockLength = 0;
  const dupeCacheBlocks = [{}];

  const processDupeCache = () => {
    dupeCacheBlocks.unshift({});
    if (dupeCacheBlocks.length > 100) dupeCacheBlocks.pop();
    activeDupeBlockLength = 0;
  };

  const shuffleDupeCache = () => {
    const allKeys = shuffle(dupeCacheBlocks.reduce((p, c) => p.concat(Object.keys(c)), []));
    dupeCacheBlocks.length = 0;
    dupeCacheBlocks.push({});
    activeDupeBlockLength = 0;

    allKeys.forEach((key) => {
      dupeCacheBlocks[0][key] = true;
      activeDupeBlockLength += 1;

      if (activeDupeBlockLength >= dupeCacheBlockSize) processDupeCache();
    });
  };

  const isDupe = (key) => {
    if (!dupeCacheSize) return false;

    const seenAlready = dupeCacheBlocks.reduce((p, c) => {
      return p || c[key];
    }, false);

    if (seenAlready) return true;

    dupeCacheBlocks[0][key] = true;
    activeDupeBlockLength += 1;

    if (activeDupeBlockLength >= dupeCacheBlockSize) processDupeCache();

    return false;
  };

  if (preReadDupeCache) {
    await readFromGroup({
      pointers,
      pointerKey: test ? 'test-true' : 'test-false',
      take: Math.floor(dupeCacheSize / 2),
      folder,
      filter,
      isDupe,
    });

    shuffleDupeCache();
  }

  const getNextBatch = () =>
    readFromGroup({
      pointers,
      pointerKey: test ? 'test-true' : 'test-false',
      take: batchSize,
      folder,
      filter,
      isDupe,
    });
  return {
    getNextBatch,
  };
};
