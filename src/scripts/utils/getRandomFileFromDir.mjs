import * as path from 'path';
import { promises as fs } from 'fs';

export const getRandomFileFromDir = async (dir) => {
  // this assumes that a dir has either files or subdirs in it, not both

  const list = await fs.readdir(dir);

  const dirs = [];
  const files = [];

  let i = list.length;
  while (i--) {
    const file = path.resolve(dir, list[i]);
    const stat = await fs.stat(file);

    if (stat && stat.isDirectory()) {
      dirs.push(path.resolve(dir, file));
      continue;
    }

    if (file.endsWith('.csv')) files.push(path.resolve(dir, file));
  }

  if (files.length) return files[Math.floor(Math.random() * files.length)];

  const chosenDir = dirs[Math.floor(Math.random() * dirs.length)];

  return getRandomFileFromDir(chosenDir);
};
