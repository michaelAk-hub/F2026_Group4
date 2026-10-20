const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const { startTestDB, stopTestDB } = require('./setup');

describe('API skeleton', () => {
  it('GET /api/health reports 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 503);
    assert.equal(res.body.database, 'disconnected');
  });

  it('GET /api/health reports ok when the database is connected', async () => {
    await startTestDB();
    try {
      assert.equal(mongoose.connection.readyState, 1);
      const res = await request(app).get('/api/health');
      assert.equal(res.status, 200);
      assert.equal(res.body.status, 'ok');
      assert.equal(res.body.database, 'connected');
    } finally {
      await stopTestDB();
    }
  });

  it('unknown routes return 404 JSON', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.match(res.body.error, /Route not found/);
  });
});
