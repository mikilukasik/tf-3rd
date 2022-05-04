import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { discWriter } from './utils/discWriter.mjs';
import { getGroupName } from './utils/getDataset.mjs';
import { v3OutputKeys } from './utils/addV3Output.mjs';
import { bulkWriter } from './utils/bulkWriter.mjs';

const { addOp, writeCache: writeMongoCache } = bulkWriter({ collectionName: 'scidRecordsSorted', batchSize: 2000 });

const { writeRecordToDisc, writeCache: writeDiscCache } = discWriter({
  recordsFolder: 'data/newCsvs2',
  gamesFolder: 'data/newGames2',
  groups: [
    // {
    //   groupName: 'moveIndex',
    //   filter: ({ wr, wm }) => wr === 1 && wm && wm.length === 2,
    //   getPath: ({ wm, p }) => `${Math.floor(p * 3)}/${wm.join('/')}`,
    //   transform: ({ wf, wm }) => [wf, ...wm].join(','),
    // },
    {
      groupName: 'all',
      filter: () => true,
      getPath: ({ p, o2b }) => `${p === 1 ? 2 : Math.floor(p * 3)}/${getGroupName(o2b)}`,
      // transform: ({ wNextFen, v2Output, v3Output, wNextResult }) =>
      //   [wNextFen, wNextResult, v2Output, ...v3OutputKeys.map((key) => v3Output[key])].join(','),
      transform: ({ wf, o2, o3, wr, p, wm }) =>
        [
          wf,
          o2,
          wr,
          p,
          (wm || []).join('-') || null,
          ...v3OutputKeys.map(
            (key) =>
              o3[
                key
                  .split('_')
                  .map((s) => s[0])
                  .join('')
              ],
          ),
        ].join(','),
    },
    // {
    //   groupName: 'progress',
    //   filter: () => Math.random() > 0.7,
    //   getPath: ({ p }) => `${Math.floor(p * 10)}`,
    //   transform: ({ wf, p }) => [wf, p].join(','),
    // },
  ],
});

const updater = async (record) => {
  await writeRecordToDisc(record);

  const copiedRecord = Object.assign({}, record);
  delete copiedRecord._id;

  await addOp({ insertOne: { document: copiedRecord } });
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidRecords',
    filters: {},
    sort: { s: 1 },
    updater,
  });

  await writeDiscCache();
  await writeMongoCache();
  client.close();
};

run();
