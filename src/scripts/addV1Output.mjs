import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV1Output } from './utils/addV1Output.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames' });

const updater = async (doc) => {
  const newRecords = doc.records.map((record) => {
    const recordWithTestSwitch = addTestDataSwitch({ record });
    const recordWithWNextFen = addWNextFen({ record: recordWithTestSwitch, doc });
    const recordWithWV1Output = addV1Output({ record: recordWithWNextFen });
    return recordWithWV1Output;
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
      'records.v1Output': 1,
    },
    options: {
      sparse: true,
    },
  });

  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { 'records.v1Output': { $exists: false } },
    updater,
  });

  await writeCache();
  client.close();
};

run();
