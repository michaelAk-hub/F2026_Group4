// Tests for the admin dashboard API GET /api/admin/dashboard and the admin seed script
// (Member 5, Week 6). Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const Payment = require('../src/models/payment');
const { seedAdmin } = require('../scripts/seed-admin');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CARD = { cardName: 'Test Driver', cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvv: '123' };
const auth = (token) => ({ Authorization: 'Bearer ' + token });

async function login(email, password) {
  return (await request(app).post('/api/auth/login').send({ email, password })).body.token;
}
async function driver(email) {
  await request(app).post('/api/auth/register').send({ name: 'Test Driver', email, password: 'secret123', carNumber: 'KAB 123' });
  return login(email, 'secret123');
}
async function admin() {
  await seedAdmin('admin@parking.com', 'Admin12345');
  return login('admin@parking.com', 'Admin12345');
}

// Reserve "spot" from "inHours" for 2 hours (4.00) with the real APIs; pay if "pay" is true
async function booking(token, spot, inHours, pay = true) {
  const start = Date.now() + inHours * HOUR;
  const res = await request(app).post('/api/reservations').set(auth(token)).send({
    spotId: spot.id, startTime: new Date(start).toISOString(), endTime: new Date(start + 2 * HOUR).toISOString(),
  });
  const created = res.body.reservation;
  if (pay) {
    await request(app).post('/api/payments').set(auth(token)).send({ reservationId: created.id, ...CARD });
    await request(app).post(`/api/reservations/${created.id}/confirm`).set(auth(token));
  }
  return created;
}

// Move the payment time back (the database sets updatedAt itself, so we change it directly)
function paidDaysAgo(paymentId, days) {
  return Payment.collection.updateOne({ _id: new Payment.base.Types.ObjectId(paymentId) }, { $set: { updatedAt: new Date(Date.now() - days * DAY) } });
}

const dashboard = (token) => request(app).get('/api/admin/dashboard').set(auth(token));

describe('Admin dashboard API', () => {
  let spots;

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    spots = [];
    for (let i = 1; i <= 4; i++) {
      const spot = await ParkingSpot.create({ spotLocation: `Lot A - Spot 0${i}` });
      await Sensor.create({ parkingSpotID: spot._id, sensorAvailability: 'Available', sensorLastSeen: new Date() });
      spots.push(spot);
    }
  });
  afterEach(clearTestDB);

  test('TC-MK55: only an administrator can open the dashboard data (RQ18, RQ24)', async () => {
    const driverToken = await driver('maria@example.com');
    const adminToken = await admin();

    expect((await request(app).get('/api/admin/dashboard')).status).toBe(401);
    expect((await dashboard(driverToken)).status).toBe(403);
    expect((await dashboard(adminToken)).status).toBe(200);
  });

  test('TC-MK56: the seed script creates an administrator, changes its password, and refuses bad input (RQ16)', async () => {
    expect(await seedAdmin('Admin@Parking.com', 'Admin12345')).toBe('created');
    const first = await request(app).post('/api/auth/login').send({ email: 'admin@parking.com', password: 'Admin12345' });
    expect(first.body.role).toBe('admin');

    expect(await seedAdmin('admin@parking.com', 'NewPass999')).toBe('updated');
    expect((await request(app).post('/api/auth/login').send({ email: 'admin@parking.com', password: 'Admin12345' })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: 'admin@parking.com', password: 'NewPass999' })).body.role).toBe('admin');

    await driver('maria@example.com');
    await expect(seedAdmin('maria@example.com', 'Admin12345')).rejects.toThrow('belongs to a driver account');
    await expect(seedAdmin('boss@parking.com', 'short')).rejects.toThrow('8+ characters and a number');
  });

  test('TC-MK57: the occupancy is the same as the live map, with the occupied share and the running reservations (RQ05, RQ18)', async () => {
    const adminToken = await admin();
    const token = await driver('maria@example.com');
    await ParkingSpot.updateOne({ _id: spots[0]._id }, { spotStatus: 'Taken' });
    await booking(token, spots[1], 0); // paid and running now -> reserved

    const res = await dashboard(adminToken);
    const map = await request(app).get('/api/spots');
    expect(res.body.occupancy.total).toBe(4);
    expect(res.body.occupancy.counts).toEqual(map.body.counts);
    expect(res.body.occupancy.counts).toMatchObject({ occupied: 1, reserved: 1, empty: 2 });
    expect(res.body.occupancy.occupiedPercent).toBe(25);
    expect(res.body.occupancy.activeReservations).toBe(1);
  });

  test('TC-MK58: the revenue counts only paid payments, not unpaid reservations (RQ18)', async () => {
    const adminToken = await admin();
    const token = await driver('maria@example.com');
    await booking(token, spots[0], 1);
    await booking(token, spots[1], 1);
    await booking(token, spots[2], 1, false); // not paid

    const { revenue } = (await dashboard(adminToken)).body;
    expect(revenue.currency).toBe('EUR');
    expect(revenue.last24h).toEqual({ amount: 8, payments: 2 });
  });

  test('TC-MK59: the revenue is split by period: last 24 hours, 7 days and 30 days (RQ18)', async () => {
    const adminToken = await admin();
    const token = await driver('maria@example.com');
    await booking(token, spots[0], 1); // paid now
    await paidDaysAgo((await booking(token, spots[1], 1)).paymentId, 3);
    await paidDaysAgo((await booking(token, spots[2], 1)).paymentId, 10);
    await paidDaysAgo((await booking(token, spots[3], 1)).paymentId, 40); // too old

    const { revenue } = (await dashboard(adminToken)).body;
    expect(revenue.last24h).toEqual({ amount: 4, payments: 1 });
    expect(revenue.last7d).toEqual({ amount: 8, payments: 2 });
    expect(revenue.last30d).toEqual({ amount: 12, payments: 3 });
  });

  test('TC-MK60: a cancelled paid reservation is shown as a refund and not as revenue (RQ18)', async () => {
    const adminToken = await admin();
    const token = await driver('maria@example.com');
    await booking(token, spots[0], 1);
    const cancelled = await booking(token, spots[1], 3);
    const res = await request(app).delete(`/api/reservations/${cancelled.id}`).set(auth(token));
    expect(res.status).toBe(200);

    const body = (await dashboard(adminToken)).body;
    expect(body.revenue.last24h).toEqual({ amount: 4, payments: 1 });
    expect(body.refunds.last30d).toEqual({ amount: 4, payments: 1 });
  });

  test('TC-MK61: the latest payments are the 5 newest, with receipt and spot, and never a card number (RQ11, C07)', async () => {
    const adminToken = await admin();
    const token = await driver('maria@example.com');
    for (let i = 0; i < 6; i++) await booking(token, spots[i % 4], 3 * (i + 1));

    const { latestPayments } = (await dashboard(adminToken)).body;
    expect(latestPayments).toHaveLength(5);
    const times = latestPayments.map((p) => new Date(p.paidAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
    expect(latestPayments[0]).toMatchObject({ amount: 4, spot: expect.stringMatching(/^Lot A - Spot 0\d$/) });
    expect(latestPayments[0].receiptId).toMatch(/^RCPT-/);
    expect(JSON.stringify(latestPayments)).not.toMatch(/4242424242424242|cardLast4|"123"/);
  });

  test('TC-MK62: an empty system gives zeros, not errors (RQ18)', async () => {
    await ParkingSpot.deleteMany({});
    const res = await dashboard(await admin());
    expect(res.status).toBe(200);
    expect(res.body.occupancy).toMatchObject({ total: 0, occupiedPercent: 0, activeReservations: 0 });
    expect(res.body.revenue.last30d).toEqual({ amount: 0, payments: 0 });
    expect(res.body.latestPayments).toEqual([]);
  });
});
