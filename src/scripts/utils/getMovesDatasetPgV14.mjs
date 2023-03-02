import * as path from 'path';
import { promises as fs } from 'fs';

import { getRandomFileFromDir } from './getRandomFileFromDir.mjs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

const datasetFolder = path.resolve('./data/csv_v2/default');
const cacheFolder = path.resolve('./data/cache/v14');

// const inUnits = 14;
const outUnits = 1837; // 1792 moves where queen promotion is default. 44 knight promotion moves + 1 resign

const recordsPerDataset = 50000;
const testRecordsPerDataset = 20000;

const loadJsons = async (folder, filenames) => {
  const result = [];
  for (const fileName of filenames) {
    result.push(JSON.parse(await fs.readFile(path.resolve(folder, fileName), 'utf8')));
  }
  return result;
};

const { cacheReady, getCachedDataset, getCachedTestDataset, addToCache, addToTestCache } = (() => {
  const cache = [];
  let cacheIds;
  let isCacheReady = false;
  const cacheAwaiters = [];
  const readerSessions = {};

  const cacheReady = () =>
    new Promise((r) => {
      if (isCacheReady) return r();
      cacheAwaiters.push(r);
    });

  const registerSession = (sessionId) => {
    if (readerSessions[sessionId]) return;

    readerSessions[sessionId] = {
      cacheIndex: -1,
    };
  };

  const getCachedDataset = async (sessionId) => {
    registerSession(sessionId);
    //
  };
  const getCachedTestDataset = async (sessionId) => {
    registerSession(sessionId);
    readerSessions[sessionId].cacheIndex += 1;

    try {
      const { pointers, data } = JSON.parse(
        await fs.readFile(
          path.resolve(cacheFolder, cacheIds[readerSessions[sessionId].cacheIndex], 'testDataset.json'),
        ),
      );

      return { pointers, data };
    } catch (e) {
      console.error(e);
      return null;
    }
    //
  };
  const addToCache = async ({ data, pointers }) => {
    //
  };

  const addToTestCache = async ({ data, pointers, fensInLastTestBatch }) => {
    const cacheId = Date.now().toString() + Math.random().toString().replace('0.', '');

    cache[cacheId] = {
      id: cacheId,
      datasetFilenames: [],
      testDataset: data,
      fensInLastTestBatch,
      datasets: [],
      pointers,
    };

    const currentCacheFolder = path.resolve(cacheFolder, cacheId);
    await fs.mkdir(currentCacheFolder, { recursive: true });

    await fs.writeFile(
      path.resolve(currentCacheFolder, 'testDataset.json'),
      JSON.stringify({ pointers, data, fensInLastTestBatch }),
      'utf8',
    );
  };

  (async () => {
    await fs.mkdir(cacheFolder, { recursive: true });

    cacheIds = (await fs.readdir(cacheFolder)).sort();
    for (const id of cacheIds) {
      const currentCacheFolder = path.resolve(cacheFolder, id);

      const datasetFilenames = (await fs.readdir(currentCacheFolder))
        .filter((name) => name !== 'metadata.json' && name !== 'testDataset.json')
        .sort();

      // const { pointers, testPointers } = JSON.parse(
      //   await fs.readFile(path.resolve(currentCacheFolder, 'metadata.json', 'utf8')),
      // );

      const {
        data: testDataset,
        fensInLastTestBatch,
        pointers,
      } = JSON.parse(await fs.readFile(path.resolve(currentCacheFolder, 'testDataset.json'), 'utf8'));
      const datasets = await loadJsons(currentCacheFolder, datasetFilenames);

      cache[id] = {
        id,
        datasetFilenames,
        testDataset,
        datasets,
        fensInLastTestBatch,
        pointers,
        // testPointers,
        // pointers,
      };
    }

    while (cacheAwaiters.length) cacheAwaiters.pop()();
    isCacheReady = true;
  })();

  return { cacheReady, getCachedDataset, getCachedTestDataset, addToCache, addToTestCache };
})();

const getGroups = async ({ datasetFolder, groupTransformer }) => {
  const dirContents = (await fs.readdir(datasetFolder)).sort();
  const groups = dirContents.map((pointerKey) => ({ pointerKey /* , ratio */ }));
  const transformedGroups = groupTransformer(groups);
  const ratio = 1 / transformedGroups.length;

  return transformedGroups.map(({ pointerKey }) => ({ pointerKey, ratio }));
};

const getNextFileName = async (fileName, rootFolder, deepFileName, subCall = false, beginningToEnd) => {
  if (fileName === rootFolder) {
    console.log(`finished reading dataset at file ${deepFileName}`);
    if (beginningToEnd) throw false;

    return fileName;
  }

  const split = fileName.split('/');
  const folderName = split.slice(0, -1).join('/');
  const dirContents = (await fs.readdir(folderName)).sort();
  const currentIndex = dirContents.findIndex((file) => file === split[split.length - 1]);

  if (currentIndex < dirContents.length - 1) {
    return split
      .slice(0, -1)
      .concat(dirContents[currentIndex + 1])
      .join('/');
  }

  const nextFolder = await getNextFileName(folderName, rootFolder, deepFileName || fileName, true, beginningToEnd);
  const firstFileNameInNextFolder = path.resolve(nextFolder, (await fs.readdir(nextFolder)).sort()[0]);

  if (!subCall) console.log(`reading from folder: ${nextFolder}`);

  return firstFileNameInNextFolder;
};

const readMore = async ({ takeMax, pointers, pointerKey, folder, beginningToEnd, randomFileOrder }) => {
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

  try {
    pointers[pointerKey] = {
      fileName: randomFileOrder
        ? await getRandomFileFromDir(folder, beginningToEnd)
        : await getNextFileName(pointers[pointerKey].fileName, folder, '', false, beginningToEnd),
      index: 0,
    };
  } catch (e) {
    if (e) throw e;

    // finished the dataset
    pointers[pointerKey] = {
      fileName: null,
      index: 0,
    };
  }

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
}) => {
  console.log('------', Object.keys(fensInLastTestBatch).sort()[0]);

  const result = [];
  if (!take) return result;

  const groupFolder = path.resolve(folder, pointerKey);

  const resetPointer = async (currentPointers) => {
    const fileName = await getRandomFileFromDir(groupFolder, beginningToEnd);

    if (!randomFileOrder) console.log(`starting to read dataset from file ${fileName}`);

    currentPointers[pointerKey] = {
      fileName,
      index: 0,
    };

    return currentPointers;
  };

  if (!pointers[pointerKey]) {
    await resetPointer(pointers);
  }

  let removedDupes = 0;
  let removedTestFens = 0;
  let remaining = take;
  while (remaining && pointers[pointerKey].fileName) {
    const records = (
      await readMore({
        takeMax: remaining,
        pointers: randomFileOrder ? await resetPointer({}) : pointers,
        pointerKey,
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

export const datasetReader = async ({
  filter,
  groupTransformer = (gs) => gs,
  getXs,
  id: sessionId = Date.now().toString() + Math.random().toString().replace('0.', ''),
  format: defaultFormat = 'columns',
}) => {
  await cacheReady();

  const folder = path.resolve(datasetFolder);
  let pointers = {};
  let testPointers = {};

  const groups = await getGroups({ datasetFolder, groupTransformer });

  let fensInLastTestBatch = {};

  const transformRecord = (record) => {
    // const [fen, onehot_move, hit_soon, result, chkmate_ending, stall_ending, lmf, lmt, progress] = record;

    const xs = getXs({ fens: [record[0]], lmf: record[6], lmt: record[7] });
    const ys = new Array(outUnits).fill(0);
    ys[Number(record[1])] = 1;

    return { xs, ys };
  };

  const transformRecordMoveAsLabel = (record) => {
    return `${getXs({ fens: [record[0]], lmf: record[6], lmt: record[7] })},${Number(record[1])}`;
    // return { xs: getXs({ fens: [record[0]], lmf: record[6], lmt: record[7] }), ys: Number(record[1]) };
  };

  const getNextBatch = async ({ isDupe = getDefaultIsDupe(), format = defaultFormat } = {}) => {
    // const cachedBatch = await getCachedDataset(sessionId);
    // if (cachedBatch) {
    //   ({ pointers } = cachedBatch);
    //   return cachedBatch.data;
    // }
    console.log(11);

    const results = await Promise.all(
      groups.map(({ pointerKey, ratio }) =>
        readFromGroup({
          pointers,
          pointerKey,
          take: Math.ceil(recordsPerDataset * ratio),
          folder,
          filter,
          isDupe,
          fensInLastTestBatch,
        }),
      ),
    );

    console.log(22);

    let data = shuffle(results.flat());
    console.log(33);

    if (format === 'columns') {
      process.stdout.write('transforming dataset to xs and ys..');
      const started = Date.now();
      data = data.map(transformRecord);
      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    if (format === 'csv') {
      process.stdout.write('transforming dataset to xs..');
      const started = Date.now();
      data = data.map(transformRecordMoveAsLabel);
      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    console.log(44);

    data = data.filter(Boolean);

    if (format === 'columns') {
      process.stdout.write('transforming dataset to columns..');
      const started = Date.now();
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
      process.stdout.write('transforming dataset to csv..');
      const started = Date.now();

      // const reducer = (p, c) => {
      //   return `${p}\n${c.xs},${c.ys}`;
      // };
      // data = data.reduce(reducer, '');
      data = data.join('\n');

      console.log(`  - done in ${Date.now() - started} ms.`);
    }

    // await addToCache({ data, pointers });

    return data;
  };

  const getNextTestBatch = async ({ isDupe = getDefaultIsDupe() } = {}) => {
    const cachedTestBatch = await getCachedTestDataset(sessionId);
    if (cachedTestBatch) {
      ({ fensInLastTestBatch, pointers: testPointers } = cachedTestBatch);
      return cachedTestBatch.data;
    }

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

      // await addToTestCache({ data, pointers: testPointers, fensInLastTestBatch });

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
