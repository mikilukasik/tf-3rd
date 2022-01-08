const addCastling = ({ arr, castling, castlingIndex, inputLength }) => {
  if (!castlingIndex) return;
  // mutating for performance
  const setTo = (val) => (index) => (arr[index * inputLength + castlingIndex] = val);

  // if (castling.includes('q')) [0, 1, 2, 3, 4].forEach(setTo(-1));
  // if (castling.includes('k')) [4, 5, 6, 7].forEach(setTo(-1));
  // if (castling.includes('Q')) [56, 57, 58, 59, 60].forEach(setTo(1));
  // if (castling.includes('K')) [60, 61, 62, 63].forEach(setTo(1));

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

const fen2flatArray = ({ fenStr, inputLength: _inputLength, castlingIndex = 7, enPassantIndex = 0 }) => {
  const inputLength = _inputLength || 7 + (castlingIndex ? 1 : 0) + (enPassantIndex ? 1 : 0);

  const [board, nextChar, castling, enPassant] = fenStr.split(' ');
  const wn = nextChar === 'w' ? 1 : -1;
  const arr = [];
  board.split('').forEach((char) => {
    switch (char) {
      case 'p':
        arr.push(wn, -1, 0, 0, 0, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'b':
        arr.push(wn, 0, -1, 0, 0, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'n':
        arr.push(wn, 0, 0, -1, 0, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'r':
        arr.push(wn, 0, 0, 0, -1, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'q':
        arr.push(wn, 0, 0, 0, 0, -1, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'k':
        arr.push(wn, 0, 0, 0, 0, 0, -1, ...Array(inputLength - 7).fill(0));
        break;

      case 'P':
        arr.push(wn, 1, 0, 0, 0, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'B':
        arr.push(wn, 0, 1, 0, 0, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'N':
        arr.push(wn, 0, 0, 1, 0, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'R':
        arr.push(wn, 0, 0, 0, 1, 0, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'Q':
        arr.push(wn, 0, 0, 0, 0, 1, 0, ...Array(inputLength - 7).fill(0));
        break;
      case 'K':
        arr.push(wn, 0, 0, 0, 0, 0, 1, ...Array(inputLength - 7).fill(0));
        break;

      case '/':
        break;

      default:
        // arr.push(...Array.from({ length: Number(char) }).map(() => 0));
        for (let emptyIndex = 0; emptyIndex < Number(char); emptyIndex += 1)
          arr.push(wn, 0, 0, 0, 0, 0, 0, ...Array(inputLength - 7).fill(0));
      // arr.push(...new Array(Number(char) * 12).fill(0));
    }
  });

  addCastling({ arr, castling, castlingIndex, inputLength });
  addEnPassant({ arr, enPassant, enPassantIndex, inputLength });

  return arr;
};

module.exports = {
  fen2flatArray,
};
