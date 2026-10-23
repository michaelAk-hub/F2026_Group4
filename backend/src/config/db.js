const mongoose = require('mongoose');

// Connect to MongoDB (stop trying after 5 seconds)
async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log('MongoDB connected');
}

module.exports = { connectDB };
