import * as path from 'path';
import { promises as fs } from 'fs';

// import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';
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

const readMore = async ({ takeMax, pointers, pointerKey, folder, beginningToEnd, randomFileOrder, fileList }) => {
  const rawData = await fs.readFile(fileList[pointers[pointerKey].fileIndex], 'utf-8');
  const parsedData = rawData
    .trim()
    .split('\n')
    .slice(pointers[pointerKey].lineIndex)
    .map((row) => row.split(',')); // Number() ?

  if (parsedData.length > takeMax) {
    pointers[pointerKey].lineIndex = pointers[pointerKey].lineIndex + takeMax;

    return parsedData.slice(0, takeMax);
  }

  pointers[pointerKey] = {
    fileIndex: randomFileOrder
      ? Math.floor(Math.random() * fileList.length)
      : (pointers[pointerKey].fileIndex + 1) % fileList.length,
    lineIndex: 0,
  };

  return parsedData;
};

const readFromGroup = async ({
  pointers = {},
  pointerKey,
  take,
  folder,
  filter = () => true,
  isDupe,
  beginningToEnd,
  dontLogDupes,
  fensInLastTestBatch = {},
  randomFileOrder,
  fileList,
}) => {
  console.log('------', Object.keys(fensInLastTestBatch).sort()[0]);

  const result = [];
  if (!take) return result;

  const groupFolder = path.resolve(folder, pointerKey);

  const resetPointer = async (currentPointers) => {
    const fileIndex = Math.floor(Math.random() * fileList.length);

    if (!randomFileOrder) console.log(`starting to read dataset from file index ${fileIndex}`);

    currentPointers[pointerKey] = {
      fileIndex,
      lineIndex: 0,
    };

    return currentPointers;
  };

  if (!pointers[pointerKey]) {
    await resetPointer(pointers);
  }

  let removedDupes = 0;
  let removedTestFens = 0;
  let remaining = take;
  while (remaining /* && pointers[pointerKey].fileName*/) {
    const records = (
      await readMore({
        takeMax: remaining,
        pointers: randomFileOrder ? await resetPointer({}) : pointers,
        pointerKey,
        fileList,
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

export const datasetReader = async ({
  filter,
  groupTransformer = (gs) => gs,
  getXs,
  id: sessionId = Date.now().toString() + Math.random().toString().replace('0.', ''),
  format: defaultFormat = 'columns',
  files: _files,
}) => {
  const folder = path.resolve(datasetFolder);
  let pointers = {};
  let testPointers = {};

  const groups = await getGroups({ datasetFolder, groupTransformer });
  const files = _files || (await getFiles({ groups }));

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
          pointers,
          pointerKey,
          fileList: files[pointerKey],
          take: Math.ceil(recordsPerDataset * ratio),
          folder,
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
            pointers: testPointers,
            pointerKey,
            take: Math.ceil(recordsPerDataset * ratio),
            folder,
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
