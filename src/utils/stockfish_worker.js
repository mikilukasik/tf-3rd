const sf = require('stockfish')();
sf.onmessage = () => null;

const getVal = (str, label) => (str.match(new RegExp(`(^| )${label} (-?[a-z0-9.]+d*(.d+)?)($| )`)) || [])[2];

const trimAndFillGaps = (_arr) => {
  const arr = _arr.slice(1);
  const keys = ['cp', 'mate', 'bmc'];

  let found1stElm = false;
  for (const [index, elm] of arr.entries()) {
    if (!elm && found1stElm) {
      let prevFilledIndex = index - 1;
      while (!arr[prevFilledIndex]) {
        prevFilledIndex -= 1;
        if (prevFilledIndex < 0) {
          console.log(1, _arr, arr, index, prevFilledIndex);
          // throw new Error('anyad');
        }
      }
      let nextFilledIndex = index + 1;
      while (!arr[nextFilledIndex]) {
        nextFilledIndex += 1;
        if (nextFilledIndex >= arr.length) {
          console.log(2, _arr, arr, index, nextFilledIndex);
          // throw new Error('apad');
        }
      }
      let updatingIndex = index;

      console.log({ arr, prevFilledIndex, nextFilledIndex, updatingIndex });
      while (!arr[updatingIndex]) {
        arr[updatingIndex] = keys.reduce(
          (estimatedLine, key) => {
            estimatedLine[key] = (arr[prevFilledIndex][key] + arr[nextFilledIndex][key]) / 2;
            return estimatedLine;
          },
          { estimated: true },
        );

        updatingIndex += 1;
      }
    }
    found1stElm = true;
  }

  return arr;
};

module.exports = {
  getStockfishEvalScore: (fen) =>
    new Promise((r) => {
      sf.onmessage = (msg) => {
        const s = msg.split(' ');
        if ([s[0], s[1], s[3], s[4]].join('-') === 'Total-evaluation:-(white-side)') {
          return r(s[2]);
        }
      };

      sf.postMessage('ucinewgame');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('eval');
    }),

  getStockfishSearchScore: (fen) =>
    new Promise((r) => {
      const result = {
        messages: [],
        scoresPerDepth: [],
      };

      sf.onmessage = (msg) => {
        // console.log(msg);
        result.messages.push(msg);

        if (msg.startsWith('info depth')) {
          result.scoresPerDepth[getVal(msg, 'seldepth') || getVal(msg, 'depth')] = {
            cp: Number(getVal(msg, 'cp')),
            mate: Number(getVal(msg, 'mate')),
            bmc: Number(getVal(msg, 'bmc')),
            pv: getVal(msg, 'pv'),
          };
        }

        if (msg.startsWith('bestmove')) {
          result.bestmove = getVal(msg, 'bestmove');
          result.ponder = getVal(msg, 'ponder');

          result.scoresPerDepth = trimAndFillGaps(result.scoresPerDepth);

          return r(result);
        }
      };

      sf.postMessage('ucinewgame');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('go depth 12');
    }),
};
