const sf = require('stockfish')();
sf.onmessage = () => null;

const getVal = (str, label) => (str.match(new RegExp(`(^| )${label} (-?[a-z0-9.]+d*(.d+)?)($| )`)) || [])[2];
const getNumberVal = (...args) => Number(getVal(...args)) || null;

// const trimAndFillGaps = (_arr) => {
//   const arr = _arr.slice(1);
//   // const keys = ['cp', 'mate', 'bmc'];

//   // let found1stElm = false;
//   // for (const [index, elm] of arr.entries()) {
//   //   if (!elm && found1stElm) {
//   //     let prevFilledIndex = index - 1;
//   //     while (!arr[prevFilledIndex]) {
//   //       if (prevFilledIndex === 0) {
//   //         arr[0] = { cp: 0, mate: NaN, bmc: 0, estimated: true };
//   //         break;
//   //       }
//   //       prevFilledIndex -= 1;
//   //       if (prevFilledIndex < 0) {
//   //         console.warn(1, _arr, arr, index, prevFilledIndex);
//   //       }
//   //     }
//   //     let nextFilledIndex = index + 1;
//   //     while (!arr[nextFilledIndex]) {
//   //       nextFilledIndex += 1;
//   //       if (nextFilledIndex >= arr.length) {
//   //         console.warn(2, _arr, arr, index, nextFilledIndex);
//   //       }
//   //     }

//   //     let updatingIndex = index;
//   //     while (!arr[updatingIndex]) {
//   //       arr[updatingIndex] = keys.reduce(
//   //         (estimatedLine, key) => {
//   //           estimatedLine[key] = (arr[prevFilledIndex][key] + arr[nextFilledIndex][key]) / 2;
//   //           return estimatedLine;
//   //         },
//   //         { estimated: true },
//   //       );

//   //       updatingIndex += 1;
//   //     }
//   //   }
//   //   found1stElm = true;
//   // }

//   return arr;
// };

module.exports = {
  getStockfishEvalScore: (fen) =>
    new Promise((r) => {
      sf.onmessage = (msg) => {
        const s = msg.split(' ');
        if ([s[0], s[1], s[3], s[4]].join('-') === 'Total-evaluation:-(white-side)') {
          return r(Number(s[2]));
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
        scoresPerSelDepth: [],
      };

      sf.onmessage = (msg) => {
        result.messages.push(msg);

        if (msg.startsWith('info depth')) {
          result.scoresPerDepth[getVal(msg, 'depth')] = {
            cp: getNumberVal(msg, 'cp'),
            mate: getNumberVal(msg, 'mate'),
            bmc: getNumberVal(msg, 'bmc'),
            pv: getVal(msg, 'pv'),
          };

          result.scoresPerSelDepth[getVal(msg, 'seldepth')] = {
            cp: getNumberVal(msg, 'cp'),
            mate: getNumberVal(msg, 'mate'),
            bmc: getNumberVal(msg, 'bmc'),
            pv: getVal(msg, 'pv'),
          };

          getVal(msg, 'seldepth') || getVal(msg, 'depth');
        }

        if (msg.startsWith('bestmove')) {
          result.bestmove = getVal(msg, 'bestmove');
          result.ponder = getVal(msg, 'ponder');

          result.scoresPerDepth = result.scoresPerDepth.slice(1);
          result.scoresPerSelDepth = result.scoresPerSelDepth.slice(1);

          return r(result);
        }
      };

      true;

      sf.postMessage('setoption name Ponder value false');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('go depth 8');
    }),
};
