import { bulkWriter } from './utils/bulkWriter.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidRecords', batchSize: 500 });

const updater = async (doc) => {
  const prunedRecords = doc.records.map(
    (
      {
        p: progress,
        t: testData,
        wf: wNextFen,
        wr: wNextResult,
        wb: wNextBalance,
        o2: v2Output,
        o2b: v2OutputBucket,
        wm: wNextMoveIndicators,
        o3: v3Output,
        s: sortVal,
      },
      i,
    ) => ({
      g: doc._id,
      i,
      p: progress,
      t: testData,
      wf: wNextFen,
      wr: wNextResult,
      wb: wNextBalance,
      o2: v2Output,
      o2b: v2OutputBucket,
      wm: wNextMoveIndicators,
      o3: v3Output,
      s: sortVal,
    }),
  );

  await addOp(prunedRecords.map((document) => ({ insertOne: { document } })));
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { pruned: true },
    updater,
  });

  await writeCache();
  client.close();
};

run();
