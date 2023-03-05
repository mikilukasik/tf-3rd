import * as path from 'path';
import { promises as fs } from 'fs';

// import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';
import { getSavedObject } from '../../../chss-module-engine/src/utils/savedObject/savedObject.mjs';
import { getRandomizedFilelist } from './getRandomizedFilelist.mjs';

const datasetFolder = path.resolve('./data/csv_v2/default');

// const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const recordsPerDataset = 50000;
const testRecordsPerDataset = 20000;

const getGroups = async ({ datasetFolder, groupTransformer }) => {
  const dirContents = (await fs.readdir(datasetFolder)).sort();
  const groups = dirContents.map((pointerKey) => ({ pointerKey /* , ratio */ }));
  const transformedGroups = groupTransformer(groups);
  const ratio = 1 / transformedGroups.length;

  return transformedGroups.map(({ pointerKey }) => ({ pointerKey, ratio }));
};

const readMore = async ({ takeMax, pointers, pointerKey, folder, beginningToEnd, randomFileOrder, readerMeta }) => {
  const rawData = await fs.readFile(readerMeta.files[pointerKey][pointers[pointerKey].fileIndex], 'utf-8');
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
  console.log('hssssello', pointers[pointerKey].fileIndex, readerMeta.files[pointerKey].length);

  if (pointers[pointerKey].fileIndex >= readerMeta.files[pointerKey].length) {
    console.log('hello');
    pointers[pointerKey].fileIndex = 0;
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
  console.log('------', Object.keys(fensInLastTestBatch).sort()[0]);

  const result = [];
  if (!take) return result;

  const groupFolder = path.resolve(readerMeta.datasetFolder, pointerKey);

  const resetPointer = async (currentPointers) => {
    const fileIndex = Math.floor(Math.random() * readerMeta.files[pointerKey].length);

    if (!randomFileOrder) console.log(`starting to read dataset from file index ${fileIndex}`);

    currentPointers[pointerKey] = {
      fileIndex,
      lineIndex: 0,
    };
    console.log('itt');
    return currentPointers;
  };

  if (!readerMeta.pointers[pointerKey]) {
    await resetPointer(readerMeta.pointers);
  }

  let removedDupes = 0;
  let removedTestFens = 0;
  let remaining = take;

  console.log('meg itt');
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
  getXs,
  id: sessionId,
  format: defaultFormat = 'columns',
  readerMeta,
}) => {
  console.log('creating new reader... ', { readerMeta });

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
  console.log('sohuold have files', { readerMeta }, readerMeta.files['0.25 - 0.50'][10]);

  let fensInLastTestBatch = {};

  const transformRecord = (record) => {
    // const [fen, onehot_move, hit_soon, result, chkmate_ending, stall_ending, lmf, lmt, progress] = record;

    const xs = getXs({ fens: [record[0]], lmf: record[6], lmt: record[7] });
    const ys = new Array(outUnits).fill(0);
    ys[record[1] === '' ? 1836 : Number(record[1])] = 1;

    return { xs, ys };
  };

  const transformRecordMoveAsLabel = (record) => {
    return `${getXs({ fens: [record[0]], lmf: record[6], lmt: record[7] })},${
      record[1] === '' ? 1836 : Number(record[1])
    }`;
  };

  const getNextBatch = async ({ isDupe = getDefaultIsDupe(), format = defaultFormat } = {}) => {
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

    if (format === 'csv') {
      process.stdout.write('joining csv lines..');
      started = Date.now();
      data = data.join('\n');
      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    return data;
  };

  const getNextTestBatch = async ({ isDupe = getDefaultIsDupe() } = {}) => {
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
  };
};
