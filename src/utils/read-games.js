const fs = require('fs').promises;
const path = require('path');
const { getStockfishEvalScore, getStockfishSearchScore } = require('./stockfish_worker.js');

const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

const getFilledArray = () =>
  Array(8)
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

const processMoveLines = async ({ moveLines, result, fileName }) => {
  const processedMoveLines = [];

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

  for (const [moveIndex, line] of moveLines.entries()) {
    const fenStr = `${line.substr(1, line.indexOf(' ') - 1)}`;

    if (moveIndex === 0) {
      if (fenStr !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR') {
        console.warn(`First fen is invalid in ${fileName}`);
        return null;
      }

      continue;
    }

    const wasWhitesMove = moveIndex % 2;

    updateCastlingStr(fenStr);
    const ept = getEnPassantTarget({
      fen1: moveLines[moveIndex - 1],
      fen2: fenStr,
      whitesMove: wasWhitesMove,
    });

    const newFen = `${fenStr} ${wasWhitesMove ? 'b' : 'w'} ${castlingStr || '-'} ${ept}`;
    const stockfishScores = {
      eval: await getStockfishEvalScore(newFen),
      search: await getStockfishSearchScore(newFen),
    };

    processedMoveLines.push({ fenStr: newFen, stockfishScores });
  }

  return processedMoveLines;
};

const getMoveLines = ({ lines }) => {
  const firstMoveLineIndex = lines.findIndex((line) => line.startsWith('movesArray = new Array(')) + 1;
  const lastMoveLineIndex = lines.findIndex((line) => line.startsWith('var current = 0;'));

  return lines.slice(firstMoveLineIndex, lastMoveLineIndex);
};

const getResult = ({ lines, fileName }) => {
  const result = {};
  const resultStr = lines.find((line) => line.startsWith(`<br><class="VH">`)).substr(16, 3);

  switch (resultStr) {
    case '1-0':
      result.ww = true;
      break;

    case '0-1':
      result.bw = true;
      break;

    case '=-=':
      result.draw = true;
      break;

    default:
      console.warn(`no result in html ${fileName}`, { resultStr });
      return null;
  }
  return result;
};

const processHtml = async ({ htmlContent, fileName }) => {
  const lines = htmlContent.split('\n');
  const result = getResult({ lines, fileName });

  const moveLines = getMoveLines({ lines });
  const fens = await processMoveLines({ moveLines, result, fileName });

  return { fens, result };
};

const cacheGame = async ({ game, fileName, folderName }) => {
  try {
    const cacheFileName = path.resolve(`cache/${folderName}/${fileName}.json`);
    await fs.mkdir(path.resolve('cache', folderName), { recursive: true });
    return fs.writeFile(cacheFileName, JSON.stringify(game, null, 2));
  } catch (e) {
    console.error(e);
  }
};

const getCachedGame = async ({ fileName, folderName }) => {
  const cacheFileName = path.resolve(`cache/${folderName}/${fileName}.json`);
  try {
    return JSON.parse(await fs.readFile(cacheFileName));
  } catch (e) {
    return null;
  }
};

const readGames = async ({ folderName, skip = 0, limit = 9999999999 }) => {
  const sourceDir = path.resolve(`data/${folderName}/`);
  console.log(`Reading .html files from ${sourceDir}...`);

  const allFilesArray = await fs.readdir(sourceDir);
  const validFilesArray = allFilesArray.filter((fileName) => /_\d+.html$/.test(fileName));
  console.log(`Found ${validFilesArray.length} valid files out of ${allFilesArray.length} total files.`);

  // randomizing file order for better samples
  // if (!process.env.KEEP_FILE_ORDER) validFilesArray.sort(() => Math.random() - 0.5);

  let fileIndex = skip;
  const getNextGame = async () => {
    const fileName = validFilesArray[fileIndex++];
    if (!fileName || fileIndex - skip > limit) return { game: null, gameIndex: null };

    const cached = await getCachedGame({ fileName, folderName });
    if (cached) return { gameIndex: fileIndex - 1, game: cached, fileName };

    const htmlContent = await fs.readFile(path.resolve(sourceDir, fileName), 'utf-8');
    const game = await processHtml({ htmlContent, fileName });
    await cacheGame({ game, fileName, folderName });
    return { gameIndex: fileIndex - 1, game, fileName };
  };

  return {
    getNextGame,
  };
};

module.exports = {
  readGames,
};
