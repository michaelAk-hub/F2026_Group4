// Tests for the admin sensor API (Member 3, Week 6): GET/POST/PUT/DELETE /api/sensors. Run with: npm test
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const Reservation = require('../src/models/reservation');
const { cleanCoordinates } = require('../src/controllers/sensorsController');
const { startTestDB, clearTestDB, stopTestDB } = require('./setup');

// A login token of an administrator (the same as the reservation tests)
const adminToken = jwt.sign({ accountId: 'abc', role: 'admin' }, process.env.JWT_SECRET);

// Small helpers: send a request as the administrator
function asAdmin(method, url, body) {
  return request(app)[method](url).set('Authorization', 'Bearer ' + adminToken).send(body);
}

// Register a driver and log in, like the frontend does. Returns the token.
async function loginDriver() {
  await request(app).post('/api/auth/register').send({
    name: 'Maria Driver',
    email: 'maria@example.com',
    password: 'secret123',
    carNumber: 'KAB 123',
  });
  const res = await request(app).post('/api/auth/login').send({ email: 'maria@example.com', password: 'secret123' });
  return res.body.token;
}

describe('Admin sensor API', () => {
  let spot;

  beforeAll(startTestDB);
  afterAll(stopTestDB);

  beforeEach(async () => {
    spot = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 05' });
  });
  afterEach(clearTestDB);

  test('TC-G81: without a token returns 401, a driver gets 403 on every sensor route (RQ17, RQ24)', async () => {
    const sensor = await Sensor.create({ sensorAvailability: 'Available', parkingSpotID: spot._id });
    const driverToken = await loginDriver();
    const routes = [
      ['get', '/api/sensors'],
      ['post', '/api/sensors'],
      ['put', `/api/sensors/${sensor.id}`],
      ['delete', `/api/sensors/${sensor.id}`],
    ];

    for (const [method, url] of routes) {
      const noToken = await request(app)[method](url).send({ spotId: spot.id, coordinates: '1,1' });
      expect(noToken.status).toBe(401);

      const driver = await request(app)[method](url)
        .set('Authorization', 'Bearer ' + driverToken)
        .send({ spotId: spot.id, coordinates: '1,1' });
      expect(driver.status).toBe(403);
    }

    // nothing was changed
    expect(await Sensor.countDocuments()).toBe(1);
    expect((await Sensor.findById(sensor.id)).sensorLocationCoordinates).toBeUndefined();
  });

  test('TC-G82: the admin adds a sensor to a spot; it is Unavailable and the map shows the spot as unknown (RQ17, RQ28)', async () => {
    const res = await asAdmin('post', '/api/sensors', { spotId: spot.id, coordinates: ' 34.6786 , 33.0413 ' });

    expect(res.status).toBe(201);
    expect(res.body.sensor.spotLocation).toBe('Lot A - Spot 05');
    expect(res.body.sensor.availability).toBe('Unavailable'); // it has not sent anything yet
    expect(res.body.sensor.coordinates).toBe('34.6786,33.0413'); // saved without spaces

    // the map now has the coordinates, and "unknown" until the first sensor message
    const map = await request(app).get('/api/spots');
    expect(map.body.spots[0].coordinates).toBe('34.6786,33.0413');
    expect(map.body.spots[0].status).toBe('unknown');
  });

  test('TC-G83: the admin adds a sensor with the name of a new spot; the new spot is on the map (RQ17, RQ32)', async () => {
    const res = await asAdmin('post', '/api/sensors', { spotLocation: '  Lot B - Spot 01 ' });

    expect(res.status).toBe(201);
    expect(res.body.sensor.spotLocation).toBe('Lot B - Spot 01');
    expect(res.body.sensor.coordinates).toBeNull(); // the coordinates are optional

    const newSpot = await ParkingSpot.findOne({ spotLocation: 'Lot B - Spot 01' });
    expect(newSpot.spotStatus).toBe('Available');

    const map = await request(app).get('/api/spots');
    expect(map.body.total).toBe(2);

    // the name of a spot that exists uses that spot, it does not make a second one
    const same = await asAdmin('post', '/api/sensors', { spotLocation: 'Lot A - Spot 05' });
    expect(same.status).toBe(201);
    expect(String(same.body.sensor.spotId)).toBe(spot.id);
    expect(await ParkingSpot.countDocuments()).toBe(2);
  });

  test('TC-G84: wrong data is rejected and nothing is saved (RQ17, RQ27)', async () => {
    const noSpot = await asAdmin('post', '/api/sensors', { coordinates: '34.6,33.0' });
    expect(noSpot.status).toBe(400);

    const wrongId = await asAdmin('post', '/api/sensors', { spotId: 'not-an-id' });
    expect(wrongId.status).toBe(400);

    const unknown = await asAdmin('post', '/api/sensors', { spotId: '507f1f77bcf86cd799439011' });
    expect(unknown.status).toBe(404);
    expect(unknown.body.message).toBe('Parking spot not found.');

    for (const coordinates of ['abc', '34.6', '95,33', '34.6,200', '34.6;33.0']) {
      const wrong = await asAdmin('post', '/api/sensors', { spotId: spot.id, coordinates });
      expect(wrong.status).toBe(400);
    }

    const longName = await asAdmin('post', '/api/sensors', { spotLocation: 'x'.repeat(51) });
    expect(longName.status).toBe(400);

    expect(await Sensor.countDocuments()).toBe(0);
    expect(await ParkingSpot.countDocuments()).toBe(1); // no spot was made

    // a spot can have only one sensor
    await asAdmin('post', '/api/sensors', { spotId: spot.id });
    const second = await asAdmin('post', '/api/sensors', { spotId: spot.id });
    expect(second.status).toBe(409);
    expect(second.body.message).toBe('This parking spot already has a sensor.');
    expect(await Sensor.countDocuments()).toBe(1);
  });

  test('TC-G85: the admin sees all sensors with the name of their spot, sorted by the name (RQ17)', async () => {
    const spot2 = await ParkingSpot.create({ spotLocation: 'Lot A - Spot 02' });
    await Sensor.create({ sensorAvailability: 'Available', parkingSpotID: spot._id, sensorLastSeen: new Date() });
    await Sensor.create({ sensorAvailability: 'Unavailable', parkingSpotID: spot2._id, sensorLocationCoordinates: '34.1,33.1' });

    const res = await asAdmin('get', '/api/sensors');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.sensors.map((s) => s.spotLocation)).toEqual(['Lot A - Spot 02', 'Lot A - Spot 05']);
    expect(res.body.sensors[0].availability).toBe('Unavailable');
    expect(res.body.sensors[0].coordinates).toBe('34.1,33.1');
    expect(res.body.sensors[1].availability).toBe('Available');
    expect(res.body.sensors[1].lastSeen).not.toBeNull();
  });

  test('TC-G86: the admin changes the coordinates and the name of the spot; wrong changes are rejected (RQ17)', async () => {
    const sensor = await Sensor.create({ sensorAvailability: 'Available', parkingSpotID: spot._id, sensorLocationCoordinates: '34.1,33.1' });
    await ParkingSpot.create({ spotLocation: 'Lot A - Spot 06' });

    const res = await asAdmin('put', `/api/sensors/${sensor.id}`, { coordinates: '34.2,33.2', spotLocation: 'Lot A - Spot 07' });
    expect(res.status).toBe(200);
    expect(res.body.sensor.coordinates).toBe('34.2,33.2');
    expect(res.body.sensor.spotLocation).toBe('Lot A - Spot 07');
    expect((await ParkingSpot.findById(spot.id)).spotLocation).toBe('Lot A - Spot 07');

    // wrong changes: nothing to change, wrong coordinates, a name that another spot has, unknown sensor
    expect((await asAdmin('put', `/api/sensors/${sensor.id}`, {})).status).toBe(400);
    expect((await asAdmin('put', `/api/sensors/${sensor.id}`, { coordinates: '1,2,3', spotLocation: 'New name' })).status).toBe(400);
    const taken = await asAdmin('put', `/api/sensors/${sensor.id}`, { spotLocation: 'Lot A - Spot 06' });
    expect(taken.status).toBe(409);
    expect((await asAdmin('put', '/api/sensors/507f1f77bcf86cd799439011', { coordinates: '1,2' })).status).toBe(404);
    expect((await asAdmin('put', '/api/sensors/not-an-id', { coordinates: '1,2' })).status).toBe(404);

    // the wrong changes did not change anything (not even half of the change)
    expect((await Sensor.findById(sensor.id)).sensorLocationCoordinates).toBe('34.2,33.2');
    expect((await ParkingSpot.findById(spot.id)).spotLocation).toBe('Lot A - Spot 07');

    // null removes the coordinates
    const removed = await asAdmin('put', `/api/sensors/${sensor.id}`, { coordinates: null });
    expect(removed.status).toBe(200);
    expect(removed.body.sensor.coordinates).toBeNull();
  });

  test('TC-G87: the admin removes a sensor; the spot and its reservations stay and the map shows it as unknown (RQ17, RQ28)', async () => {
    const sensor = await Sensor.create({ sensorAvailability: 'Available', parkingSpotID: spot._id, sensorLastSeen: new Date() });
    await Reservation.create({
      reservationStartTime: new Date(Date.now() + 60 * 60 * 1000),
      reservationEndTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      userID: '507f1f77bcf86cd799439011',
      parkingSpotID: spot._id,
      paymentID: '507f1f77bcf86cd799439012',
    });

    const before = await request(app).get('/api/spots');
    expect(before.body.spots[0].status).toBe('empty');

    const res = await asAdmin('delete', `/api/sensors/${sensor.id}`);
    expect(res.status).toBe(200);
    expect(await Sensor.countDocuments()).toBe(0);
    expect(await ParkingSpot.countDocuments()).toBe(1); // the spot stays
    expect(await Reservation.countDocuments()).toBe(1); // and its reservation

    const after = await request(app).get('/api/spots');
    expect(after.body.spots[0].status).toBe('unknown');

    // the second time the sensor is not there any more
    const again = await asAdmin('delete', `/api/sensors/${sensor.id}`);
    expect(again.status).toBe(404);
  });

  test('TC-G88: cleanCoordinates accepts only "latitude,longitude" on the earth', () => {
    expect(cleanCoordinates('34.6786,33.0413')).toBe('34.6786,33.0413');
    expect(cleanCoordinates(' -33.9 , 18.4 ')).toBe('-33.9,18.4');
    expect(cleanCoordinates('90,180')).toBe('90,180');
    expect(cleanCoordinates('90.1,0')).toBeNull();
    expect(cleanCoordinates('0,-180.5')).toBeNull();
    expect(cleanCoordinates('')).toBeNull();
    expect(cleanCoordinates('1e3,2')).toBeNull();
  });
});
