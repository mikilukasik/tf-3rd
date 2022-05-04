import { getCollection } from './getCollection.mjs';

export const updateMongoDocs = async ({
  collectionName,
  filters,
  updater,
  closeClient,
  logBatchSize = 100,
  sort = {},
}) => {
  const { collection, client } = await getCollection(collectionName);
  const cursor = collection.find(filters).sort(sort);

  let processedCount = 0;
  let erroredCount = 0;
  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    try {
      await updater(doc, { collection });
      processedCount += 1;
    } catch (e) {
      console.log(`Failed _id: ${doc._id}`);
      console.error(e);
      erroredCount += 1;
    }

    if ((processedCount + erroredCount) % logBatchSize === 0)
      console.log(`processed ${processedCount} docs. (${erroredCount} errors)`);
  }

  if (closeClient) client.close();

  return { client };
};
