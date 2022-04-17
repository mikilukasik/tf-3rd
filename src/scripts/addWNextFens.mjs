import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { getWhiteNextFen } from './utils/getWNextFen.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames' });

const updater = async (doc) => {
  const newRecords = doc.records.map((record) => {
    const recordWithTestSwitch = addTestDataSwitch({ record });
    const recordWithWNextFen = addWNextFen({ record: recordWithTestSwitch, doc });
    return recordWithWNextFen;
  });

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
      'records.wNextBalance': 1,
    },
    options: {
      sparse: true,
    },
  });

  await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { 'records.wNextBalance': { $exists: false } },
    updater,
    closeClient: true,
  });

  await writeCache();
};

run();
