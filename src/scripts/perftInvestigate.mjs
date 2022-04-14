import { generateLegalMoves } from '../../chss-module-engine/src/engine_new/moveGenerators/generateLegalMoves.js';
import { getLegalMoveCountThrowMethod } from '../../chss-module-engine/src/engine_new/testUtils/getLegalMoveCountThrowMethod.mjs';
import { board2fen } from '../../chss-module-engine/src/engine_new/transformers/board2fen.js';
import { fen2intArray } from '../../chss-module-engine/src/engine_new/transformers/fen2intArray.js';
import { move2moveString } from '../../chss-module-engine/src/engine_new/transformers/move2moveString.js';
import { getMovedBoard } from '../../chss-module-engine/src/engine_new/utils/getMovedBoard.js';

import pkg1 from '../utils/stockfish_worker.js';
const { getStockfishAllMoves, getMovedFen, getStockfishPerft } = pkg1;

const perfTestFens = [
  { description: 'Illegal ep move #1', fen: '3k4/3p4/8/K1P4r/8/8/8/8 b - - 0 1', depth: 6, result: 1134888 },
  { description: 'Illegal ep move #2', fen: '8/8/4k3/8/2p5/8/B2P2K1/8 w - - 0 1', depth: 6, result: 1015133 },
  { description: 'EP Capture Checks Opponent', fen: '8/8/1k6/2b5/2pP4/8/5K2/8 b - d3 0 1', depth: 6, result: 1440467 },
  { description: 'Short Castling Gives Check', fen: '5k2/8/8/8/8/8/8/4K2R w K - 0 1', depth: 6, result: 661072 },
  { description: 'Long Castling Gives Check', fen: '3k4/8/8/8/8/8/8/R3K3 w Q - 0 1', depth: 6, result: 803711 },
  { description: 'Castle Rights', fen: 'r3k2r/1b4bq/8/8/8/8/7B/R3K2R w KQkq - 0 1', depth: 4, result: 1274206 },
  { description: 'Castling Prevented', fen: 'r3k2r/8/3Q4/8/8/5q2/8/R3K2R b KQkq - 0 1', depth: 4, result: 1720476 },
  { description: 'Promote out of Check', fen: '2K2r2/4P3/8/8/8/8/8/3k4 w - - 0 1', depth: 6, result: 3821001 },
  { description: 'Discovered Check', fen: '8/8/1P2K3/8/2n5/1q6/8/5k2 b - - 0 1', depth: 5, result: 1004658 },
  { description: 'Promote to give check', fen: '4k3/1P6/8/8/8/8/K7/8 w - - 0 1', depth: 6, result: 217342 },
  { description: 'Under Promote to give check', fen: '8/P1k5/K7/8/8/8/8/8 w - - 0 1', depth: 6, result: 92683 },
  { description: 'Self Stalemate', fen: 'K1k5/8/P7/8/8/8/8/8 w - - 0 1', depth: 6, result: 2217 },
  { description: 'Stalemate & Checkmate', fen: '8/k1P5/8/1K6/8/8/8/8 w - - 0 1', depth: 7, result: 567584 },
  { description: 'Stalemate & Checkmate', fen: '8/8/2k5/5q2/5n2/8/5K2/8 b - - 0 1', depth: 4, result: 23527 },
];

export const perft = (depth = 5, fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') => {
  const chssEncodedMoves = generateLegalMoves(fen2intArray(fen));

  if (depth === 1) return chssEncodedMoves.length;

  const chssNextFens = Array.from(chssEncodedMoves)
    .map((encodedMove) => getMovedBoard(encodedMove, fen2intArray(fen)))
    .map(board2fen);

  return chssNextFens.map((nextFen) => perft(depth - 1, nextFen)).reduce((p, c) => p + c, 0);
};

export const perftTest = async () => {
  const stats = {
    matchCount: 0,
    errorCount: 0,
    errored: [],
  };

  for (const { fen, depth, result, description } of perfTestFens) {
    const moveCount = perft(depth, fen);
    if (moveCount === result) {
      console.log(`Match: ${moveCount} ${description} ${fen} d${depth}`);
      stats.matchCount += 1;
      continue;
    }

    const stockFishPerft = await getStockfishPerft(fen, depth);
    console.log(`ERROR: ${moveCount} (exp: ${result}) (stockFish: ${stockFishPerft}) ${description} ${fen} d${depth}`);
    stats.errorCount += 1;

    stats.errored.push({ fen, depth, description, stockFishPerft });
  }

  return stats;
};

const compareMoveArrays = ({ stockfishMoves, chssMoves }) => {
  const extraMoves = chssMoves.slice();
  const missedMoves = stockfishMoves.slice();
  chssMoves.forEach((moveStr) => {
    if (stockfishMoves.includes(moveStr)) {
      extraMoves.splice(extraMoves.indexOf(moveStr), 1);
      missedMoves.splice(missedMoves.indexOf(moveStr), 1);
    }
  });
  return { extraMoves, missedMoves };
};

const compareFenArrays = ({ stockfishFens: _sf, chssFens: _cf }) => {
  const stockfishFens = _sf.map((fen) => fen.split(' ').slice(0, -2).join(' '));
  const chssFens = _cf.map((fen) => fen.split(' ').slice(0, -2).join(' '));
  const extraFens = chssFens.slice();
  const missedFens = stockfishFens.slice();

  chssFens.forEach((chssFen) => {
    // console.log('.', { stockfishFens, chssFen });
    if (stockfishFens.includes(chssFen)) {
      // console.log('hello');
      extraFens.splice(extraFens.indexOf(chssFen), 1);
      missedFens.splice(missedFens.indexOf(chssFen), 1);
    }
  });
  return { extraFens, missedFens };
};

const compareMovesForFen = async (fen) => {
  const stockfishMoves = await getStockfishAllMoves(fen);
  const chssEncodedMoves = generateLegalMoves(fen2intArray(fen));
  const chssMoves = Array.from(chssEncodedMoves).map((move) => move2moveString(move));

  return { ...compareMoveArrays({ stockfishMoves, chssMoves }), chssEncodedMoves, stockfishMoves };
};

const digDeep = async ({ fen, depth, currentDepth = 1 }) => {
  const { extraMoves, missedMoves, chssEncodedMoves, stockfishMoves } = await compareMovesForFen(fen);

  if (extraMoves.length || missedMoves.length) return { failingFen: fen, extraMoves, missedMoves };
  if (currentDepth > depth) return { failingFen: null, extraMoves, missedMoves };

  const chssNextFens = Array.from(chssEncodedMoves)
    .map((encodedMove) => getMovedBoard(encodedMove, fen2intArray(fen)))
    .map(board2fen);

  const stockFishNextFens = await stockfishMoves.reduce((promiseChain, stockfishMove) => {
    return promiseChain.then(async (nextFens) => {
      const fenMovedWithStockfish = await getMovedFen(stockfishMove, fen);
      return [...nextFens, fenMovedWithStockfish];
    });
  }, Promise.resolve([]));

  const { extraFens, missedFens } = compareFenArrays({ stockfishFens: stockFishNextFens, chssFens: chssNextFens });
  if (extraFens.length || missedFens.length) return { extraFens, missedFens, failingFen: fen };

  for (const nextFen of chssNextFens) {
    const nextRes = await digDeep({ fen: nextFen, depth, currentDepth: currentDepth + 1 });
    if (nextRes.failingFen) return nextRes;
  }

  // shouldn't get here
  return {};
};

const dig = async (errored) => {
  for (const { fen, depth, description } of errored) {
    const result = await digDeep({ fen, depth });

    console.log({ ...result, description });
  }
};

const run = async () => {
  const { errored } = await perftTest();
  console.log(`Error count: ${errored.length}`);

  await dig(errored);
};

run();
