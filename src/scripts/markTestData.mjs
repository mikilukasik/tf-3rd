import { bulkWriter } from './utils/bulkWriter.mjs';
import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames' });

const updater = async (doc, { collection }) => {
  const newRecords = doc.records.map((record) =>
    Object.assign({}, record, {
      // wNextFen: record.fen,
      // wNextResult: doc.result,
      // wNextBalancesAhead: record.balancesAhead,
      // wNextBalance: record.balance,
      testData: Math.random() > 0.9, // 10%
    }),
  );

  // await collection.updateOne({ _id: doc._id }, { $set: { records: newRecords } });

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { records: newRecords } },
    },
  });
};

const run = async () => {
  await createMongoIndexes({
    collectionName: 'scidGames',
    indexes: {
      'records.testData': 1,
    },
    options: {
      sparse: true,
    },
  });

  await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { 'records.testData': { $exists: false } },
    updater,
    closeClient: true,
  });

  await writeCache();
};

run();
