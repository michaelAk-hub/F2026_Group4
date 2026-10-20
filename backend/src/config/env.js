// Loads .env once and exposes the settings the app needs.
require('dotenv').config({ quiet: true });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5050, // 5000 is taken by AirPlay on macOS
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_parking',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

module.exports = env;
