/**
 * Settings of the app, read from environment variables.
 *
 * dotenv copies the values from the .env file into process.env.
 * .env is private to each computer and is NOT committed to GitHub
 * (see .gitignore); .env.example shows which values exist.
 * If a value is missing, the default after || is used.
 */
require('dotenv').config({ quiet: true });

const env = {
  // "development" on our laptops, "production" on the hosting server.
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5050, // 5000 is taken by AirPlay on macOS
  // Address of the MongoDB database: local by default, or a MongoDB Atlas URI.
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_parking',
  // Which website may call the API from the browser ("*" = any, dev only).
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

module.exports = env;
