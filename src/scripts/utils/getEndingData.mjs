import pkg1 from '../../utils/stockfish_worker.js';
import { fen2intArray } from '../../../chss-module-engine/src/engine_new/transformers/fen2intArray.js';
import { isCaptured } from '../../../chss-module-engine/src/engine_new/utils/isCaptured.js';

const { getStockfishAllMoves } = pkg1;

export const getEndingData = async (fen) => {
  const allMoveStrings = await getStockfishAllMoves(fen);

  if (allMoveStrings.length > 0)
    return {
      aborted_ending: true,
      chkmate_ending: false,
      stall_ending: false,
    };

  const board = fen2intArray(fen);
  const chkmate_ending = isCaptured(board, board.indexOf(6 + (board[64] << 3)), board[64]);

  return {
    aborted_ending: false,
    chkmate_ending,
    stall_ending: !chkmate_ending,
  };
};
