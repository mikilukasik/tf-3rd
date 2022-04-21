import * as path from 'path';
import { promises as fs } from 'fs';

export const getAllFiles = async (dir) => {
  const results = [];
  const list = await fs.readdir(dir);

  // let hasSubDirs = false;

  let i = list.length;
  while (i--) {
    const file = path.resolve(dir, list[i]);
    const stat = await fs.stat(file);

    if (stat && stat.isDirectory()) {
      // hasSubDirs = true;
      results.push(...(await getAllFiles(path.resolve(dir, file))));
      continue;
    }

    results.push(path.resolve(dir, file));
  }

  // if (!hasSubDirs && list.length > 0) results.push(dir);
  return results;
};
