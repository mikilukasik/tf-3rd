import { promises as fs } from 'fs';
import * as path from 'path';
import readGames from '../utils/readGames.mjs';

const sourceFolders = {
  // 'data/html/OTB-HQ/otb_1800_chkmt': { endsWithMate: true },
  // 'data/html/OTB-HQ/otb_all_stlmt': { endsWithStall: true },
  'data/html/Engines/eng_chkmt_2000+_novar': { endsWithMate: true },
  'data/html/Engines/eng_stlmt_novar': { endsWithStall: true },
};
const destFolder = 'data/records_engines';
const movesFile = 'possibleMoves.csv';
const endsWithMate = true;
const endsWithStall = false;

const { processRecord, writeCache } = (() => {
  const cache = {};
  const fileCounts = {};

  const ensureDir = async (folder) => {
    if (cache[folder]) return;
    await fs.mkdir(folder, { recursive: true });
    cache[folder] = [];
    fileCounts[folder] = 0;
  };

  const writeCacheFile = async ({ folder }) => {
    fileCounts[folder] += 1;
    const fileName = path.resolve(
      folder,
      `${folder.split(`${destFolder}/`)[1].replace(/\//g, '-')}-${fileCounts[folder]}.json`,
    );
    await fs.writeFile(fileName, JSON.stringify(cache[folder]), 'utf8');
    cache[folder].length = 0;
  };

  const addRecord = async ({ record, folder }) => {
    cache[folder].push(record);
    if (cache[folder].length > 1000) await writeCacheFile({ folder });
  };

  const processRecord = async (record) => {
    const { fen, result, isMate, isStall, balance } = record;

    const category = isMate ? 'mate' : isStall ? 'stall' : balance.toString();
    const folder = path.resolve(destFolder, category, result.toString(), fen.split(' ')[1]);

    await ensureDir(folder);
    await addRecord({ record, folder });
  };

  const writeCache = async () => {
    for (const folder of Object.keys(cache)) {
      if (cache[folder].length) {
        await writeCacheFile({ folder });
      }
    }
  };

  return {
    processRecord,
    writeCache,
  };
})();

const run = async () => {
  const { getNextGame } = await readGames({ folderNames: sourceFolders, movesFile, endsWithMate, endsWithStall });

  for (
    let { game, gameIndex, totalGames } = await getNextGame();
    game;
    { game, gameIndex, totalGames } = await getNextGame()
  ) {
    const { records } = game;

    for (const record of records) {
      await processRecord(record);
    }

    if (gameIndex % 1000 === 0) console.log(`${gameIndex + 1} / ${totalGames}`);
  }

  await writeCache();
};

run();
