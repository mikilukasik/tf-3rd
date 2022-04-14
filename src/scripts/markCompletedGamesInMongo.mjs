import { MongoClient } from 'mongodb';
import pkg1 from '../utils/stockfish_worker.js';
const { getStockfishSearchScore } = pkg1;

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

const markAsCompleted = async ({ doc, completed = true }) => {
  const collection = await getCollection('scidGames');
  await collection.updateOne({ _id: doc._id }, { $set: { completed } });
};

const processDoc = async ({ doc }) => {
  const { records } = doc;
  const lastFen = records[records.length - 1].fen;
  const stockFishResult = await getStockfishSearchScore(lastFen, 2);
  const { bestmove } = stockFishResult;
  if (!bestmove) {
    await markAsCompleted({ doc });
    return;
  }

  await markAsCompleted({ doc, completed: false });
};

const run = async () => {
  const collection = await getCollection('scidGames');
  const cursor = collection.find({ completed: { $exists: false } });

  const length = await cursor.count();
  console.log({ length });

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
    if (Math.random() > 0.99) console.log(`processed ${processedCount}/${length} docs. (${erroredCount} errors)`);
  }

  client.close();
};

run();
