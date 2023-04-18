import { oneHotToMovesMap } from '../../../chss-module-engine/src/engine_new/transformers/oneHotToMovesMap.js';
import { move2moveString } from '../../../chss-module-engine/src/engine_new/transformers/move2moveString.js';

const mirrorCell = (cellIndex) => {
  const rank = cellIndex >>> 3; // equals to rank
  const file = cellIndex & 7; // equals to file

  return ((7 - rank) << 3) + file;
};

const mirrorMove = (move) => {
  const sourceIndex = move >>> 10;
  const targetIndex = move & 63;

  const piece = (move >>> 6) & 15;
  const newPiece = piece ? piece ^ 8 : 0;

  return (mirrorCell(sourceIndex) << 10) + mirrorCell(targetIndex) + (newPiece << 6);
};

const getLmVal = (allValsArr, index) => 1 / allValsArr[index];

const mirrorFlatArray = (arr) => {
  const chunks = [];
  const copiedArr = arr.slice();

  while (copiedArr.length) {
    chunks.push(copiedArr.splice(-8));
  }

  return chunks.flat();
};

const addQueenPromotion = (move, board) => {
  const piece = (move >>> 6) & 15;
  if (piece) return move;

  const sourceIndex = move >>> 10;
  const targetIndex = move & 63;

  if (board[sourceIndex] === 1 && targetIndex >= 56) return move + (5 << 6);
  if (board[sourceIndex] === 9 && targetIndex < 8) return move + (13 << 6);

  return move;
};

export const getXs = ({ board: origBoard, lmt: origLmt, lmf: origLmf, tf }) => {
  const { board, lmf, lmt } = origBoard[64]
    ? { board: origBoard, lmf: origLmf, lmt: origLmt }
    : {
        board: origBoard.split('/').reverse().join('/'),
        lmf: mirrorFlatArray(origLmf),
        lmt: mirrorFlatArray(origLmt),
      };

  const arr = [];
  board.split('').forEach((char) => {
    switch (char) {
      case 'p':
        arr.push([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        break;
      case 'b':
        arr.push([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        break;
      case 'n':
        arr.push([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        break;
      case 'r':
        arr.push([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
        break;
      case 'q':
        arr.push([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
        break;
      case 'k':
        arr.push([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
        break;

      case 'P':
        arr.push([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
        break;
      case 'B':
        arr.push([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
        break;
      case 'N':
        arr.push([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
        break;
      case 'R':
        arr.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
        break;
      case 'Q':
        arr.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
        break;
      case 'K':
        arr.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
        break;

      case '/':
        break;

      default:
        for (let emptyIndex = 0; emptyIndex < Number(char); emptyIndex += 1) arr.push(Array(12).fill(0));
    }
  });

  return tf.tensor(
    new Array(64)
      .fill(0)
      .map((_, index) => [...arr[index], getLmVal(lmf, index), getLmVal(lmt, index)])
      .flat(),
    [1, 8, 8, 14],
  );
};

export const ysToStats = ({ ys, board }) => {
  const moveValues = ys.reduce((p, val, i) => {
    p[addQueenPromotion(board[64] ? oneHotToMovesMap[i] : mirrorMove(oneHotToMovesMap[i]), board)] = val;
    return p;
  }, {});

  const moveStringValues = oneHotToMovesMap.reduce((p, move, i) => {
    const m = addQueenPromotion(board[64] ? move : mirrorMove(move), board);
    p[move2moveString(m)] = ys[i];
    return p;
  }, {});

  const { winningMove } = (
    board[64] ? (data) => data : ({ winningMove }) => ({ winningMove: mirrorMove(winningMove) })
  )(
    oneHotToMovesMap.reduce(
      (p, move, i) => {
        return ys[i] > p.winningValue ? { winningMove: move, winningValue: ys[i] } : p;
      },
      { winningMove: null, winningValue: -1000 },
    ),
  );

  const winningMoveString = move2moveString(winningMove);

  return { winningMoveString, moveValues, moveStringValues };
};

export const predict = async ({ board, lmf, lmt, tf, model }) => {
  const xs = getXs({ board, lmf, lmt, tf });

  const predictionTensor = model.predict(xs);
  const ys = await predictionTensor.data();
  predictionTensor.dispose();

  return ysToStats({ ys, board });
};
