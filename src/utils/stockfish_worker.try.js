const sf = require('stockfish')();

const depth = 2;

module.exports = {
  getStockfishScore: (fen) =>
    new Promise((r) => {
      let lastScore;
      sf.onmessage = (msg) => {
        console.log(msg);

        // console.log(msg);
        if (msg.startsWith('bestmove'))
          return setTimeout(() => {
            r(lastScore);
          }, 1000);
        // const s = msg.split(' ');
        // if ([s[0], s[1], s[3], s[4]].join('-') === 'Total-evaluation:-(white-side)') {
        //   return r(s[2]);
        // }

        // lastScore = r(s[9]);
        const matchedScore = msg.match(/score cp (-?\d+) /);
        if (matchedScore) lastScore = matchedScore[1];

        // if (s[0] === 'bestMove') {
        //   return r(lastScore);
        // }
      };

      sf.postMessage('ucinewgame');
      sf.postMessage(`position fen ${fen}`);
      sf.postMessage(`go depth ${depth}`);
      // sf.postMessage('eval');
    }),

  // sf.onmessage = (e) => console.log(11111, e);

  // sf.onmessage = (msg) => {
  //   const s = msg.split(' ');
  //   if ([s[0], s[1], s[3], s[4]].join('-') === 'Total-evaluation:-(white-side)') {
  //     console.log(s[2])
  //   }
  // }

  // sf.postMessage('ucinewgame')
  // sf.postMessage('position fen k7/8/pQ6/8/8/8/8/K7 w - 0 1')
  // sf.postMessage('eval')
  // sf.postMessage('go depth 20')

  // console.log(sf)
};
