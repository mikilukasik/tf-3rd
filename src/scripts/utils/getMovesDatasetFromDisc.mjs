import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { getGroups } from './groups.mjs';
import getFolderSize from 'get-folder-size';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

// const GROUP_SIZE_CUTOFF = 30000000;

const topGroups = ['movesFrom', 'movesTo'];

const getNextFileName = async (fileName) => {
  const split = fileName.split('/');

  const dirContents = (await fs.readdir(split.slice(0, -1).join('/'))).sort();
  const currentIndex = dirContents.findIndex((file) => file === split[split.length - 1]);

  if (currentIndex < dirContents.length - 1) {
    return split
      .slice(0, -1)
      .concat(dirContents[currentIndex + 1])
      .join('/');
  }

  const parentDirContents = (await fs.readdir(split.slice(0, -2).join('/'))).sort();
  const currentParentIndex = parentDirContents.findIndex((dir) => dir === split[split.length - 2]);

  if (currentParentIndex < parentDirContents.length - 1) {
    const nextFolder = split
      .slice(0, -2)
      .concat(parentDirContents[currentParentIndex + 1])
      .join('/');

    const nextFolderContents = (await fs.readdir(nextFolder)).sort();
    return path.resolve(nextFolder, nextFolderContents[0]);
  }

  // read all in category, start from beginning
  console.log(`finished reading dataset at file ${fileName}`);

  const firstFolder = split.slice(0, -2).concat(parentDirContents[0]).join('/');
  const firstFolderContents = (await fs.readdir(firstFolder)).sort();

  const newFileName = path.resolve(firstFolder, firstFolderContents[0]);
  console.log(`starting dataset from beginning at file ${newFileName}`);

  return newFileName;
};

const getSampleCounts = async ({ folder, progressGroups, groups, test, batchSize }) => {
  const sizes = {};
  let maximum = 0;
  const sampleCounts = {};
  // groups.reduce((p, { groupName }) => {
  //   p[groupName] = [];
  //   return p;
  // }, {});

  for (const topGroupName of topGroups) {
    // console.log({ topGroupName });
    for (const { groupName } of groups) {
      for (const progressGroup of progressGroups) {
        for (const fromOrTo of new Array(64).fill(0).map((e, i) => i.toString())) {
          const { size } = await getFolderSize(
            path.resolve(
              folder,
              topGroupName,
              test ? 'test-true' : 'test-false',
              progressGroup.toString(),
              fromOrTo,
              groupName,
            ),
          );

          const groupKey = `${topGroupName}/${
            test ? 'test-true' : 'test-false'
          }/${progressGroup}/${fromOrTo}/${groupName}`;

          sizes[groupKey] = size;
          // sampleCounts[groupKey] = size > GROUP_SIZE_CUTOFF ? 1 : size / GROUP_SIZE_CUTOFF;

          maximum = Math.max(maximum, size);
          // const sizeGroup = Math.floor(size / 1000000).toString();
          // sizeGroups[sizeGroup] = (sizeGroups[sizeGroup] || 0) + 1;
          // sizes[groupName][progressGroup] = sizes[groupName][progressGroup] || [];
          // sizes[groupName][progressGroup][fromOrTo] = sizes[groupName][progressGroup][fromOrTo] || {};
          // sizes[groupName][progressGroup][fromOrTo][topGroupName] = size;
        }
      }
    }
  }

  const cutoff = maximum / 50;
  let total = 0;
  for (const key of Object.keys(sizes)) {
    sampleCounts[key] = sizes[key] > cutoff ? 1 : sizes[key] / cutoff;
    total += sampleCounts[key];
  }
  for (const key of Object.keys(sampleCounts)) {
    sampleCounts[key] = Math.ceil((sampleCounts[key] / total) * batchSize);
  }

  // console.log(JSON.stringify({ sizes }, null, 2));
  // console.log({ sizes, sampleCounts });
  // process.exit(0);

  return sampleCounts;
};

// const getMultipliers = ({ sizes, groups }) => {
//   const multipliers = groups.reduce((p, { groupName }) => {
//     p[groupName] = [];
//     return p;
//   }, {});

//   Object.keys(sizes).forEach((groupName) => {
//     const total = sizes[groupName].reduce((p, c) => p + c);
//     const cutoff = total / sizes[groupName].length / 3;
//     const rawRatios = sizes[groupName].map((size) => (size > cutoff ? 1 : size / total));
//     const rawRatiosMultiplier = sizes[groupName].length / rawRatios.reduce((p, c) => p + c);
//     multipliers[groupName] = rawRatios.map((r) => r * rawRatiosMultiplier);
//   });

//   return multipliers;
// };

const readMore = async ({ takeMax, pointers, pointerKey }) => {
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
    fileName: await getNextFileName(pointers[pointerKey].fileName),
    index: 0,
  };

  return parsedData;
};

const readFromGroup = async ({ pointers, pointerKey, take, folder, filter = () => true, noDupes }) => {
  const result = [];
  if (!take) return result;

  if (!pointers[pointerKey]) {
    // we only get here on 1st run if inited without pointers
    const fileName = await getRandomFileFromDir(path.resolve(folder, pointerKey));

    console.log(`starting to read dataset from file ${fileName}`);

    pointers[pointerKey] = {
      fileName,
      index: 0,
    };
  }

  const fensSeen = {};
  let removedDupes = 0;

  let remaining = take;
  while (remaining) {
    const records = (await readMore({ takeMax: remaining, pointers, pointerKey })).filter(
      // TODO: make this more random. we should choose any one of the dupes, not always the 1st one
      noDupes
        ? (line) => {
            if (fensSeen[`${line[1]}${line[7]}`]) {
              removedDupes += 1;
              return false;
            }
            if (!filter(line)) return false;

            fensSeen[`${line[1]}${line[7]}`] = true;
            return true;
          }
        : filter,
    );
    remaining -= records.length;
    result.push(...records);
  }

  if (removedDupes) console.log(`Filtered out ${removedDupes} duplicate fens`);

  return result;
};

export const datasetReader = async ({
  folder,
  batchSize = 100000,
  progressGroups = [0, 1, 2],
  pointers: _pointers = {},
  test = false,
}) => {
  const pointers = Object.assign({}, _pointers);
  const groups = getGroups(batchSize / progressGroups.length);

  const sampleCounts = await getSampleCounts({ folder, progressGroups, groups, test, batchSize });
  // const multipliers = getMultipliers({ sizes, groups });

  const getNextBatch = async () => {
    const result = [];
    for (const groupName of Object.keys(sampleCounts)) {
      const groupResults = await readFromGroup({
        pointers,
        pointerKey: groupName,
        take: sampleCounts[groupName],
        folder,
      });

      result.push(...groupResults);
    }

    shuffle(result);

    return result;
  };

  return {
    getNextBatch,
  };
};

export const datasetReaderV2 = async ({
  folder,
  batchSize = 5000,
  pointers: _pointers = {},
  filter,
  test = false,
  noDupes = false,
}) => {
  const pointers = Object.assign({}, _pointers);

  const getNextBatch = () =>
    readFromGroup({
      pointers,
      pointerKey: test ? 'test-true' : 'test-false',
      take: batchSize,
      folder,
      filter,
      noDupes,
    });

  return {
    getNextBatch,
  };
};
