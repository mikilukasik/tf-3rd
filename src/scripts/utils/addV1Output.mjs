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

  const balanceFiller = balanceDiffsAhead[balanceDiffsAhead.length - 1] + result * 2500;
  const extendedArr = balanceDiffsAhead.concat(Array(16).fill(balanceFiller)).slice(2);
  const smootherBalancesArray = smoothen(extendedArr);

  return smootherBalancesArray.reduce((p, c, i) => p + c / Math.pow(1.25, i), 0) / 25000;
};

export const addV1Output = ({ record }) => {
  if (typeof record.v1Output === 'number') return record;

  return Object.assign({}, record, {
    v1Output: getBalanceScore({ result: record.wNextResult, balancesAhead: record.wNextBalancesAhead }),
  });
};
