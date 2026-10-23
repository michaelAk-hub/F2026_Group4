// Tests for the health check and the 404 page. Run with: npm test
const request = require('supertest');
const app = require('../src/app');
const { startTestDB, stopTestDB } = require('./setup');

describe('API', () => {
  test('health returns 503 when the database is not connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body.database).toBe('disconnected');
  });

  test('health returns ok when the database is connected', async () => {
    await startTestDB();
    const res = await request(app).get('/api/health');
    await stopTestDB();

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});
