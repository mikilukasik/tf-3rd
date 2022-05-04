import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV2OutputBucket } from './utils/addV2OutputBucket.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
import { addV3Output } from './utils/addV3Output.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
// import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { addMoveIndicators } from './utils/addMoveIndicators.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames' });

const updater = async (doc) => {
  const newRecords = doc.records
    .map((record) => addWNextFen({ record, doc }))
    .map((record, index) => {
      let newRecord = record;

      [addTestDataSwitch, addV2Output, addV2OutputBucket, addMoveIndicators].forEach((func) => {
        newRecord = func({ record: newRecord, doc, index });
      });

      return newRecord;
    });

  const recordsWithV3Output = addV3Output({ records: newRecords, result: doc.result });

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { records: recordsWithV3Output } },
    },
  });
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: {}, //{ 'records.v3Output': { $exists: false } },
    updater,
  });

  await writeCache();
  client.close();
};

run();
