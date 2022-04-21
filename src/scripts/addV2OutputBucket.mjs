import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV2OutputBucket } from './utils/addV2OutputBucket.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
// import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames' });

const updater = async (doc) => {
  const newRecords = doc.records.map((record) => {
    const recordWithTestSwitch = addTestDataSwitch({ record });
    const recordWithWNextFen = addWNextFen({ record: recordWithTestSwitch, doc });
    const recordWithWV2Output = addV2Output({ record: recordWithWNextFen });
    const recordWithWV2OutputBucket = addV2OutputBucket({ record: recordWithWV2Output });
    return recordWithWV2OutputBucket;
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
    filters: { 'records.v2OutputBucket': { $exists: false } },
    updater,
  });

  await writeCache();
  client.close();
};

run();
