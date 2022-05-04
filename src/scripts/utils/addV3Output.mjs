import { expandGroupedBlanks } from './fenUtils.mjs';

export const v3OutputKeys = [
  ...['hit', 'lose'].map((group) => 'prnbqkPRNBQK'.split('').map((piece) => `${group}_${piece}`)).flat(),
  'promote_p',
  'promote_P',
];

const getChar = ({ index, fen }) => {
  const row = fen.split(' ')[0].split('/')[Math.floor(index / 8)];
  const expandedRow = expandGroupedBlanks(row);
  const char = expandedRow[index % 8];

  if (char === '1') return null;
  return char;
};

const getDisappeared = ({ fen, movedPiece, moveIndicators, pawnMoved }) => {
  const targetPiece = getChar({ fen, index: moveIndicators[1] });

  if (targetPiece) return targetPiece;

  // en passant
  if (pawnMoved && moveIndicators[0] % 8 !== moveIndicators[1] % 8) {
    // pawn moved diagonally to empty space
    return movedPiece === 'p' ? 'P' : 'p';
  }

  return null;
};

const getDiff = ({ fen, moveIndicators }) => {
  const movedPiece = getChar({ fen, index: moveIndicators[0] });
  const pawnMoved = ['p', 'P'].includes(movedPiece);
  const dissapeared = getDisappeared({ fen, movedPiece, moveIndicators, pawnMoved });
  const hitBy = dissapeared && movedPiece;
  const promoted = pawnMoved && [0, 7].includes(Math.floor(moveIndicators[1] / 8)) ? movedPiece : null;

  return { dissapeared, hitBy, promoted };
};

const applyOutputToPrecedingRedords = ({ records, index }) => {
  const keysToIncrease = Object.keys(records[index].v3Output).filter((key) => records[index].v3Output[key] === 1);

  let currentIndex = index;
  while (currentIndex--) {
    keysToIncrease.forEach((key) => {
      records[currentIndex].v3Output[key] =
        (records[currentIndex].v3Output[key] || 0) + 1 / Math.pow(1.25, index - currentIndex);
    });
  }
};

const flipSide = (outputKey) => {
  const [type, piece] = outputKey.split('_');
  const newPiece = piece.charCodeAt(0) >= 97 ? piece.toUpperCase() : piece.toLowerCase();
  return `${type}_${newPiece}`;
};

const applyWNext = (record) => {
  if (record.fen.split(' ')[1] === 'w') return record;

  const newV3Output = Object.keys(record.v3Output).reduce((p, origKey) => {
    p[flipSide(origKey)] = record.v3Output[origKey];
    return p;
  }, {});

  return Object.assign({}, record, { v3Output: newV3Output });
};

export const addV3Output = ({ records, result }) => {
  // if (typeof records[0].v3Output === 'object') return records;
  const newRecords = records.map((r) => Object.assign({}, r));

  records.forEach((record, index) => {
    const { moveIndicators, fen } = record;

    newRecords[index].v3Output = v3OutputKeys.reduce((p, c) => Object.assign(p, { [c]: 0 }), {});

    if (index === records.length - 1) {
      if (result === 0) return;

      // TODO: should mark hitBy
      newRecords[index].v3Output[`lose_${fen.split(' ')[1] === 'w' ? 'K' : 'k'}`] = 1;
      applyOutputToPrecedingRedords({ records: newRecords, index });
      return;
    }

    const { dissapeared, hitBy, promoted } = getDiff({ fen, moveIndicators });

    if (dissapeared) {
      newRecords[index].v3Output[`lose_${dissapeared}`] = 1;
      newRecords[index].v3Output[`hit_${hitBy}`] = 1;
    }

    if (promoted) {
      newRecords[index].v3Output[`promote_${promoted}`] = 1;
    }

    if (dissapeared || promoted) applyOutputToPrecedingRedords({ records: newRecords, index });
  });

  return newRecords.map(applyWNext);
};
