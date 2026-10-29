// Tests for GET /api/spots (src/controllers/spotsController.js). Run with: npm test
// The database calls are replaced with example data, so these tests do not need MongoDB.
const request = require('supertest');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const { spotState, SENSOR_TIMEOUT_MS } = require('../src/controllers/spotsController');

const NOW = Date.now();
const fresh = new Date(NOW - 10 * 1000); // sensor reported 10 seconds ago
const old = new Date(NOW - SENSOR_TIMEOUT_MS - 60 * 1000); // sensor silent for too long

// Example data: 5 spots. Spot 04 has a sensor that is silent too long, spot 05 has no sensor.
const spots = [
  { _id: 's1', spotLocation: '01', spotStatus: 'Available' },
  { _id: 's2', spotLocation: '02', spotStatus: 'Taken' },
  { _id: 's3', spotLocation: '03', spotStatus: 'Reserved' },
  { _id: 's4', spotLocation: '04', spotStatus: 'Available' },
  { _id: 's5', spotLocation: '05', spotStatus: 'Available' },
];
const sensors = [
  { parkingSpotID: 's1', sensorAvailability: 'Available', sensorLocationCoordinates: '34.6786,33.0413', sensorLastSeen: fresh },
  { parkingSpotID: 's2', sensorAvailability: 'Available', sensorLastSeen: fresh },
  { parkingSpotID: 's3', sensorAvailability: 'Available', sensorLastSeen: fresh },
  { parkingSpotID: 's4', sensorAvailability: 'Available', sensorLastSeen: old },
];

// Makes ParkingSpot.find().sort().lean() and Sensor.find().lean() return the example data
function useData(spotList, sensorList) {
  jest.spyOn(ParkingSpot, 'find').mockReturnValue({ sort: () => ({ lean: async () => spotList }) });
  jest.spyOn(Sensor, 'find').mockReturnValue({ lean: async () => sensorList });
}

afterEach(() => jest.restoreAllMocks());

describe('spotState', () => {
  test('TC-MK07: database status is shown as empty / occupied / reserved', () => {
    const online = { sensorAvailability: 'Available', sensorLastSeen: fresh };
    expect(spotState({ spotStatus: 'Available' }, online, NOW)).toBe('empty');
    expect(spotState({ spotStatus: 'Taken' }, online, NOW)).toBe('occupied');
    expect(spotState({ spotStatus: 'Reserved' }, online, NOW)).toBe('reserved');
  });

  test('TC-MK08: a spot without a sensor is unknown', () => {
    expect(spotState({ spotStatus: 'Available' }, undefined, NOW)).toBe('unknown');
  });

  test('TC-MK09: a spot is unknown when its sensor is silent for more than 2 minutes', () => {
    const atLimit = { sensorAvailability: 'Available', sensorLastSeen: new Date(NOW - SENSOR_TIMEOUT_MS) };
    const overLimit = { sensorAvailability: 'Available', sensorLastSeen: new Date(NOW - SENSOR_TIMEOUT_MS - 1000) };
    expect(spotState({ spotStatus: 'Taken' }, atLimit, NOW)).toBe('occupied');
    expect(spotState({ spotStatus: 'Taken' }, overLimit, NOW)).toBe('unknown');
  });

  test('TC-MK15: a spot is unknown at once when its sensor is offline', () => {
    const offline = { sensorAvailability: 'Unavailable', sensorLastSeen: fresh };
    expect(spotState({ spotStatus: 'Available' }, offline, NOW)).toBe('unknown');
    expect(spotState({ spotStatus: 'Taken' }, offline, NOW)).toBe('unknown');
  });

  test('TC-MK16: a sensor that never sent a message (no sensorLastSeen) gives unknown', () => {
    expect(spotState({ spotStatus: 'Available' }, { sensorAvailability: 'Available' }, NOW)).toBe('unknown');
  });
});

describe('GET /api/spots', () => {
  test('TC-MK10: returns every spot with its state, and the counts for the dashboard', async () => {
    useData(spots, sensors);
    const res = await request(app).get('/api/spots');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5);
    expect(res.body.counts).toEqual({ empty: 1, occupied: 1, reserved: 1, unknown: 2 });
    expect(res.body.spots.map((s) => s.status)).toEqual(['empty', 'occupied', 'reserved', 'unknown', 'unknown']);
    expect(res.body.spots[0]).toMatchObject({ id: 's1', location: '01', coordinates: '34.6786,33.0413' });
    expect(res.body.spots[4]).toMatchObject({ location: '05', coordinates: null, lastUpdate: null });
  });

  test('TC-MK11: ?status=unknown returns only those spots, counts stay for all spots', async () => {
    useData(spots, sensors);
    const res = await request(app).get('/api/spots?status=unknown');

    expect(res.status).toBe(200);
    expect(res.body.spots.map((s) => s.location)).toEqual(['04', '05']);
    expect(res.body.total).toBe(5);
    expect(res.body.counts.empty).toBe(1);
  });

  test('TC-MK12: a wrong status filter returns 400 with a clear message', async () => {
    useData(spots, sensors);
    const res = await request(app).get('/api/spots?status=free');

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('status must be one of: empty, occupied, reserved, unknown');
  });

  test('TC-MK13: no spots in the database returns an empty list', async () => {
    useData([], []);
    const res = await request(app).get('/api/spots');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ total: 0, counts: { empty: 0, occupied: 0, reserved: 0, unknown: 0 }, spots: [] });
  });

  test('TC-MK14: a database error returns 500 and does not crash the server', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(ParkingSpot, 'find').mockReturnValue({ sort: () => ({ lean: async () => { throw new Error('DB down'); } }) });
    jest.spyOn(Sensor, 'find').mockReturnValue({ lean: async () => [] });
    const res = await request(app).get('/api/spots');

    expect(res.status).toBe(500);
    // the user must not see the inside error ("DB down")
    expect(JSON.stringify(res.body)).not.toContain('DB down');
  });
});
