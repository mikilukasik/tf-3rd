import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV2OutputBucket } from './utils/addV2OutputBucket.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
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

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { records: newRecords } },
    },
  });
};

const run = async () => {
  // await createMongoIndexes({
  //   collectionName: 'scidGames',
  //   indexes: {
  //     'records.v2OutputBucket': 1,
  //   },
  //   options: {
  //     sparse: true,
  //   },
  // });

  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: {}, //{ 'records.moveIndicators': { $exists: false } },
    updater,
  });

  await writeCache();
  client.close();
};

run();
