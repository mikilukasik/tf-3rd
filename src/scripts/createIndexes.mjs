import { createMongoIndexes } from './utils/createMongoIndexes.mjs';

const indexes = [
  {
    'records.wNextFen': 1,
    'records.mirrored': 1,
    'records.rnds': 1,
  },
];

createMongoIndexes({
  collectionName: 'scidGames',
  indexes,
  closeClient: true,
});
