const fs = require('fs').promises;
const path = require('path');
const { getStockfishScore } = require('./stockfish_worker.js');

// const encoder = new TextEncoder();

const processMoveLines = async ({ moveLines, fileName }) => {
  // const totalMoves = moveLines.length;
  // return moveLines.map(([moveIndex, line]) => {

  // })
  const processedMoveLines = [];

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
    // console.log('getting');
    const stockfishScores = wasWhitesMove
      ? { bn: Number(await getStockfishScore(`${fenStr} b`)) / 168 + 0.5 }
      : { wn: Number(await getStockfishScore(`${fenStr} w`)) / 168 + 0.5 };

    // {
    //   // wn: Number(await getStockfishScore(`${fenStr} w`)),
    //   // bn: Number(await getStockfishScore(`${fenStr} b`)),
    //   wn: Number(await getStockfishScore(`${fenStr} w`)) / 168 + 0.5,
    //   bn: Number(await getStockfishScore(`${fenStr} b`)) / 168 + 0.5,
    // };
    // console.log('got', stockfishScores);
    processedMoveLines.push({ fenStr, stockfishScores });
    continue;
    // const progress = moveIndex / (totalMoves - 1);
    // const projectedWinner = result + 0.5;
    // const linearScore = result * progress + 0.5
    // const whiteWillWin = result === 0.5 ? 1 : 0;
    // const blackWillWin = result === -0.5 ? 1 : 0;
    // const whiteScore = whiteWillWin * progress;
    // const blackScore = blackWillWin * progress;
    // const whiteWon = whiteWillWin && progress === 1 ? 1 : 0;
    // const blackWon = blackWillWin && progress === 1 ? 1 : 0;

    // const endGameScore = Math.pow(progress, 5) * result + 0.5;
    // const openingScore = Math.pow(progress, 0.5) * result + 0.5;
    // const midGameScore = ((progress > 0.5 ? Math.pow((progress - 0.5) * 2, 2) : Math.pow(progress * 2, 4) - (progress > 0.5 ? 0 : 1)) / 2 + 0.5) * result + 0.5;

    // const isCheckMate = progress === 1 ? projectedWinner : 0.5; // only works if all htmls have checkmate on the end

    // const output = [progress, projectedWinner, linearScore, openingScore, midGameScore, endGameScore, isCheckMate];
    // const output = [linearScore, whiteScore, blackScore, whiteWillWin, blackWillWin, whiteWon, blackWon];
    // const output = [Number(await getStockfishScore(`${fenStr} ${wasWhitesMove ? 'b' : 'w'}`)) / 168 + 0.5];

    // const resultingInputArray = [wasWhitesMove];

    // // const step = 1 / 12;

    // let tableBalance = 0;
    // let totalValue = 0;

    // fenStr.split('').forEach((char) => {
    //   switch (char) {
    //     case 'p':
    //       resultingInputArray.push(1, 0.5, 0.5, 0.5, 0.5);
    //       tableBalance += 1;
    //       totalValue += 1;
    //       break;
    //     case 'b':
    //       resultingInputArray.push(0.5, 1, 0.5, 0.5, 0.5);
    //       tableBalance += 3;
    //       totalValue += 3;
    //       break;
    //     case 'n':
    //       resultingInputArray.push(0.5, 0.5, 1, 0.5, 0.5);
    //       tableBalance += 3;
    //       totalValue += 3;
    //       break;
    //     case 'r':
    //       resultingInputArray.push(0.5, 0.5, 0.5, 1, 0.5);
    //       tableBalance += 5;
    //       totalValue += 5;
    //       break;
    //     case 'q':
    //       resultingInputArray.push(0.5, 1, 0.5, 1, 0.5);
    //       tableBalance += 9;
    //       totalValue += 9;
    //       break;
    //     case 'k':
    //       resultingInputArray.push(0.5, 0.5, 0.5, 0.5, 1);
    //       break;

    //     case 'P':
    //       resultingInputArray.push(0, 0.5, 0.5, 0.5, 0.5);
    //       tableBalance -= 1;
    //       totalValue += 1;
    //       break;
    //     case 'B':
    //       resultingInputArray.push(0.5, 0, 0.5, 0.5, 0.5);
    //       tableBalance -= 3;
    //       totalValue += 3;
    //       break;
    //     case 'N':
    //       resultingInputArray.push(0.5, 0.5, 0, 0.5, 0.5);
    //       tableBalance -= 3;
    //       totalValue += 3;
    //       break;
    //     case 'R':
    //       resultingInputArray.push(0.5, 0.5, 0.5, 0, 0.5);
    //       tableBalance -= 5;
    //       totalValue += 5;
    //       break;
    //     case 'Q':
    //       resultingInputArray.push(0.5, 0, 0.5, 0, 0.5);
    //       tableBalance -= 9;
    //       totalValue += 9;
    //       break;
    //     case 'K':
    //       resultingInputArray.push(0.5, 0.5, 0.5, 0.5, 0);
    //       break;

    //     case '/':
    //       break;

    //     default:
    //       resultingInputArray.push(...Array.from({ length: Number(char) * 5 }).map(() => 0.5));
    //   }
    // });
  }
  return processedMoveLines;
};

const getMoveLines = ({ lines }) => {
  const firstMoveLineIndex = lines.findIndex((line) => line.startsWith('movesArray = new Array(')) + 1;
  const lastMoveLineIndex = lines.findIndex((line) => line.startsWith('var current = 0;'));

  return lines.slice(firstMoveLineIndex, lastMoveLineIndex);
  // .slice(-20) // keep the last 20 steps only, much less noise
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
  const fens = await processMoveLines({ moveLines, fileName });

  return { fens, result };
};

const cacheGame = async ({ game, fileName, folderName }) => {
  try {
    const cacheFileName = path.resolve(`cache/${folderName}/${fileName}.json`);
    fs.mkdir(`cache/${folderName}`, { recursive: true });
    return fs.writeFile(cacheFileName, JSON.stringify(game));
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
  // console.log(skip, typeof skip);
  let fileIndex = skip;
  const getNextGame = async () => {
    const fileName = validFilesArray[fileIndex++];
    if (!fileName || fileIndex - skip > limit) return { game: null, gameIndex: null };

    const cached = await getCachedGame({ fileName, folderName });
    if (cached) return { gameIndex: fileIndex - 1, game: cached };

    const htmlContent = await fs.readFile(path.resolve(sourceDir, fileName), 'utf-8');
    const game = await processHtml({ htmlContent, fileName });
    await cacheGame({ game, fileName, folderName });
    return { gameIndex: fileIndex - 1, game };
  };

  /*

  for (const [fileIndex, _fileName] of fileArray.entries()) {
    const now = Date.now();
    // if (lastLoggedAt < now - 10000) {
    //   lastLoggedAt = now;
    //   console.log(`${fileIndex} of ${fileArray.length} files processed.`);
    // }

    const sourceFileName = path.resolve(sourceDir, _fileName);
    const stringContent = fs.readFileSync(sourceFileName, 'utf-8');
    const lines = stringContent.split('\n');

    const resultStr = lines.find((line) => line.startsWith(`<br><class="VH">`)).substr(16);
    let result;
    switch (resultStr) {
      case '1-0':
        result = 0.5;
        break;

      case '0-1':
        result = -0.5;
        break;

      case '=-=':
        result = 0;
        break;

      default:
        console.warn(`no result in html ${fileName}`, { resultStr });
        return;
    }

    const firstMoveLineIndex = lines.findIndex((line) => line === 'movesArray = new Array(') + 1;
    const lastMoveLineIndex = lines.findIndex((line) => line === 'var current = 0;');

    const moveLines = lines.slice(firstMoveLineIndex, lastMoveLineIndex); //.map((line, index) => ({ line, index })).slice(-50);
    // .slice(-20) // keep the last 20 steps only, much less noise
   

      // if (wasWhitesMove) {
      //   if (destFilesUsed.white) fs.appendFileSync(destFileNameWhite, ',\n', 'utf8');
      //   destFilesUsed.white = true;

      //   fs.appendFileSync(destFileNameWhite, `  ${JSON.stringify({ input: resultingInputArray, output })}`, 'utf-8');
      //   continue;
      // }

      if (destFilesUsed.mix) fs.appendFileSync(destFileName, ',\n', 'utf8');
      destFilesUsed.mix = true;

      fs.appendFileSync(destFileName, `  ${JSON.stringify({ input: resultingInputArray, output })}`, 'utf-8');

      if (tableBalance === 0 && totalValue < 70) {
        if (destFilesUsed.eq) fs.appendFileSync(destEqFileName, ',\n', 'utf8');
        destFilesUsed.eq = true;

        fs.appendFileSync(destEqFileName, `  ${JSON.stringify({ input: resultingInputArray, output })}`, 'utf-8');
      }

      if (progress > 0.9) {
        if (destFilesUsed.end) fs.appendFileSync(destEndFileName, ',\n', 'utf8');
        destFilesUsed.end = true;

        fs.appendFileSync(destEndFileName, `  ${JSON.stringify({ input: resultingInputArray, output })}`, 'utf-8');
      }
    }
  }


  */

  // fs.appendFileSync(destEndFileName, `]\n`, 'utf-8');
  // fs.appendFileSync(destFileName, `]\n`, 'utf-8');
  // fs.appendFileSync(destEqFileName, `]\n`, 'utf-8');

  return {
    getNextGame,
  };
};

module.exports = {
  readGames,
};
