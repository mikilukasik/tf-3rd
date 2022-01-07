const sf = require('stockfish')();
sf.onmessage = () => null;

const getVal = (str, label) => (str.match(new RegExp(`(^| )${label} (-?[a-z0-9.]+d*(.d+)?)($| )`)) || [])[2];
const getNumberVal = (...args) => Number(getVal(...args)) || null;

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
      sf.postMessage('go depth 4');
    }),
};
