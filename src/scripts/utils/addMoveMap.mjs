import { fen2intArray } from '../../../chss-module-engine/src/engine_new/transformers/fen2intArray.js';
import { getPseudoMoveMap } from '../../../chss-module-engine/src/engine_new/moveGenerators/getPseudoMoveMap.js';

export const addMoveMap = ({ record }) => {
  const { fen } = record;
  const [, color] = fen.split(' ');

  if (color !== 'w') throw new Error("Black's move received in addMoveMap");

  const moveMap = getPseudoMoveMap(fen2intArray(fen));

  // console.log(moveMap);
  // process.exit(0);

  return {
    ...record,
    moveMap,
  };
};
