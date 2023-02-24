import { board2fen } from '../../../chss-module-engine/src/engine_new/transformers/board2fen.js';
import { oneHotToMovesV2 } from '../../scripts/utils/oneHotMovesMapV2.mjs';

export default async ({ tf, modelUrl }) => {
  console.log('Loading fromto model...');
  const model = await tf.loadLayersModel(modelUrl);

  console.log('initialising fromto model transforms.');

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

  const getLmVal = (allValsArr, index) => 1 / allValsArr[index];

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
          getLmVal(lmf, index),
          getLmVal(lmt, index),
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

  const gameToXs = ({ game: { board, allPastFens, wNext, moves, lmf, lmt } }) => {
    // console.log({ board, allPastFens, wNext, moves, lmf, lmt });

    // console.log({ game });
    const allPastFensLength = allPastFens && allPastFens.length;
    const fens = allPastFensLength
      ? [
          // allPastFens[allPastFensLength - 5],
          // allPastFens[allPastFensLength - 3],
          allPastFens[allPastFensLength - 1],
        ]
      : [board2fen(board)];

    if (!wNext)
      fens.forEach((f, i) => {
        if (fens[i]) fens[i] = mirrorer(f);
      });

    if (lmf && lmt) {
      return getXs({ fens, lmf, lmt });
    }

    // `${cellIndex2cellStr(move >>> 10)}${cellIndex2cellStr(move & 63)}${getPromotionPiece(move)}`;

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

    // const lmf = (!wNext ? mirrorFlatArray : (e) => e)(lastMovedFrom).join('');
    // const lmt = (!wNext ? mirrorFlatArray : (e) => e)(lastMovedTo).join('');

    return getXs({
      fens,
      lmf: (!wNext ? mirrorFlatArray : (e) => e)(lastMovedFromInts), //.join(''),
      lmt: (!wNext ? mirrorFlatArray : (e) => e)(lastMovedToInts), //.join(''),
    });

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

  const ysToStats = ({ ys, game: { wNext, nextMoves, board } }) => {
    // const moveValues = ys.reduce((p, val, i) => {
    //   p[addQueenPromotion(wNext ? oneHotToMovesMap[i] : mirrorMove(oneHotToMovesMap[i]), board)] = val;
    //   return p;
    // }, {});

    const getMoveValue = (_move) => {
      const move = wNext ? _move : mirrorMove(_move);
      const source = move >>> 10;
      const target = move & 63;
      return ys[source] + ys[target + 64];
    };

    let winningMove = null;
    let highestScore = -1;

    const moveValues = nextMoves.reduce((p, move) => {
      p[move] = getMoveValue(move);
      if (p[move] > highestScore) {
        highestScore = p[move];
        winningMove = move;
      }
      return p;
    }, {});

    // const moveValues = new Proxy(
    //   {},
    //   {
    //     get(t, prop) {
    //       const move = wNext ? Number(prop) : mirrorMove(Number(prop));
    //       const source = move >>> 10;
    //       const target = move & 63;
    //       return ys[source] + ys[target + 64];
    //     },
    //   },
    // );

    const moveStringValues = nextMoves.reduce((p, move) => {
      p[getMoveString(move)] = moveValues[move];
      return p;
    }, {});

    // const moveStringValues = oneHotToMovesMap.reduce((p, move, i) => {
    //   const m = addQueenPromotion(wNext ? move : mirrorMove(move), board);
    //   p[getMoveString(m)] = ys[i];
    //   return p;
    // }, {});

    // const { winningMove } = (wNext ? (data) => data : ({ winningMove }) => ({ winningMove: mirrorMove(winningMove) }))(
    //   oneHotToMovesMap.reduce(
    //     (p, move, i) => {
    //       return ys[i] > p.winningValue ? { winningMove: move, winningValue: ys[i] } : p;
    //     },
    //     { winningMove: null, winningValue: -1000 },
    //   ),
    // );

    const winningMoveString = getMoveString(winningMove);

    return { winningMoveString, moveValues, moveStringValues, ys }; //{ winningMove, winningValue, winningMoveString };
  };

  const predict = async ({ game }) => {
    const xs = gameToXs({ game });

    const predictionTensor = model.predict(xs);
    const prediction = await predictionTensor.data();
    predictionTensor.dispose();

    const response = ysToStats({ ys: prediction, game });

    return response;
    //
  };

  return {
    predict,
    //   gameToXs,
    //   ysToStats,
  };
};
