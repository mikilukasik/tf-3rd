import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import { discWriter } from './utils/discWriter.mjs';
// import { getGroupName } from './utils/getDataset.mjs';
import { movesToOneHot } from './utils/oneHotMovesMap.mjs';

const {
  writeRecordToDisc: updater,
  writeCache: writeDiscCache,
  updateStatsFile,
} = discWriter({
  recordsFolder: 'data/randomizedAll',
  // groups: ({ wr, wm, p, o2, o2b, wf, p4f, lmf, lmt, pm, i }) => {
  groups: ({ wr, wm, p, o2, wf, lmf, lmt, i, s }) => {
    // const filter = () => true; //wr === 1 && wm && wm.length === 2;
    const transform = () => [wr, wf, i, p, o2, lmf, lmt, wm ? movesToOneHot[wm[0]][wm[1]] : '-', s].join(',');

    return [
      {
        groupName: 'randomOrder',
        // filter,
        getPath: () => '',
        transform,
      },
      // {
      //   groupName: 'movesTo',
      //   filter,
      //   getPath: () => `${p === 1 ? 2 : Math.floor(p * 3)}/${wm[1]}/${getGroupName(o2b)}`,
      //   transform,
      // },
    ];
  },
});

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidRecords',
    filters: {},
    sort: { s: 1 },
    project: { wr: 1, wm: 1, p: 1, o2: 1, wf: 1, lmf: 1, lmt: 1, i: 1, t: 1, s: 1 },
    updater,
    // skip: 338200,
    lastSortValUpdater: updateStatsFile,
  });

  await writeDiscCache();
  client.close();
};

run();
