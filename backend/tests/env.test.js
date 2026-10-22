const fs = require('fs');
const path = require('path');
const { loadConfig, REQUIRED } = require('../src/config/env');

const valid = {
  PORT: '3000',
  MONGODB_URI: 'mongodb://localhost:27017/smart_parking',
  JWT_SECRET: 'x'.repeat(32),
  MQTT_URL: 'mqtt://localhost:1883',
};

describe('loadConfig', () => {
  test('TC-ENV-01: returns config when all variables are valid', () => {
    const config = loadConfig(valid);
    expect(config.port).toBe(3000);
    expect(config.mongodbUri).toBe(valid.MONGODB_URI);
    expect(config.mqttUrl).toBe(valid.MQTT_URL);
  });

  test('TC-ENV-02: throws and lists every missing variable', () => {
    expect(() => loadConfig({ PORT: '3000' }))
      .toThrow('Missing required environment variables: MONGODB_URI, JWT_SECRET, MQTT_URL');
  });

  test('TC-ENV-03: rejects an invalid PORT', () => {
    expect(() => loadConfig({ ...valid, PORT: 'abc' })).toThrow('PORT must be an integer');
    expect(() => loadConfig({ ...valid, PORT: '70000' })).toThrow('PORT must be an integer');
  });

  test('TC-ENV-04: rejects a JWT_SECRET shorter than 32 characters', () => {
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'short' })).toThrow('at least 32 characters');
  });

  test('TC-ENV-05: applies defaults for optional variables', () => {
    const config = loadConfig(valid);
    expect(config.nodeEnv).toBe('development');
    expect(config.jwtExpiresIn).toBe('1h');
  });

  test('TC-ENV-06: .env.example contains every required variable', () => {
    const example = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8');
    REQUIRED.forEach((key) => expect(example).toMatch(new RegExp(`^${key}=`, 'm')));
  });
});
