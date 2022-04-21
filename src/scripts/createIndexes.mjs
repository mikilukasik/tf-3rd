import { createMongoIndexes } from './utils/createMongoIndexes.mjs';

// createMongoIndexes({
//   collectionName: 'scidGames',
//   indexes: [
//     {
//       'records.wNextFen': 1,
//       'records.mirrored': 1,
//       'records.rnds': 1,
//     },
//   ],
//   closeClient: true,
// });

createMongoIndexes({
  collectionName: 'scidRecords',
  indexes: [
    {
      v2OutputBucket2: 1,
      rnd0: 1,
      testData: 1,
    },
  ],
  closeClient: true,
});
