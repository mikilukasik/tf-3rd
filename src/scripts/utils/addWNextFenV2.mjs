import { getWhiteNextFen } from './getWNextFen.mjs';

export const addWNextFenV2 = (record) => ({
  ...record,

  ...(record.orig_fen.split(' ')[1] === 'w'
    ? {
        fen: record.orig_fen,
        wNextBalancesAhead: record.balancesAhead,
        wNextBalance: record.balance,
        wNextResult: record.origResult,
        won: record.origResult === 1,
        lost: record.origResult === -1,
      }
    : {
        fen: getWhiteNextFen({ fen: record.orig_fen }).fen,
        wNextBalancesAhead: record.balancesAhead.map((val) => val * -1),
        wNextBalance: record.balance * -1,
        wNextResult: record.origResult * -1,
        won: record.origResult === -1,
        lost: record.origResult === 1,
        w_rating: record.b_rating,
        b_rating: record.w_rating,
      }),
});
