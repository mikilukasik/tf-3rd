import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV2OutputBucket } from './utils/addV2OutputBucket.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
import { addV3Output, v3OutputKeys } from './utils/addV3Output.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { addMoveIndicators } from './utils/addMoveIndicators.mjs';
import { discWriter } from './utils/discWriter.mjs';

const { addOp, writeCache } = bulkWriter({ collectionName: 'scidGames' });
const { writeRecordToDisc, writeGameToDisc } = discWriter({
  recordsFolder: 'data/newCsvs',
  gamesFolder: 'data/newGames',
  groups: [
    {
      groupName: 'moveIndex',
      filter: ({ wNextResult, wNextMoveIndicators }) =>
        wNextResult === 1 && wNextMoveIndicators && wNextMoveIndicators.length === 2,
      getPath: ({ wNextMoveIndicators, progress }) => `${Math.floor(progress * 3)}/${wNextMoveIndicators.join('/')}`,
      transform: ({ wNextFen, wNextMoveIndicators }) => [wNextFen, ...wNextMoveIndicators].join(','),
    },
    {
      groupName: 'v2Output',
      filter: () => true,
      getPath: ({ progress, v2OutputBucket }) => `${Math.floor(progress * 3)}/${v2OutputBucket}`,
      transform: ({ wNextFen, v2Output, v3Output, wNextResult }) =>
        [wNextFen, wNextResult, v2Output, ...v3OutputKeys.map((key) => v3Output[key])].join(','),
    },
    {
      groupName: 'progress',
      filter: () => Math.random() > 0.7,
      getPath: ({ progress }) => `${Math.floor(progress * 10)}`,
      transform: ({ fen, progress }) => [fen, progress].join(','),
    },
  ],
});

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

  // await writeRecordToDisc(recordsWithV3Output);
  await writeGameToDisc(Object.assign({}, doc, { records: recordsWithV3Output }));

  await addOp({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { gameOnDisc: true } },
    },
  });
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { gameOnDisc: { $exists: false } },
    updater,
  });

  await writeCache();
  client.close();
};

run();
