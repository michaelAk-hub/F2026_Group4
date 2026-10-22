// Load the settings from the .env file (see .env.example)
require('dotenv').config({ quiet: true });

module.exports = {
  port: process.env.PORT || 5050, // 5000 is used by AirPlay on Mac
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_parking',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
