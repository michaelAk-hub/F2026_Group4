/**
 * Test helpers: a temporary MongoDB that lives only in memory.
 *
 * Tests create and delete users freely, so they must never touch the
 * real database. mongodb-memory-server starts a throw-away MongoDB for
 * the tests and removes it at the end.
 */
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongod;

// Start the in-memory database and connect Mongoose to it.
async function startTestDB() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

// Empty every collection, so each test starts from a clean database.
async function clearTestDB() {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

// Disconnect and shut the in-memory database down.
async function stopTestDB() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

module.exports = { startTestDB, clearTestDB, stopTestDB };
