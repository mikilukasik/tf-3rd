// import { getCollection } from './utils/getCollection.mjs';
// import { getGroups } from './utils/getDataset.mjs';
// import * as path from 'path';
// import { promises as fs } from 'fs';
import { datasetReader } from './utils/getDatasetFromDisc.mjs';

// const OUTPUT_FOLDER = './data/datasetCsvs2';

// const td = new TextDecoder();

const run = async () => {
  const { getNextBatch } = await datasetReader({
    folder: './data/newCsvs2/all/test-true',
  });

  const batch = await getNextBatch();
  console.log(batch.length);

  await getNextBatch();
  // const data = new Array(1000000).fill(0).map(() => Math.random());
  // await fs.mkdir(OUTPUT_FOLDER, { recursive: true });
  // await fs.writeFile(path.resolve(OUTPUT_FOLDER, 'test.json'), JSON.stringify(data), 'utf-8');
  // await fs.writeFile(path.resolve(OUTPUT_FOLDER, 'test.bin'), td.decode(new Float64Array(data).buffer), 'utf-8');
  // const { collection } = await getCollection('scidRecords');
  // const processGroup = async ({ groupName, filter }) => {
  //   let counter = 0;
  //   let records;
  //   console.log({
  //     testData,
  //     v2OutputBucket2: { $in: filter },
  //   });
  //   do {
  //     if (counter > (testData ? 150000 : 1500000)) break;
  //     const folder = path.resolve(
  //       OUTPUT_FOLDER,
  //       `test-${testData}`,
  //       groupName,
  //       ...[1000000, 10000].map((num) => (Math.floor(counter / num) * num).toString()),
  //     );
  //     await fs.mkdir(folder, { recursive: true });
  //     const fileName = path.resolve(folder, `test-${testData}_${groupName}_${counter}.csv`);
  //     try {
  //       await fs.stat(fileName);
  //       counter += 250; //records.length;
  //       continue;
  //     } catch (e) {
  //       //
  //     }
  //     // console.log({ counter });
  //     // process.exit(0);
  //     records = await collection
  //       .find({
  //         testData,
  //         v2OutputBucket2: { $in: filter },
  //       })
  //       .project({ fen: 1, v2Output: 1 })
  //       .sort({ rnd0: 1 })
  //       .skip(counter)
  //       .limit(250)
  //       .toArray();
  //     if (!records || !records.length) break;
  //     const data = records.map(({ fen, v2Output }) => `${fen},${v2Output}`).join('\n');
  //     await fs.writeFile(fileName, data, 'utf8');
  //     if (counter % 10000 === 0) console.log(`test-${testData}_${groupName}: ${counter}`);
  //     counter += records.length;
  //     // eslint-disable-next-line no-constant-condition
  //   } while (true);
  // };
  // for (const group of getGroups()) {
  //   await processGroup(group);
  // }
  // // await Promise.all(getGroups().map((group) => processGroup(group)));
};

// Promise.all([run(false), run(true)])
run().catch(console.error);
