export const getXs = ({ fens }) => {
  const expandedFens = fens.map((fen) => {
    if (!fen) return Array(64).fill(Array(12).fill(0));

    const [board] = fen.split(' ');
    const arr = [];
    board.split('').forEach((char) => {
      switch (char) {
        case 'p':
          arr.push([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
          break;
        case 'b':
          arr.push([0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
          break;
        case 'n':
          arr.push([0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
          break;
        case 'r':
          arr.push([0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
          break;
        case 'q':
          arr.push([0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0]);
          break;
        case 'k':
          arr.push([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
          break;

        case 'P':
          arr.push([0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0]);
          break;
        case 'B':
          arr.push([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]);
          break;
        case 'N':
          arr.push([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]);
          break;
        case 'R':
          arr.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0]);
          break;
        case 'Q':
          arr.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
          break;
        case 'K':
          arr.push([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
          break;

        case '/':
          break;

        default:
          for (let emptyIndex = 0; emptyIndex < Number(char); emptyIndex += 1) arr.push(Array(12).fill(0));
      }
    });
    return arr;
  });

  return new Array(64)
    .fill(0)
    .map((elm, index) => [
      ...expandedFens.map((expandedFen) => expandedFen[index]).flat(),
      // getLmVal(lmf, index),
      // getLmVal(lmt, index),
    ])
    .flat();
};
