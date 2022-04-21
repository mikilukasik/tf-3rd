import { bulkWriter } from './utils/bulkWriter.mjs';
import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { getCollection } from './utils/getCollection.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames', batchSize: 90 });

const updater = async (doc) => {
  const { collection: recordsCollection } = await getCollection('scidRecords');

  const records = doc.records.map((sourceRecord, index) => ({
    fen: sourceRecord.wNextFen,
    result: sourceRecord.wNextResult,
    balance: sourceRecord.wNextBalance,
    v2Output: sourceRecord.v2Output,
    v2OutputBucket: sourceRecord.v2OutputBucket,
    progress: sourceRecord.progress,
    gameId: doc._id,
    recordIndex: index,
    rnd0: sourceRecord.rnds[0],
    rnd1: sourceRecord.rnds[1],
  }));

  await recordsCollection.insertMany(records);

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { recordsCopied: true } },
    },
  });
};

const run = async () => {
  // await createMongoIndexes({
  //   collectionName: 'scidRecords',
  //   indexes: {
  //     v2OutputBucket: 1,
  //     rnd0: 1,
  //     rnd1: 1,
  //   },
  //   options: {},
  // });

  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { recordsCopied: { $ne: true }, 'records.v2OutputBucket': { $exists: true } },
    updater,
  });

  await writeCache();
  client.close();
};

run();
