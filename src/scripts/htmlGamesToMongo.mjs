import { promises as fs } from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { addTestDataSwitch } from './utils/addTestDataSwitch.mjs';
import { addV2Output } from './utils/addV2Output.mjs';
import { addV2OutputBucket } from './utils/addV2OutputBucket.mjs';
import { addWNextFen } from './utils/addWNextFen.mjs';
import pkg1 from '../utils/stockfish_worker.js';
const { getStockfishSearchScore, getMovedFen } = pkg1;

const BATCH_SIZE = 100;
const parentFolder = 'data/html/0x';

const client = new MongoClient('mongodb://0.0.0.0:27017');
let db;

const collections = {};

const connect = async () => {
  await client.connect();
  db = client.db('chss');
};

const getCollection = async (collecitonName) => {
  if (collections[collecitonName]) return collections[collecitonName];
  if (!db) await connect();
  collections[collecitonName] = db.collection(collecitonName);
  return collections[collecitonName];
};

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

const processFenLines = async ({ fenLines, fileName }) => {
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
      throw new Error(`First fen is invalid in ${fileName}: ${fenStr}`);
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

const processMoveLines = async ({ moveLines, fileName }) => {
  try {
    if (!moveLines[0].startsWith('<a href="javascript:gotoMove(0)" ID="0" class="V0"></a> <span class="VC">')) {
      throw new Error(`First move is invalid in ${fileName}: ${moveLines[0]}`);
    }

    const moves = moveLines.slice(1).map((moveLine) => moveLine.match(/class="V0">(\d+.)?(.*)<\/a>/)[2]);
    return moves;
  } catch (e) {
    console.error(e);
    console.log({ fileName });
    return null;
  }
};

const getFenLines = ({ lines }) => {
  const firstFenLineIndex = lines.findIndex((line) => line.startsWith('movesArray = new Array(')) + 1;
  const lastFenLineIndex = lines.findIndex((line) => line.startsWith('var current = 0;'));

  return lines.slice(firstFenLineIndex, lastFenLineIndex);
};

const getMoveLines = ({ lines }) => {
  return lines.filter((line) => line.startsWith('<a href="javascript:gotoMove('));
};

const getPlayers = ({ lines }) => {
  const playersLine = lines.find((line) => line.startsWith('<span class="hPlayers">'));
  if (!playersLine) return null;

  try {
    const players = playersLine.replace('<br>', '').split('>')[1].split('<')[0];
    const [wName, bName] = players.split('-').map((str) => str.trim());
    return { wName, bName };
  } catch (e) {
    return { playersLine, error: e.message };
  }
};

const getEvent = ({ lines }) => {
  const eventLine = lines.find((line) => line.startsWith('<span class="hEvent">'));
  if (!eventLine) return null;

  try {
    const event = eventLine.replace('<br>', '').split('>')[1].split('<')[0];
    return event;
  } catch (e) {
    return eventLine;
  }
};

const getResult = ({ lines, fileName }) => {
  const resultStr = lines.find((line) => line.startsWith(`<br><class="VH">`)).substr(16, 3);

  switch (resultStr) {
    case '1-0':
      return 1;

    case '0-1':
      return -1;

    case '=-=':
      return 0;

    default:
      throw new Error(`no result in html ${fileName}: ${resultStr}`);
  }
};

const processHtml = async ({ htmlContent, fileName, folderName }) => {
  try {
    const lines = htmlContent.split('\n');
    const fenLines = getFenLines({ lines });
    const moveLines = getMoveLines({ lines });
    const players = getPlayers({ lines });
    const event = getEvent({ lines });

    const origResult = getResult({ lines, fileName });
    const fens = await processFenLines({ fenLines, fileName });
    const moves = await processMoveLines({ moveLines, fileName });

    const { records, result, fensAdded } = await getRecords({ fens, origResult, fileName });

    return {
      origResult,
      result,
      records,
      fens,
      moves,
      players,
      event,
      fileName,
      folderName,
      fensAdded,
      newBatch: true,
    };
  } catch (e) {
    console.error(e);
    console.log({ fileName });
    return null;
  }
};

// alphazero's valuation https://arxiv.org/pdf/2009.04374.pdf
const pieceValues = {
  p: -1,
  b: -3.33,
  n: -3.05,
  r: -5.63,
  q: -9.5,
  P: 1,
  B: 3.33,
  N: 3.05,
  R: 5.63,
  Q: 9.5,
};

const getBalance = ({ fen }) =>
  Math.round(
    fen
      .split(' ')[0]
      .split('')
      .reduce((p, c) => p + (pieceValues[c] || 0), 0) * 100,
  );

const finishGame = async ({ fens, origResult, fileName }) => {
  let result = origResult;
  const extendedFens = fens.slice();
  let fensAdded = 0;

  if (result === 0) {
    return { extendedFens, result, fensAdded };
  }

  let fen = fens[fens.length - 1];
  for (let i = 0; i < 150; i += 1) {
    const { bestmove } = await getStockfishSearchScore(fen, 14);
    if (!bestmove) {
      const sideToMove = fen.split(' ')[1];
      if ((sideToMove === 'w' && result !== -1) || (sideToMove === 'b' && result !== 1)) {
        throw new Error(`result has changed r: ${origResult}, lastFen: ${fens[fens.length - 1]} fileName: ${fileName}`);
      }

      return { extendedFens, result, fensAdded };
    }

    fen = await getMovedFen(bestmove, fen);
    extendedFens.push(fen);
    fensAdded += 1;
  }

  throw new Error(`couldn't finish game in 150 moves r: ${origResult}, lastFen: ${fens[fens.length - 1]}`);
};

const getRecords = async ({ fens, origResult, fileName }) => {
  const { extendedFens, result, fensAdded } = await finishGame({ fens, origResult, fileName });

  const fensLength = extendedFens.length;

  const records = extendedFens.map((fen, fenIndex) => {
    const balance = getBalance({ fen });

    return {
      fen,
      progress: fenIndex / (fensLength - 1),
      balance,
      balancesAhead: [balance],
      rnds: getFilledArray(10).map(() => Math.random()),
      // testData: Math.random() > 0.9, // 10%
    };
  });

  let recordIndex = fensLength - 1;
  while (recordIndex--) records[recordIndex].balancesAhead.push(...records[recordIndex + 1].balancesAhead);

  const newRecords = records.map((record) => {
    const recordWithTestSwitch = addTestDataSwitch({ record });
    const recordWithWNextFen = addWNextFen({ record: recordWithTestSwitch, doc: { result } });
    const recordWithV2Output = addV2Output({ record: recordWithWNextFen });
    const recordWithV2OutputBucket = addV2OutputBucket({ record: recordWithV2Output });
    return recordWithV2OutputBucket;
  });

  return { records: newRecords, result, fensAdded };
};

const readGames = async () => {
  const sourceDirs = (await fs.readdir(parentFolder)).map((fName) => path.resolve(parentFolder, fName));
  console.log(`Reading .html files from ${sourceDirs.map((folderName) => folderName.split('/').pop()).join(', ')}...`);

  const allFilesArray = (
    await Promise.all(
      sourceDirs.map((folderName) =>
        fs.readdir(folderName).then((fileNames) =>
          fileNames.map((fileName) => ({
            fileName,
            folderName,
          })),
        ),
      ),
    )
  ).flat();
  const validFilesArray = allFilesArray.filter(({ fileName }) => /_\d+.html$/.test(fileName));
  const validFilesCount = validFilesArray.length;
  console.log(`Found ${validFilesCount} valid files out of ${allFilesArray.length} total files.`);

  let fileIndex = 0;

  const getNextGames = async () => {
    const result = [];

    for (let index = 0; index < BATCH_SIZE; index += 1) {
      const fileObject = validFilesArray[fileIndex++];
      if (!fileObject) break;

      const { fileName, folderName } = fileObject;

      const htmlContent = await fs.readFile(path.resolve(folderName, fileName), 'utf-8');
      const game = await processHtml({ htmlContent, fileName, folderName });

      if (htmlContent && !game) continue;

      result.push({ gameIndex: fileIndex - 1, game, fileName, folderName });
    }

    return result;
  };

  return { getNextGames, validFilesCount };
};

const run = async () => {
  const { getNextGames, validFilesCount } = await readGames();
  const collection = await getCollection('scidGames');

  let processed = 0;
  for (let nextGames = await getNextGames(); nextGames && nextGames.length; nextGames = await getNextGames()) {
    const mongoRecords = nextGames.map(({ game }) => game);

    await collection.insertMany(mongoRecords);

    processed += mongoRecords.length;
    console.log(`processed ${processed} of ${validFilesCount} games.`);
  }

  client.close();
};

run();

// db.getCollection('scidGames').aggregate([{$project: {'fen': {$arrayElemAt: ['$records',6]}}}, {$group: {_id:null, fen: {$addToSet: '$fen.fen'}}},
// // {$unwind:'$fen'},
// // { $sample: { size: 10 } }
// { $project: { _id: 0 }}
// ])
