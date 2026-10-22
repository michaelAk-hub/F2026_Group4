// Tests for the health check and the 404 page. Run with: npm test
const { describe, it } = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/app');
const { startTestDB, stopTestDB } = require('./setup');

describe('API', () => {
  it('health returns 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/health');
    assert.strictEqual(res.status, 503);
    assert.strictEqual(res.body.database, 'disconnected');
  });

  it('health returns ok when the database is connected', async () => {
    await startTestDB();
    const res = await request(app).get('/api/health');
    await stopTestDB();

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, 'ok');
  });

  it('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.strictEqual(res.status, 404);
  });
});
