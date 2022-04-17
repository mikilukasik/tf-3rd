import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://0.0.0.0:27017');
let db;

const collections = {};

const connect = async () => {
  await client.connect();
  db = client.db('chss');
};

export const getCollection = async (collecitonName) => {
  if (collections[collecitonName]) return { collection: collections[collecitonName], client, db };
  if (!db) await connect();
  collections[collecitonName] = db.collection(collecitonName);
  return { collection: collections[collecitonName], client, db };
};
