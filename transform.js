const addCastling = ({ arr, castling, castlingIndex, inputLength }) => {
  if (!castlingIndex) return;
  // mutating for performance
  const setTo = (val) => (index) => (arr[index * inputLength + castlingIndex] = val);

  if (castling.includes('q')) [0, 4].forEach(setTo(0));
  if (castling.includes('k')) [4, 7].forEach(setTo(0));
  if (castling.includes('Q')) [56, 60].forEach(setTo(1));
  if (castling.includes('K')) [60, 63].forEach(setTo(1));
};

const addEnPassant = ({ arr, enPassant, enPassantIndex, inputLength }) => {
  if (!enPassantIndex || enPassant === '-') return;

  const row = enPassant[1] === '3' ? 4 : 3;
  const col = enPassant.charCodeAt(0) - 97;
  const index = 8 * row + col;
  arr[index * inputLength + enPassantIndex] = row === 2 ? -1 : 1;
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

const getWhiteNextFen = ({ fen }) => {
  const [board, nextChar, castling, enPassant] = fen.split(' ');
  if (nextChar === 'w') return { fen, mirrored: false };

  const mirroredBoard = board.split('/').reverse().join('/');
  const invertedBoard = mirroredBoard.split('').map(charInverter).join('');
  const invertedCastling = castling.split('').map(charInverter).sort(castlingSorter).join('');
  const mirroredEnPassant = mirrorEnPassant(enPassant);

  return { fen: `${invertedBoard} w ${invertedCastling} ${mirroredEnPassant}`, mirrored: true };
};

const getLmVal = (allValsString, index) =>
  1 / (Number(`0x${allValsString[index * 2]}${allValsString[index * 2 + 1]}`) || 0.5);

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

  return new Array(64)
    .fill(0)
    .map((dummy, index) => [
      ...expandedFens.map((expandedFen) => expandedFen[index]).flat(),
      getLmVal(lmf, index),
      getLmVal(lmt, index),
    ])
    .flat();
};

const fen2flatArray = ({ fenStr, inputLength: _inputLength, castlingIndex = 0, enPassantIndex = 0 }) => {
  const inputLength = _inputLength || 12 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);

  const [board, nextChar, castling, enPassant] = fenStr.split(' ');
  const arr = [];
  board.split('').forEach((char) => {
    switch (char) {
      case 'p':
        arr.push(1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'b':
        arr.push(0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'n':
        arr.push(0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'r':
        arr.push(0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'q':
        arr.push(0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'k':
        arr.push(0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;

      case 'P':
        arr.push(0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'B':
        arr.push(0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'N':
        arr.push(0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'R':
        arr.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'Q':
        arr.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, ...Array(inputLength - 12).fill(0));
        break;
      case 'K':
        arr.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, ...Array(inputLength - 12).fill(0));
        break;

      case '/':
        break;

      default:
        for (let emptyIndex = 0; emptyIndex < Number(char); emptyIndex += 1) arr.push(...Array(inputLength).fill(0));
    }
  });

  addCastling({ arr, castling, castlingIndex, inputLength });
  addEnPassant({ arr, enPassant, enPassantIndex, inputLength });

  return arr;
};

module.exports = {
  fen2flatArray,
  getWhiteNextFen,
  getXs,
};
