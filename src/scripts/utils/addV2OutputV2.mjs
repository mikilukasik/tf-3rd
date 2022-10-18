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

const getBalanceScore = ({ result, balancesAhead }) => {
  const balanceDiffsAhead = balancesAhead.concat(result === 0 ? [0] : []).map((bal) => bal - balancesAhead[0]);

  const balanceFiller = balanceDiffsAhead[balanceDiffsAhead.length - 1] + result * 1500;
  const extendedArr = balanceDiffsAhead.concat(Array(16).fill(balanceFiller));
  const smootherBalancesArray = smoothen(extendedArr);

  const chkMtSoonArr = Array(balancesAhead.length)
    .fill(0)
    .concat(Array(16).fill(result * 1500));
  const smootherChkMtSoonArr = smoothen(chkMtSoonArr);

  let hits_left = 0;
  balancesAhead.forEach((ba, i) => {
    if (i === 0) return;
    if (ba !== balancesAhead[i - 1]) hits_left += 1;
  });

  return {
    hits_left,
    hit_soon: reduceAndDivideBalanceArray(smootherBalancesArray),
    chkmate_soon: reduceAndDivideBalanceArray(smootherChkMtSoonArr),
  };
};

export const addV2OutputV2 = (record) => ({
  ...record,
  ...getBalanceScore({ result: record.wNextResult, balancesAhead: record.wNextBalancesAhead }),
});
