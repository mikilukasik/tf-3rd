const { parentPort, workerData } = require('worker_threads');
const { Client } = require('pg');

const pgClient = new Client({
  user: 'chss',
  host: 'localhost',
  database: 'chss',
  password: 'password',
  port: 54320,
});

const {
  batchSize = 5000,
  pointers = {},
  groups: groupsWithStringifiedFunctions = { default: { take: 1 } },
} = workerData;
const groups = Object.keys(groupsWithStringifiedFunctions).reduce(
  (grs, key) => ({
    ...grs,
    [key]: {
      ...groupsWithStringifiedFunctions[key],
      ...(groupsWithStringifiedFunctions[key].postFilter
        ? { postFilter: eval(groupsWithStringifiedFunctions[key].postFilter) }
        : {}),
    },
  }),
  {},
);

const totalGroupTakes = Object.values(groups).reduce((p, { take }) => p + take, 0);
const takeMultiplier = batchSize / totalGroupTakes;

const takePerGroup = Object.keys(groups).reduce((groupTakes, groupName) => {
  groupTakes[groupName] = Math.ceil(groups[groupName].take * takeMultiplier);
  return groupTakes;
}, {});

let largestId;
let nextBatch;
let initStarted;
let inited;
const pgClientResolvers = [];
const nextBatchAwaiters = [];
const datasetReadCounts = {};

const init = () =>
  new Promise((r) => {
    if (inited) return r();
    pgClientResolvers.push(r);

    if (initStarted) return;
    initStarted = true;

    pgClient
      .connect()
      .then(() => {
        return pgClient.query('SELECT $1::text as message', ['Postgres connected']);
      })
      .then((res) => {
        console.log(res.rows[0].message);
        return pgClient.query(`
          SELECT id FROM public.fens_agg
          ORDER BY id DESC
          limit 1
        `);
      })
      .then((largestIdRaw) => {
        largestId = Number(largestIdRaw.rows[0].id);
        inited = true;
        while (pgClientResolvers.length) pgClientResolvers.pop()();
      })
      .catch(console.error);
  });

init();

const shuffle = (array) => {
  let currentIndex = array.length;
  let randomIndex;

  while (currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }

  return array;
};

const rowMapper = ({ id, fen, moves }) => ({
  id,
  fen,
  moves: JSON.parse(moves).map(([onehot_move, count, hit_soon, result]) => ({
    onehot_move,
    count,
    hit_soon,
    result,
  })),
});

const readMore = async ({ takeMax, pointers: _pointers, pointerKey, preFilter }) => {
  const rawData = await pgClient.query(`
    SELECT id, fen, moves FROM public.fens_agg
    WHERE id > ${_pointers[pointerKey].id}
    ${preFilter ? `AND ${preFilter}` : ''}
    ORDER BY id
    limit ${Math.min(5000, takeMax)};
  `);

  const parsedData = rawData.rows.map(rowMapper);

  if (parsedData.length) {
    _pointers[pointerKey].id = parsedData[parsedData.length - 1].id;
    return parsedData;
  }

  _pointers[pointerKey].id = 0;
  datasetReadCounts[pointerKey] = (datasetReadCounts[pointerKey] || 0) + 1;
  console.log(`completed dataset for group ${pointerKey}. Read counts per group:`, datasetReadCounts);

  return parsedData;
};

const readerBusyWithGroups = {};
const readerAwaitersPerGroup = [];

const readFromGroup = ({ pointerKey, ...rest }) =>
  new Promise((resolve) => {
    if (!readerBusyWithGroups[pointerKey]) {
      readerBusyWithGroups[pointerKey] = true;
      return readFromGroupNoThrottle({ pointerKey, ...rest }).then((result) => {
        const nextTask = (readerAwaitersPerGroup[pointerKey] || []).shift();
        readerBusyWithGroups[pointerKey] = false;

        if (nextTask) {
          readFromGroup({ pointerKey: nextTask.pointerKey, ...nextTask.rest }).then(nextTask.resolve);
        }
        resolve(result);
      });
    }

    readerAwaitersPerGroup[pointerKey] = (readerAwaitersPerGroup[pointerKey] || []).concat({
      pointerKey,
      rest,
      resolve,
    });
  });

const readFromGroupNoThrottle = async ({
  pointers: _pointers,
  pointerKey,
  take,
  preFilter,
  postFilter = () => true,
}) => {
  const result = [];
  if (!take) return result;

  if (!_pointers[pointerKey]) {
    const id = Math.floor(Math.random() * largestId);

    console.log(
      id,
      largestId,
      `starting to read dataset for group ${pointerKey} (take ${take}) from ${((id / largestId) * 100).toFixed(1)}%`,
    );

    _pointers[pointerKey] = {
      id,
    };
  }

  let remaining = take;
  while (remaining) {
    const records = (await readMore({ takeMax: remaining, pointers: _pointers, pointerKey, preFilter })).filter(
      postFilter,
    );
    remaining -= records.length;
    result.push(...records);
  }

  process.stdout.write('.');

  return result;
};

const loadNextBatch = async ({ ratio = 1, _pointers = pointers } = {}) => {
  // if (nextBatch && ratio === 1) throw new Error('tried to double-load batch');
  await init();
  console.log('loading batch', ratio);

  const result = [];

  await Promise.all(
    Object.keys(groups).map(async (groupName) => {
      const groupResults = await readFromGroup({
        pointers: _pointers,
        pointerKey: groupName,
        ...groups[groupName],
        take: Math.ceil(takePerGroup[groupName] * ratio),
      });

      result.push(...groupResults);
    }),
  );

  console.log('loaded batch', ratio);

  if (ratio !== 1) {
    return shuffle(result);
  }

  nextBatch = shuffle(result);

  const awaiter = nextBatchAwaiters.shift();
  if (awaiter) {
    awaiter(nextBatch);
    nextBatch = null;
    loadNextBatch();
  }
};

setTimeout(loadNextBatch, 500);

const getNextBatch = ({ ratio = 1, _pointers = pointers } = {}) =>
  ratio === 1
    ? new Promise((r) => {
        if (nextBatch) {
          r(nextBatch);
          nextBatch = null;
          loadNextBatch({ ratio, pointers: _pointers });
          return;
        }

        nextBatchAwaiters.push(r);
      })
    : loadNextBatch({ ratio, pointers: _pointers });

const messageHandlers = {
  getNextBatch,
};

parentPort.on('message', async ({ cmd, data, id }) => {
  try {
    const result = await messageHandlers[cmd](data);
    parentPort.postMessage({ cmd: 'resolve', data: result, id });
  } catch (e) {
    parentPort.postMessage({ cmd: 'reject', data: e, id });
  }
});
