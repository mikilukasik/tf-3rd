import { getCollection } from './getCollection.mjs';

export const createMongoIndexes = async ({ collectionName, indexes, options, closeClient }) => {
  const { collection, client } = await getCollection(collectionName);

  for (const index of [].concat(indexes)) {
    const result = await collection.createIndex(index, options);
    console.log({ index, result });
  }

  if (closeClient) client.close();
};
