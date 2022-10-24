import { oneHotToMovesV2 } from '../../scripts/utils/oneHotMovesMapV2.mjs';
import { moveInBoard, moveString2move } from '../../../chss-module-engine/src/engine/engine';
import { getMovedBoard } from '../../../chss-module-engine/src/engine_new/utils/getMovedBoard.js';
import { getUpdatedLmfLmt } from '../../../chss-module-engine/src/engine_new/utils/getUpdatedLmfLmt.js';
import { board2fen } from '../../../chss-module-engine/src/engine_new/transformers/board2fen.js';

export default async ({ tf, modelUrl }) => {
  console.log('Loading eval model...');
  const model = await tf.loadLayersModel(modelUrl);

  console.log('loaded eval model.');

  const pieces = ['', 'p', 'b', 'n', 'r', 'q', 'k', '', '', 'P', 'B', 'N', 'R', 'Q', 'K'];

  const oneHotToMovesMap = oneHotToMovesV2.map(([source, target, piece]) => {
    // TODO: add knight promotion and resign logic here
    return (source << 10) + target + (piece ? pieces.indexOf(piece.toUpperCase()) << 6 : 0);
    // (move >>> 6) & 15;
  });
  // console.log({ modelUrl, oneHotToMovesMap });

  const getMoveString = (move) =>
    `${cellIndex2cellStr(move >>> 10)}${cellIndex2cellStr(move & 63)}${pieces[(move >>> 6) & 15]}`;

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

  const cellIndex2cellStr = (index) => `${String.fromCharCode((index % 8) + 97)}${8 - Math.floor(index / 8)}`;

  // const getLmVal = (arr, index) =>
  //   1 / arr[index] || 0.5);

  const getXs = ({ fens, lmt, lmf }) => {
    const expandedFens = fens.map((fen) => {
      if (!fen) return Array(64).fill(Array(12).fill(0));

      const [board] = fen.split(' ');
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
      return arr;
    });

    // if (!lmt || !lmf) {
    //   console.log({ lmt, lmf, fens });
    // }

    return tf.tensor(
      new Array(64)
        .fill(0)
        .map((dummy, index) => [
          ...expandedFens.map((expandedFen) => expandedFen[index]).flat(),
          1 / lmf[index],
          1 / lmt[index],
        ])
        .flat(),
      [1, 8, 8, 14],
    );
  };

  const mirrorFlatArray = (arr) => {
    const chunks = [];
    const copiedArr = arr.slice();

    while (copiedArr.length) {
      chunks.push(copiedArr.splice(-8));
    }

    return chunks.flat();
  };

  const charInverter = (char) => {
    const lowChar = char.toLowerCase();
    const upChar = char.toUpperCase();

    if (char === lowChar) return upChar;
    return lowChar;
  };

  const castlingOrder = ['K', 'Q', 'k', 'q', '-'];
  const castlingSorter = (a, b) => castlingOrder.indexOf(a) - castlingOrder.indexOf(b);

  const mirrorEnPassant = (enpStr) => {
    if (enpStr === '-') return '-';
    if (enpStr[1] === '3') return `${enpStr[0]}6`;
    return `${enpStr[0]}3`;
  };

  const mirrorer = (fen) => {
    const [board, nextChar, castling, enPassant] = fen.split(' ');

    const mirroredBoard = board.split('/').reverse().join('/');
    const invertedBoard = mirroredBoard.split('').map(charInverter).join('');
    const invertedCastling = castling.split('').map(charInverter).sort(castlingSorter).join('');
    const mirroredEnPassant = mirrorEnPassant(enPassant);

    return `${invertedBoard} ${nextChar === 'w' ? 'b' : 'w'} ${invertedCastling} ${mirroredEnPassant}`;
  };

  const getLmfLmt = ({ game: { allPastFens, wNext, moves } }) => {
    const i = allPastFens.length - 1;
    const lastMovedFromInts = new Array(64).fill(255).map((val, cellIndex) => {
      let lookBackIndex = i;
      while (lookBackIndex--) {
        if (moves[lookBackIndex] >>> 10 === cellIndex) {
          return Math.min(255, i - lookBackIndex);
        }
      }
      return 255;
    });
    // console.log({ lastMovedFromInts });
    // const lastMovedFrom = lastMovedFromInts.map((val) => val.toString(16).padStart(2, '0'));

    const lastMovedToInts = new Array(64).fill(255).map((val, cellIndex) => {
      let lookBackIndex = i;
      while (lookBackIndex--) {
        if ((moves[lookBackIndex] & 63) === cellIndex) {
          return Math.min(255, i - lookBackIndex);
        }
      }
      return 255;
    });
    // console.log({ lastMovedToInts });

    // const lastMovedTo = lastMovedToInts.map((val) => val.toString(16).padStart(2, '0'));
    //
    const lmf = lastMovedFromInts;
    const lmt = lastMovedToInts;

    return { lmf, lmt };
  };

  const boardToXs = ({ board, lmf, lmt }) => {
    // console.log({ wNext });
    // console.log({ game });
    // const allPastFensLength = allPastFens.length;
    // const fens = [
    //   // allPastFens[allPastFensLength - 5],
    //   // allPastFens[allPastFensLength - 3],
    //   allPastFens[allPastFensLength - 1],
    // ];
    // if (!wNext)
    //   fens.forEach((f, i) => {
    //     if (fens[i]) fens[i] = mirrorer(f);
    //   });
    // // `${cellIndex2cellStr(move >>> 10)}${cellIndex2cellStr(move & 63)}${getPromotionPiece(move)}`;
    // const i = allPastFens.length - 1;
    // const lastMovedFromInts = new Array(64).fill(255).map((val, cellIndex) => {
    //   let lookBackIndex = i;
    //   while (lookBackIndex--) {
    //     if (moves[lookBackIndex] >>> 10 === cellIndex) {
    //       return Math.min(255, i - lookBackIndex);
    //     }
    //   }
    //   return 255;
    // });
    // // console.log({ lastMovedFromInts });
    // const lastMovedFrom = lastMovedFromInts.map((val) => val.toString(16).padStart(2, '0'));
    // const lastMovedToInts = new Array(64).fill(255).map((val, cellIndex) => {
    //   let lookBackIndex = i;
    //   while (lookBackIndex--) {
    //     if ((moves[lookBackIndex] & 63) === cellIndex) {
    //       return Math.min(255, i - lookBackIndex);
    //     }
    //   }
    //   return 255;
    // });
    // // console.log({ lastMovedToInts });
    // const lastMovedTo = lastMovedToInts.map((val) => val.toString(16).padStart(2, '0'));
    // const lmf = (!wNext ? mirrorFlatArray : (e) => e)(lastMovedFrom).join('');
    // const lmt = (!wNext ? mirrorFlatArray : (e) => e)(lastMovedTo).join('');
    // return getXs({ fens, lmf, lmt });
    // return [0, 0];
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

  const predictionsToStats = ({ predictions, game: { wNext, nextMoves, board } }) => {
    const moveValues = nextMoves.reduce((p, move) => {
      p[move] = predictions[move].chkmate_soon;
      return p;
    }, {});
    const moveStringValues = nextMoves.reduce((p, move) => {
      p[getMoveString(move)] = predictions[move].chkmate_soon;
      return p;
    }, {});

    // ys.reduce((p, val, i) => {
    //   p[addQueenPromotion(wNext ? oneHotToMovesMap[i] : mirrorMove(oneHotToMovesMap[i]), board)] = val;
    //   return p;
    // }, {});

    // const moveStringValues = oneHotToMovesMap.reduce((p, move, i) => {
    //   const m = addQueenPromotion(wNext ? move : mirrorMove(move), board);
    //   p[getMoveString(m)] = ys[i];
    //   return p;
    // }, {});

    const {
      winningMove,
    } = //(wNext ? (data) => data : ({ winningMove }) => ({ winningMove: mirrorMove(winningMove) }))(
      nextMoves.reduce(
        (p, move, i) => {
          return predictions[move].result > p.winningValue
            ? { winningMove: move, winningValue: predictions[move].result }
            : p;
        },
        { winningMove: null, winningValue: -1000 },
      );
    // );

    const winningMoveString = getMoveString(winningMove);

    return { winningMoveString, moveValues, moveStringValues, predictions }; //{ winningMove, winningValue, winningMoveString };
  };

  // export const getMoveSorter = async (board) => {
  //   const prediction = await getPrediction({ board, modelName: MODEL_NAME });

  //   const moveSorter = (a, b) => {
  //     const sourceIndexA = a >>> 10;
  //     const targetIndexA = a & 63;

  //     const sourceIndexB = b >>> 10;
  //     const targetIndexB = b & 63;

  //     const scoreA = prediction[sourceIndexA] * 1.4 + prediction[targetIndexA + 64];
  //     const scoreB = prediction[sourceIndexB] * 1.4 + prediction[targetIndexB + 64];

  //     return scoreB - scoreA;
  //   };

  //   return moveSorter;
  // };

  const predict = async ({ game }) => {
    const movedBoards = game.nextMoves.map((move) => ({
      move,
      board: getMovedBoard(move, game.board),
      ...getUpdatedLmfLmt({ move, ...getLmfLmt({ game }) }),
    }));

    const predictions = {}; //game.nextMoves.reduce((p,c)=>{p[c]={};return p},{})

    for (const { move, board, lmf, lmt } of movedBoards) {
      const wNext = board[64];

      if (wNext) {
        const xs = getXs(
          wNext
            ? { fens: [board2fen(board)], lmf, lmt }
            : { fens: [mirrorer(board2fen(board))], lmf: mirrorFlatArray(lmf), lmt: mirrorFlatArray(lmt) },
        );
        const predictionTensor = model.predict(xs);
        const [result, chkmate_soon, hit_soon] = (await predictionTensor.data()).map(wNext ? (e) => e : (e) => e * -1);
        predictionTensor.dispose();

        predictions[move] = { result, chkmate_soon, hit_soon };
      }
    }
    // console.log(movedBoards);

    // const moveSorter = await getMoveSorter(nextGameState.board);
    // const moves = game.moves.slice().sort(moveSorter);
    // // setWinningMove(move2moveString(moves[0]));

    // console.log({ moves });

    // const xs = gameToXs({ game });

    // const predictionTensor = model.predict(xs);
    // const prediction = await predictionTensor.data();
    // predictionTensor.dispose();

    const response = predictionsToStats({ predictions, game });

    return response;
    //
  };

  return {
    predict,
    //   gameToXs,
    //   predictionsToStats,
  };
};
