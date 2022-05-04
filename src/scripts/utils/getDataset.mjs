import { getCollection } from './getCollection.mjs';
import { groups, getGroups } from './groups.mjs';

export const getGroupName = (v2OutputBucket) => groups.find(({ filter }) => filter.includes(v2OutputBucket)).groupName;

export const getDataset = async ({ pointers = {}, testData = false, limit = 1000 } = {}) => {
  const newPointers = Object.assign({}, pointers);
  let started = Date.now();
  const { collection } = await getCollection('scidRecords');

  const groups = getGroups(limit / 22);
  // console.log(groups);
  const queries = groups.map(({ filter, take, groupName }) =>
    collection
      .find({
        testData,
        v2OutputBucket2: { $in: filter },
        // rnd0: pointers[groupName] ? { $gt: pointers[groupName] } : { $gte: 0 },
      })
      .project({ fen: 1, v2Output: 1, rnd0: 1 })
      .sort({ rnd0: 1 })
      .skip(pointers[groupName] || 0)
      .limit(take)
      .toArray()
      .then((result) => {
        newPointers[groupName] = (newPointers[groupName] || 0) + result.length;
        return result;
      }),
  );

  console.log(`GET_DATASET: generated queries in ${Date.now() - started} ms.`);
  started = Date.now();

  const mongoResult = await Promise.all(queries);

  console.log(`GET_DATASET: mongo response took ${Date.now() - started} ms.`);
  started = Date.now();

  const additionalQueries = groups.map(({ filter, take, groupName }, index) => {
    const newTake = take - mongoResult[index].length;
    if (newTake === 0) return Promise.resolve([]);

    newPointers[groupName] = 0;

    return collection
      .find({
        testData,
        v2OutputBucket2: { $in: filter },
      })
      .project({
        fen: 1,
        v2Output: 1,
        //  rnd0: 1
      })
      .sort({ rnd0: 1 })
      .limit(newTake)
      .toArray()
      .then((result) => {
        newPointers[groupName] += result.length;
        return result;
      });
  });

  console.log(`GET_DATASET: generated additional queries in ${Date.now() - started} ms.`);
  started = Date.now();

  const additionalMongoResult = await Promise.all(additionalQueries);

  console.log(`GET_DATASET: additional queries completed in ${Date.now() - started} ms.`);
  started = Date.now();

  additionalMongoResult.forEach((additionalGroupResult, index) => {
    mongoResult[index].push(...additionalGroupResult);
  });

  const result = mongoResult.flat().sort(() => Math.random() - 0.5);

  console.log(`GET_DATASET: result transformed in ${Date.now() - started} ms.`);

  return { result, newPointers };
};
