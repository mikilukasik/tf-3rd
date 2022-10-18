import { getQueenMoves } from '../../../chss-module-engine/src/engine_new/moveGenerators/getQueenMoves.js';
import { getKnightMoves } from '../../../chss-module-engine/src/engine_new/moveGenerators/getKnightMoves.js';

export const oneHotToMovesV2 = [];

const canPromoteToRook = (from, to) => {
  const isNearMove = [7, 8, 9].includes(Math.abs(from - to));
  if (!isNearMove) return false;

  if (from >= 8 && from < 16 && to < 8) return true;
  if (from >= 48 && from < 56 && to >= 56) return true;

  return false;
};

let oneHotIndex = 0;
export const movesToOneHotV2 = new Array(64).fill(0).reduce((p, c, i) => {
  p[i] = {};

  getQueenMoves(i, new Array(64).fill(0), 1).forEach((target) => {
    oneHotToMovesV2[oneHotIndex] = [i, target, ''];
    p[i][target] = { '': oneHotIndex++ };

    if (canPromoteToRook(i, target)) {
      oneHotToMovesV2[oneHotIndex] = [i, target, 'n'];
      p[i][target].n = oneHotIndex++;
    }
  });

  getKnightMoves(i, new Array(64).fill(0), 1).forEach((target) => {
    oneHotToMovesV2[oneHotIndex] = [i, target, ''];
    p[i][target] = { '': oneHotIndex++ };
  });

  return p;
}, {});

// add resign as a valid move, symbolised with 0,0
oneHotToMovesV2[oneHotIndex] = [0, 0, ''];
movesToOneHotV2['0']['0'] = { '': oneHotIndex++ };
