import { promises as fs } from 'fs';
import path from 'path';
import { datasetReaderV3 } from './src/scripts/utils/getMovesDatasetPgV3.mjs';
import { oneHotToMovesV2 } from './src/scripts/utils/oneHotMovesMapV2.mjs';
const pieces = ['', 'p', 'b', 'n', 'r', 'q', 'k', '', '', 'P', 'B', 'N', 'R', 'Q', 'K'];

const oneHotToMovesMap = oneHotToMovesV2.map(([source, target, piece]) => {
  // TODO: add knight promotion and resign logic here
  return (source << 10) + target + (piece ? pieces.indexOf(piece.toUpperCase()) << 6 : 0);
  // (move >>> 6) & 15;
});

const cellIndex2cellStr = (index) => `${String.fromCharCode((index % 8) + 97)}${8 - Math.floor(index / 8)}`;

const getMoveString = (move) =>
  `${cellIndex2cellStr(move >>> 10)}${cellIndex2cellStr(move & 63)}${pieces[(move >>> 6) & 15]}`;

const datasetFolder = './data/newestCsvs/newest2'; //  /newest and /newest2

// no filter
// const filter = () => true;

// all
const filter = (data) => Number(data[2]) >= 0; //|| Number(data[3]) > 0.001 || Math.random() < 0.01; //mostly good moves;

// midegame
// const filter = (data) => data[7] === '1' && (Number(data[2]) >= 0 || Number(data[3]) > 0.0001); //|| Math.random() < 0.01;

//openings
// const filter = (data) => Number(data[2]) >= 0 && data[7] === '0'; //|| Math.random() < 0.01;

const recordsPerDataset = 30000;
const dupeCacheSize = 2000000;
const singleMoveRatio = 7.5;
const singleProgressGroupRatio = 1.48;
const singleBalanceGroupRatio = 1;

const stats = new Array(3).fill(0);

const getBalanceGroupFromFen = (fen) => {
  const [pieces] = fen.split(' ');

  const whitePieceCount = pieces.replace(/[^A-Z]/g, '').length;
  const blackPieceCount = pieces.replace(/[^a-z]/g, '').length;

  if (blackPieceCount > whitePieceCount) return 0;
  if (blackPieceCount < whitePieceCount) return 1;
  return 2;
};

const updateStats = async (records) => {
  for (const record of records) {
    const [
      fen,
      onehot_move,
      hit_soon,
      chkmate_soon,
      result,
      chkmate_ending,
      stall_ending,
      p, // ? 0 : is_midgame ? 1 : 2,
      is_last,
      lmf, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
      lmt, //.map((val) => val.toString(16).padStart(2, '0')).join(''),
    ] = record;

    stats[getBalanceGroupFromFen(fen)] += 1; // (stats[onehot_move]||0)+1
  }

  const sortedStats = stats.map((count, group) => ({ count, group })).sort((a, b) => b.count - a.count);

  await fs.writeFile('stats.json', JSON.stringify(sortedStats, null, 2), 'utf8');

  console.log(sortedStats);
};

const run = async function () {
  const { getNextBatch } = await init();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const dataset = await getNextBatch();
    if (!dataset) {
      throw new Error('no dataset loaded');
    }

    if (!dataset.length) {
      break;
    }

    await updateStats(dataset);
  }
};

const init = async () => {
  try {
    const { getNextBatch } = await datasetReaderV3({
      folder: path.resolve(datasetFolder),
      test: false,
      batchSize: recordsPerDataset,
      filter,
      dupeCacheSize,
      beginningToEnd: true,
      singleMoveRatio, //: 1.2,
      singleProgressGroupRatio,
      singleBalanceGroupRatio,
    });
    console.log('datasetReaderV3 for lessons initialized');

    return { getNextBatch };
  } catch (e) {
    console.error(e);
  }
};

run().catch(console.error);
