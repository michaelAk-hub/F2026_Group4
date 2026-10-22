const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// The tests use a temporary database in memory, not the real one.
let mongod;

async function startTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

// Delete all data between tests
async function clearTestDB() {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
}

async function stopTestDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

module.exports = { startTestDB, clearTestDB, stopTestDB };
