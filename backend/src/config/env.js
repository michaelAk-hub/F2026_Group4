// Loads and validates environment variables for the backend.
require('dotenv').config({ quiet: true });

// The server cannot start without these
const REQUIRED = ['PORT', 'MONGODB_URI', 'JWT_SECRET', 'MQTT_URL'];

// Checks the settings and returns them. Throws an error if something is wrong.
// (env can be passed in by the tests, otherwise it is read from .env)
function loadConfig(env = process.env) {
  // Find every required variable that is missing or empty
  const missing = REQUIRED.filter((key) => !env[key] || env[key].trim() === '');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // PORT must be a whole number between 1 and 65535
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  // A short secret is easy to guess
  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

  // Optional values get a default
  return {
    port,
    nodeEnv: env.NODE_ENV || 'development',
    mongodbUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN || '1h',
    mqttUrl: env.MQTT_URL,
  };
}

module.exports = { loadConfig, REQUIRED };
