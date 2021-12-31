const sf = require('stockfish')();
sf.onmessage = () => {};

module.exports = {
  getStockfishScore: (fen) =>
    new Promise((r) => {
      sf.onmessage = (msg) => {
        // console.log(msg)
        const s = msg.split(' ');
        if ([s[0], s[1], s[3], s[4]].join('-') === 'Total-evaluation:-(white-side)') {
          return r(s[2]);
        }
      };

      sf.postMessage('ucinewgame');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage('eval');
    }),
};
