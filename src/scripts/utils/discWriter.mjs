import * as path from 'path';
import { promises as fs } from 'fs';

const RECORDS_PER_FILE = 2500;

export const discWriter = ({ groups, recordsFolder, gamesFolder }) => {
  const cache = {};
  const counters = {};

  setInterval(() => {
    console.log('Writing cache to disc');
    writeCache();
  }, 300000);

  const writeCache = async () => {
    for (const folder of Object.keys(cache)) {
      if (cache[folder].length === 0) continue;

      const subFolder = path.resolve(folder, Math.floor(Math.random() * 25).toString());

      const fragmentRatio = cache[folder].length / RECORDS_PER_FILE;
      if (counters[subFolder] && Math.random() >= fragmentRatio) {
        counters[subFolder] -= 1;
      }

      if (!counters[subFolder]) {
        counters[subFolder] = 0;
        await fs.mkdir(subFolder, { recursive: true });
      }

      await fs.appendFile(path.resolve(subFolder, `${counters[subFolder]}.csv`), cache[folder].join('\n'), 'utf8');
      cache[folder].length = 0;
      counters[subFolder] += 1;
    }
  };

  const writeRecordToDisc = async (records) => {
    for (const record of [].concat(records)) {
      for (const { groupName, filter, getPath, transform } of groups) {
        if (!filter(record)) continue;

        const folder = path.resolve(recordsFolder, groupName, `test-${record.t}`, getPath(record));

        if (!cache[folder]) {
          cache[folder] = [];
        }

        cache[folder].push(transform(record));

        if (cache[folder].length >= RECORDS_PER_FILE) {
          const subFolder = path.resolve(folder, Math.floor(Math.random() * 25).toString());
          if (!counters[subFolder]) {
            counters[subFolder] = 0;
            await fs.mkdir(subFolder, { recursive: true });
          }

          await fs.writeFile(path.resolve(subFolder, `${counters[subFolder]}.csv`), cache[folder].join('\n'), 'utf8');
          cache[folder].length = 0;
          counters[subFolder] += 1;
        }
      }
    }
  };

  const writeGameToDisc = async (game) => {
    const folder = path.resolve(
      gamesFolder,
      Math.floor(Math.random() * 100).toString(),
      Math.floor(Math.random() * 100).toString(),
    );

    await fs.mkdir(folder, { recursive: true });

    await fs.writeFile(path.resolve(folder, `${game._id}.json`), JSON.stringify(game), 'utf8');
  };

  return {
    writeRecordToDisc,
    writeGameToDisc,
    writeCache,
  };
};
