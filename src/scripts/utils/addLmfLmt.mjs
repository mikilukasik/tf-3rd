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

export const addLmfLmt = ({ record, records, index: i }) => {
  const wNext = record.fen === record.orig_fen;
  const fens = records.slice(0, i + 1).map((r) => r.orig_fen);
  const moves = records.slice(0, i + 1).map((r) => r.orig_move_indexes);

  if (!wNext)
    fens.forEach((f, i) => {
      if (fens[i]) fens[i] = mirrorer(f);
    });

  const lastMovedFrom = new Array(64).fill(255).map((val, cellIndex) => {
    let lookBackIndex = i;
    while (lookBackIndex--) {
      if (moves[lookBackIndex][0] === cellIndex) {
        return Math.min(255, i - lookBackIndex);
      }
    }
    return 255;
  });

  const lastMovedTo = new Array(64).fill(255).map((val, cellIndex) => {
    let lookBackIndex = i;
    while (lookBackIndex--) {
      if (moves[lookBackIndex][1] === cellIndex) {
        return Math.min(255, i - lookBackIndex);
      }
    }
    return 255;
  });

  const lmf = (!wNext ? mirrorFlatArray : (e) => e)(lastMovedFrom);
  const lmt = (!wNext ? mirrorFlatArray : (e) => e)(lastMovedTo);

  return Object.assign({}, record, {
    lmf,
    lmt,
  });
};
