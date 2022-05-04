import { createMongoIndexes } from './utils/createMongoIndexes.mjs';

// createMongoIndexes({
//   collectionName: 'scidGames',
//   indexes: [
//     {
//       'records.s': 1,
//     },
//     {
//       'records.o2b': 1,
//     },
//   ],
//   closeClient: true,
// });

createMongoIndexes({
  collectionName: 'scidRecords',
  indexes: [
    {
      s: 1,
    },
  ],
  closeClient: true,
});
