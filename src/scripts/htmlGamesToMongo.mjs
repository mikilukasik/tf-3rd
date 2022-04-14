// const fs = require('fs').promises;
import { promises as fs } from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';

const BATCH_SIZE = 100;
const folderNames = ['data/html/hm124-128', 'data/html/hm129-133', 'data/html/hm134-139'];

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
    // const stockfishScores = {
    //   eval: await getStockfishEvalScore(newFen),
    //   // search: await getStockfishSearchScore(newFen),
    // };

    processedFenLines.push(newFen);
  }

  return processedFenLines;
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

// const validateLengths = ({ result: gameResult, fens, moves, fileName }) => {
//   let result = true;
//   if (gameResult === 0) return result;

//   if (gameResult === -1) {
//     if (fens.length % 2 === 0) {
//       console.warn(`invalid fen length in ${fileName}`);
//       result = false;
//     }

//     if (moves.length % 2 === 1) {
//       console.warn(`invalid moves length in ${fileName}`);
//       result = false;
//     }
//     return result;
//   }

//   if (gameResult === 1) {
//     if (fens.length % 2 === 1) {
//       console.warn(`invalid fen length in ${fileName}`);
//       result = false;
//     }

//     if (moves.length % 2 === 0) {
//       console.warn(`invalid moves length in ${fileName}`);
//       result = false;
//     }
//     return result;
//   }

//   console.warn(`invalid result in ${fileName}`);
//   return false;
// };

const processHtml = async ({ htmlContent, fileName }) => {
  try {
    const lines = htmlContent.split('\n');
    const fenLines = getFenLines({ lines });
    const moveLines = getMoveLines({ lines });
    const players = getPlayers({ lines });
    const event = getEvent({ lines });

    const result = getResult({ lines, fileName });
    const fens = await processFenLines({ fenLines, fileName });
    const moves = await processMoveLines({ moveLines, fileName });
    // if (!validateLengths({ result, fens, moves, fileName })) return null;

    const records = getRecords({ fens, result });

    return { result, records, fens, moves, htmlContent, players, event, fileName };
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

const getRecords = ({ fens, result }) => {
  const fensLength = fens.length;

  const records = fens
    .map((fen, fenIndex) => {
      // const isLast = fenIndex === fensLength - 1;
      // if (endsWithStall && !isLast) return null;

      const balance = getBalance({ fen });

      return {
        fen,
        result,
        // wNext: fenIndex % 2 === 0,
        // nextMove: moves[fenIndex],
        // prevMove: moves[fenIndex - 1],
        // nextFen: fens[fenIndex + 1],
        // prevFen: fens[fenIndex - 1],
        progress: fenIndex / (fensLength - 1),
        // fenIndex: fenIndex,
        // isStrart: fenIndex === 0,
        // fensLength,

        balance,
        balancesAhead: [balance],

        rnds: getFilledArray(5).map(() => Math.random()),
        // fileName,
      };
    })
    .filter(Boolean);

  let recordIndex = fensLength - 1;
  while (recordIndex--) records[recordIndex].balancesAhead.push(...records[recordIndex + 1].balancesAhead);

  return records;
};

const readGames = async () => {
  const sourceDirs = folderNames.map((folderName) => path.resolve(folderName));
  console.log(`Reading .html files from ${sourceDirs.map(({ folderName }) => folderName).join(', ')}...`);

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
      if (!fileObject) return null;

      const { fileName, folderName } = fileObject;

      const htmlContent = await fs.readFile(path.resolve(folderName, fileName), 'utf-8');
      const game = await processHtml({ htmlContent, fileName });

      if (htmlContent && !game) continue;

      result.push({ gameIndex: fileIndex - 1, game, fileName });
    }

    return result.filter(Boolean);
  };

  return getNextGames;
};

const run = async () => {
  const getNextGames = await readGames();
  const collection = await getCollection('scidGames');

  for (let nextGames = await getNextGames(); nextGames && nextGames.length; nextGames = await getNextGames()) {
    const mongoRecords = nextGames.map(({ game: { fileName, event, moves, records, players, result } }) => ({
      fileName,
      event,
      moves,
      records,
      players,
      result,
    }));

    await collection.insertMany(mongoRecords);
    process.stdout.write('.');
  }

  client.close();
};

run();

// db.getCollection('scidGames').aggregate([{$project: {'fen': {$arrayElemAt: ['$records',6]}}}, {$group: {_id:null, fen: {$addToSet: '$fen.fen'}}},
// // {$unwind:'$fen'},
// // { $sample: { size: 10 } }
// { $project: { _id: 0 }}
// ])
