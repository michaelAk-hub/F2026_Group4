// Integration test of the driver flow: register -> login -> map -> reserve -> pay (Member 5, Week 4).
// Everything runs together: the real API, a real temporary MongoDB, the live map stream (Member 5),
// the sensor service and the payment API (Member 4) and the expiry job (Member 3). Run with: npm test
//
// The tests marked test.failing show a BUG from the bug list (docs/bug-list-week4.md): they describe
// the CORRECT behaviour and fail today, so Jest reports them as passing. When a bug is fixed, Jest
// reports that test as failing -> change test.failing to test.
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const http = require('http');
const request = require('supertest');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const Payment = require('../src/models/payment');
const Reservation = require('../src/models/reservation');
const { handleMessage } = require('../src/services/sensorService');
const { runReservationJob, HOLD_MINUTES } = require('../src/services/reservationJob');
const stream = require('../src/services/spotStream');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

const HOUR = 60 * 60 * 1000;
const PASSWORD = 'secret123';

// --- helpers: the same requests the frontend pages send ---

async function registerAndLogin(email) {
  const reg = await request(app).post('/api/auth/register')
    .send({ name: 'Test Driver', email, password: PASSWORD, confirmPassword: PASSWORD, carNumber: 'KAB 123' });
  const login = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  return { reg, login, token: login.body.token };
}

function reserve(token, spotId, startMs, hours = 2) {
  return request(app).post('/api/reservations').set('Authorization', 'Bearer ' + token)
    .send({ spotId, startTime: new Date(startMs).toISOString(), endTime: new Date(startMs + hours * HOUR).toISOString() });
}

function confirm(token, reservationId) {
  return request(app).post(`/api/reservations/${reservationId}/confirm`).set('Authorization', 'Bearer ' + token);
}

// Card details as the payment form sends them. 4242... is approved by the mock bank of Member 4,
// 4000 0000 0000 0002 is its test card that is always declined.
const CARD = { cardName: 'Maria Driver', cardNumber: '4242 4242 4242 4242', expiry: '12/30', cvv: '123' };
const DECLINED_CARD = { ...CARD, cardNumber: '4000 0000 0000 0002' };

// POST /api/payments - the mock payment service of Member 4
function pay(token, reservationId, card = CARD) {
  return request(app).post('/api/payments').set('Authorization', 'Bearer ' + token).send({ reservationId, ...card });
}

// Reserve, pay and confirm: the whole driver flow in one step
async function reserveAndPay(token, spot, startMs, hours = 2) {
  const created = (await reserve(token, spot.id, startMs, hours)).body.reservation;
  await pay(token, created.id);
  await confirm(token, created.id);
  return created;
}

async function mapStatus(spot) {
  const res = await request(app).get('/api/spots');
  return { status: res.body.spots.find((s) => s.id === String(spot._id)).status, counts: res.body.counts };
}

// A sensor message, as the MQTT client of Member 4 receives it
function sensorSays(spot, status) {
  return handleMessage(`parking/spots/${spot._id}/status`, Buffer.from(JSON.stringify({ status })));
}

// Two spots with working sensors, like the seed script of Member 4
async function seedSpots() {
  const spots = [];
  for (const location of ['Lot A - Spot 01', 'Lot A - Spot 02']) {
    const spot = await ParkingSpot.create({ spotLocation: location });
    await Sensor.create({ parkingSpotID: spot._id, sensorAvailability: 'Available', sensorLastSeen: new Date() });
    spots.push(spot);
  }
  return spots;
}

describe('Integration: register -> map -> reserve -> pay', () => {
  let spot1;
  let spot2;

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    [spot1, spot2] = await seedSpots();
  });
  afterEach(clearTestDB);

  test('TC-MK27: a new driver registers and logs in, and gets a token with the role driver (RQ01, RQ03)', async () => {
    const { reg, login } = await registerAndLogin('maria@example.com');
    expect(reg.status).toBe(201);
    expect(login.status).toBe(200);
    expect(login.body.role).toBe('driver');
    expect(login.body.token).toEqual(expect.any(String));

    const wrong = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'wrong999' });
    expect(wrong.status).toBe(401);
  });

  test('TC-MK28: after login the map shows the spots and the counts (RQ05, RQ26)', async () => {
    await registerAndLogin('maria@example.com');
    const res = await request(app).get('/api/spots');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.counts).toEqual({ empty: 2, occupied: 0, reserved: 0, unknown: 0 });
  });

  test('TC-MK29: a reservation starts Unpaid, costs 4.00 for 2 hours and cannot be confirmed before paying (RQ08, RQ09)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    const res = await reserve(token, spot1.id, Date.now());

    expect(res.status).toBe(201);
    expect(res.body.reservation.status).toBe('Unpaid');
    expect(res.body.reservation.amount).toBe(4);

    const early = await confirm(token, res.body.reservation.id);
    expect(early.status).toBe(402);
    expect((await mapStatus(spot1)).status).toBe('empty'); // not reserved before paying
  });

  test('TC-MK30: paying by card gives a receipt, only the last 4 digits are saved, and after confirm the map shows reserved (RQ09, RQ10, RQ11, RQ26)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    const created = (await reserve(token, spot1.id, Date.now())).body.reservation;

    const paid = await pay(token, created.id);
    expect(paid.status).toBe(200);
    expect(paid.body.receipt).toMatchObject({ amount: 4, cardLast4: '4242' });
    expect(paid.body.receipt.receiptId).toMatch(/^RCPT-/);

    // PCI-DSS (C07): the database keeps no full card number and no CVV
    const saved = JSON.stringify(await Payment.findById(created.paymentId).lean());
    expect(saved).not.toContain('4242424242424242');
    expect(saved).not.toContain('"123"');

    const res = await confirm(token, created.id);
    expect(res.status).toBe(200);
    expect(res.body.reservation.status).toBe('Paid');
    const map = await mapStatus(spot1);
    expect(map.status).toBe('reserved');
    expect(map.counts).toEqual({ empty: 1, occupied: 0, reserved: 1, unknown: 0 });
  });

  test('TC-MK31: an open live map receives the reserved spot after the payment (RQ22)', async () => {
    stream.settings.pollMs = 50;
    const server = app.listen(0);
    const { token } = await registerAndLogin('maria@example.com');
    const created = (await reserve(token, spot1.id, Date.now())).body.reservation;

    // open the live map like the browser does
    let received = '';
    const req = http.get({ port: server.address().port, path: '/api/spots/stream' }, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => { received += chunk; });
    });
    try {
      await waitFor(() => received.includes('event: snapshot'));
      await pay(token, created.id);
      await confirm(token, created.id);

      await waitFor(() => received.includes('event: update'));
      const update = JSON.parse(received.split('event: update\ndata: ')[1].split('\n')[0]);
      expect(update.spots).toEqual([expect.objectContaining({ id: spot1.id, status: 'reserved' })]);
    } finally {
      req.destroy();
      stream.closeAll();
      server.close();
    }
  });

  test('TC-MK32: a declined card leaves the reservation unpaid, and the driver can pay with another card (RQ09, RQ27)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    const created = (await reserve(token, spot1.id, Date.now())).body.reservation;

    const declined = await pay(token, created.id, DECLINED_CARD);
    expect(declined.status).toBe(402);
    expect(declined.body.message).toBe('Your card was declined. Please try another card.');
    expect((await confirm(token, created.id)).status).toBe(402);

    expect((await pay(token, created.id)).status).toBe(200);
    expect((await confirm(token, created.id)).status).toBe(200);
  });

  test('TC-MK33: the same reservation cannot be paid twice (RQ09)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    const created = (await reserve(token, spot1.id, Date.now())).body.reservation;

    expect((await pay(token, created.id)).status).toBe(200);
    const again = await pay(token, created.id);
    expect(again.status).toBe(409);
    expect(again.body.message).toBe('This reservation is already paid.');
  });

  test('TC-MK34: a second driver cannot reserve the same spot for the same time, but can take another spot (RQ08)', async () => {
    const a = await registerAndLogin('maria@example.com');
    const b = await registerAndLogin('nikos@example.com');
    const start = Date.now() + HOUR;

    expect((await reserve(a.token, spot1.id, start)).status).toBe(201);
    const same = await reserve(b.token, spot1.id, start);
    expect(same.status).toBe(409);
    expect(same.body.message).toBe('This spot is already reserved for that time.');
    expect((await reserve(b.token, spot2.id, start)).status).toBe(201);
  });

  test('TC-MK35: only the owner can pay and confirm a reservation, and nobody without login (RQ13, RQ24)', async () => {
    const a = await registerAndLogin('maria@example.com');
    const b = await registerAndLogin('nikos@example.com');
    const created = (await reserve(a.token, spot1.id, Date.now())).body.reservation;

    expect((await pay(b.token, created.id)).status).toBe(404);
    await pay(a.token, created.id);
    expect((await confirm(b.token, created.id)).status).toBe(404);
    expect((await request(app).post('/api/payments').send({ reservationId: created.id, ...CARD })).status).toBe(401);
    expect((await request(app).post(`/api/reservations/${created.id}/confirm`)).status).toBe(401);
  });

  test('TC-MK36: the driver parks on the paid spot and leaves; the map follows the sensor (RQ06, RQ26)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    await reserveAndPay(token, spot1, Date.now());

    await sensorSays(spot1, 'occupied');
    expect((await mapStatus(spot1)).status).toBe('occupied');

    await sensorSays(spot1, 'free'); // the reservation is still running
    expect((await mapStatus(spot1)).status).toBe('reserved');
  });

  test('TC-MK37: an unpaid reservation is released by the expiry job, then another driver can reserve (RQ08, RQ09)', async () => {
    const a = await registerAndLogin('maria@example.com');
    const b = await registerAndLogin('nikos@example.com');
    const start = Date.now() + HOUR;
    await reserve(a.token, spot1.id, start); // never paid

    expect((await reserve(b.token, spot1.id, start)).status).toBe(409); // held while the driver may pay
    await runReservationJob(new Date(Date.now() + (HOLD_MINUTES + 1) * 60 * 1000));
    expect((await reserve(b.token, spot1.id, start)).status).toBe(201);
  });

  test('TC-MK38: when a paid reservation ends, the expiry job makes the spot empty again (RQ05)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    await reserveAndPay(token, spot1, Date.now(), 2);
    expect((await mapStatus(spot1)).status).toBe('reserved');

    await runReservationJob(new Date(Date.now() + 3 * HOUR));
    expect((await mapStatus(spot1)).status).toBe('empty');
  });

  // ---------------- Bugs found by the integration test (see docs/bug-list-week4.md) ----------------

  test('TC-MK39 / BUG-01: two drivers who reserve the same spot at the same moment do not both get it (RQ08)', async () => {
    const a = await registerAndLogin('maria@example.com');
    const b = await registerAndLogin('nikos@example.com');
    const start = Date.now() + HOUR;

    const results = await Promise.all([reserve(a.token, spot1.id, start), reserve(b.token, spot1.id, start)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await Reservation.countDocuments({ parkingSpotID: spot1._id })).toBe(1);
  });

  test.failing('TC-MK40 / BUG-02: a paid reservation for tomorrow does not show the spot as reserved today (RQ05, RQ26)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    await reserveAndPay(token, spot1, Date.now() + 24 * HOUR);

    expect((await mapStatus(spot1)).status).toBe('empty');
  });

  test('TC-MK41 / BUG-03: a very short reservation is refused, or it can be paid (RQ09)', async () => {
    const { token } = await registerAndLogin('maria@example.com');
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const res = await reserve(token, spot1.id, Date.now() + HOUR, 2 / 3600); // 2 seconds -> price 0.00

    if (res.status === 201) {
      expect((await pay(token, res.body.reservation.id)).status).toBe(200);
    } else {
      expect(res.status).toBe(400);
    }
  });
});

// Waits until check() is true (or fails after 3 seconds)
async function waitFor(check) {
  const end = Date.now() + 3000;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
