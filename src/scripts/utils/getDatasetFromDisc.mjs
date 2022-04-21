import { getGroups } from './getDataset.mjs';
import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';

const FOLDER = './data/datasetCsvs';

const getFirstFileName = (fileName) => {
  const split = fileName.split('/');
  const len = split.length;

  const fileNameParts = split[len - 1].replace('.csv', '').split('_');
  const newFileName = `${fileNameParts.slice(0, -1).concat(0).join('_')}.csv`;

  split[len - 1] = newFileName;
  split[len - 2] = '0';
  split[len - 3] = '0';

  return split.join('/');
};

const getNextFileName = (fileName) => {
  const split = fileName.split('/');
  const len = split.length;

  const fileNameParts = split[len - 1].replace('.csv', '').split('_');

  const nextNumber = Number(fileNameParts[fileNameParts.length - 1]) + 250;

  const newFileName = `${fileNameParts.slice(0, -1).concat(nextNumber).join('_')}.csv`;
  split[len - 1] = newFileName;

  split[len - 2] = (Math.floor(nextNumber / 10000) * 10000).toString();
  split[len - 3] = (Math.floor(nextNumber / 1000000) * 1000000).toString();

  return split.join('/');
};

export const getDatasetFromDisc = async ({ pointers: _pointers = {}, testData = false, limit = 1000 } = {}) => {
  const pointers = Object.assign({}, _pointers);

  const groups = getGroups(limit / 22);

  const result = [];

  for (const { groupName, take } of groups) {
    if (!pointers[groupName])
      pointers[groupName] = await getRandomFileFromDir(path.resolve(FOLDER, `test-${testData}`, groupName));

    let filesCount = Math.round(take / 250);
    while (filesCount--) {
      try {
        await fs.stat(pointers[groupName]);
      } catch (e) {
        // file didn't exist, start from beginning
        pointers[groupName] = getFirstFileName(pointers[groupName]);
      }

      const rawData = await fs.readFile(pointers[groupName], 'utf-8');
      rawData.split('\n').forEach((row) => {
        const [fen, v2OutputAsStr] = row.split(',');
        const v2Output = Number(v2OutputAsStr);

        result.push({ fen, v2Output });
      });

      pointers[groupName] = getNextFileName(pointers[groupName]);
    }
  }

  result.sort(() => Math.random() - 0.5);

  return { result, newPointers: pointers };
};
