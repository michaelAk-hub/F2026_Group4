// Tests for the administrator's violation API (task 6.4): RQ14, RQ19, RQ24.
//   GET /api/violations and PUT /api/violations/:id
// Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const Account = require('../src/models/Account');
const Administrator = require('../src/models/administrator');
const ParkingSpot = require('../src/models/parkingSpot');
const Violation = require('../src/models/violation');
const { checkViolations } = require('../src/services/violationService');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;
const auth = (token) => ({ Authorization: 'Bearer ' + token });

// An administrator account, and the token you get when it logs in
async function loginAdmin(email = 'admin@parking.com') {
  const admin = await Administrator.create({});
  await Account.create({
    accountEmail: email,
    accountPasswordHash: await bcrypt.hash('admin1234', 10),
    administratorID: admin._id,
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'admin1234' });
  return { token: res.body.token, administratorID: admin._id };
}

// A driver account, and the token you get when it logs in
async function loginDriver() {
  await request(app).post('/api/auth/register').send({
    name: 'Maria Driver',
    email: 'maria@example.com',
    password: 'secret123',
    confirmPassword: 'secret123',
    carNumber: 'KAB 123',
  });
  const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'secret123' });
  return res.body.token;
}

// A violation saved directly in the database. Only one OPEN violation per spot is allowed,
// so every open violation in these tests is on its own spot.
async function createViolation(location, overrides = {}) {
  const spot = await ParkingSpot.create({ spotLocation: location });
  const violation = await Violation.create({
    violationType: 'Unreserved parking',
    violationDate: new Date(),
    parkingSpotID: spot._id,
    ...overrides,
  });
  return { spot, violation };
}

const list = (token, query = '') => request(app).get('/api/violations' + query).set(auth(token));
const close = (token, id, body) => request(app).put(`/api/violations/${id}`).set(auth(token)).send(body);

describe('Violations API (administrator)', () => {
  let admin;

  beforeAll(async () => {
    await startTestDB();
    await Violation.init(); // builds the "one open violation per spot" index
  });
  afterAll(stopTestDB);

  beforeEach(async () => {
    admin = await loginAdmin();
  });
  afterEach(clearTestDB);

  test('TC-G109: without a token both routes give 401 (RQ24)', async () => {
    const { violation } = await createViolation('A1');

    expect((await request(app).get('/api/violations')).status).toBe(401);
    expect((await request(app).put(`/api/violations/${violation._id}`).send({ status: 'Resolved' })).status).toBe(401);
  });

  test('TC-G110: a driver gets 403 on both routes and nothing changes (RQ24)', async () => {
    const { violation } = await createViolation('A1');
    const driverToken = await loginDriver();

    expect((await list(driverToken)).status).toBe(403);
    expect((await close(driverToken, violation._id, { status: 'Resolved' })).status).toBe(403);
    expect((await Violation.findById(violation._id)).violationStatus).toBe('Unresolved');
  });

  test('TC-G111: the list shows only the open violations, with the spot location (RQ19)', async () => {
    const driverId = new mongoose.Types.ObjectId(); // the driver of the first violation
    await createViolation('A1', { violationType: 'Unpaid reservation', userID: driverId });
    await createViolation('A2', { violationStatus: 'Resolved' });
    await createViolation('A3', { violationStatus: 'Dismissed' });

    const res = await list(admin.token);

    expect(res.status).toBe(200);
    expect(res.body.violations).toHaveLength(1);
    const v = res.body.violations[0];
    expect(v.type).toBe('Unpaid reservation');
    expect(v.status).toBe('Unresolved');
    expect(v.spotLocation).toBe('A1');
    expect(v.userId).toBe(String(driverId));
    expect(v.id).toBeDefined();
    expect(v.spotId).toBeDefined();
    expect(v.date).toBeDefined();
    expect(v.note).toBe('');
  });

  test('TC-G112: the status filter shows resolved, dismissed or all violations', async () => {
    await createViolation('A1');
    await createViolation('A2', { violationStatus: 'Resolved' });
    await createViolation('A3', { violationStatus: 'Dismissed' });

    expect((await list(admin.token, '?status=Resolved')).body.violations.map((v) => v.spotLocation)).toEqual(['A2']);
    expect((await list(admin.token, '?status=Dismissed')).body.violations.map((v) => v.spotLocation)).toEqual(['A3']);
    expect((await list(admin.token, '?status=all')).body.violations).toHaveLength(3);
  });

  test('TC-G113: an unknown status filter gives 400', async () => {
    const res = await list(admin.token, '?status=banana');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Status must be Unresolved, Resolved, Dismissed or all.');
  });

  test('TC-G114: the newest violation is first', async () => {
    const now = Date.now();
    await createViolation('A1', { violationDate: new Date(now - 2 * HOUR) });
    await createViolation('A2', { violationDate: new Date(now) });
    await createViolation('A3', { violationDate: new Date(now - HOUR) });

    const res = await list(admin.token);

    expect(res.body.violations.map((v) => v.spotLocation)).toEqual(['A2', 'A3', 'A1']);
  });

  test('TC-G115: resolving saves the status, the note and the administrator, and removes it from the open list (RQ19)', async () => {
    const { violation } = await createViolation('A1');

    const res = await close(admin.token, violation._id, { status: 'Resolved', note: '  Driver paid at the desk.  ' });

    expect(res.status).toBe(200);
    expect(res.body.violation.status).toBe('Resolved');
    expect(res.body.violation.note).toBe('Driver paid at the desk.');
    expect(res.body.violation.spotLocation).toBe('A1');

    const saved = await Violation.findById(violation._id);
    expect(saved.violationStatus).toBe('Resolved');
    expect(saved.violationNote).toBe('Driver paid at the desk.');
    expect(String(saved.administratorID)).toBe(String(admin.administratorID));

    expect((await list(admin.token)).body.violations).toHaveLength(0);
    expect((await list(admin.token, '?status=Resolved')).body.violations).toHaveLength(1);
  });

  test('TC-G116: dismissing works, and the note is optional', async () => {
    const { violation } = await createViolation('A1');

    const res = await close(admin.token, violation._id, { status: 'Dismissed' });

    expect(res.status).toBe(200);
    expect(res.body.violation.status).toBe('Dismissed');
    expect(res.body.violation.note).toBe('');
    expect((await Violation.findById(violation._id)).violationStatus).toBe('Dismissed');
  });

  test('TC-G117: closing a violation twice gives 409 and keeps the first note', async () => {
    const { violation } = await createViolation('A1');
    expect((await close(admin.token, violation._id, { status: 'Resolved', note: 'First' })).status).toBe(200);

    const second = await close(admin.token, violation._id, { status: 'Dismissed', note: 'Second' });

    expect(second.status).toBe(409);
    const saved = await Violation.findById(violation._id);
    expect(saved.violationStatus).toBe('Resolved');
    expect(saved.violationNote).toBe('First');
  });

  test('TC-G118: a wrong status or note gives 400 and nothing changes', async () => {
    const { violation } = await createViolation('A1');

    expect((await close(admin.token, violation._id, { status: 'Unresolved' })).status).toBe(400);
    expect((await close(admin.token, violation._id, { status: 'banana' })).status).toBe(400);
    expect((await close(admin.token, violation._id, {})).status).toBe(400);
    expect((await close(admin.token, violation._id, { status: 'Resolved', note: 123 })).status).toBe(400);
    expect((await close(admin.token, violation._id, { status: 'Resolved', note: 'x'.repeat(501) })).status).toBe(400);

    const saved = await Violation.findById(violation._id);
    expect(saved.violationStatus).toBe('Unresolved');
    expect(saved.violationNote).toBeUndefined();
  });

  test('TC-G119: an invalid or unknown violation id gives 404', async () => {
    expect((await close(admin.token, 'not-an-id', { status: 'Resolved' })).status).toBe(404);
    expect((await close(admin.token, '507f1f77bcf86cd799439011', { status: 'Resolved' })).status).toBe(404);
  });

  test('TC-G120: two administrators closing it at the same moment: only one succeeds', async () => {
    const { violation } = await createViolation('A1');
    const other = await loginAdmin('admin2@parking.com');

    const [a, b] = await Promise.all([
      close(admin.token, violation._id, { status: 'Resolved' }),
      close(other.token, violation._id, { status: 'Dismissed' }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  test('TC-G121: a token with the admin role but no administrator account gets 403', async () => {
    const { violation } = await createViolation('A1');
    await loginDriver();
    const driverAccount = await Account.findOne({ accountEmail: 'maria@example.com' });
    const forged = jwt.sign({ accountId: String(driverAccount._id), role: 'admin' }, process.env.JWT_SECRET);

    const res = await close(forged, violation._id, { status: 'Resolved' });

    expect(res.status).toBe(403);
    expect((await Violation.findById(violation._id)).violationStatus).toBe('Unresolved');
  });

  test('TC-G122: after an administrator resolves it, a new incident on the same spot creates a new violation', async () => {
    const spot = await ParkingSpot.create({ spotLocation: 'A1' });
    const first = await checkViolations(spot._id, new Date());
    expect(first.created).toBe(true);

    await close(admin.token, first.violation._id, { status: 'Resolved', note: 'Handled' });
    const second = await checkViolations(spot._id, new Date());

    expect(second.created).toBe(true);
    expect(String(second.violation._id)).not.toBe(String(first.violation._id));
    expect((await list(admin.token)).body.violations).toHaveLength(1); // only the new one is open
  });
});
