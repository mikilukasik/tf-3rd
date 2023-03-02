import * as path from 'path';
import { promises as fs } from 'fs';
import { getRandomizedFilelist } from './utils/getRandomizedFilelist.mjs';

const datasetFolder = './data/csv_v2/default'; //  /newest and /newest2
const rootFolder = path.resolve(datasetFolder);

const writeRandomFilelists = async () => {
  const folders = (await fs.readdir(rootFolder)).map((f) => path.resolve(rootFolder, f));

  for (const folder of folders) {
    const list = await getRandomizedFilelist(folder);
    await fs.writeFile(path.resolve(folder, 'randomFilelist.json'), JSON.stringify(list, null, 2), 'utf-8');
  }
};

writeRandomFilelists();
