/**
 * Entry point of the backend (what `npm start` / `npm run dev` runs).
 *
 * Order matters:
 *  1. connect to MongoDB
 *  2. only if that works, start listening for HTTP requests
 * so the API never answers requests while the database is missing.
 */
const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');

async function start() {
  // 1. Connect to the database. If MongoDB is not running we stop the
  //    program with a clear message instead of a long error trace.
  try {
    await connectDB(env.mongoUri);
  } catch (err) {
    console.error(`Could not connect to MongoDB at ${env.mongoUri}: ${err.message}`);
    process.exit(1); // exit code 1 = "stopped because of an error"
  }

  // 2. Start the web server on the configured port (5050 by default).
  const server = app.listen(env.port, () => {
    console.log(`API running on http://localhost:${env.port}/api (${env.nodeEnv})`);
  });

  // 3. Clean shutdown: when the server is stopped (Ctrl+C = SIGINT, or the
  //    hosting platform sends SIGTERM) close the server and the database
  //    connection properly before exiting.
  const shutdown = async () => {
    server.close();
    await disconnectDB();
    process.exit(0); // exit code 0 = "stopped normally"
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
