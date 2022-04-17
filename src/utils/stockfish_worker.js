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

  getStockfishSearchScore: (fen, depth = 10) =>
    new Promise((r) => {
      const result = {
        messages: [],
        scoresPerDepth: [],
        scoresPerSelDepth: [],
      };

      sf.onmessage = (msg) => {
        // console.log(msg);

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
      sf.postMessage(`go depth ${depth}`);
    }),

  getStockfishNextFen: (fen, depth = 10) =>
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
      sf.postMessage(`go depth ${depth}`);
    }),

  getStockfishAllMoves: (fen) =>
    new Promise((r) => {
      sf.onmessage = (msg) => {
        if (msg.startsWith('Legal uci moves: ')) {
          return r(msg.replace('Legal uci moves: ', '').trim().split(' ').filter(Boolean));
        }
      };

      sf.postMessage('ucinewgame');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('d');
    }),

  getStockfishPerft: (fen, depth) =>
    new Promise((r) => {
      sf.onmessage = (msg) => {
        if (msg.startsWith('Nodes searched: ')) {
          return r(Number(msg.replace('Nodes searched: ', '')));
        }
      };

      sf.postMessage('ucinewgame');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage(`go perft ${depth}`);
    }),

  getMovedFen: (move, fen) =>
    new Promise((r) => {
      let fenToReturn;
      sf.onmessage = (msg) => {
        if (msg.startsWith('Legal uci moves: ')) {
          return r(fenToReturn);
        }

        if (msg.startsWith('Fen: ')) {
          fenToReturn = msg.replace('Fen: ', '').trim();
        }
      };

      sf.postMessage(`position fen ${fen} moves ${move}`);
      sf.postMessage('d');
    }),
};
