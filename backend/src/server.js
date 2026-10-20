const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

async function start() {
  try {
    await connectDB(env.mongoUri);
  } catch (err) {
    console.error(`Could not connect to MongoDB at ${env.mongoUri}: ${err.message}`);
    process.exit(1);
  }

  const server = app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
