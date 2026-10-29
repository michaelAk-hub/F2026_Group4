// Tests for register, login and the token check. Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const Account = require('../src/models/Account');
const Administrator = require('../src/models/administrator');
const User = require('../src/models/User');
const { requireAuth, requireRole } = require('../src/middleware/auth');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// The same values the register form sends
const form = {
  name: 'Maria Driver',
  email: 'Maria@Example.com',
  password: 'secret123',
  confirmPassword: 'secret123',
  carNumber: 'kab 123',
};

describe('Auth API', () => {
  beforeAll(startTestDB);
  afterEach(clearTestDB);
  afterAll(stopTestDB);

  test('register creates a driver and an account', async () => {
    const res = await request(app).post('/api/auth/register').send(form);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('maria@example.com');
    expect(res.body.user.carNumber).toBe('KAB 123');

    // the password is saved only as a hash
    const account = await Account.findOne({ accountEmail: 'maria@example.com' }).select('+accountPasswordHash');
    expect(account.accountPasswordHash).not.toBe('secret123');
    expect(JSON.stringify(res.body)).not.toContain('secret123');
  });

  test('register with the same email returns 409', async () => {
    await request(app).post('/api/auth/register').send(form);
    const res = await request(app).post('/api/auth/register').send(form);
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This email is already registered.');
  });

  test('register checks the password rule', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...form, password: 'short', confirmPassword: 'short' });
    expect(res.status).toBe(400);
  });

  test('register checks that the passwords match', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...form, confirmPassword: 'other1234' });
    expect(res.status).toBe(400);
  });

  test('register without a car number returns 400 and saves nothing (RQ02)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...form, carNumber: '' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Car number is required');
    expect(await User.countDocuments()).toBe(0);
  });

  test('register works without confirmPassword (the frontend checks it and does not send it)', async () => {
    const { confirmPassword, ...sent } = form;
    const res = await request(app).post('/api/auth/register').send(sent);
    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Account created');
  });

  test('register with a wrong car number returns the same message as the form', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...form, carNumber: 'AB 12' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Use 3 letters and 3 numbers: ABC123 or ABC 123');
    expect(await User.countDocuments()).toBe(0);
  });

  test('register with a bad email does not leave a driver without an account', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...form, email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });

  test('login returns a token and the role driver', async () => {
    await request(app).post('/api/auth/register').send(form);
    const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'secret123' });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe('driver');
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).role).toBe('driver');
  });

  test('login returns the role admin for an administrator account', async () => {
    const admin = await Administrator.create({});
    await Account.create({
      accountEmail: 'admin@parking.com',
      accountPasswordHash: await bcrypt.hash('admin1234', 10),
      administratorID: admin._id,
    });

    const res = await request(app).post('/api/auth/login').send({ email: 'admin@parking.com', password: 'admin1234' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('admin');
  });

  test('login with a wrong password returns 401', async () => {
    await request(app).post('/api/auth/register').send(form);
    const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'wrong1234' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Incorrect email or password.'); // api.js shows this to the user
    expect(res.body.token).toBeUndefined();
  });

  test('login with an unknown email returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'secret123' });
    expect(res.status).toBe(401);
  });

  test('login without a password returns 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('requireAuth and requireRole', () => {
  // A small app with one page for drivers only
  const testApp = express();
  testApp.get('/driver-page', requireAuth, requireRole('driver'), (req, res) => res.json({ ok: true }));

  const tokenFor = (role) => jwt.sign({ accountId: 'abc', role }, process.env.JWT_SECRET);

  test('no token returns 401', async () => {
    const res = await request(testApp).get('/driver-page');
    expect(res.status).toBe(401);
  });

  test('a bad token returns 401', async () => {
    const res = await request(testApp).get('/driver-page').set('Authorization', 'Bearer not-a-token');
    expect(res.status).toBe(401);
  });

  test('the wrong role returns 403 (RQ24)', async () => {
    const res = await request(testApp).get('/driver-page').set('Authorization', 'Bearer ' + tokenFor('admin'));
    expect(res.status).toBe(403);
  });

  test('the right role can open the page', async () => {
    const res = await request(testApp).get('/driver-page').set('Authorization', 'Bearer ' + tokenFor('driver'));
    expect(res.status).toBe(200);
  });
});
