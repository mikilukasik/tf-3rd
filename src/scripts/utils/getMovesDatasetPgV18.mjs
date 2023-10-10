import * as path from 'path';
import { promises as fs } from 'fs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';
import { getSavedObject } from '../../../chss-module-engine/src/utils/savedObject/savedObject.mjs';
import { getRandomizedFilelist } from './getRandomizedFilelist.mjs';
import { getXsAsString as getXs } from '../../utils/getXsV2.js';
import zlib from 'zlib';
import { onehot_map } from './onehot_map.mjs';

const datasetFolder = path.resolve('./data/gz_v8/default');

// const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const recordsPerDataset = 100000;
const testRecordsPerDataset = 20000;

const getGroups = async ({ datasetFolder, groupTransformer }) => {
  const dirContents = (await fs.readdir(datasetFolder)).filter((name) => name !== '.DS_Store').sort();
  const groups = dirContents.map((pointerKey) => ({ pointerKey /* , ratio */ }));
  const transformedGroups = groupTransformer(groups);
  const ratio = 1 / transformedGroups.length;

  return transformedGroups.map(({ pointerKey }) => ({ pointerKey, ratio }));
};

const readMore = async ({ takeMax, pointers, pointerKey, folder, beginningToEnd, randomFileOrder, readerMeta }) => {
  const compressedData = await fs.readFile(readerMeta.files[pointerKey][pointers[pointerKey].fileIndex]);

  const rawData = await new Promise((r) => {
    // Decompress the data using gzip
    zlib.gunzip(compressedData, (err, uncompressedData) => {
      if (err) {
        console.error(err);
        return;
      }

      // Convert the uncompressed data to a string
      const csvData = uncompressedData.toString();

      // Call the callback function with the CSV data
      r(csvData);
    });
  });

  const parsedData = rawData
    .trim()
    .split('\n')
    .slice(pointers[pointerKey].lineIndex)
    .map((row) => row.split(',')); // Number() ?
  // console.log(parsedData.length);

  if (parsedData.length > takeMax) {
    pointers[pointerKey].lineIndex = pointers[pointerKey].lineIndex + takeMax;

    return parsedData.slice(0, takeMax);
  }

  // console.log(1, pointers[pointerKey].fileIndex);

  pointers[pointerKey].fileIndex = randomFileOrder
    ? Math.floor(Math.random() * readerMeta.files[pointerKey].length)
    : pointers[pointerKey].fileIndex + 1; // % readerMeta.files[pointerKey].length,

  if (pointers[pointerKey].fileIndex >= readerMeta.files[pointerKey].length) {
    pointers[pointerKey].fileIndex = 0;

    if (!readerMeta.filteredSampleCountsPerGroup[pointerKey].timesCompleted) {
      readerMeta.filteredSampleCount += readerMeta.filteredSampleCountsPerGroup[pointerKey].count;
    }
    readerMeta.filteredSampleCountsPerGroup[pointerKey].timesCompleted += 1;
    readerMeta.filteredSampleCountsPerGroup[pointerKey].count = 0;

    console.log({ countsPerGroup: readerMeta.filteredSampleCountsPerGroup, total: readerMeta.filteredSampleCount });

    shuffle(readerMeta.files[pointerKey]);
    // readerMeta.files[pointerKey].push(...(await getRandomizedFilelist(path.resolve(datasetFolder, pointerKey))));
  }

  pointers[pointerKey].lineIndex = 0;

  // console.log(2, pointers[pointerKey].fileIndex);

  return parsedData;
};

const readFromGroup = async ({
  readerMeta,
  // pointers = {},
  pointerKey,
  take,
  // folder,
  filter = () => true,
  isDupe,
  beginningToEnd,
  dontLogDupes,
  fensInLastTestBatch = {},
  randomFileOrder,
  // fileList,
}) => {
  // console.log('------', Object.keys(fensInLastTestBatch).sort()[0]);

  const result = [];
  if (!take) return result;

  const groupFolder = path.resolve(readerMeta.datasetFolder, pointerKey);

  const resetPointer = async (currentPointers, setTo0) => {
    const fileIndex = setTo0 ? 0 : Math.floor(Math.random() * readerMeta.files[pointerKey].length);

    if (!randomFileOrder) console.log(`starting to read dataset from file index ${fileIndex}`);

    currentPointers[pointerKey] = {
      fileIndex,
      lineIndex: 0,
    };
    // console.log('itt');
    return currentPointers;
  };

  if (!readerMeta.pointers[pointerKey]) {
    await resetPointer(readerMeta.pointers, true);
  }

  let removedDupes = 0;
  let removedTestFens = 0;
  let remaining = take;

  // console.log('meg itt');
  while (remaining /* && pointers[pointerKey].fileName*/) {
    const records = (
      await readMore({
        takeMax: remaining,
        pointers: randomFileOrder ? await resetPointer({}) : readerMeta.pointers,
        pointerKey,
        readerMeta,
        folder: groupFolder,
        beginningToEnd,
        randomFileOrder,
      })
    ).filter((line) => {
      if (!filter(line)) return false;

      if (isDupe(line)) {
        removedDupes += 1;
        return false;
      }

      if (fensInLastTestBatch[line[0]]) {
        removedTestFens += 1;
        return false;
      }

      return true;
    });
    remaining -= records.length;
    result.push(...records);
    // console.log({ readerMeta, pointerKey });
    readerMeta.filteredSampleCountsPerGroup[pointerKey].count += records.length;
  }

  if (removedDupes && !dontLogDupes) console.log(`${pointerKey}: ${removedDupes} duplicate fens`);
  if (removedTestFens && !dontLogDupes) console.log(`${pointerKey}: ${removedTestFens} test fens`);

  return result;
};

const getDefaultIsDupe = () => {
  const dupeCache = {};

  return (record) => {
    if (dupeCache[record[0]]) return true;

    dupeCache[record[0]] = true;
    return false;
  };
};

const getMultiEpochIsDupe = (() => {
  const caches = [];
  let isFirstPop = true;

  return (maxEpochs) => {
    if (caches.length > maxEpochs) {
      if (isFirstPop) {
        isFirstPop = false;

        //randomize caches

        console.log('randomizing caches...');
        const allFensShullfed = shuffle(caches.reduce((p, cache) => p.concat(Object.keys(cache)), []));
        let i = caches.length;
        while (i--) caches[i] = {};

        while (allFensShullfed.length) {
          const l = allFensShullfed.length;
          caches[l % caches.length][allFensShullfed.pop()] = true;
        }
      }
      caches.shift();
    }

    console.log(
      `isdupe caches length ${caches.length}, total samples: ${caches.reduce((p, c) => p + Object.keys(c).length, 0)}`,
    );

    const dupeCache = {};
    caches.push(dupeCache);

    return (record) => {
      let i = caches.length;
      while (i--) if (caches[i][record[0]]) return true;

      dupeCache[record[0]] = true;
      return false;
    };
  };
})();

const getFiles = async ({ groups }) => {
  const result = {};

  for (const { pointerKey } of groups) {
    const folder = path.resolve(datasetFolder, pointerKey);
    result[pointerKey] = await getRandomizedFilelist(folder);
  }

  return result;
};

const readers = {};
export const datasetReader = async (options) => {
  // dr18
  if (readers[options.id]) return readers[options.id];

  console.log({ options });
  const id = options.id || Date.now().toString() + Math.random().toString().replace('0.', '');

  const { data: readerMeta, methods } = await getSavedObject(`./data/datasetReader/readerMetas/${id}`);
  await methods.loadData();

  const reader = await getDatasetReader({
    ...options,
    id,
    readerMeta,
  });

  readers[reader.id] = reader;
  return reader;
};

const getDatasetReader = async ({
  filter,
  groupTransformer = (gs) => gs,
  id: sessionId,
  format: defaultFormat = 'columns',
  ysformat: defaultYsformat = 'default',
  xsformat: defaultXsformat = 'default',
  readerMeta,
}) => {
  console.log('creating new reader... ', { readerMeta }, filter);

  if (!sessionId) throw new Error('missing session id in datasetreader');

  if (!readerMeta.datasetFolder) readerMeta.datasetFolder = path.resolve(datasetFolder);
  if (!readerMeta.pointers) readerMeta.pointers = {};
  if (!readerMeta.testPointers) readerMeta.testPointers = {};

  const groups = await getGroups({ datasetFolder, groupTransformer });
  if (!readerMeta.files) {
    const fls = await getFiles({ groups });
    console.log('filling', Object.keys(fls).length);
    readerMeta.files = fls;
  }

  if (!readerMeta.filteredSampleCountsPerGroup)
    readerMeta.filteredSampleCountsPerGroup = groups.reduce((p, c) => {
      p[c.pointerKey] = { count: 0, timesCompleted: 0 };
      return p;
    }, {});
  if (!readerMeta.filteredSampleCount) readerMeta.filteredSampleCount = 0;

  // console.log('sohuold have files', { readerMeta }, readerMeta.files['0.25 - 0.50'][10]);

  let fensInLastTestBatch = {};

  const transformRecord = (record) => {
    // 0 fen,
    // 1 onehot_move,
    // 2 hit_soon,
    // 3   hit_or_win_soon,
    // 4   chkmate_soon,
    // 5   result,
    // 6   chkmate_ending ? '1' : '',
    // 7   stall_ending ? '1' : '',
    // 8   lmf.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // 9   lmt.map((val) => val.toString(16).padStart(2, '0')).join(''),
    // 10  chkmate_ending || stall_ending ? progress : '',
    // 11  chkmate_ending || stall_ending ? progress : progress * 0.8, // adjusted progress for games that were not completed
    // 12  w_rating,
    // 13  b_rating,
    // 14  min_rating_diff,
    // 15  max_rating_diff,
    // 16  nextBalance,
    // 17  nextBalanceDistance,
    // 18  balAhead[0],
    // 19  balAhead[2],
    // 20  balAhead[4],
    // 21  balAhead[6],
    // 22  balAhead[8],
    // 23  balAhead[10],
    // 24  balAhead[12],
    // 25  balAhead[14],
    // 26  balAhead[16],
    // 27  balAhead[18],

    const xs = getXs({ fens: [record[0]], lmf: record[8], lmt: record[9] });

    const ys = new Array(outUnits).fill(0);
    ys[record[1] === '' ? 1836 : Number(record[1])] = 1;

    // const ys = [996699669966];

    return { xs, ys };
  };

  const getTransformRecordMoveAsLabel = ({ ysformat, xsformat }) =>
    console.log(2, { ysformat, xsformat }) ||
    (ysformat === '1966'
      ? //   output = Concatenate(name='concat-output')([
        //     combined_softmax,
        //     from_softmax,
        //     to_softmax,
        //     knight_promo
        //   ])
        (record) => {
          const ohMove = record[1] === '' ? '1836' : record[1];
          return `${getXs({
            fens: [record[0]],
            lmf: record[8],
            lmt: record[9],
            xsformat,
            moveMap: record[16],
          })},${ohMove},${onehot_map[ohMove].slice(0, 2)},${onehot_map[ohMove][2] ? 1 : 0}`; //
        }
      : ysformat === 'nextBalance'
      ? (record) => {
          // console.log(Number(record[11]), Number(record[5]));
          // console.log(Number(record[16]));
          // console.log({ a: record[21] });
          return `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},${Number(record[16])}`;
        }
      : ysformat === 'bal8'
      ? (record) => {
          // console.log(Number(record[11]), Number(record[5]));
          // console.log(Number(record[16]));
          const balAsStr = record[21];
          if (balAsStr) return `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},${balAsStr}`;

          const lastBalStr = record[20] || record[19] || record[18] || record[16];
          if (!lastBalStr) throw new Error(`no lastbal ${JSON.stringify(record)}`);

          return `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},${
            Number(lastBalStr) + 20 * Number(record[5])
          }`;
        }
      : ysformat && ysformat.startsWith('nextBal')
      ? (record) => {
          // console.log(Number(record[11]), Number(record[5]));
          // console.log(Number(record[16]));
          const xsPart = `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},`;

          const queriedBalIndex = Number(ysformat.replace('nextBal', ''));

          // 16  nextBalance,
          // 17  nextBalanceDistance,
          // 18  balAhead[0],

          const currentBal = Number(record[18]);
          const nextBal = Number(record[16]);
          const distance = Number(record[17]);

          // if (distance>queriedBalIndex)

          const valToAdd = (Math.max(queriedBalIndex - distance + 1, 0) / queriedBalIndex) * (nextBal - currentBal);

          // console.log({ queriedBalIndex, currentBal, nextBal, distance, valToAdd });

          return `${xsPart}${currentBal + valToAdd}`;

          // const balAsStr = record[21];
          // if (balAsStr) return `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},${balAsStr}`;

          // const lastBalStr = record[20] || record[19] || record[18] || record[16];
          // if (!lastBalStr) throw new Error(`no lastbal ${JSON.stringify(record)}`);

          // return `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},${
          //   Number(lastBalStr) + 20 * Number(record[5])
          // }`;
        }
      : (record) => {
          // log one record per thousand
          // if (Math.random() > 0.999) console.log({ record });

          // console.log(Number(record[16]));
          return `${getXs({ fens: [record[0]], lmf: record[8], lmt: record[9], xsformat })},${Number(record[1])}`;
        });

  const getNextBatch = async ({
    isDupe = getMultiEpochIsDupe(3),
    format = defaultFormat,
    ysformat = defaultYsformat,
    xsformat = defaultXsformat,
  } = {}) => {
    process.stdout.write('reading data from disc..');
    let started = Date.now();

    const results = await Promise.all(
      groups.map(({ pointerKey, ratio }) =>
        readFromGroup({
          readerMeta,
          // pointers: readerMeta.pointers,
          pointerKey,
          // fileList: readerMeta.files[pointerKey],
          take: Math.ceil(recordsPerDataset * ratio),
          // folder: readerMeta.datasetFolder,
          filter,
          isDupe,
          fensInLastTestBatch,
        }),
      ),
    );
    console.log(`  - done in ${Date.now() - started} ms.`);

    process.stdout.write('flattening and shuffling data..');
    started = Date.now();

    let data = shuffle(results.flat());
    console.log(`  - done in ${Date.now() - started} ms.`);

    if (format === 'columns') {
      process.stdout.write('transforming dataset to objects..');
      started = Date.now();
      data = data.map(transformRecord);
      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    if (format === 'csv') {
      const transformRecordMoveAsLabel = getTransformRecordMoveAsLabel({ ysformat, xsformat });
      process.stdout.write('transforming dataset for csv format..');
      started = Date.now();
      data = data.map(transformRecordMoveAsLabel);
      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    // TODO: do we need this here?
    data = data.filter(Boolean);

    if (format === 'columns') {
      process.stdout.write('transforming dataset to columns..');
      started = Date.now();
      data = data.reduce(
        (p, c) => {
          p.xs.push(c.xs);
          p.ys.push(c.ys);
          return p;
        },
        { xs: [], ys: [] },
      );

      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    return data;
  };

  const getNextTestBatch = async ({ isDupe = getMultiEpochIsDupe(3) } = {}) => {
    try {
      const results = await Promise.all(
        groups.map(({ pointerKey, ratio }) =>
          readFromGroup({
            pointers: readerMeta.testPointers,
            pointerKey,
            take: Math.ceil(recordsPerDataset * ratio),
            folder: readerMeta.datasetFolder,
            filter: (line) => Math.random() > 0.9 && filter(line),
            isDupe,
            randomFileOrder: true,
          }),
        ),
      );

      const rawData = shuffle(results.flat());

      fensInLastTestBatch = rawData.reduce((p, c) => {
        p[c[0]] = true;
        return p;
      }, {});

      const data = rawData
        .slice(0, testRecordsPerDataset)
        .map(transformRecord)
        .filter(Boolean)
        .reduce(
          (p, c) => {
            p.xs.push(c.xs);
            p.ys.push(c.ys);
            return p;
          },
          { xs: [], ys: [] },
        );

      return data;
    } catch (e) {
      console.error(e);
    }
  };

  return {
    getNextBatch,
    getNextTestBatch,
    id: sessionId,
    metadata: readerMeta,
  };
};
