import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { getGroups } from './groups.mjs';
import getFolderSize from 'get-folder-size';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';
import { getFirstFileFromDir } from './getFirstFileFromDir.mjs';

// const GROUP_SIZE_CUTOFF = 30000000;

const getNextFileName = async (fileName, rootFolder, deepFileName) => {
  const split = fileName.split('/');
  const depth = split.length - rootFolder.split('/').length;

  const folderName = split.slice(0, -1).join('/');
  const dirContents = (await fs.readdir(folderName)).sort();
  const currentIndex = dirContents.findIndex((file) => file === split[split.length - 1]);

  if (currentIndex < dirContents.length - 1) {
    return split
      .slice(0, -1)
      .concat(dirContents[currentIndex + 1])
      .join('/');
  }

  if (depth > 0) {
    const nextFolder = await getNextFileName(folderName, rootFolder, deepFileName || fileName, false);
    const firstFileNameInNextFolder = path.resolve(nextFolder, (await fs.readdir(nextFolder)).sort()[0]);

    return firstFileNameInNextFolder;
  }

  // read all in category, start from beginning
  console.log(`finished reading dataset at file ${deepFileName}`);
  return fileName;
};

const readMore = async ({ takeMax, pointers, pointerKey, folder }) => {
  // console.log({ pointers, pointerKey, folder }, 66);
  // process.exit(0);

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

const readFromGroup = async ({ pointers, pointerKey, take, folder, filter = () => true }) => {
  // console.log({ pointers, pointerKey, folder });
  // process.exit(0);

  const dupeCache = {};
  // let dupeSum = 0;
  // let dupeSampleCount = 0;

  // setInterval(() => {
  //   const dupeCacheSize = dupeCaches.reduce((p, c) => p + Object.keys(c).length, 0);

  //   dupeSum += dupeCacheSize;
  //   dupeSampleCount += 1;

  //   console.log({ test, dupeCacheSize, avg: Math.round(dupeSum / dupeSampleCount) });
  // }, 17583);

  // setInterval(() => {
  //   // console.log({
  //   //   dupeCacheSize: dupeCaches.reduce((p, c) => {
  //   //     p += Object.keys(c).length;
  //   //   }, 0),
  //   // });

  //   dupeCaches.unshift({});
  //   if (dupeCaches.length > dupeCacheMinutes) dupeCaches.pop();
  // }, 60000);

  const isDupe = (key) => {
    const seenAlready = dupeCache[key];

    if (seenAlready) return true;

    dupeCache[key] = true;
    return false;
  };

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

export const datasetReaderV2 = async ({
  folder,
  batchSize = 5000,
  pointers: _pointers = {},
  filter,
  test = false,
  dupeCacheMinutes = 1,
}) => {
  const pointers = Object.assign({}, _pointers);

  // const dupeCaches = [{}];
  // let dupeSum = 0;
  // let dupeSampleCount = 0;

  // setInterval(() => {
  //   const dupeCacheSize = dupeCaches.reduce((p, c) => p + Object.keys(c).length, 0);

  //   dupeSum += dupeCacheSize;
  //   dupeSampleCount += 1;

  //   console.log({ test, dupeCacheSize, avg: Math.round(dupeSum / dupeSampleCount) });
  // }, 17583);

  // setInterval(() => {
  //   // console.log({
  //   //   dupeCacheSize: dupeCaches.reduce((p, c) => {
  //   //     p += Object.keys(c).length;
  //   //   }, 0),
  //   // });

  //   dupeCaches.unshift({});
  //   if (dupeCaches.length > dupeCacheMinutes) dupeCaches.pop();
  // }, 60000);

  // const isDupe = (key) => {
  //   const seenAlready = dupeCaches.reduce((p, c) => {
  //     return p || c[key];
  //   }, false);

  //   if (seenAlready) return true;

  //   dupeCaches[0][key] = true;
  //   return false;
  // };

  const getNextBatch = () =>
    readFromGroup({
      pointers,
      pointerKey: test ? 'test-true' : 'test-false',
      take: batchSize,
      folder,
      filter,
      // isDupe,
    });

  return {
    getNextBatch,
  };
};
