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

export const mirrorer = (fen) => {
  const [board, nextChar, castling, enPassant] = fen.split(' ');

  const mirroredBoard = board.split('/').reverse().join('/');
  const invertedBoard = mirroredBoard.split('').map(charInverter).join('');
  const invertedCastling = castling.split('').map(charInverter).sort(castlingSorter).join('');
  const mirroredEnPassant = mirrorEnPassant(enPassant);

  return `${invertedBoard} ${nextChar === 'w' ? 'b' : 'w'} ${invertedCastling} ${mirroredEnPassant}`;
};
