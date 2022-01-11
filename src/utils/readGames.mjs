// const fs = require('fs').promises;
import { promises as fs } from 'fs';
import * as path from 'path';
// const path = require('path');
// const { getStockfishEvalScore, getStockfishSearchScore } = require('../utils/stockfish_worker');

const MOVES_FILE = 'possibleMoves.csv';

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

const getPossibleMovesListUpdater = async ({ movesFile }) => {
  let possibleMoves;
  try {
    possibleMoves = (await fs.readFile(movesFile, 'utf8'))
      .split('\n')
      .reduce((p, c) => Object.assign(p, { [c]: true }), {});
  } catch (e) {
    possibleMoves = {};
  }

  return async ({ moves }) => {
    for (const move of moves) {
      if (possibleMoves[move]) continue;

      await fs.appendFile(movesFile, `${move}\n`, 'utf8');
      possibleMoves[move] = true;
    }
  };
};

const processMoveLines = async ({ moveLines, fileName, updatePossibleMovesList }) => {
  if (!moveLines[0].startsWith('<a href="javascript:gotoMove(0)" ID="0" class="V0"></a> <span class="VC">')) {
    throw new Error(`First move is invalid in ${fileName}: ${moveLines[0]}`);
  }

  const moves = moveLines.slice(1).map((moveLine) => moveLine.match(/class="V0">(\d+.)?(.*)<\/a>/)[2]);
  await updatePossibleMovesList({ moves });
  return moves;
};

const getFenLines = ({ lines }) => {
  const firstFenLineIndex = lines.findIndex((line) => line.startsWith('movesArray = new Array(')) + 1;
  const lastFenLineIndex = lines.findIndex((line) => line.startsWith('var current = 0;'));

  return lines.slice(firstFenLineIndex, lastFenLineIndex);
};

const getMoveLines = ({ lines }) => {
  return lines.filter((line) => line.startsWith('<a href="javascript:gotoMove('));
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

const validateLengths = ({ result: gameResult, fens, moves, fileName }) => {
  let result = true;
  if (gameResult === 0) return result;

  if (gameResult === -1) {
    if (fens.length % 2 === 0) {
      console.warn(`invalid fen length in ${fileName}`);
      result = false;
    }

    if (moves.length % 2 === 1) {
      console.warn(`invalid moves length in ${fileName}`);
      result = false;
    }
    return result;
  }

  if (gameResult === 1) {
    if (fens.length % 2 === 1) {
      console.warn(`invalid fen length in ${fileName}`);
      result = false;
    }

    if (moves.length % 2 === 0) {
      console.warn(`invalid moves length in ${fileName}`);
      result = false;
    }
    return result;
  }

  console.warn(`invalid result in ${fileName}`);
  return false;
};

const processHtml = async ({ htmlContent, fileName, updatePossibleMovesList, endsWithMate, endsWithStall }) => {
  const lines = htmlContent.split('\n');
  const fenLines = getFenLines({ lines });
  const moveLines = getMoveLines({ lines });

  const result = getResult({ lines, fileName });
  const fens = await processFenLines({ fenLines, fileName });
  const moves = await processMoveLines({ moveLines, fileName, updatePossibleMovesList });
  if (!validateLengths({ result, fens, moves, fileName })) return null;

  const records = getRecords({ fens, moves, result, endsWithMate, endsWithStall, fileName });

  return { result, records, fens, moves };
};

const cacheGame = async ({ game, fileName, folderName }) => {
  try {
    const cacheFileName = path.resolve(`cache/${folderName.split('/').pop()}/${fileName}.json`);
    await fs.mkdir(path.resolve('cache', folderName.split('/').pop()), { recursive: true });
    return fs.writeFile(cacheFileName, JSON.stringify(game, null, 2));
  } catch (e) {
    console.error(e);
  }
};

const getCachedGame = async ({ fileName, folderName }) => {
  const cacheFileName = path.resolve(`cache/${folderName.split('/').pop()}/${fileName}.json`);
  try {
    return JSON.parse(await fs.readFile(cacheFileName));
  } catch (e) {
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

const getRecords = ({ fens, result, moves, endsWithMate, endsWithStall, fileName }) => {
  const fensLength = fens.length;

  const records = fens
    .map((fen, fenIndex) => {
      const isLast = fenIndex === fensLength - 1;
      // if (endsWithStall && !isLast) return null;

      const balance = getBalance({ fen });

      return {
        fen,
        result,
        wNext: fenIndex % 2 === 0,
        nextMove: moves[fenIndex],
        prevMove: moves[fenIndex - 1],
        nextFen: fens[fenIndex + 1],
        prevFen: fens[fenIndex - 1],
        fenIndex: fenIndex,
        isStrart: fenIndex === 0,
        fensLength,
        isMate: endsWithMate && isLast,
        isStall: endsWithStall && isLast,
        balance,
        balancesAhead: [balance],
        fileName,
        endsWithMate,
        endsWithStall,
      };
    })
    .filter(Boolean);

  let recordIndex = fensLength - 1;
  while (recordIndex--) records[recordIndex].balancesAhead.push(...records[recordIndex + 1].balancesAhead);

  return records;
};

const readGames = async ({ folderNames, skip = 0, limit, movesFile: _movesFile = MOVES_FILE }) => {
  const sourceDirs = Object.keys(folderNames).map((folderName) => ({
    folderName: path.resolve(folderName),
    endsWithMate: folderNames[folderName].endsWithMate,
    endsWithStall: folderNames[folderName].endsWithStall,
  }));
  console.log(`Reading .html files from ${sourceDirs.map(({ folderName }) => folderName).join(', ')}...`);

  const movesFile = path.resolve(_movesFile);
  console.log(`Will update possible moves in ${movesFile}...`);

  const updatePossibleMovesList = await getPossibleMovesListUpdater({ movesFile });

  const allFilesArray = (
    await Promise.all(
      sourceDirs.map(({ folderName, endsWithStall, endsWithMate }) =>
        fs.readdir(folderName).then((fileNames) =>
          fileNames.map((fileName) => ({
            fileName,
            folderName,
            endsWithMate,
            endsWithStall,
          })),
        ),
      ),
    )
  ).flat();
  const validFilesArray = allFilesArray.filter(({ fileName }) => /_\d+.html$/.test(fileName));
  const validFilesCount = validFilesArray.length;
  console.log(`Found ${validFilesCount} valid files out of ${allFilesArray.length} total files.`);

  let fileIndex = skip;

  const getNextGame = async () => {
    const fileObject = validFilesArray[fileIndex++];
    if (!fileObject || (limit && fileIndex - skip > limit)) return { game: null, gameIndex: null };

    const { fileName, folderName, endsWithMate, endsWithStall } = fileObject;

    const cached = await getCachedGame({ fileName, folderName });
    if (cached) {
      if (!validateLengths({ ...cached, fileName })) return getNextGame();
      return { gameIndex: fileIndex - 1, game: cached, fileName, totalGames: validFilesCount };
    }

    const htmlContent = await fs.readFile(path.resolve(folderName, fileName), 'utf-8');
    const game = await processHtml({ htmlContent, fileName, updatePossibleMovesList, endsWithMate, endsWithStall });

    await cacheGame({ game, fileName, folderName });

    if (htmlContent && !game) return getNextGame();

    return { gameIndex: fileIndex - 1, game, fileName, totalGames: validFilesCount };
  };

  return {
    getNextGame,
  };
};

export default readGames;
