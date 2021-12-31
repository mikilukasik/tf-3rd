const express = require('express');
const { readGames } = require('./src/utils/read-games');

const app = express();
const port = 3500;

const FOLDER_NAME = 'otb_2000+_chkmt/2000+chkmt';

app.use('/', express.static('./public'));
app.use('/dist', express.static('./dist'));

app.get('/games', async (req, res, next) => {
  const skip = Number(req.query.skip) ?? 0;
  const limit = Number(req.query.limit) ?? 1000;

  const { getNextGame } = await readGames({ folderName: req.query.folder || FOLDER_NAME, skip, limit });

  res.write('[');
  for (let i = 0; i < limit; i += 1) {
    const chunk = await getNextGame();
    if (!chunk.game) break;
    res.write(`${i > 0 ? ',' : ''}${JSON.stringify(chunk)}`);
  }
  res.write(']');
  res.end();
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
