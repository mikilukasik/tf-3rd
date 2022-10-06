// import { bulkWriter } from './utils/bulkWriter.mjs';
// import { mirrorer } from './utils/mirrorer.mjs';
import { updateMongoDocs } from './utils/updateMongoDocs.mjs';
import pkg from '../utils/stockfish_worker.js';
import { mirrorer } from './utils/mirrorer.mjs';
const { getMovedFen } = pkg;
export const cellIndex2cellStr = (index) => `${String.fromCharCode((index % 8) + 97)}${8 - Math.floor(index / 8)}`;
// const { addOp, writeCache } = bulkWriter({ collectionName: 'scidRecords', batchSize: 500 });

const updater = async (doc) => {
  mainloop: for (const [
    i,
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
  ] of doc.records.entries()) {
    // if (!wNextMoveIndicators) {
    //   console.log({
    //     fen,
    //     progress,
    //     testData,
    //     wNextFen,
    //     wNextResult,
    //     wNextBalance,
    //     v2Output,
    //     v2OutputBucket,
    //     wNextMoveIndicators,
    //     v3Output,
    //     sortVal,
    //   });
    // }
    if (progress === 1) continue mainloop;

    const moveStr = wNextMoveIndicators.map(cellIndex2cellStr).join('');

    const nextFen = doc.records[i + 1].wf.split(' ').slice(0, 3).join(' ');
    const movedFen = mirrorer(await getMovedFen(moveStr, wNextFen))
      .split(' ')
      .slice(0, 3)
      .join(' ');

    if (
      nextFen !== movedFen //&&
      // !(await Promise.all(['B', 'K', 'R', 'Q'].map((piece) => getMovedFen(`${moveStr}${piece}`)))).reduce(
      //   (p, c) => p || c.split(' ').slice(0, 3).join(' ') === nextFen,
      //   false,
      // )
    ) {
      for (const char of ['b', 'n', 'r', 'q']) {
        const movedFenPromoted = mirrorer(await getMovedFen(moveStr + char, wNextFen))
          .split(' ')
          .slice(0, 3)
          .join(' ');
        // console.log({ movedFenPromoted });
        if (movedFenPromoted === nextFen) continue mainloop;
      }

      console.log('found one', { wNextFen, movedFen, nextFen, moveStr, wNextMoveIndicators });
      process.exit(0);
    }
    // console.log(movedFen, nextFen);
  }

  // await addOp(prunedRecords.map((document) => ({ insertOne: { document } })));
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
