import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV2OutputBucket } from './utils/addV2OutputBucket.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
import { addV3Output } from './utils/addV3Output.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { addMoveIndicators } from './utils/addMoveIndicators.mjs';

const pruneRecord = ({
  fen,
  progress,
  balance,
  testData,
  wNextFen,
  wNextResult,
  wNextBalance,
  v2Output,
  v2OutputBucket,
  moveIndicators,
  wNextMoveIndicators,
  v3Output,
}) => ({
  f: fen,
  p: progress,
  b: balance,
  t: testData,
  wf: wNextFen,
  wr: wNextResult,
  wb: wNextBalance,
  o2: v2Output,
  o2b: v2OutputBucket,
  m: moveIndicators,
  wm: wNextMoveIndicators,
  o3: Object.keys(v3Output).reduce((o3, key) => {
    o3[
      key
        .split('_')
        .map((s) => s[0])
        .join('')
    ] = v3Output[key];
    return o3;
  }, {}),
  s: Math.random(),
});

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
  const prunedRecords = recordsWithV3Output.map(pruneRecord);

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { pruned: true, records: prunedRecords }, $unset: { moves: '', recordsCopied: '' } },
    },
  });
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { pruned: { $ne: true } },

    updater,
  });

  await writeCache();
  client.close();
};

run();
