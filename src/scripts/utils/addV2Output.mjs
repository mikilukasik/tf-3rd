const smoothen = (arr) => {
  const smoothArr = arr.slice();

  let i = 0;
  while (i++ < arr.length - 2) {
    if (Math.abs(arr[i - 1] - arr[i + 1]) < 75) smoothArr[i] = (arr[i - 1] + arr[i + 1]) / 2;
  }

  return smoothArr;
};

const getBalanceScore = ({ result, balancesAhead }) => {
  const balanceDiffsAhead = balancesAhead.map((bal) => bal - balancesAhead[0]);

  const balanceFiller = balanceDiffsAhead[balanceDiffsAhead.length - 1] + result * 1500;
  const extendedArr = balanceDiffsAhead.concat(Array(16).fill(balanceFiller));
  const smootherBalancesArray = smoothen(extendedArr);

  return smootherBalancesArray.slice(2).reduce((p, c, i) => p + c / Math.pow(1.25, i), 0) / 10000;
};

export const addV2Output = ({ record }) => {
  if (typeof record.v2Output === 'number') return record;

  return Object.assign({}, record, {
    v2Output: getBalanceScore({ result: record.wNextResult, balancesAhead: record.wNextBalancesAhead }),
  });
};
