import { getQueenMoves } from '../../../chss-module-engine/src/engine_new/moveGenerators/getQueenMoves.js';
import { getKnightMoves } from '../../../chss-module-engine/src/engine_new/moveGenerators/getKnightMoves.js';

export const oneHotToMoves = [];

let oneHotIndex = 0;
export const movesToOneHot = new Array(64).fill(0).reduce((p, c, i) => {
  p[i] = {};

  getQueenMoves(i, new Array(64).fill(0), 1).forEach((target) => {
    oneHotToMoves[oneHotIndex] = [i, target];
    p[i][target] = oneHotIndex++;
  });
  getKnightMoves(i, new Array(64).fill(0), 1).forEach((target) => {
    oneHotToMoves[oneHotIndex] = [i, target];
    p[i][target] = oneHotIndex++;
  });

  return p;
}, {});
