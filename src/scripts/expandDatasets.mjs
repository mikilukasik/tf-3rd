import { promises as fs } from 'fs';
import * as path from 'path';

const sourceFolder = 'data/datasets/1st_42_shuffled';
const destFolder = 'data/datasets/1st_expanded';

const pad = (_num, size) => {
  let num = _num.toString();
  while (num.length < size) num = `0${num}`;
  return num;
};

const noMoreCastling = ({ fen }) => {
  const castling = fen.split(' ')[2];
  return castling === '-';
};

const noMorePawns = ({ fen }) => {
  const board = fen.split(' ')[0];
  const hasBlackPawns = board.indexOf('p') >= 0;
  const hasWhitePawns = board.indexOf('P') >= 0;
  return !(hasBlackPawns || hasWhitePawns);
};

const rowReverser = (row) => row.split('').reverse().join('');

const mirrorOnX = (record) => {
  const { fen } = record;
  const [board, ...restOfFen] = fen.split(' ');

  const newBoard = board.split('/').map(rowReverser).join('/');
  return Object.assign({}, record, { fen: [newBoard, ...restOfFen].join(' ') });
};

const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

const mergeBlanks = (rowStr) => rowStr.replace(/[1]+/g, (blanks) => blanks.length);

const rotate90 = (record) => {
  const { fen } = record;
  const [board, ...restOfFen] = fen.split(' ');

  const lines = board.split('/').map((line) => expandGroupedBlanks(line).split(''));

  const newLines = [];
  for (let i = 0; i < 8; i += 1) {
    newLines[i] = [];
    for (let j = 0; j < 8; j += 1) {
      newLines[i][j] = lines[j][7 - i];
    }
  }

  const newBoard = newLines.map((lineArr) => mergeBlanks(lineArr.join(''))).join('/');
  return Object.assign({}, record, { fen: [newBoard, ...restOfFen].join(' ') });
};

const getRotatedRecords = (record) => {
  const resultingRecords = [record];

  for (let i = 0; i < 3; i += 1) {
    const recordToRotate = resultingRecords[resultingRecords.length - 1];
    resultingRecords.push(rotate90(recordToRotate));
  }

  return resultingRecords.slice(1);
};

const addFlippedAndRotated = (dataArr) => {
  const newDataArr = [];

  for (const data of dataArr) {
    const resultingRecords = [data];

    if (noMoreCastling(data)) {
      resultingRecords.push(mirrorOnX(data));
      if (noMorePawns(data))
        resultingRecords.push(...getRotatedRecords(resultingRecords[0]), ...getRotatedRecords(resultingRecords[1]));
    }

    newDataArr.push(...resultingRecords);
  }

  return newDataArr;
};

const saveNewFile = async ({ records, fileIndex }) => {
  await fs.writeFile(
    path.resolve(destFolder, `${pad(fileIndex, 3)}-s${records.length}.json`),
    JSON.stringify(records),
    'utf8',
  );
};

const processFiles = async ({ sourceDatasetFiles }) => {
  for (const [fileIndex, sourceFileName] of sourceDatasetFiles.entries()) {
    console.log(`processing ${sourceFileName}...`);

    const sourceRecords = JSON.parse(await fs.readFile(path.resolve(sourceFolder, sourceFileName)));
    const records = await addFlippedAndRotated(sourceRecords);

    await saveNewFile({ records, fileIndex });
  }
};

const run = async () => {
  await fs.mkdir(path.resolve(destFolder), { recursive: true });

  const sourceDatasetFiles = await fs.readdir(path.resolve(sourceFolder));

  await processFiles({ sourceDatasetFiles });
};

run();
