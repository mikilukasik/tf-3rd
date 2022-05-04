import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { getGroups } from './groups.mjs';
import getFolderSize from 'get-folder-size';

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

const getCategorySizes = async ({ folder, progressGroups, groups }) => {
  const sizes = groups.reduce((p, { groupName }) => {
    p[groupName] = [];
    return p;
  }, {});

  for (const { groupName } of groups) {
    for (const progressGroup of progressGroups) {
      const { size } = await getFolderSize(path.resolve(folder, progressGroup.toString(), groupName));
      sizes[groupName][progressGroup] = size;
    }
  }

  return sizes;
};

const getMultipliers = ({ sizes, groups }) => {
  const multipliers = groups.reduce((p, { groupName }) => {
    p[groupName] = [];
    return p;
  }, {});

  Object.keys(sizes).forEach((groupName) => {
    const total = sizes[groupName].reduce((p, c) => p + c);
    const cutoff = total / sizes[groupName].length / 3;
    const rawRatios = sizes[groupName].map((size) => (size > cutoff ? 1 : size / total));
    const rawRatiosMultiplier = sizes[groupName].length / rawRatios.reduce((p, c) => p + c);
    multipliers[groupName] = rawRatios.map((r) => r * rawRatiosMultiplier);
  });

  return multipliers;
};

const readMore = async ({ takeMax, pointers, pointerKey }) => {
  const rawData = await fs.readFile(pointers[pointerKey].fileName, 'utf-8');
  const parsedData = rawData
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
}) => {
  const pointers = Object.assign({}, _pointers);
  const groups = getGroups(batchSize / progressGroups.length);

  const sizes = await getCategorySizes({ folder, progressGroups, groups });
  const multipliers = getMultipliers({ sizes, groups });

  const getNextBatch = async () => {
    const result = [];
    for (const progressGroupAnyType of progressGroups) {
      const progressGroup = progressGroupAnyType.toString();

      for (const { groupName, take } of groups) {
        const adjustedTake = Math.round(take * multipliers[groupName][progressGroup]);
        const pointerKey = `${progressGroup}/${groupName}`;

        const groupResults = await readFromGroup({ pointers, pointerKey, take: adjustedTake, folder });
        result.push(...groupResults);
      }
    }

    result.sort(() => Math.random() - 0.5);

    return result;
  };

  return {
    getNextBatch,
  };
};
