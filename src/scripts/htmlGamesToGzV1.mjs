import { promises as fs } from 'fs';
import * as path from 'path';
import { addHitChkmtSoon } from './utils/addHitChkmtSoon.mjs';
import { addWNextFenV2 } from './utils/addWNextFenV2.mjs';
import { getEndingData } from './utils/getEndingData.mjs';
import { addMoveIndicatorsV2 } from './utils/addMoveIndicatorsV2.mjs';
import { addLmfLmt } from './utils/addLmfLmt.mjs';
import { addFlippedAndRotatedV2 } from './utils/addFlippedAndRotatedV2.mjs';
import { discWriter } from './utils/discWriterV3.mjs';
import { shuffle } from '../../chss-module-engine/src/utils/schuffle.js';
import { addMoveMap } from './utils/addMoveMap.mjs';

const BATCH_SIZE = 100;
const parentFolder = 'data/new_html';
const recordsFolder = 'data/gz_v1';

const progressGroupCount = 4;

let filesSkipped = 0;
let fensSkipped = 0;

const fileFilter = () => true;
// ({ filename, origResult }) => {
//   if (filename.includes('W3100') || filename.includes('B3100')) return true;

//   if (origResult === 1 && filename.includes('W2950')) return true;
//   if (origResult === -1 && filename.includes('B2950')) return true;

//   filesSkipped += 1;
//   return false;
// };

const recordFilter = () => true;
// ({ w_rating, wNextResult }) => {
//   const willAllow = w_rating > 3000 || (w_rating > 2900 && wNextResult === 1);
//   if (!willAllow) fensSkipped += 1;
//   return willAllow;
// };

const gameKeys = [
  'filename',
  'result',
  'chkmate_ending',
  'stall_ending',
  'aborted_ending',
  'total_moves',
  'w_rating',
  'b_rating',
  'raring_diff',
];
const recordKeys = [
  'fen',
  'movestr',
  'onehot_move',
  'hit_soon',
  'chkmate_soon',
  'result',
  'draw',
  'won',
  'lost',
  'chkmate_ending',
  'stall_ending',
  'aborted_ending',
  'balance',
  'piece_count',
  'hits_left',
  'is_opening',
  'is_midgame',
  'is_endgame',
  'filename',
  'move_index',
  'total_moves',
  'is_last',
  'lmf',
  'lmt',
  'moveMap',
  'w_rating',
  'b_rating',
  'min_rating_diff',
  'max_rating_diff',
  'hit_or_win_soon',
  'version',
  'rnd',
  'test',
];

const getProgressGroupName = (p) => {
  const normalized = Math.ceil(p * progressGroupCount) || 1;
  return `${((normalized - 1) / progressGroupCount).toFixed(2)} - ${(normalized / progressGroupCount).toFixed(2)}`;
};

const getCompressedMoveMap = (moveMap, fen, version) => {
  const asArray = moveMap.map((cellData) => {
    if (!cellData) return '0000000000000000000000000';

    const { from = {}, to = {} } = cellData;

    if (to[0]) throw new Error('to[0] should never exist');
    if (to[7]) throw new Error('to[7] should never exist');
    if (from[7]) throw new Error('from[7] should never exist');
    if (from[8]) throw new Error('from[8] should never exist');
    if (to[8]) throw new Error('to[8] should never exist');

    return [
      from[0] || 0,
      from[1] || 0,
      from[2] || 0,
      from[3] || 0,
      from[4] || 0,
      from[5] || 0,
      from[6] || 0,
      from[9] || 0,
      from[10] || 0,
      from[11] || 0,
      from[12] || 0,
      from[13] || 0,
      from[14] || 0,

      to[1] || 0,
      to[2] || 0,
      to[3] || 0,
      to[4] || 0,
      to[5] || 0,
      to[6] || 0,
      to[9] || 0,
      to[10] || 0,
      to[11] || 0,
      to[12] || 0,
      to[13] || 0,
      to[14] || 0,
    ]
      .map((n) => {
        if (n > 31) {
          console.log(moveMap, n, fen, version);
          throw new Error('n > 15');
        }
        const char = Math.min(31, n || 0).toString(32);
        if (char.length !== 1) throw new Error(`char length ${char.length}`);

        return char;
      })
      .join('');
  });

  const asStr = asArray.join('');

  if (asStr.length !== 64 * 25) throw new Error(`movemap length ${asStr.length}`);

  return asStr;
};

const {
  writeRecordToDisc,
  writeCache: writeDiscCache,
  updateStatsFile,
} = discWriter({
  recordsFolder,
  recordsPerFile: 2000,
  groups: ({
    fen,
    movestr,
    onehot_move,
    hit_soon,
    chkmate_soon,
    result,
    draw,
    won,
    lost,
    chkmate_ending,
    stall_ending,
    aborted_ending,
    balance,
    piece_count,
    hits_left,
    is_opening,
    is_midgame,
    is_endgame,
    filename,
    hit_or_win_soon,
    move_index,
    total_moves,
    is_last,
    lmf,
    lmt,
    moveMap,
    version,
    rnd,
    test,
    w_rating,
    b_rating,
    min_rating_diff,
    max_rating_diff,
  }) => {
    const progress = move_index / total_moves;

    const transform = () => {
      if (typeof onehot_move !== 'number') {
        onehot_move = 1836;
      }
      return [
        fen,
        onehot_move,
        hit_soon,
        // hit_or_win_soon,
        chkmate_soon,
        result,
        chkmate_ending ? '1' : '',
        stall_ending ? '1' : '',
        // is_opening ? 0 : is_midgame ? 1 : 2,
        is_last ? '1' : '',
        lmf.map((val) => val.toString(16).padStart(2, '0')).join(''),
        lmt.map((val) => val.toString(16).padStart(2, '0')).join(''),
        // move_index,
        // total_moves,
        chkmate_ending || stall_ending ? progress : '',
        chkmate_ending || stall_ending ? '' : progress * 0.8, // adjusted progress for games that were not completed
        w_rating,
        b_rating,
        min_rating_diff,
        max_rating_diff,
        getCompressedMoveMap(moveMap, fen, version),
      ].join(',');
    };
    return [
      {
        groupName: 'default',
        // filter,
        getPath: () =>
          `${getProgressGroupName(chkmate_ending || stall_ending ? progress : progress * 0.8)}/${Math.floor(
            Math.random() * 250,
          )
            .toString()
            .padStart(3, '0')}`,
        // () => {
        //   return Math.floor(Math.random() * 500)
        //     .toString()
        //     .padStart(3, '0');
        // },
        transform,
      },
    ];
  },
});

const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

const getFilledArray = (length = 8) =>
  Array(length)
    .fill(0)
    .map((e, i) => i);

const getEnPassantTarget = ({ fen1, fen2, whitesMove }) => {
  const pawnChar = whitesMove ? 'P' : 'p';

  const splitFen1 = fen1.split('/');
  const splitFen2 = fen2.split('/');
  const fen1SourceRow = expandGroupedBlanks(splitFen1[whitesMove ? 6 : 1]);
  const fen1TargetRow = expandGroupedBlanks(splitFen1[whitesMove ? 4 : 3]);
  const fen2SourceRow = expandGroupedBlanks(splitFen2[whitesMove ? 6 : 1]);
  const fen2TargetRow = expandGroupedBlanks(splitFen2[whitesMove ? 4 : 3]);

  const { length: foundOne, 0: col } = getFilledArray().filter(
    (col) =>
      fen1SourceRow[col] === pawnChar &&
      fen1TargetRow[col] === '1' &&
      fen2SourceRow[col] === '1' &&
      fen2TargetRow[col] === pawnChar,
  );

  return foundOne ? `${String.fromCharCode(97 + col)}${whitesMove ? '3' : '6'}` : '-';
};

const processFenLines = async ({ fenLines, filename }) => {
  const processedFenLines = [];

  let castlingStr = 'KQkq';
  const updateCastlingStr = (fenStr) => {
    const removeLetter = (letter) => (castlingStr = castlingStr.replace(letter, ''));

    let [bRow, , , , , , , wRow] = fenStr.split('/');
    bRow = expandGroupedBlanks(bRow);
    wRow = expandGroupedBlanks(wRow);

    if (bRow[0] !== 'r') removeLetter('q');
    if (bRow[7] !== 'r') removeLetter('k');
    if (wRow[0] !== 'R') removeLetter('Q');
    if (wRow[7] !== 'R') removeLetter('K');

    if (bRow[4] !== 'k') {
      removeLetter('k');
      removeLetter('q');
    }
    if (wRow[4] !== 'K') {
      removeLetter('K');
      removeLetter('Q');
    }
  };

  for (const [moveIndex, line] of fenLines.entries()) {
    const fenStr = `${line.substr(1, line.indexOf(' ') - 1)}`;

    if (moveIndex === 0 && fenStr !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') {
      throw new Error(`First fen is invalid in ${filename}: ${fenStr}`);
    }

    const wasWhitesMove = moveIndex % 2;

    updateCastlingStr(fenStr);
    const ept = moveIndex
      ? getEnPassantTarget({
          fen1: fenLines[moveIndex - 1],
          fen2: fenStr,
          whitesMove: wasWhitesMove,
        })
      : '-';

    const newFen = `${fenStr} ${wasWhitesMove ? 'b' : 'w'} ${castlingStr || '-'} ${ept}`;
    processedFenLines.push(newFen);
  }

  return processedFenLines.filter(Boolean);
};

const getFenLines = ({ lines }) => {
  const firstFenLineIndex = lines.findIndex((line) => line.startsWith('movesArray = new Array(')) + 1;
  const lastFenLineIndex = lines.findIndex((line) => line.startsWith('var current = 0;'));

  return lines.slice(firstFenLineIndex, lastFenLineIndex);
};

const getResult = ({ lines, filename }) => {
  const resultStr = lines.find((line) => line.startsWith(`<br><class="VH">`)).substr(16, 3);

  switch (resultStr) {
    case '1-0':
      return 1;

    case '0-1':
      return -1;

    case '=-=':
      return 0;

    default:
      throw new Error(`no result in html ${filename}: ${resultStr}`);
  }
};

const processHtml = async ({ htmlContent, filename }) => {
  try {
    const lines = htmlContent.split('\n');
    const origResult = getResult({ lines, filename });

    if (!fileFilter({ filename, origResult, lines })) {
      return null;
    }

    const fenLines = getFenLines({ lines });
    const fens = await processFenLines({ fenLines, filename });

    const { chkmate_ending, stall_ending, aborted_ending, records, total_moves, w_rating, b_rating, raring_diff } =
      await getRecords({
        fens,
        origResult,
        filename,
      });

    return {
      filename,
      result: origResult,

      chkmate_ending,
      stall_ending,
      aborted_ending,

      total_moves,
      records,
      w_rating,
      b_rating,
      raring_diff,
    };
  } catch (e) {
    console.error(e);
    console.log({ filename });

    // process.exit(1);
    return null;
  }
};

// alphazero's valuation https://arxiv.org/pdf/2009.04374.pdf
// const wPieceValues = {
//   P: 1,
//   B: 3.33,
//   N: 3.05,
//   R: 5.63,
//   Q: 9.5,
// };

// const bPieceValues = {
//   p: -1,
//   b: -3.33,
//   n: -3.05,
//   r: -5.63,
//   q: -9.5,
// };

const wPieceValues = {
  P: 1,
  B: 3,
  N: 3,
  R: 5,
  Q: 9,
};

const bPieceValues = {
  p: -1,
  b: -3,
  n: -3,
  r: -5,
  q: -9,
};

const pieceValues = { ...wPieceValues, ...bPieceValues };

const getBalance = ({ fen }) => {
  const chars = fen.split(' ')[0].split('');

  let w_pieces_wo_pawns = 0;
  let b_pieces_wo_pawns = 0;
  let balance = 0;
  let piece_count = 0;

  chars.forEach((char) => {
    w_pieces_wo_pawns += wPieceValues[char] || 0;
    b_pieces_wo_pawns -= bPieceValues[char] || 0;
    balance += pieceValues[char] || 0;
    piece_count += pieceValues[char] ? 1 : 0;
  });

  return {
    is_endgame: w_pieces_wo_pawns < 15.5 && b_pieces_wo_pawns < 15.5,
    balance: Math.round(balance * 100),
    piece_count,
  };
};

const pruneRecord = ({
  filename,
  total_moves,
  move_index,
  is_last,
  won,
  lost,
  draw,
  chkmate_ending,
  stall_ending,
  aborted_ending,
  piece_count,
  hits_left,
  is_opening,
  is_midgame,
  is_endgame,
  fen,
  wNextBalance,
  wNextResult,
  hit_soon,
  hit_or_win_soon,
  chkmate_soon,
  movestr,
  onehot_move,
  lmf,
  lmt,
  version,
  w_rating,
  b_rating,
  min_rating_diff,
  max_rating_diff,
  moveMap,
}) => ({
  fen,

  movestr,
  onehot_move,

  hit_soon,
  chkmate_soon,

  result: wNextResult,
  draw,
  won,
  lost,
  chkmate_ending,
  stall_ending,
  aborted_ending,

  balance: wNextBalance,
  piece_count,
  hits_left,

  is_opening,
  is_midgame,
  is_endgame,

  filename,
  move_index,
  total_moves,
  is_last,

  lmf,
  lmt,
  moveMap,

  w_rating,
  b_rating,
  min_rating_diff,
  max_rating_diff,

  hit_or_win_soon,

  version,
  rnd: Math.random(),
  test: Math.random() > 0.99, // 1% is still around 1.4M test samples
});

const ratingsMap = {
  'engChkmt2850-Diff0-14': { minDiff: '0', maxDiff: '14' },
  'engChkmt2850-Diff100-199': { minDiff: '100', maxDiff: '199' },
  'engChkmt2850-Diff15-49': { minDiff: '15', maxDiff: '49' },
  'engChkmt2850-Diff200-499': { minDiff: '200', maxDiff: '499' },
  'engChkmt2850-Diff50-99': { minDiff: '50', maxDiff: '99' },
  'engChkmt2850-Diff500-3000': { minDiff: '500', maxDiff: '3000' },
  engW2250B2850: { wRating: 2250, bRating: 2850 },
  engW2750B2950: { wRating: 2750, bRating: 2950 },
  engW2850B2250: { wRating: 2850, bRating: 2250 },
  engW2850B2850: { wRating: 2850, bRating: 2850 },
  engW2850Bany: { wRating: 2850, bRating: 0 },
  engW2950B2750: { wRating: 2950, bRating: 2750 },
  engW2950B2950: { wRating: 2950, bRating: 2950 },
  engW2950Bany: { wRating: 2950, bRating: 0 },
  engW3100B3100: { wRating: 3100, bRating: 3100 },
  engW3100Bany: { wRating: 3100, bRating: 0 },
  engWanyB2850: { wRating: 0, bRating: 2850 },
  engWanyB2950: { wRating: 0, bRating: 2950 },
  engWanyB3100: { wRating: 0, bRating: 3100 },
};

const getRecords = async ({ fens, origResult, filename }) => {
  const total_moves = fens.length - 1;

  const lastFen = fens[total_moves];
  const { chkmate_ending, stall_ending, aborted_ending } = await getEndingData(lastFen);

  const { wRating, bRating, minDiff, maxDiff } = ratingsMap[filename.split('_')[0]];

  const records = fens.map((fen, move_index) => {
    const { balance, is_endgame, piece_count } = getBalance({ fen });
    const is_opening = move_index < 20 || piece_count === 30; // up to 20 halfmoves or until the 1st hit. whichever is longer

    return {
      orig_fen: fen,
      filename,
      balance,
      balancesAhead: [balance],
      total_moves,
      move_index,
      version: 0,
      is_last: move_index === total_moves,
      draw: origResult === 0,
      chkmate_ending,
      stall_ending,
      aborted_ending,
      piece_count,
      is_opening,
      is_midgame: !is_opening && !is_endgame,
      is_endgame,
      w_rating: wRating,
      b_rating: bRating,
      min_rating_diff: minDiff,
      max_rating_diff: maxDiff,
    };
  });

  let recordIndex = total_moves;
  while (recordIndex--) records[recordIndex].balancesAhead.push(...records[recordIndex + 1].balancesAhead);

  const recordsWithMoveIndicators = records.map((record, index) => {
    const recordWithWNextFen = addWNextFenV2({ ...record, origResult });
    const recordWithV2Output = addHitChkmtSoon(recordWithWNextFen);
    const recordWithMove = addMoveIndicatorsV2({ record: recordWithV2Output, records, index, aborted_ending });

    return recordWithMove;
  });

  const recordsWithLmfLmt = recordsWithMoveIndicators
    .map((record, index) => {
      const withLmfLmt = addLmfLmt({ record, records: recordsWithMoveIndicators, index });
      const withMoveMap = addMoveMap({ record: withLmfLmt });
      return withMoveMap;
    })
    .filter(recordFilter);

  const newRecords = addFlippedAndRotatedV2(recordsWithLmfLmt);

  return {
    records: newRecords.map(pruneRecord),
    chkmate_ending,
    stall_ending,
    aborted_ending,
    total_moves,
  };
};

const readGames = async ({ skipFilenames = [] }) => {
  const sourceDirs = (await fs.readdir(parentFolder)).map((fName) => path.resolve(parentFolder, fName));
  let sdIndex = sourceDirs.length;
  while (sdIndex--) {
    if (!(await fs.lstat(sourceDirs[sdIndex])).isDirectory()) sourceDirs.splice(sdIndex, 1);
  }
  console.log(`Reading .html files from ${sourceDirs.map((folderName) => folderName.split('/').pop()).join(', ')}...`);

  const allFilesArray = (
    await Promise.all(
      sourceDirs.map((folderName) =>
        fs.readdir(folderName).then((filenames) =>
          filenames.map((filename) => ({
            filename,
            folderName,
          })),
        ),
      ),
    )
  ).flat();

  const skippedHash = skipFilenames.reduce((p, c) => {
    p[c] = true;
    return p;
  }, {});

  const allFilesArrayWithoutSkipped = allFilesArray.filter(({ filename }) => !skippedHash[filename]);

  const validFilesArray = shuffle(allFilesArrayWithoutSkipped.filter(({ filename }) => /_\d+.html$/.test(filename)));
  const validFilesCount = validFilesArray.length;
  console.log(
    `Found ${validFilesCount} valid files out of ${allFilesArray.length} total files. (${skipFilenames.length} files were already processed)`,
  );

  let fileIndex = 0;

  const getNextGames = async () => {
    const result = [];

    for (let index = 0; index < BATCH_SIZE; index += 1) {
      const fileObject = validFilesArray[fileIndex++];
      if (!fileObject) break;

      const { filename, folderName } = fileObject;

      const htmlContent = await fs.readFile(path.resolve(folderName, filename), 'utf-8');
      const game = await processHtml({ htmlContent, filename });

      if (htmlContent && !game) continue;

      result.push({ gameIndex: fileIndex - 1, game, filename, folderName });
    }

    return result;
  };

  return { getNextGames, validFilesCount };
};

const run = async () => {
  // await pgClient.connect();

  // const res = await pgClient.query('SELECT $1::text as message', ['Postgres connected']);
  // console.log(res.rows[0].message); // Hello world!

  // const filenamesInDb = (await pgClient.query('SELECT filename FROM public.scid_games')).rows.map((e) => e.filename);
  // console.log(`There are ${filenamesInDb.length} files already processed in the db.`);

  const { getNextGames, validFilesCount } = await readGames({ skipFilenames: [] /* filenamesInDb */ });

  const started = Date.now();

  let processed = 0;
  for (let nextGames = await getNextGames(); nextGames && nextGames.length; nextGames = await getNextGames()) {
    const mongoRecords = nextGames.map(({ game }) => game);

    const gamesUpdateVals = [];
    const recordsUpdateVals = [];

    let i = mongoRecords.length;

    while (i--) {
      const game = { ...mongoRecords[i], records: undefined };
      const records = mongoRecords[i].records; //.slice(-1);

      await writeRecordToDisc(records);

      gamesUpdateVals.push(`(${gameKeys.map((key) => `'${game[key]}'`).join(',')})`);

      recordsUpdateVals.push(
        ...records.map(
          (record) =>
            `(${recordKeys
              .map((key) =>
                Array.isArray(record[key])
                  ? `'{${record[key].map((val) => `"${val}"`).join(',')}}'`
                  : record[key] === null
                  ? 'NULL'
                  : typeof record[key] === 'object'
                  ? `'${JSON.stringify(record[key])}'`
                  : `'${record[key]}'`,
              )
              .join(',')})`,
        ),
      );
    }

    // const pgGamesPromise = pgClient.query(
    //   `INSERT INTO scid_games (${gameKeys.join(', ')}) VALUES ${gamesUpdateVals.join(',')}`,
    // );
    // const pgRecordsPromise = pgClient.query(
    //   `INSERT INTO scid_records (${recordKeys.join(', ')}) VALUES ${recordsUpdateVals.join(',')}`,
    // );

    // await Promise.all([pgGamesPromise, pgRecordsPromise]);

    processed += mongoRecords.length;

    const elapsed = Date.now() - started;
    const recordTakes = elapsed / (processed + +filesSkipped);
    const remainingTakes = (validFilesCount - processed - filesSkipped) * recordTakes;

    console.log(
      `processed ${processed} of ${validFilesCount} games. (Skipped games: ${filesSkipped}, skipped fens: ${fensSkipped}) ETA: ${(
        remainingTakes / 3600000
      ).toFixed(2)} hours`,
    );
  }

  await writeDiscCache();
};

run().catch(console.error);
