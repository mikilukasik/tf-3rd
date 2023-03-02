import * as path from 'path';
import { promises as fs } from 'fs';
import { shuffle } from '../../../chss-module-engine/src/utils/schuffle.js';

export const getRandomizedFilelist = async (dir, isSubCall) => {
  const result = [];

  const list = await fs.readdir(dir);

  let i = list.length;
  while (i--) {
    const file = path.resolve(dir, list[i]);
    const stat = await fs.stat(file);

    if (!stat) continue;

    if (stat.isDirectory()) {
      result.push(...(await getRandomizedFilelist(file, true)));
      continue;
    }

    result.push(file);
  }

  if (isSubCall) return result;

  return shuffle(result);
};
