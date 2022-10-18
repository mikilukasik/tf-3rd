import { getWhiteNextFen } from './getWNextFen.mjs';

export const addWNextFenV2 = (record) => ({
  ...record,

  ...(record.orig_fen.split(' ')[1] === 'w'
    ? {
        fen: record.orig_fen,
        wNextBalancesAhead: record.balancesAhead,
        wNextBalance: record.balance,
        wNextResult: record.origResult,
      }
    : {
        fen: getWhiteNextFen({ fen: record.orig_fen }).fen,
        wNextBalancesAhead: record.balancesAhead.map((val) => val * -1),
        wNextBalance: record.balance * -1,
        wNextResult: record.origResult * -1,
      }),
});
