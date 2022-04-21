import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { getBucket } from './utils/addV2OutputBucket.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
// import { createMongoIndexes } from './utils/createMongoIndexes.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidRecords', batchSize: 250 });

const updater = async (doc) => {
  // const newDoc = Object.assign({}, doc, {
  //   v2OutputBucket2: getBucket(doc.v2Output)
  // })
  // const newRecords = doc.records.map((record) => {
  //   const recordWithTestSwitch = addTestDataSwitch({ record });
  //   const recordWithWNextFen = addWNextFen({ record: recordWithTestSwitch, doc });
  //   const recordWithWV2Output = addV2Output({ record: recordWithWNextFen });
  //   const recordWithWV2OutputBucket = addV2OutputBucket({ record: recordWithWV2Output });
  //   return recordWithWV2OutputBucket;
  // });

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { v2OutputBucket2: getBucket(doc.v2Output), testData: Math.random() > 0.9 } },
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
    collectionName: 'scidRecords',
    filters: { 'records.v2OutputBucket2': { $exists: false } },
    updater,
    logBatchSize: 20000,
  });

  await writeCache();
  client.close();
};

run();
