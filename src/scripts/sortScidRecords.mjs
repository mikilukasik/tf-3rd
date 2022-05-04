import { bulkWriter } from './utils/bulkWriter.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidRecordsSorted', batchSize: 2000 });

const updater = async (record) => {
  const copiedRecord = Object.assign({}, record);
  delete copiedRecord._id;

  await addOp({ insertOne: { document: copiedRecord } });
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidRecords',
    sort: { s: 1 },
    logBatchSize: 1000,
    updater,
  });

  await writeCache();
  client.close();
};

run();
