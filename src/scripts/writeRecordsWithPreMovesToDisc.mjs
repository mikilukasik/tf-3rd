import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { discWriter } from './utils/discWriter.mjs';
import { getGroupName } from './utils/getDataset.mjs';

const { writeRecordToDisc: updater, writeCache: writeDiscCache } = discWriter({
  recordsFolder: 'data/newCsvs3',
  groups: ({ wr, wm, p, o2b, wf, p4f, lmf, lmt, pm }) => {
    const filter = () => wr === 1 && wm && wm.length === 2;
    const transform = () => [wf, p, ...p4f, lmf, lmt, ...wm, pm].join(',');

    return [
      {
        groupName: 'movesFrom',
        filter,
        getPath: () => `${p === 1 ? 2 : Math.floor(p * 3)}/${wm[0]}/${getGroupName(o2b)}`,
        transform,
      },
      {
        groupName: 'movesTo',
        filter,
        getPath: () => `${p === 1 ? 2 : Math.floor(p * 3)}/${wm[1]}/${getGroupName(o2b)}`,
        transform,
      },
    ];
  },
});

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidRecords',
    filters: {},
    sort: { s: 1 },
    updater,
  });

  await writeDiscCache();
  client.close();
};

run();
