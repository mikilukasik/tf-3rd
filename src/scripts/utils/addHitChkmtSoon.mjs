const smoothen = (arr) => {
  const smoothArr = arr.slice();

  let i = 0;
  while (i++ < arr.length - 2) {
    if (Math.abs(arr[i - 1] - arr[i + 1]) < 75) smoothArr[i] = (arr[i - 1] + arr[i + 1]) / 2;
  }

  return smoothArr;
};

const reduceAndDivideBalanceArray = (arr) => arr.slice(2).reduce((p, c, i) => p + c / Math.pow(1.25, i), 0) / 10000;

// const balanceFiller = result * 10000;
// const balanceDiffsAhead = balancesAhead.concat(Array(16).fill(balanceFiller)).map((bal) => bal - balancesAhead[0]);
// const smootherBalancesArray = smoothen(balanceDiffsAhead);

// const chkMtSoonArr = Array(balancesAhead.length).fill(0).concat(Array(16).fill(balanceFiller));
// const smootherChkMtSoonArr = smoothen(chkMtSoonArr);

const getBalanceScore = ({ result, balancesAhead, chkmate_ending, stall_ending, move_index, total_moves }) => {
  const balanceDiffsAhead = balancesAhead.concat(result === 0 ? [0] : []).map((bal) => bal - balancesAhead[0]);

  const lastVal = balanceDiffsAhead[balanceDiffsAhead.length - 1];
  const balanceFiller = lastVal + result * 1500;
  const hitOrWinArray = balanceDiffsAhead.concat(Array(16).fill(balanceFiller));
  const hitSoonArray = balanceDiffsAhead.concat(Array(16).fill(lastVal));
  // const smootherBalancesArray = smoothen(hitOrWinArray);

  const chkMtSoonArr = Array(balancesAhead.length)
    .fill(0)
    .concat(Array(16).fill(result * 1500));

  let hits_left = 0;
  balancesAhead.forEach((ba, i) => {
    if (i === 0) return;
    if (ba !== balancesAhead[i - 1]) hits_left += 1;
  });

  // const smallBalAhead = balancesAhead.map((n) => Math.round(n / 100));

  const extendedSBalAhead = balancesAhead.concat(
    chkmate_ending || stall_ending
      ? new Array(20).fill(stall_ending ? 0 : balancesAhead[balancesAhead.length - 1] + 1500 * Number(result))
      : [],
  );

  const balAhead = smoothen(extendedSBalAhead).map((n) => Math.round(n / 100));

  const nextBalanceDistance = balAhead.findIndex((b) => b !== balAhead[0]);

  const nextBalance = nextBalanceDistance === -1 ? '' : balAhead[nextBalanceDistance];

  // if (chkmate_ending && move_index / total_moves > 0.97)
  //   console.log({ balancesAhead, extendedSBalAhead, balAhead, nextBalanceDistance, nextBalance });

  // console.log({ balAhead, balancesAhead });

  // console.log(balAhead.join(','));

  return {
    hits_left,
    hit_or_win_soon: reduceAndDivideBalanceArray(smoothen(hitOrWinArray)),
    hit_soon: reduceAndDivideBalanceArray(smoothen(hitSoonArray)),
    chkmate_soon: reduceAndDivideBalanceArray(smoothen(chkMtSoonArr)),
    balAhead, //: balancesAhead,
    nextBalance,
    nextBalanceDistance,
  };
};

export const addHitChkmtSoon = (record) => ({
  ...record,
  ...getBalanceScore({ ...record, result: record.wNextResult, balancesAhead: record.wNextBalancesAhead }),
});
