import * as fs from 'fs';
import { movesToOneHotV3, oneHotToMovesV3 } from './utils/oneHotMovesMapV3.mjs';

fs.writeFileSync('./movesToOneHotMapV3.json', JSON.stringify(movesToOneHotV3, null, 2), 'utf-8');
fs.writeFileSync('./oneHotToMovesMapV3.json', JSON.stringify(oneHotToMovesV3, null, 2), 'utf-8');
