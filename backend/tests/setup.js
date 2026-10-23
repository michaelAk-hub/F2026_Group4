const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

// The tests use a temporary database in memory, not the real one.
let mongod;

// Start the test database and connect to it
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

// Close the connection and stop the test database
async function stopTestDB() {
  await mongoose.disconnect();
  await mongod.stop();
}

module.exports = { startTestDB, clearTestDB, stopTestDB };
