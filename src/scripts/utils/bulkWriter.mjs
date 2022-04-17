import { getCollection } from './getCollection.mjs';

export const bulkWriter = ({ collectionName, batchSize = 50 }) => {
  const cache = [];

  const writeCache = async () => {
    if (!cache.length) return;

    const { collection } = await getCollection(collectionName);
    await collection.bulkWrite(cache);
    cache.length = 0;
  };

  const addOp = async (op) => {
    cache.push(op);
    if (cache.length >= batchSize) await writeCache();
  };

  return {
    addOp,
    writeCache,
  };
};
