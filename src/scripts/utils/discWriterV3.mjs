import * as path from 'path';
import { promises as fs } from 'fs';
import zlib from 'zlib';

const DEFAULT_RECORDS_PER_FILE = 5000;
// const FILES_PER_FOLDER = 100;

const writeCompressed = (filename, data, encoding) => {
  const bufferData = Buffer.from(data);

  return new Promise((res, rej) => {
    // Compress the data using gzip
    zlib.gzip(bufferData, (err, compressedData) => {
      if (err) {
        console.error(err);
        return rej(err);
      }

      // Save the compressed data to a file
      fs.writeFile(filename + '.gz', compressedData)
        .then(() => {
          console.log(`Compressed data saved to ${filename}.gz`);
          return res();
        })
        .catch((err) => {
          console.error(err);
          return rej(err);
        });
    });
  });
  //
};

export const discWriter = ({
  groups,
  recordsFolder,
  gamesFolder = 'default',
  recordsPerFile = DEFAULT_RECORDS_PER_FILE,
}) => {
  const cache = {};
  const counters = {};
  // const activeSubFolders = {};

  const writeCache = async () => {
    for (const folder of Object.keys(cache)) {
      if (cache[folder].length === 0) continue;

      const subFolder = path.resolve(folder); //, activeSubFolders[folder].toString());

      console.log(`writing into ${subFolder}`);

      // const fragmentRatio = cache[folder].length / recordsPerFile;
      // if (counters[subFolder] && Math.random() >= fragmentRatio) {
      //   counters[subFolder] -= 1;
      // }

      if (!counters[subFolder]) {
        counters[subFolder] = 0;
        await fs.mkdir(subFolder, { recursive: true });
      }

      await writeCompressed(
        path.resolve(subFolder, `${counters[subFolder]}.csv`),
        `${cache[folder].join('\n')}\n`,
        'utf8',
      );
      cache[folder].length = 0;
      counters[subFolder] += 1;

      // if (counters[subFolder] > FILES_PER_FOLDER) {
      //   // activeSubFolders[folder] += 1;
      //   delete counters[subFolder];
      // }
    }
  };

  // setInterval(() => {
  //   console.log('Writing cache to disc');
  //   writeCache();
  // }, 300000);

  const writeRecordToDisc = async (records) => {
    for (const record of [].concat(records)) {
      for (const { groupName, filter, getPath, transform } of Array.isArray(groups) ? groups : groups(record)) {
        if (filter && !filter(record)) continue;

        const folder = path.resolve(
          recordsFolder,
          groupName,
          // `test-${Boolean(record.t || record.test)}`,
          getPath(record),
        );

        if (!cache[folder]) {
          cache[folder] = [];
          // activeSubFolders[folder] = 0;
        }

        cache[folder].push(transform(record));

        if (cache[folder].length >= recordsPerFile) {
          const subFolder = path.resolve(folder); //, activeSubFolders[folder].toString());

          if (!counters[subFolder]) {
            counters[subFolder] = 0;
            await fs.mkdir(subFolder, { recursive: true });
          }

          await writeCompressed(
            path.resolve(subFolder, `${counters[subFolder]}.csv`),
            `${cache[folder].join('\n')}\n`,
            'utf8',
          );
          cache[folder].length = 0;
          counters[subFolder] += 1;

          // if (counters[subFolder] > FILES_PER_FOLDER) {
          //   // activeSubFolders[folder] += 1;
          //   delete counters[subFolder];
          // }
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
