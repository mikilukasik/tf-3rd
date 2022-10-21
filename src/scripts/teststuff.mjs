import path from 'path';
import { datasetReaderV4 } from './utils/getMovesDatasetPgV4.mjs';

const datasetFolder = './data/newestCsvs/newest2'; //  /newest and /newest2
const testRecordsPerDataset = 20000;

const filter = (data) => Number(data[2]) >= 0 || Number(data[3]) > 0.0001; //|| Math.random() < 0.01;

const loadTestData = async () => {
  const { getNextBatch } = await datasetReaderV4({
    folder: path.resolve(datasetFolder),
    test: true,
    batchSize: testRecordsPerDataset,
    filter,
    //noDupes: true,
    dupeCacheSize: 10000000,
  });

  console.log('datasetReaderV4 for test samples initialized, getting test samples...');
  const rawTestData = await getNextBatch();
  console.log(`Loaded ${rawTestData.length} test samples.`);
  // testData = loadData(rawTestData.map(transformRecord).filter(Boolean));
};

loadTestData();
