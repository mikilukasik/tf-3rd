import * as fs from 'fs';
import { movesToOneHot, oneHotToMoves } from './utils/oneHotMovesMap.mjs';

fs.writeFileSync('./movesToOneHotMap.json', JSON.stringify(movesToOneHot, null, 2), 'utf-8');
fs.writeFileSync('./oneHotToMovesMap.json', JSON.stringify(oneHotToMoves, null, 2), 'utf-8');
