const { parentPort, workerData } = require('worker_threads');
const { Client } = require('pg');

const pgClient = new Client({
  user: 'chss',
  host: 'localhost',
  database: 'chss',
  password: 'password',
  port: 54320,
});

const { batchSize = 5000, pointers = {}, groups = { default: { take: 1 } } } = workerData;

const totalGroupTakes = Object.values(groups).reduce((p, { take }) => p + take, 0);
const takeMultiplier = batchSize / totalGroupTakes;

const takePerGroup = Object.keys(groups).reduce((groupTakes, groupName) => {
  groupTakes[groupName] = Math.ceil(groups[groupName].take * takeMultiplier);
  return groupTakes;
}, {});

let nextBatch;
const nextBatchAwaiters = [];

let initStarted;
let inited;
const pgClientResolvers = [];
const init = () =>
  new Promise((r) => {
    if (inited) return r();
    if (initStarted) return pgClientResolvers.push(r);

    initStarted = true;
    pgClient
      .connect()
      .then(() => {
        inited = true;
        return pgClient.query('SELECT $1::text as message', ['Postgres connected']);
      })
      .then((res) => {
        console.log(res.rows[0].message);
        r();
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

const readMore = async ({ takeMax, pointers, pointerKey, preFilter }) => {
  const rawData = await pgClient.query(`
    SELECT id, fen, moves FROM public.fens_agg
    WHERE id > ${pointers[pointerKey].id}
    ${preFilter ? `AND ${preFilter}` : ''}
    ORDER BY id
    limit ${Math.min(5000, takeMax)};
  `);

  const parsedData = rawData.rows.map(rowMapper);

  pointers[pointerKey].id = parsedData.length ? parsedData[parsedData.length - 1].id : 0;

  return parsedData;
};

const readFromGroup = async ({ pointers, pointerKey, take, preFilter, postFilter = () => true }) => {
  const result = [];
  if (!take) return result;

  if (!pointers[pointerKey]) {
    const largestId = Number(
      (
        await pgClient.query(`
          SELECT id FROM public.fens_agg
          ORDER BY id DESC
          limit 1
        `)
      ).rows[0].id,
    );

    const id = Math.floor(Math.random() * largestId);

    console.log(`starting to read dataset for group ${pointerKey} (take ${take}) from id ${id}`);

    pointers[pointerKey] = {
      id,
    };
  }

  let remaining = take;
  while (remaining) {
    const records = (await readMore({ takeMax: remaining, pointers, pointerKey, preFilter })).filter(postFilter);
    remaining -= records.length;
    result.push(...records);
  }

  process.stdout.write('.');

  return result;
};

const loadNextBatch = async ({ ratio = 1 } = {}) => {
  // if (nextBatch && ratio === 1) throw new Error('tried to double-load batch');
  console.log('loading batch', ratio);

  const result = [];

  await Promise.all(
    Object.keys(groups).map(async (groupName) => {
      const groupResults = await readFromGroup({
        pointers,
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

loadNextBatch();

const getNextBatch = ({ ratio = 1 } = {}) =>
  ratio === 1
    ? new Promise((r) => {
        if (nextBatch) {
          r(nextBatch);
          nextBatch = null;
          loadNextBatch({ ratio });
          return;
        }

        nextBatchAwaiters.push(r);
      })
    : loadNextBatch({ ratio });

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
