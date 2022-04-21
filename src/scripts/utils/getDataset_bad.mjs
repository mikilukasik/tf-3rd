import { getCollection } from './getCollection.mjs';

const getGroups = (size) =>
  [
    {
      take: Math.round(size * 2),
      filter: [
        '-0.656',
        '-0.672',
        '-0.688',
        '-0.703',
        '-0.719',
        '-0.734',
        '-0.75',
        '-0.766',
        '-0.781',
        '-0.797',
        '-0.813',
        '-0.828',
        '-0.844',
        '-0.859',
        '-0.875',
        '-0.891',
        '-0.906',
        '-0.922',
        '-0.938',
        '-0.953',
        '-0.969',
        '-0.984',
        '-1',
      ],
    },
    {
      take: Math.round(size * 2),
      filter: [
        '0.641',
        '0.656',
        '0.672',
        '0.688',
        '0.703',
        '0.719',
        '0.734',
        '0.75',
        '0.766',
        '0.781',
        '0.797',
        '0.813',
        '0.828',
        '0.844',
        '0.859',
        '0.875',
        '0.891',
        '0.906',
        '0.922',
        '0.938',
        '0.953',
        '0.969',
        '0.984',
      ],
    },
    {
      take: Math.round(size * 3),
      filter: [
        '-0.359',
        '-0.375',
        '-0.391',
        '-0.406',
        '-0.422',
        '-0.438',
        '-0.453',
        '-0.469',
        '-0.484',
        '-0.5',
        '-0.516',
        '-0.531',
        '-0.547',
        '-0.563',
        '-0.578',
        '-0.594',
        '-0.609',
        '-0.625',
        '-0.641',
      ],
    },
    {
      take: Math.round(size * 3),
      filter: [
        '0.344',
        '0.359',
        '0.375',
        '0.391',
        '0.406',
        '0.422',
        '0.438',
        '0.453',
        '0.469',
        '0.484',
        '0.5',
        '0.516',
        '0.531',
        '0.547',
        '0.563',
        '0.578',
        '0.594',
        '0.609',
        '0.625',
      ],
    },
    {
      take: Math.round(size * 2),
      filter: ['-0.203', '-0.219', '-0.234', '-0.25', '-0.266', '-0.281', '-0.297', '-0.313', '-0.328', '-0.344'],
    },
    {
      take: Math.round(size * 2),
      filter: ['0.188', '0.203', '0.219', '0.234', '0.25', '0.266', '0.281', '0.297', '0.313', '0.328'],
    },
    {
      take: Math.round(size),
      filter: ['-0.141', '-0.156', '-0.172', '-0.188'],
    },
    {
      take: Math.round(size),
      filter: ['0.125', '0.141', '0.156', '0.172'],
    },
    {
      take: Math.round(size),
      filter: ['-0.078', '-0.094', '-0.109', '-0.125'],
    },
    {
      take: Math.round(size),
      filter: ['0.063', '0.078', '0.094', '0.109'],
    },
    {
      take: Math.round(size * 2),
      filter: ['-0.016', '-0.031', '-0.047', '-0.063'],
    },
    {
      take: Math.round(size * 2),
      filter: ['0', '0.016', '0.031', '0.047'],
    },
  ].map(({ filter, take }) => ({ filter, take, groupName: `${filter[0]} to ${filter[filter.length - 1]}` }));

const ponderCache = {};

const ponderCacheAwaiters = {};

export const getDataset = ({ pointers = {}, testData = false, limit = 1000, ponder = false } = {}) =>
  new Promise((resolve) => {
    const cacheKey = JSON.stringify({ pointers, testData, limit });
    if (ponder && ponderCache[cacheKey]) {
      if (ponderCache[cacheKey] === 'loading') {
        ponderCacheAwaiters[cacheKey] = (ponderCacheAwaiters[cacheKey] || []).concat(resolve);
        return;
      }

      const toReturn = ponderCache[cacheKey];
      delete ponderCache[cacheKey];
      return resolve(toReturn);
    }

    getDatasetOnce({ pointers, testData, limit }).then(({ result, newPointers }) => {
      if (ponder) {
        const newCacheKey = JSON.stringify({ pointers: newPointers, testData, limit });
        ponderCache[newCacheKey] = 'loading';

        getDataset({ pointers: newPointers, testData, limit, ponder }).then(
          ({ result: futureResult, newPointers: futurePointers }) => {
            if (ponderCacheAwaiters[newCacheKey]) {
              while (ponderCacheAwaiters[newCacheKey].length) {
                ponderCacheAwaiters[newCacheKey].pop()({ result: futureResult, pointers: futurePointers });
              }
            }

            ponderCache[newCacheKey] = { result: futureResult, pointers: futurePointers };
          },
        );
      }

      return resolve({ result, newPointers });
    });
  });

const getDatasetOnce = async ({ pointers = {}, testData = false, limit = 1000 } = {}) => {
  console.log(`starting mongo query: ${JSON.stringify(pointers)}`);
  const { collection } = await getCollection('scidRecords');

  const groups = getGroups(limit / 22);
  // console.log(groups);
  const queries = groups.map(({ filter, take, groupName }) =>
    collection
      .find({
        testData,
        v2OutputBucket2: { $in: filter },
        rnd0: pointers[groupName] ? { $gt: pointers[groupName] } : { $gte: 0 },
      })
      .project({ fen: 1, v2Output: 1, rnd0: 1 })
      .sort({ rnd0: 1 })
      .limit(take)
      .toArray(),
  );

  const mongoResult = await Promise.all(queries);

  const additionalQueries = groups.map(({ filter, take }, index) => {
    const newTake = take - mongoResult[index].length;
    if (newTake === 0) return Promise.resolve([]);

    return collection
      .find({
        testData,
        v2OutputBucket2: { $in: filter },
      })
      .project({ fen: 1, v2Output: 1, rnd0: 1 })
      .sort({ rnd0: 1 })
      .limit(newTake)
      .toArray();
  });

  const additionalMongoResult = await Promise.all(additionalQueries);
  additionalMongoResult.forEach((additionalGroupResult, index) => {
    mongoResult[index].push(...additionalGroupResult);
  });

  const newPointers = mongoResult
    .map((queryResult, queryIndex) => ({
      pointerName: groups[queryIndex].groupName,
      value: queryResult[queryResult.length - 1].rnd0,
    }))
    .reduce((p, { pointerName, value }) => {
      p[pointerName] = value;
      return p;
    }, {});

  const result = mongoResult.flat().sort(() => Math.random() - 0.5);

  console.log(`finished mongo query: ${JSON.stringify(pointers)}`);
  return { result, newPointers };
};
