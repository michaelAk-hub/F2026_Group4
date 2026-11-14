// Tests for the profile endpoints GET /api/me and PUT /api/me (Member 5, Week 5). Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const User = require('../src/models/User');
const Account = require('../src/models/Account');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const PASSWORD = 'secret123';

// Register a driver and log in, like the frontend does. Returns the token.
async function driver(email = 'maria@example.com', carNumber = 'KAB 123') {
  await request(app).post('/api/auth/register').send({ name: 'Maria Driver', email, password: PASSWORD, carNumber });
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return res.body.token;
}

const getMe = (token) => request(app).get('/api/me').set('Authorization', 'Bearer ' + token);
const putMe = (token, body) => request(app).put('/api/me').set('Authorization', 'Bearer ' + token).send(body);

describe('Profile API (/api/me)', () => {
  let token;

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    token = await driver();
  });
  afterEach(clearTestDB);

  test('TC-MK43: a driver sees their own profile, without the password (RQ12, RQ23)', async () => {
    const res = await getMe(token);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: 'Maria Driver', email: 'maria@example.com', carNumber: 'KAB 123', paymentMethod: null });
    expect(JSON.stringify(res.body)).not.toMatch(/password|hash/i);
  });

  test('TC-MK44: without login 401, and an administrator gets 403 (RQ24)', async () => {
    const adminToken = jwt.sign({ accountId: 'abc', role: 'admin' }, process.env.JWT_SECRET);

    expect((await request(app).get('/api/me')).status).toBe(401);
    expect((await request(app).put('/api/me').send({ name: 'X' })).status).toBe(401);
    expect((await getMe(adminToken)).status).toBe(403);
  });

  test('TC-MK45: the driver changes name, car number and email; the new email logs in (RQ12)', async () => {
    const res = await putMe(token, { name: '  Maria Antoniou ', carNumber: 'abc 456', email: ' New.Maria@Example.com ' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Profile updated.');
    expect(res.body.user).toMatchObject({ name: 'Maria Antoniou', carNumber: 'ABC 456', email: 'new.maria@example.com' });
    expect((await getMe(token)).body.user.email).toBe('new.maria@example.com');

    const newLogin = await request(app).post('/api/auth/login').send({ email: 'new.maria@example.com', password: PASSWORD });
    const oldLogin = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: PASSWORD });
    expect(newLogin.status).toBe(200);
    expect(oldLogin.status).toBe(401);
  });

  test('TC-MK46: wrong values are refused with 400 and nothing is saved, not even the correct values (RQ12, RQ27)', async () => {
    const badCar = await putMe(token, { name: 'Maria Antoniou', carNumber: 'AB 12' });
    expect(badCar.status).toBe(400);
    expect(badCar.body.message).toBe('Use 3 letters and 3 numbers: ABC123 or ABC 123');

    const badEmail = await putMe(token, { name: 'Maria Antoniou', email: 'not-an-email' });
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.message).toBe('Email is not valid');

    expect((await putMe(token, { name: 'M' })).status).toBe(400);
    expect((await putMe(token, {})).status).toBe(400);

    // the correct name sent together with a wrong value was not saved
    expect((await getMe(token)).body.user).toMatchObject({ name: 'Maria Driver', carNumber: 'KAB 123', email: 'maria@example.com' });
  });

  test('TC-MK47: an email that another account uses gives 409 and nothing changes (RQ01, RQ12)', async () => {
    await driver('nikos@example.com', 'NIK 777');

    const res = await putMe(token, { email: 'NIKOS@example.com', name: 'Maria Antoniou' });
    expect(res.status).toBe(409);
    expect(res.body.message).toBe('This email is already registered.');
    expect((await getMe(token)).body.user).toMatchObject({ email: 'maria@example.com', name: 'Maria Driver' });

    // keeping your own email is fine
    expect((await putMe(token, { email: 'maria@example.com' })).status).toBe(200);
  });

  test('TC-MK48: the password, the role and the ids cannot be changed through the profile (RQ23, RQ24)', async () => {
    const before = await Account.findOne({ accountEmail: 'maria@example.com' }).select('+accountPasswordHash').lean();

    const res = await putMe(token, { name: 'Maria Antoniou', password: 'hacked999', role: 'admin', userID: '507f1f77bcf86cd799439011', administratorID: '507f1f77bcf86cd799439011' });
    expect(res.status).toBe(200);

    const after = await Account.findOne({ accountEmail: 'maria@example.com' }).select('+accountPasswordHash').lean();
    expect(after.accountPasswordHash).toBe(before.accountPasswordHash);
    expect(String(after.userID)).toBe(String(before.userID));
    expect(after.administratorID).toBeUndefined();
    const login = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: PASSWORD });
    expect(login.body.role).toBe('driver');
  });

  test('TC-MK49: a payment method can be saved and removed, but never a card number (RQ12, C07 PCI-DSS)', async () => {
    const saved = await putMe(token, { paymentMethod: 'Visa ending 4242' });
    expect(saved.status).toBe(200);
    expect(saved.body.user.paymentMethod).toBe('Visa ending 4242');

    for (const card of ['4242 4242 4242 4242', '4242-4242-4242-4242', 'my card 4242424242424242']) {
      const res = await putMe(token, { paymentMethod: card });
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Do not save a card number. Use a short name such as "Visa ending 4242".');
    }
    expect(JSON.stringify(await User.find().lean())).not.toContain('4242424242424242');

    const removed = await putMe(token, { paymentMethod: null });
    expect(removed.body.user.paymentMethod).toBeNull();
  });
});
