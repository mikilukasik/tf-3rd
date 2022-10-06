import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { getGroups } from './groups.mjs';
import getFolderSize from 'get-folder-size';

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
  const firstFolder = split.slice(0, -2).concat(parentDirContents[0]).join('/');
  const firstFolderContents = (await fs.readdir(firstFolder)).sort();
  return path.resolve(firstFolder, firstFolderContents[0]);
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

const readFromGroup = async ({ pointers, pointerKey, take, folder }) => {
  const result = [];
  if (!take) return result;

  if (!pointers[pointerKey]) {
    // we only get here on 1st run if inited without pointers
    pointers[pointerKey] = {
      fileName: await getRandomFileFromDir(path.resolve(folder, pointerKey)),
      index: 0,
    };
  }

  let remaining = take;
  while (remaining) {
    const records = await readMore({ takeMax: remaining, pointers, pointerKey });
    remaining -= records.length;
    result.push(...records);
  }

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
      // console.log({ groupName, c: sampleCounts[groupName] });
      // const progressGroup = progressGroupAnyType.toString();

      // for (const { groupName, take } of groups) {
      // const adjustedTake = Math.round(take * multipliers[groupName][progressGroup]);
      // const pointerKey = `${progressGroup}/${groupName}`;

      const groupResults = await readFromGroup({
        pointers,
        pointerKey: groupName,
        take: sampleCounts[groupName],
        folder,
        // groupName,
      });

      result.push(...groupResults);
      // }
    }

    result.sort(() => Math.random() - 0.5);

    return result;
  };

  return {
    getNextBatch,
  };
};
