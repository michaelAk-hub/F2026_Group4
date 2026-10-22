/**
 * Database connection helpers (MongoDB through Mongoose).
 *
 * Mongoose keeps one shared connection for the whole app, so once
 * connectDB() succeeds every model (User, ParkingSpot, ...) can be used
 * anywhere without connecting again.
 */
const mongoose = require('mongoose');

async function connectDB(uri) {
  // Give up after 5 seconds if the database cannot be reached,
  // instead of waiting forever.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB };
