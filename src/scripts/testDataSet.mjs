import { getCollection } from './utils/getCollection.mjs';
import { getDataset } from './utils/getDataset.mjs';

(async () => {
  const started = Date.now();

  let i = 10;
  let pointers = {
    '-0.656 to -1': 710600,
  };

  while (i--) {
    const { result, newPointers } = await getDataset({ limit: 1000, pointers });
    pointers = newPointers;
    console.log(pointers);
  }

  // console.log(`got ${result.length} samples in ${(Date.now() - started) / 1000} seconds. pointers: `, pointers); //, result.map((r) => r.v2Output).join('\n'));

  const { client } = await getCollection('scidRecords');
  client.close();
})();
