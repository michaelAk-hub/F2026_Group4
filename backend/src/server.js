const app = require('./app');
const { loadConfig } = require('./config/env');
const { connectDB } = require('./config/db');

// First check the settings, then connect to the database, then start the server.
async function start() {
  try {
    const config = loadConfig();
    await connectDB(config.mongodbUri);

    app.listen(config.port, () => {
      console.log(`API running on http://localhost:${config.port}/api`);
    });
  } catch (err) {
    console.error('Could not start the server:', err.message);
    process.exit(1);
  }
}

start();
