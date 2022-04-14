import { promises as fs } from 'fs';
import pkg1 from '../utils/stockfish_worker.js';
const { getStockfishAllMoves, getMovedFen } = pkg1;

const startingFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const getNextFens = async (fens = [startingFen]) => {
  const result = [];

  for (const fen of fens) {
    const moves = await getStockfishAllMoves(fen);
    const fens = await moves.reduce((promiseChain, stockfishMove) => {
      return promiseChain.then(async (nextFens) => {
        const fenMovedWithStockfish = await getMovedFen(stockfishMove, fen);
        return [...nextFens, fenMovedWithStockfish];
      });
    }, Promise.resolve([]));

    result.push(...fens);
  }

  return result;
};

const run = async () => {
  const d1Fens = await getNextFens();
  const d2Fens = await getNextFens(d1Fens);
  const d3Fens = await getNextFens(d2Fens);

  await fs.writeFile('d1Fens.json', JSON.stringify(d1Fens, null, 2), 'utf8');
  await fs.writeFile('d2Fens.json', JSON.stringify(d2Fens, null, 2), 'utf8');
  await fs.writeFile('d3Fens.json', JSON.stringify(d3Fens, null, 2), 'utf8');

  console.log('DONE');
};

run();
