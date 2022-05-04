import { expandGroupedBlanks } from './fenUtils.mjs';
import { getWhiteNextFen } from './getWNextFen.mjs';

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
        continue;
      }

      if (isMyPiece(expandedFenRow[colIndex]) && (typeof result[0] !== 'number' || ![4, 60].includes(result[0]))) {
        result[0] = rowIndex * 8 + colIndex;
      }
    }
  }

  return result;
};

const getWNextMoveIndicators = ({ fen, moveIndicators }) => {
  const [, playerColor] = fen.split(' ');
  if (playerColor === 'w') return moveIndicators;

  return moveIndicators.map((index) => {
    const rowIndex = Math.floor(index / 8);
    const colIndex = index % 8;

    return 8 * (7 - rowIndex) + colIndex;
  });
};

export const addMoveIndicators = ({ record, doc: { records }, index }) => {
  if (typeof record.moveIndicators === 'object') return record;

  if (index === records.length - 1) return Object.assign({}, record, { moveIndicators: [] });

  const fen = record.fen;
  const nextFen = records[index + 1].fen;

  const moveIndicators = getMoveIndicators({ fen, nextFen });
  const wNextMoveIndicators = getWNextMoveIndicators({ fen, moveIndicators });

  return Object.assign({}, record, { moveIndicators, wNextMoveIndicators });
};
