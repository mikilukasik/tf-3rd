import { getWhiteNextFen } from './getWNextFen.mjs';

export const addWNextFen = ({ record, doc }) => {
  if (typeof record.wNextFen === 'string') return record;

  return Object.assign(
    {},
    record,
    record.fen.split(' ')[1] === 'w'
      ? {
          wNextFen: record.fen,
          wNextResult: doc.result,
          wNextBalancesAhead: record.balancesAhead,
          wNextBalance: record.balance,
        }
      : {
          wNextFen: getWhiteNextFen({ fen: record.fen }).fen,
          wNextResult: doc.result * -1,
          wNextBalancesAhead: record.balancesAhead.map((val) => val * -1),
          wNextBalance: record.balance * -1,
        },
  );
};
