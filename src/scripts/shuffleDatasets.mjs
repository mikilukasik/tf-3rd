import { promises as fs } from 'fs';
import * as path from 'path';
import readRecords from '../utils/readRecords.mjs';

const sourceFolder = 'data/datasets/1st_42';
const destFolder = 'data/datasets/1st_42_shuffled';
const batchLength = 50000;

// const tempFolder = `${destFolder.split('/').slice(0, -1).join('/')}/shufflerTemp`;

const pad = (_num, size) => {
  let num = _num.toString();
  while (num.length < size) num = `0${num}`;
  return num;
};

// const createTempFilesFromFens = async ({ fens }) => {
//   for (const fenObj of fens) {
//     const splitFen = fenObj.fen.split(' ')[0].split('/');
//     const folder = path.resolve(tempFolder, ...splitFen);
//     const fileName = `${Date.now()}.json`;

//     await fs.mkdir(folder, { recursive: true });
//     await fs.writeFile(path.resolve(folder, fileName), JSON.stringify(fenObj), 'utf8');
//   }
// };

// const createTempFiles = async ({ sourceDatasetFiles }) => {
//   for (const sourceFileName of sourceDatasetFiles) {
//     console.log(`processing ${sourceFileName}...`);

//     const fens = JSON.parse(await fs.readFile(path.resolve(sourceFolder, sourceFileName)));
//     await createTempFilesFromFens({ fens });
//   }

//   process.exit(0);
// };

const fensCache = {};
const fenKeys = [];

const addFens = async ({ fens }) => {
  for (const { fen, result, balancesAhead } of fens) {
    if (!fensCache[fen]) {
      fenKeys.push(fen);
      fensCache[fen] = [];
    }

    fensCache[fen].push({ r: result, b: balancesAhead });
  }
};

const loadSourceFiles = async ({ sourceDatasetFiles }) => {
  for (const sourceFileName of sourceDatasetFiles) {
    console.log(`processing ${sourceFileName}...`);

    const fens = JSON.parse(await fs.readFile(path.resolve(sourceFolder, sourceFileName)));
    await addFens({ fens });
  }

  // process.exit(0);
};

const getAggregatedRecords = (fen) => {
  const recordsForFen = fensCache[fen];

  const recordsPerResult = {};
  recordsForFen.forEach(({ r, b }) => {
    if (!recordsPerResult[r]) recordsPerResult[r] = [];
    // console.log({ b });
    recordsPerResult[r].push(b);
  });
  // console.log(recordsPerResult);
  const getBalancesAhead = (balancesAheadBatch) => {
    const avgBalancesAhead = [];
    const inputLength = balancesAheadBatch.length;

    const longestArrLength = Math.max(balancesAheadBatch.map((ba) => ba.length));
    // console.log({ longestArrLength, balancesAheadBatch });
    balancesAheadBatch.forEach((balancesAhead) => {
      if (balancesAhead.length < longestArrLength) {
        balancesAhead.push(
          ...new Array(longestArrLength - balancesAhead.length).fill(balancesAhead[balancesAhead.length - 1]),
        );
      }

      balancesAhead.forEach((balance, i) => {
        avgBalancesAhead[i] = (avgBalancesAhead[i] || 0) + balance / inputLength;
      });
    });

    return avgBalancesAhead;
  };

  const records = Object.keys(recordsPerResult).map((result) => ({
    fen,
    result: Number(result),
    balancesAhead: getBalancesAhead(recordsPerResult[result]),
  }));
  // console.log(records);
  return records;
};

const getRandomRecords = () => {
  const randomIndex = Math.floor(Math.random() * fenKeys.length);
  const fenKey = fenKeys[randomIndex];
  const records = getAggregatedRecords(fenKey);
  delete fensCache[fenKey];
  fenKeys.splice(randomIndex, 1);
  return records;
};

const run = async () => {
  await fs.mkdir(path.resolve(destFolder), { recursive: true });

  const sourceDatasetFiles = await fs.readdir(path.resolve(sourceFolder));

  await loadSourceFiles({ sourceDatasetFiles });
  // await createTempFiles({ sourceDatasetFiles });

  let batchIndex = 1;
  while (fenKeys.length) {
    console.log(`Creating batch ${batchIndex}...`);

    const thisBatch = [];
    // let batchLen = batchLength;
    while (thisBatch.length < batchLength && fenKeys.length) {
      thisBatch.push(...getRandomRecords());
    }

    await fs.writeFile(
      path.resolve(destFolder, `${pad(batchIndex++, 3)}-s${thisBatch.length}.json`),
      JSON.stringify(thisBatch),
      'utf8',
    );
  }

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
