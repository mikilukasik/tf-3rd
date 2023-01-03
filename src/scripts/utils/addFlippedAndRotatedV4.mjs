// import { movesToOneHotV2, oneHotToMovesV2 } from './oneHotMovesMapV2.mjs';
// import {
//   cellStr2cellIndex,
//   cellIndex2cellStr,
// } from '../../../chss-module-engine/src/engine_new/transformers/move2string2move.js';

const noMoreCastling = ({ fen }) => {
  const castling = fen.split(' ')[2];
  return castling === '-';
};

const noMorePawns = ({ fen }) => {
  const board = fen.split(' ')[0];
  const hasBlackPawns = board.indexOf('p') >= 0;
  const hasWhitePawns = board.indexOf('P') >= 0;
  return !(hasBlackPawns || hasWhitePawns);
};

const rowReverser = (row) => row.split('').reverse().join('');

// const mirroredColumns = {
//   a: 'h',
//   b: 'g',
//   c: 'f',
//   d: 'e',
//   e: 'd',
//   f: 'c',
//   g: 'b',
//   h: 'a',
// };

// const mirrorMoveStrOnX = (movestr) => {
//   if (!movestr || movestr === 'resign') return movestr;

//   const [sc, sr, tc, tr, pp = ''] = movestr.split('');
//   return `${mirroredColumns[sc]}${sr}${mirroredColumns[tc]}${tr}${pp}`;
// };

// const getMirroredIndex = (index) => {
//   const row = Math.floor(index / 8);
//   const col = index % 8;

//   return 8 * row + (7 - col);
// };

const mirrorOnX = (record) => {
  const { fen } = record;

  const [board, ...restOfFen] = fen.split(' ');
  const newBoard = board.split('/').map(rowReverser).join('/');
  const newFen = [newBoard, ...restOfFen].join(' ');

  // if (!movestr || movestr === 'resign')
  //   return {
  //     ...record,
  //     fen: newFen,
  //     movestr,
  //     onehot_move,
  //     wnext_move_indexes,
  //   };

  // const newMoveStr = mirrorMoveStrOnX(movestr);

  // const newWnextMoveIndexes = [
  //   getMirroredIndex(wnext_move_indexes[0]),
  //   getMirroredIndex(wnext_move_indexes[1]),
  //   ...(wnext_move_indexes[2] ? [wnext_move_indexes[2]] : []),
  // ];

  // const newOneHotMove = !onehot_move
  //   ? onehot_move
  //   : movesToOneHotV2[newWnextMoveIndexes[0]][newWnextMoveIndexes[1]][newWnextMoveIndexes[2] || ''];

  return {
    ...record,
    fen: newFen,
    // movestr: newMoveStr,
    // onehot_move: newOneHotMove,
    // wnext_move_indexes: newWnextMoveIndexes,
  };
};

const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

const mergeBlanks = (rowStr) => rowStr.replace(/[1]+/g, (blanks) => blanks.length);

const rotateFlatArray = (arr) => {
  const lines = [];
  for (let i = 0; i < arr.length; i += 8) {
    const chunk = arr.slice(i, i + 8);
    lines.push(chunk);
  }

  const newLines = [];
  for (let i = 0; i < 8; i += 1) {
    newLines[i] = [];
    for (let j = 0; j < 8; j += 1) {
      newLines[i][j] = lines[j][7 - i];
    }
  }

  return newLines.flat();
};

const rotateFen = (fen) => {
  const [board, ...restOfFen] = fen.split(' ');
  const boardAsFlatArray = board
    .split('/')
    .map((line) => expandGroupedBlanks(line).split(''))
    .flat();
  const rotatedFlatArray = rotateFlatArray(boardAsFlatArray);
  let newBoardRows = [];
  for (let i = 0; i < rotatedFlatArray.length; i += 8) {
    const chunk = rotatedFlatArray.slice(i, i + 8).join('');
    newBoardRows.push(mergeBlanks(chunk));
  }
  const newBoard = newBoardRows.join('/');

  return [newBoard, ...restOfFen].join(' '); //no need to worry about castling and enpassant rotation, there are no more pawns on the board
};

// const getRotatedIndex = (index) => {
//   const row = Math.floor(index / 8);
//   const col = index % 8;

//   return (7 - col) * 8 + row;
// };

// const rotateMoveIndexes = ([from, to, piece]) => [
//   getRotatedIndex(from),
//   getRotatedIndex(to),
//   ...(piece ? [piece] : []),
// ];

// const rotateMoveStr = ({ movestr, onehot_move }) => {
//   if (!movestr || movestr === 'resign') return { movestr, onehot_move };

//   const [sc, sr, tc, tr, pp = ''] = movestr.split('');
//   const newIndexes = rotateMoveIndexes([cellStr2cellIndex(sc + sr), cellStr2cellIndex(tc + tr)]);

//   const [newFromStr, newToStr] = newIndexes.map(cellIndex2cellStr);

//   return {
//     movestr: `${newFromStr}${newToStr}${pp}`,
//     onehot_move: movesToOneHotV2[newIndexes[0]][newIndexes[1]][pp],
//   };
// };

const rotate90 = (record) => {
  const { fen } = record;

  // const needsRotatedMoves = movestr && movestr !== 'resign';

  return {
    ...record,
    fen: rotateFen(fen),
    // wnext_move_indexes: needsRotatedMoves ? rotateMoveIndexes(wnext_move_indexes) : wnext_move_indexes,
    // ...rotateMoveStr({ movestr, onehot_move }),
  };
};

const getRotatedRecords = (record) => {
  const resultingRecords = [];

  for (let i = 0; i < 3; i += 1) {
    const recordToRotate = i === 0 ? record : resultingRecords[resultingRecords.length - 1];
    resultingRecords.push({ ...rotate90(recordToRotate) });
  }

  return resultingRecords;
};

export const addFlippedAndRotatedV4 = (records) => {
  const newRecords = [];

  for (const record of records) {
    if (!noMoreCastling(record)) continue;
    const mirrored = mirrorOnX(record);
    newRecords.push(mirrored);

    if (!noMorePawns(record)) continue;

    newRecords.push(...getRotatedRecords(record), ...getRotatedRecords(mirrored));
  }

  return records.concat(newRecords);
};
