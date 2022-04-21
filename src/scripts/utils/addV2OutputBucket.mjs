const bucketCount = 128;
const bucketWidth = 2 / bucketCount;

const getFilledArray = (length) =>
  Array(length)
    .fill(0)
    .map((e, i) => i);

const buckets = getFilledArray(bucketCount).map((index) => {
  const min = Number((-1 + index * bucketWidth).toFixed(3));
  const max = Number((min + bucketWidth).toFixed(3));

  const isFirst = index === 0;
  const isLast = index === bucketCount - 1;

  const minCondition = isFirst ? () => true : (num) => num >= min;
  const maxCondition = isLast ? () => true : (num) => num < max;

  const name = `${min}`;

  return { min, max, minCondition, maxCondition, name };
});

export const getBucket = (num) => {
  const bucket = buckets.find(({ minCondition, maxCondition }) => minCondition(num) && maxCondition(num));
  return bucket.name;
};

export const addV2OutputBucket = ({ record }) => {
  if (typeof record.v2OutputBucket === 'string') return record;

  return Object.assign({}, record, {
    v2OutputBucket: getBucket(record.v2Output),
  });
};
