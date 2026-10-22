// Loads and validates environment variables for the backend.
require('dotenv').config({ quiet: true });

const REQUIRED = ['PORT', 'MONGODB_URI', 'JWT_SECRET', 'MQTT_URL'];

function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((key) => !env[key] || env[key].trim() === '');
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  if (env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters');
  }

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
