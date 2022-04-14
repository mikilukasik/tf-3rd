import { promises as fs } from 'fs';
import * as path from 'path';
import readRecords from '../utils/readRecords.mjs';

const sourceFolder = 'data/datasets/1st_expanded';
const destFolder = 'data/datasets/1st_split';
const batchLength = 10000;
const testRatio = 0.1;

const pad = (_num, size) => {
  let num = _num.toString();
  while (num.length < size) num = `0${num}`;
  return num;
};

const fensCache = {
  train: [],
  test: [],
};

const fileIndexes = Object.keys(fensCache).reduce((fi, key) => {
  fi[key] = 1;
  return fi;
}, {});

const purgeCache = async ({ keys = Object.keys(fensCache) } = {}) => {
  for (const key of keys) {
    await fs.writeFile(
      path.resolve(destFolder, key, `${pad(fileIndexes[key]++, 3)}-s${fensCache[key].length}.json`),
      JSON.stringify(fensCache[key]),
      'utf8',
    );
    fensCache[key].length = 0;
  }
};

const addFens = async ({ fens }) => {
  for (const record of fens) {
    const key = Math.random() > testRatio ? 'train' : 'test';
    fensCache[key].push(record);
    if (fensCache[key].length >= batchLength) await purgeCache({ keys: [key] });
  }
};

const loadSourceFiles = async ({ sourceDatasetFiles }) => {
  for (const sourceFileName of sourceDatasetFiles) {
    console.log(`processing ${sourceFileName}...`);

    const fens = JSON.parse(await fs.readFile(path.resolve(sourceFolder, sourceFileName)));
    await addFens({ fens });
  }

  await purgeCache();
  // process.exit(0);
};

const run = async () => {
  await fs.mkdir(path.resolve(destFolder, 'train'), { recursive: true });
  await fs.mkdir(path.resolve(destFolder, 'test'));

  const sourceDatasetFiles = await fs.readdir(path.resolve(sourceFolder));

  await loadSourceFiles({ sourceDatasetFiles });
  // await createTempFiles({ sourceDatasetFiles });

  //   let batchIndex = 1;
  //   while (fenKeys.length) {
  //     console.log(`Creating batch ${batchIndex}...`);

  //     const thisBatch = [];
  //     // let batchLen = batchLength;
  //     while (thisBatch.length < batchLength && fenKeys.length) {
  //       thisBatch.push(...getRandomRecords());
  //     }

  //     await fs.writeFile(
  //       path.resolve(destFolder, `${pad(batchIndex++, 3)}-s${thisBatch.length}.json`),
  //       JSON.stringify(thisBatch),
  //       'utf8',
  //     );
  //   }

  // const { getNextRecordBatch } = await readRecords({ sourceFolder });
  // let totalRecords = 0;

  // const getNextBatch = async () => {
  //   let batch = [];

  //   // eslint-disable-next-line no-constant-condition
  //   while (true) {
  //     const nextBatch = await getNextRecordBatch();
  //     batch = batch.concat(nextBatch);

  //     if (!nextBatch.length || batch.length > minBatchLength) return batch;
  //   }
  // };

  // let fileIndex = 0;
  // for (let batch = await getNextBatch(); batch.length; batch = await getNextBatch()) {
  //   fileIndex += 1;
  //   totalRecords += batch.length;

  //   await fs.writeFile(
  //     path.resolve(destFolder, `${pad(fileIndex, 4)}-s${batch.length}.json`),
  //     JSON.stringify(batch),
  //     'utf8',
  //   );

  //   console.log({ fileIndex, totalRecords });
  // }
};

run();
