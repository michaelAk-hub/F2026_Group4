// Tests for the reservation API (create + confirm). Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Reservation = require('../src/models/reservation');
const Payment = require('../src/models/payment');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;

// Register a driver and log in, like the frontend does. Returns the token.
async function loginDriver(email = 'maria@example.com') {
  await request(app).post('/api/auth/register').send({
    name: 'Maria Driver',
    email,
    password: 'secret123',
    carNumber: 'KAB 123',
  });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'secret123' });
  return res.body.token;
}

// Send a reservation for a spot, from "inHours" hours from now, for "hours" hours
function reserve(token, spotId, inHours = 1, hours = 2) {
  const start = new Date(Date.now() + inHours * HOUR);
  const end = new Date(start.getTime() + hours * HOUR);
  return request(app)
    .post('/api/reservations')
    .set('Authorization', 'Bearer ' + token)
    .send({ spotId, startTime: start.toISOString(), endTime: end.toISOString() });
}

describe('Reservation API', () => {
  let token;
  let spot;

  beforeAll(startTestDB);
  afterAll(stopTestDB);

  beforeEach(async () => {
    token = await loginDriver();
    spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 05' });
  });
  afterEach(clearTestDB);

  test('a driver can reserve a free spot; it starts as Unpaid (RQ08, RQ09)', async () => {
    const res = await reserve(token, spot.id);

    expect(res.status).toBe(201);
    expect(res.body.reservation.status).toBe('Unpaid');
    expect(res.body.reservation.amount).toBe(4); // 2 hours x €2, same as the reservation page

    // the payment exists but is not done yet, and the spot is not reserved before paying
    const payment = await Payment.findById(res.body.reservation.paymentId);
    expect(payment.paymentStatus).toBe('Incomplete');
    expect((await ParkingSpot.findById(spot.id)).spotStatus).toBe('Available');
  });

  test('without a token returns 401, an administrator gets 403 (RQ24)', async () => {
    const noToken = await request(app).post('/api/reservations').send({ spotId: spot.id });
    expect(noToken.status).toBe(401);

    const adminToken = jwt.sign({ accountId: 'abc', role: 'admin' }, process.env.JWT_SECRET);
    const admin = await reserve(adminToken, spot.id);
    expect(admin.status).toBe(403);
  });

  test('a wrong or unknown spot is rejected', async () => {
    const wrong = await reserve(token, 'not-an-id');
    expect(wrong.status).toBe(400);

    const unknown = await reserve(token, '507f1f77bcf86cd799439011');
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Parking spot not found.');
  });

  test('wrong times are rejected: missing, end before start, in the past, longer than 24 hours', async () => {
    const missing = await request(app)
      .post('/api/reservations')
      .set('Authorization', 'Bearer ' + token)
      .send({ spotId: spot.id });
    expect(missing.status).toBe(400);

    const endBeforeStart = await reserve(token, spot.id, 1, -1);
    expect(endBeforeStart.status).toBe(400);

    const past = await reserve(token, spot.id, -3, 2);
    expect(past.status).toBe(400);
    expect(past.body.message).toBe('The start time is in the past.');

    const tooLong = await reserve(token, spot.id, 1, 25);
    expect(tooLong.status).toBe(400);

    expect(await Reservation.countDocuments()).toBe(0); // nothing was saved
  });

  test('double booking: an overlapping time for the same spot returns 409', async () => {
    await reserve(token, spot.id, 1, 2); // from +1h to +3h

    const otherToken = await loginDriver('nikos@example.com');
    const overlap = await reserve(otherToken, spot.id, 2, 2); // from +2h to +4h
    expect(overlap.status).toBe(409);
    expect(overlap.body.message).toBe('This spot is already reserved for that time.');

    expect(await Reservation.countDocuments()).toBe(1);
  });

  test('TC-G60: two drivers who reserve the same spot at the same moment do not both get it (RQ08)', async () => {
    const otherToken = await loginDriver('nikos@example.com');

    // both requests are sent together, so both pass the first overlap check
    const results = await Promise.all([reserve(token, spot.id), reserve(otherToken, spot.id)]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Reservation.countDocuments()).toBe(1);
    expect(await Payment.countDocuments()).toBe(1); // the payment of the removed one is deleted too
  });

  test('TC-G61: a reservation shorter than 15 minutes is rejected, so the price is never 0.00 (RQ09)', async () => {
    const tooShort = await reserve(token, spot.id, 1, 2 / 3600); // 2 seconds
    expect(tooShort.status).toBe(400);
    expect(tooShort.body.message).toBe('A reservation must be at least 15 minutes.');

    const fifteen = await reserve(token, spot.id, 1, 0.25); // exactly 15 minutes is allowed
    expect(fifteen.status).toBe(201);
    expect(fifteen.body.reservation.amount).toBe(0.5);
  });

  test('back-to-back times and other spots are allowed', async () => {
    await reserve(token, spot.id, 1, 2); // from +1h to +3h

    const after = await reserve(token, spot.id, 3, 1); // from +3h, starts when the first one ends
    expect(after.status).toBe(201);

    const otherSpot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 06' });
    const sameTime = await reserve(token, otherSpot.id, 1, 2);
    expect(sameTime.status).toBe(201);
  });

  test('confirm without payment returns 402 and the reservation stays Unpaid (RQ09)', async () => {
    const created = await reserve(token, spot.id);
    const id = created.body.reservation.id;

    const res = await request(app)
      .post(`/api/reservations/${id}/confirm`)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(402);
    expect((await Reservation.findById(id)).reservationStatus).toBe('Unpaid');
  });

  test('confirm after payment makes it Paid and the spot Reserved', async () => {
    const created = await reserve(token, spot.id);
    const id = created.body.reservation.id;

    // the mock payment service of Member 4 marks the payment as Complete
    await Payment.updateOne({ _id: created.body.reservation.paymentId }, { paymentStatus: 'Complete' });

    const res = await request(app)
      .post(`/api/reservations/${id}/confirm`)
      .set('Authorization', 'Bearer ' + token);

    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('Paid');
    expect((await ParkingSpot.findById(spot.id)).spotStatus).toBe('Reserved');
  });

  test('a driver cannot confirm the reservation of another driver', async () => {
    const created = await reserve(token, spot.id);
    const otherToken = await loginDriver('nikos@example.com');

    const res = await request(app)
      .post(`/api/reservations/${created.body.reservation.id}/confirm`)
      .set('Authorization', 'Bearer ' + otherToken);

    expect(res.status).toBe(404);
  });
});
