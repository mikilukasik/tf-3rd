import pkg1 from '../../utils/stockfish_worker.js';
import { moveString2move } from '../../../chss-module-engine/src/engine_new/transformers/move2string2move.js';
import { fen2intArray } from '../../../chss-module-engine/src/engine_new/transformers/fen2intArray.js';
import { isCaptured } from '../../../chss-module-engine/src/engine_new/utils/isCaptured.js';

const { getStockfishAllMoves } = pkg1;

const getStockFishParams = async (record) => {
  const { fen } = record;
  const allMoveStrings = await getStockfishAllMoves(fen);
  const all_moves = allMoveStrings.map(moveString2move);

  return { all_moves };
};

export const addStockFishData = async (record) => ({ ...record, ...(await getStockFishParams(record)) });
