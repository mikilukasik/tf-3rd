const { getStockfishScore } = require("./stockfish_worker")

const fen = '8/6p1/6kp/b7/P7/8/3rp3/K7 w'

getStockfishScore(fen).then(console.log, console.error)