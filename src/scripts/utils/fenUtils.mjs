export const expandGroupedBlanks = (rowStr) => {
  let result = rowStr;
  for (const char of rowStr) if (Number(char)) result = result.replace(char, '1'.repeat(Number(char)));
  return result;
};

export const mergeBlanks = (rowStr) => rowStr.replace(/[1]+/g, (blanks) => blanks.length);
