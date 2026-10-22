const app = require('./app');
const env = require('./config/env');
const { connectDB } = require('./config/db');

// First connect to the database, then start the server.
async function start() {
  try {
    await connectDB(env.mongoUri);
  } catch (err) {
    console.error('Could not connect to MongoDB:', err.message);
    process.exit(1);
  }

  app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}/api`);
  });
}

start();
