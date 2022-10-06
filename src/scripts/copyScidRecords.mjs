import { bulkWriter } from './utils/bulkWriter.mjs';
import { mirrorer } from './utils/mirrorer.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';

const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

const { addOp: addOpRecords, writeCache: writeCacheRecords } = bulkWriter({
  collectionName: 'scidRecords',
  batchSize: 1500,
});
const { addOp: addOpGames, writeCache: writeCacheGames } = bulkWriter({
  collectionName: 'scidGames',
  batchSize: 500,
});

const updater = async (doc) => {
  const prunedRecords = doc.records.map(
    (
      {
        f: fen,
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
    ) => {
      const needsMirroring = fen !== wNextFen;
      const previous4Fens = new Array(Math.max(4 - i, 0)).fill(null).concat(
        doc.records
          .slice(Math.max(0, i - 4), i)
          .map((r) => r.f)
          .map(needsMirroring ? mirrorer : (f) => f),
      );

      const lastMovedFrom = new Array(64)
        .fill(255)
        .map((val, cellIndex) => {
          let lookBackIndex = i;
          while (lookBackIndex--) {
            if (doc.records[lookBackIndex].m[0] === cellIndex) {
              return Math.min(255, i - lookBackIndex);
            }
          }
          return 255;
        })
        .map((val) => val.toString(16).padStart(2, '0'));

      const lastMovedTo = new Array(64)
        .fill(255)
        .map((val, cellIndex) => {
          let lookBackIndex = i;
          while (lookBackIndex--) {
            if (doc.records[lookBackIndex].m[1] === cellIndex) {
              return Math.min(255, i - lookBackIndex);
            }
          }
          return 255;
        })
        .map((val) => val.toString(16).padStart(2, '0'));

      const mirrorFlatArray = (arr) => {
        const chunks = [];
        const copiedArr = arr.slice();

        while (copiedArr.length) {
          chunks.push(copiedArr.splice(-8));
        }

        return chunks.flat();
      };

      const pieceToMove =
        wNextMoveIndicators &&
        wNextMoveIndicators.length &&
        expandGroupedBlanks(wNextFen.split('/')[Math.floor(wNextMoveIndicators[0] / 8)])[wNextMoveIndicators[0] % 8];

      return {
        g: doc._id,
        i,
        p: progress,
        t: testData,
        wf: wNextFen,
        p4f: previous4Fens,
        lmf: (needsMirroring ? mirrorFlatArray : (e) => e)(lastMovedFrom).join(''),
        lmt: (needsMirroring ? mirrorFlatArray : (e) => e)(lastMovedTo).join(''),
        wr: wNextResult,
        wb: wNextBalance,
        o2: v2Output,
        o2b: v2OutputBucket,
        wm: wNextMoveIndicators,
        pm: pieceToMove,
        o3: v3Output,
        s: sortVal,
      };
    },
  );

  await addOpRecords(prunedRecords.map((document) => ({ insertOne: { document } })));
  await addOpGames({ updateOne: { filter: { _id: doc._id }, update: { $set: { trackCopy: true } } } });
};

const run = async () => {
  const { client } = await updateMongoDocs({
    collectionName: 'scidGames',
    filters: { trackCopy: { $exists: false } },
    updater,
  });

  await writeCacheRecords();
  await writeCacheGames();
  client.close();
};

run();
