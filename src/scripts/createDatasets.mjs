import { promises as fs } from 'fs';
import * as path from 'path';
import readRecords from '../utils/readRecords.mjs';

const sourceFolder = 'data/records';
const destFolder = 'data/datasets/all_frontSpread_cm+sm_noResign_noDrawSmOnly';
const minBatchLength = 100000;

const pad = (_num, size) => {
  let num = _num.toString();
  while (num.length < size) num = `0${num}`;
  return num;
};

const run = async () => {
  await fs.mkdir(path.resolve(destFolder), { recursive: true });

  const { getNextRecordBatch } = await readRecords({ sourceFolder });
  let totalRecords = 0;

  const getNextBatch = async () => {
    let batch = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const nextBatch = await getNextRecordBatch();
      batch = batch.concat(nextBatch);

      if (!nextBatch.length || batch.length > minBatchLength) return batch;
    }
  };

  let fileIndex = 0;
  for (let batch = await getNextBatch(); batch.length; batch = await getNextBatch()) {
    fileIndex += 1;
    totalRecords += batch.length;

    await fs.writeFile(
      path.resolve(destFolder, `${fileIndex}-${pad(fileIndex, 4)}-${(batch.length / 1000).toFixed(0)}k.json`),
      JSON.stringify(batch),
      'utf8',
    );

    console.log({ fileIndex, totalRecords });
  }
};

run();
