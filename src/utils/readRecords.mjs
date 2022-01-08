import { promises as fs } from 'fs';
import * as path from 'path';

const getAllBottomDirNames = async (dir) => {
  const results = [];
  const list = await fs.readdir(dir);

  let hasSubDirs = false;

  let i = list.length;
  while (i--) {
    const file = path.resolve(dir, list[i]);
    const stat = await fs.stat(file);

    if (stat && stat.isDirectory()) {
      hasSubDirs = true;
      results.push(...(await getAllBottomDirNames(file)));
    }
  }

  if (!hasSubDirs && list.length > 0) results.push(dir);
  return results;
};

const readRecords = async ({ sourceFolder, skip = 0, limit }) => {
  const recordDirs = await getAllBottomDirNames(sourceFolder);
  console.log(`Will read records files from ${recordDirs.length} categories...`);

  let fileIndex = skip;

  const getFileName = (dirName) =>
    `${dirName.split(sourceFolder)[1].split('/').join('-')}-${fileIndex}.json`.replace(/^-/, '');

  const getNextRecordBatch = async () => {
    fileIndex += 1;
    const files = recordDirs.map((dirName) => path.resolve(dirName, getFileName(dirName)));

    const records = [];
    for (const file of files) {
      try {
        records.push(...JSON.parse(await fs.readFile(file, 'utf8')));
      } catch (e) {
        /* */
      }
    }

    records.sort(() => Math.random() - 0.5);

    return records;
  };

  return {
    getNextRecordBatch,
  };
};

export default readRecords;
