// Tests for the history endpoints GET /api/reservations/mine and GET /api/payments/mine
// (Member 5, Week 5). Run with: npm test
// RQ13: a driver sees ONLY their own reservations and payments.
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;
const CARD = { cardName: 'Test Driver', cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvv: '123' };

async function driver(email) {
  await request(app).post('/api/auth/register').send({ name: 'Test Driver', email, password: 'secret123', carNumber: 'KAB 123' });
  return (await request(app).post('/api/auth/login').send({ email, password: 'secret123' })).body.token;
}

const auth = (token) => ({ Authorization: 'Bearer ' + token });

// Reserve a spot "inHours" from now for 2 hours; pay it if pay is true. Uses the real APIs of Members 3 and 4.
async function reservation(token, spot, inHours, pay) {
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

const mine = (token, what) => request(app).get(`/api/${what}/mine`).set(auth(token));

describe('History API (/api/reservations/mine, /api/payments/mine)', () => {
  let maria;
  let nikos;
  let spotA;
  let spotB;

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    maria = await driver('maria@example.com');
    nikos = await driver('nikos@example.com');
    spotA = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 01' });
    spotB = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 02' });
  });
  afterEach(clearTestDB);

  test('TC-MK50: a driver gets only their own reservations, newest first, with the spot and the payment (RQ13)', async () => {
    const first = await reservation(maria, spotA, 1, true);
    const second = await reservation(maria, spotB, 5, false);
    await reservation(nikos, spotA, 10, true); // another driver

    const res = await mine(maria, 'reservations');
    expect(res.status).toBe(200);
    expect(res.body.reservations.map((r) => r._id)).toEqual([second.id, first.id]);

    // the fields that the My Reservations page of Member 1 reads
    const paid = res.body.reservations[1];
    expect(paid).toMatchObject({
      reservationStatus: 'Paid',
      parkingSpotID: { spotLocation: 'Lot A - Spot 01' },
      paymentID: { paymentAmount: 4, paymentStatus: 'Complete', cardLast4: '4242' },
    });
    expect(new Date(paid.reservationStartTime).getTime()).toBeLessThan(new Date(paid.reservationEndTime).getTime());
    expect(res.body.reservations[0]).toMatchObject({ reservationStatus: 'Unpaid', paymentID: { paymentStatus: 'Incomplete' } });
    expect(paid.userID).toBeUndefined();
  });

  test('TC-MK51: a driver gets only their own payments, with the receipt and only the last 4 card digits (RQ11, RQ13, C07)', async () => {
    const paid = await reservation(maria, spotA, 1, true);
    await reservation(maria, spotB, 5, false);
    await reservation(nikos, spotB, 10, true);

    const res = await mine(maria, 'payments');
    expect(res.status).toBe(200);
    expect(res.body.payments).toHaveLength(2);
    const complete = res.body.payments.find((p) => p.paymentStatus === 'Complete');
    expect(complete).toMatchObject({ _id: paid.paymentId, reservationId: paid.id, paymentAmount: 4, cardLast4: '4242' });
    expect(complete.receiptId).toMatch(/^RCPT-/);
    expect(JSON.stringify(res.body)).not.toContain('4242424242424242');
    expect(JSON.stringify(res.body)).not.toContain('"123"');
  });

  test('TC-MK52: the two lists match: every reservation links to a payment in the payment list (RQ13)', async () => {
    await reservation(maria, spotA, 1, true);
    await reservation(maria, spotB, 3, true);

    const reservations = (await mine(maria, 'reservations')).body.reservations;
    const paymentIds = (await mine(maria, 'payments')).body.payments.map((p) => p._id);
    expect(reservations.map((r) => r.paymentID._id).sort()).toEqual(paymentIds.sort());
  });

  test('TC-MK53: a driver without reservations gets empty lists (RQ13)', async () => {
    await reservation(nikos, spotA, 1, true);

    expect((await mine(maria, 'reservations')).body).toEqual({ reservations: [] });
    expect((await mine(maria, 'payments')).body).toEqual({ payments: [] });
  });

  test('TC-MK54: without login 401, an administrator gets 403, and the other reservation routes still work (RQ24)', async () => {
    const adminToken = jwt.sign({ accountId: 'abc', role: 'admin' }, process.env.JWT_SECRET);
    for (const what of ['reservations', 'payments']) {
      expect((await request(app).get(`/api/${what}/mine`)).status).toBe(401);
      expect((await mine(adminToken, what)).status).toBe(403);
    }
    // POST /api/reservations and POST /api/payments of Members 3 and 4 are not affected
    const created = await reservation(maria, spotA, 1, true);
    expect(created.status).toBe('Unpaid');
    expect((await mine(maria, 'reservations')).body.reservations[0].reservationStatus).toBe('Paid');
  });
});
