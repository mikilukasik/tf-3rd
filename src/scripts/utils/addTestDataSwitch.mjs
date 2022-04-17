export const addTestDataSwitch = ({ record }) => {
  if (typeof record.testData === 'boolean') return record;

  return Object.assign({}, record, {
    testData: Math.random() > 0.9, // 10%
  });
};
