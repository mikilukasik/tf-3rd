const inUnits = 14;

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

const getLmValActualStrIndex = (allValsString, lmStrIndex) =>
  1 / (Number(`0x${allValsString[lmStrIndex]}${allValsString[lmStrIndex + 1]}`) || 0.5);

// const getLmVal = (allValsString, index) =>
// 1 / (Number(`0x${allValsString[index]}${allValsString[index + 1]}`) || 0.5);

const getXs = ({ fens, lmt, lmf }) => {
  const xs = new Array(64 * inUnits).fill(0);

  // const expandedFens = fens.map((fen) => {
  //   if (!fen) return Array(64).fill(Array(12).fill(0));

  const [board] = fens[0].split(' ');
  // const arr = [];
  let currentIndex = 0; // index on board, multiplied by inunits, so index in xs
  board.split('').forEach((char) => {
    switch (char) {
      case 'p':
        xs[currentIndex] = 1;
        currentIndex += inUnits;

        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'b':
        xs[currentIndex + 1] = 1;
        currentIndex += inUnits;

        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'n':
        xs[currentIndex + 2] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'r':
        xs[currentIndex + 3] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'q':
        xs[currentIndex + 4] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'k':
        xs[currentIndex + 5] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;

      case 'P':
        xs[currentIndex + 6] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'B':
        xs[currentIndex + 7] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'N':
        xs[currentIndex + 8] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'R':
        xs[currentIndex + 9] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'Q':
        xs[currentIndex + 10] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;
      case 'K':
        xs[currentIndex + 11] = 1;
        currentIndex += inUnits;
        xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
        xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        break;

      case '/':
        break;

      default:
        // currentIndex+=Number(char)*inUnits
        for (let remaining = Number(char); remaining > 0; remaining -= 1) {
          //arr.push(Array(12).fill(0));
          currentIndex += inUnits;
          xs[currentIndex - 2] = getLmValActualStrIndex(lmf, (currentIndex / inUnits - 1) * 2);
          xs[currentIndex - 1] = getLmValActualStrIndex(lmt, (currentIndex / inUnits - 1) * 2);
        }
    }
  });
  // return arr;
  // });

  // return new Array(64)
  //   .fill(0)
  //   .map((dummy, index) => [
  //     ...expandedFens.map((expandedFen) => expandedFen[index]).flat(),
  //     getLmVal(lmf, index),
  //     getLmVal(lmt, index),
  //   ])
  //   .flat();

  return xs;
};

const getXsAsString = ({ fens, lmt, lmf, xsformat = 'default', moveMap }) => {
  let xs = ''; //new Array(64 * inUnits).fill(0);
  // console.log({ lmf, lmt });
  // const expandedFens = fens.map((fen) => {
  //   if (!fen) return Array(64).fill(Array(12).fill(0));

  const getMoveMapData = (doubledIndex) => {
    if (xsformat !== '39') return '';

    const asStr = moveMap.substr((doubledIndex / 2) * 25, 25);
    // console.log({ asStr });
    const asArr = asStr.split('').map((char) => 1 - 1 / (parseInt(char, 32) + 1));
    // console.log({ asArr });
    return `${asArr.join(',')},`;
  };

  const [board] = fens[0].split(' ');
  // const arr = [];
  let currentIndex = 0; // index on board, multiplied by inunits, so index in xs
  board.split('').forEach((char) => {
    switch (char) {
      case 'p':
        // xs[currentIndex] = 1;

        xs += '1,0,0,0,0,0,0,0,0,0,0,0,';
        // xs += '1,,,,,,,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'b':
        // xs[currentIndex + 1] = 1;
        // currentIndex += inUnits;

        xs += '0,1,0,0,0,0,0,0,0,0,0,0,';
        // xs += ',1,,,,,,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'n':
        // xs[currentIndex + 2] = 1;

        xs += '0,0,1,0,0,0,0,0,0,0,0,0,';
        // xs += ',,1,,,,,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'r':
        // xs[currentIndex + 3] = 1;

        xs += '0,0,0,1,0,0,0,0,0,0,0,0,';
        // xs += ',,,1,,,,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'q':
        // xs[currentIndex + 4] = 1;

        xs += '0,0,0,0,1,0,0,0,0,0,0,0,';
        // xs += ',,,,1,,,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'k':
        // xs[currentIndex + 5] = 1;

        xs += '0,0,0,0,0,1,0,0,0,0,0,0,';
        // xs += ',,,,,1,,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;

      case 'P':
        // xs[currentIndex + 6] = 1;

        xs += '0,0,0,0,0,0,1,0,0,0,0,0,';
        // xs += ',,,,,,1,,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'B':
        // xs[currentIndex + 7] = 1;

        xs += '0,0,0,0,0,0,0,1,0,0,0,0,';
        // xs += ',,,,,,,1,,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'N':
        // xs[currentIndex + 8] = 1;

        xs += '0,0,0,0,0,0,0,0,1,0,0,0,';
        // xs += ',,,,,,,,1,,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'R':
        // xs[currentIndex + 9] = 1;

        xs += '0,0,0,0,0,0,0,0,0,1,0,0,';
        // xs += ',,,,,,,,,1,,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'Q':
        // xs[currentIndex + 10] = 1;

        xs += '0,0,0,0,0,0,0,0,0,0,1,0,';
        // xs += ',,,,,,,,,,1,,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;
      case 'K':
        // xs[currentIndex + 11] = 1;

        xs += '0,0,0,0,0,0,0,0,0,0,0,1,';
        // xs += ',,,,,,,,,,,1,';
        xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
        xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
        xs += getMoveMapData(currentIndex);
        currentIndex += 2;
        break;

      case '/':
        break;

      default:
        // currentIndex+=Number(char)*inUnits
        for (let remaining = Number(char); remaining > 0; remaining -= 1) {
          //arr.push(Array(12).fill(0));

          xs += '0,0,0,0,0,0,0,0,0,0,0,0,';
          // xs += ',,,,,,,,,,,,';
          xs += getLmValActualStrIndex(lmf, currentIndex) + ',';
          xs += getLmValActualStrIndex(lmt, currentIndex) + ',';
          xs += getMoveMapData(currentIndex);
          currentIndex += 2;
        }
    }
  });
  // return arr;
  // });

  // return new Array(64)
  //   .fill(0)
  //   .map((dummy, index) => [
  //     ...expandedFens.map((expandedFen) => expandedFen[index]).flat(),
  //     getLmVal(lmf, index),
  //     getLmVal(lmt, index),
  //   ])
  //   .flat();

  return xs.slice(0, -1);
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
  getXsAsString,
};
