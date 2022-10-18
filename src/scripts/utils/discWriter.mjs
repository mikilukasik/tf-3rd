import * as path from 'path';
import { promises as fs } from 'fs';

const RECORDS_PER_FILE = 5000;
const FILES_PER_FOLDER = 100;

export const discWriter = ({ groups, recordsFolder, gamesFolder = 'default' }) => {
  const cache = {};
  const counters = {};
  const activeSubFolders = {};

  setInterval(() => {
    console.log('Writing cache to disc');
    writeCache();
  }, 300000);

  const writeCache = async () => {
    for (const folder of Object.keys(cache)) {
      if (cache[folder].length === 0) continue;

      const subFolder = path.resolve(folder, activeSubFolders[folder].toString());

      const fragmentRatio = cache[folder].length / RECORDS_PER_FILE;
      if (counters[subFolder] && Math.random() >= fragmentRatio) {
        counters[subFolder] -= 1;
      }

      if (!counters[subFolder]) {
        counters[subFolder] = 0;
        await fs.mkdir(subFolder, { recursive: true });
      }

      await fs.appendFile(
        path.resolve(subFolder, `${counters[subFolder]}.csv`),
        `${cache[folder].join('\n')}\n`,
        'utf8',
      );
      cache[folder].length = 0;
      counters[subFolder] += 1;

      if (counters[subFolder] > FILES_PER_FOLDER) {
        activeSubFolders[folder] += 1;
        delete counters[subFolder];
      }
    }
  };

  const writeRecordToDisc = async (records) => {
    for (const record of [].concat(records)) {
      for (const { groupName, filter, getPath, transform } of Array.isArray(groups) ? groups : groups(record)) {
        if (filter && !filter(record)) continue;

        const folder = path.resolve(recordsFolder, groupName, `test-${record.t}`, getPath(record));

        if (!cache[folder]) {
          cache[folder] = [];
          activeSubFolders[folder] = 0;
        }

        cache[folder].push(transform(record));

        if (cache[folder].length >= RECORDS_PER_FILE) {
          const subFolder = path.resolve(folder, activeSubFolders[folder].toString());

          if (!counters[subFolder]) {
            counters[subFolder] = 0;
            await fs.mkdir(subFolder, { recursive: true });
          }

          await fs.writeFile(
            path.resolve(subFolder, `${counters[subFolder]}.csv`),
            `${cache[folder].join('\n')}\n`,
            'utf8',
          );
          cache[folder].length = 0;
          counters[subFolder] += 1;

          if (counters[subFolder] > FILES_PER_FOLDER) {
            activeSubFolders[folder] += 1;
            delete counters[subFolder];
          }
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

  const updateStatsFile = async (statsData) => {
    await fs.mkdir(recordsFolder, { recursive: true });
    fs.writeFile(path.resolve(recordsFolder, 'stats'), statsData.toString(), 'utf8');
  };

  return {
    writeRecordToDisc,
    writeGameToDisc,
    writeCache,
    updateStatsFile,
  };
};
