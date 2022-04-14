import { MongoClient } from 'mongodb';
import pkg1 from '../utils/stockfish_worker.js';
const { getStockfishSearchScore, getMovedFen } = pkg1;

const client = new MongoClient('mongodb://0.0.0.0:27017');
let db;

const collections = {};

const connect = async () => {
  await client.connect();
  db = client.db('chss');
};

const getCollection = async (collecitonName) => {
  if (collections[collecitonName]) return collections[collecitonName];
  if (!db) await connect();
  collections[collecitonName] = db.collection(collecitonName);
  return collections[collecitonName];
};

const updateRecord = async ({ doc, completed, addedFens }) => {
  if (typeof completed !== 'boolean') throw new Error(`typeof completed: ${typeof completed}`);

  const collection = await getCollection('scidGames');
  await collection.updateOne({ _id: doc._id }, { $set: addedFens ? { completed, addedFens } : { completed } });
};

const processDoc = async ({ doc }) => {
  const { records } = doc;
  let fen = records[records.length - 1].fen;

  const addedFens = [];

  for (let i = 0; i < 100; i += 1) {
    const { bestmove } = await getStockfishSearchScore(fen, 14);
    if (!bestmove) {
      await updateRecord({ doc, addedFens, completed: true });
      return;
    }

    fen = await getMovedFen(bestmove, fen);
    addedFens.push(fen);
  }

  await updateRecord({ doc, addedFens, completed: false });
};

const run = async () => {
  const collection = await getCollection('scidGames');
  const cursor = collection.find({ completed: false, result: { $in: [-1, 1] }, addedFens: { $exists: false } });

  // const length = await cursor.count();
  // console.log({ length });

  let processedCount = 0;
  let erroredCount = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const doc = await cursor.next();
    if (!doc) break;
    try {
      await processDoc({ doc });
      processedCount += 1;
    } catch (e) {
      console.error(e);
      erroredCount += 1;
    }
    if (Math.random() > 0.99) console.log(`processed ${processedCount} docs. (${erroredCount} errors)`);
  }

  client.close();
};

run();
