import * as fs from 'fs';
import { movesToOneHotV2, oneHotToMovesV2 } from './utils/oneHotMovesMapV2.mjs';

fs.writeFileSync('./movesToOneHotMapV2.json', JSON.stringify(movesToOneHotV2, null, 2), 'utf-8');
fs.writeFileSync('./oneHotToMovesMapV2.json', JSON.stringify(oneHotToMovesV2, null, 2), 'utf-8');
