// In-memory MongoDB so tests never touch the real database.
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

async function startTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function clearTestDB() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

async function stopTestDB() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { startTestDB, clearTestDB, stopTestDB };
