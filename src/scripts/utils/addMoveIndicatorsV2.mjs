import { expandGroupedBlanks } from './fenUtils.mjs';
import { movesToOneHotV2 } from './oneHotMovesMapV2.mjs';
// import { getWhiteNextFen } from './getWNextFen.mjs';

const isEmpty = (char) => char === '1';

const getMoveIndicators = ({ fen, nextFen }) => {
  const result = [];

  const [board, playerColor] = fen.split(' ');
  const isMyPiece = (char) =>
    !isEmpty(char) &&
    ((char.charCodeAt(0) >= 97 /* black */ && playerColor === 'b') ||
      (char.charCodeAt(0) <= 90 /* white */ && playerColor === 'w'));

  const fenRows = board.split('/');
  const nextFenRows = nextFen.split(' ')[0].split('/');
  let knightOnTarget = false;

  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    if (fenRows[rowIndex] === nextFenRows[rowIndex].split(' ')[0]) continue;

    const expandedFenRow = expandGroupedBlanks(fenRows[rowIndex]);
    const expandedNextFenRow = expandGroupedBlanks(nextFenRows[rowIndex].split(' ')[0]);

    for (let colIndex = 0; colIndex < 8; colIndex += 1) {
      if (expandedFenRow[colIndex] === expandedNextFenRow[colIndex]) continue;
      // console.log({ colIndex });
      // target, unless we already have one that's castled king
      if (
        isMyPiece(expandedNextFenRow[colIndex]) &&
        (typeof result[1] !== 'number' || ![2, 6, 58, 62].includes(result[1]))
      ) {
        result[1] = rowIndex * 8 + colIndex;
        if (['n', 'N'].includes(expandedNextFenRow[colIndex])) knightOnTarget = true;
        continue;
      }

      if (isMyPiece(expandedFenRow[colIndex]) && (typeof result[0] !== 'number' || ![4, 60].includes(result[0]))) {
        result[0] = rowIndex * 8 + colIndex;
      }
    }
  }

  // check if pawn got promoted to knight
  result.push(knightOnTarget && [7, 8, 9].includes(Math.abs(result[0] - result[1])) ? 'n' : '');

  return result;
};

const getWNextMoveIndicators = ({ fen, moveIndicators }) => {
  const [, playerColor] = fen.split(' ');
  if (playerColor === 'w') return moveIndicators;

  return [
    ...moveIndicators.slice(0, 2).map((index) => {
      const rowIndex = Math.floor(index / 8);
      const colIndex = index % 8;

      return 8 * (7 - rowIndex) + colIndex;
    }),
    moveIndicators[2],
  ];
};

const cellIndex2cellStr = (index) => `${String.fromCharCode((index % 8) + 97)}${8 - Math.floor(index / 8)}`;

export const addMoveIndicatorsV2 = ({ record, records, index, aborted_ending }) => {
  try {
    if (index === records.length - 1) {
      // check if it was a resignation
      const moveIndicators = aborted_ending && record.wNextResult === -1 ? [0, 0, ''] : [];
      return Object.assign({}, record, {
        orig_move_indexes: [0, 0, ''],
        wnext_move_indexes: [0, 0, ''],
        orig_movestr: moveIndicators.length ? 'resign' : '',
        movestr: moveIndicators.length ? 'resign' : '',
        onehot_move: moveIndicators.length
          ? movesToOneHotV2[moveIndicators[0]][moveIndicators[1]][moveIndicators[2]]
          : null,
      });
    }

    const fen = record.orig_fen;
    const nextFen = records[index + 1].orig_fen;

    const moveIndicators = getMoveIndicators({ fen, nextFen });
    // console.log({ fen, moveIndicators });
    const wNextMoveIndicators = getWNextMoveIndicators({ fen, moveIndicators });
    console.log({ fen, nextFen, moveIndicators, wNextMoveIndicators });

    return Object.assign({}, record, {
      orig_move_indexes: moveIndicators,
      wnext_move_indexes: wNextMoveIndicators,
      orig_movestr: `${cellIndex2cellStr(moveIndicators[0])}${cellIndex2cellStr(moveIndicators[1])}${
        moveIndicators[2]
      }`,
      movestr: `${cellIndex2cellStr(wNextMoveIndicators[0])}${cellIndex2cellStr(wNextMoveIndicators[1])}${
        wNextMoveIndicators[2]
      }`,
      onehot_move: movesToOneHotV2[wNextMoveIndicators[0]][wNextMoveIndicators[1]][wNextMoveIndicators[2]],
    });
  } catch (e) {
    console.log(e);
    throw e;
  }
};
