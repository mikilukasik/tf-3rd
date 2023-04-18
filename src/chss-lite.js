import { getPseudoMoveMap } from '../chss-module-engine/src/engine_new/moveGenerators/getPseudoMoveMap.js';
import { fen2intArray } from '../chss-module-engine/src/engine_new/transformers/fen2intArray.js';

const fenInput = document.getElementById('fen-input');
const moveMapCheckBox = document.getElementById('movemap-checkbox');
const board = document.getElementById('board');

const pieceMapByChar = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

const pieceMapByNum = {
  14: '♔',
  13: '♕',
  12: '♖',
  10: '♗',
  11: '♘',
  9: '♙',
  6: '♚',
  5: '♛',
  4: '♜',
  2: '♝',
  3: '♞',
  1: '♟',
};

const getMoveMapInnerText = (data) => {
  if (!data) return '';

  const result = Object.keys(data).reduce((p, key) => `${p} ${(pieceMapByNum[key] || 'e').repeat(data[key])}`, '');

  console.log(data, result);
  return result;
};

const getMoveMapElements = ({ from, to }) => {
  const movemapFromDisplay = document.createElement('div');
  movemapFromDisplay.className = `movemap-display`;
  movemapFromDisplay.style = 'bottom: 0';
  movemapFromDisplay.innerText = getMoveMapInnerText(from);

  const movemapToDisplay = document.createElement('div');
  movemapToDisplay.className = `movemap-display`;
  movemapToDisplay.style = 'top: 0';
  movemapToDisplay.innerText = getMoveMapInnerText(to);

  return [movemapFromDisplay, movemapToDisplay];
};

const renderBoard = (fen) => {
  board.innerHTML = '';

  let moveMap = [];
  if (moveMapCheckBox.checked) {
    const board = fen2intArray(fen);
    moveMap = getPseudoMoveMap(board);
  }

  const rows = fen.split(' ')[0].split('/');
  for (let i = 0; i < 8; i += 1) {
    const row = rows[i];
    let col = 0;
    for (const char of row) {
      if (isNaN(parseInt(char))) {
        const square = document.createElement('div');
        square.className = `square ${(i + col) % 2 ? 'black' : 'white'}`;
        square.innerText = pieceMapByChar[char] || '';
        if (moveMap[8 * i + col]) getMoveMapElements(moveMap[8 * i + col]).forEach((elm) => square.appendChild(elm));
        board.appendChild(square);
        col += 1;
      } else {
        for (let j = 0; j < parseInt(char); j += 1) {
          const square = document.createElement('div');
          square.className = `square ${(i + col) % 2 ? 'black' : 'white'}`;
          if (moveMap[8 * i + col]) getMoveMapElements(moveMap[8 * i + col]).forEach((elm) => square.appendChild(elm));
          board.appendChild(square);
          col += 1;
        }
      }
    }
  }
};

fenInput.addEventListener('input', () => {
  renderBoard(fenInput.value);
});

moveMapCheckBox.addEventListener('input', () => {
  renderBoard(fenInput.value);
});

fenInput.value = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
renderBoard('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', '');
