// Tests for the live stream GET /api/spots/stream (src/services/spotStream.js). Run with: npm test
// A test server is started and the tests connect like a browser (EventSource) would.
// The database calls are replaced with example data, so these tests do not need MongoDB.
const http = require('http');
const request = require('supertest');
const app = require('../src/app');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');
const { SENSOR_TIMEOUT_MS } = require('../src/controllers/spotsController');
const stream = require('../src/services/spotStream');

let server;
let port;
const opened = []; // every connection a test opens, so it is always closed
let spots;
let sensors;

// Example data: 3 spots with working sensors (empty, occupied, empty)
function resetData() {
  const now = new Date();
  spots = [
    { _id: 's1', spotLocation: '01', spotStatus: 'Available' },
    { _id: 's2', spotLocation: '02', spotStatus: 'Taken' },
    { _id: 's3', spotLocation: '03', spotStatus: 'Available' },
  ];
  sensors = spots.map((s) => ({ parkingSpotID: s._id, sensorAvailability: 'Available', sensorLastSeen: now }));
}

// The models return the CURRENT example data, so a test can change a spot between two checks
function useData() {
  jest.spyOn(ParkingSpot, 'find').mockImplementation(() => ({ sort: () => ({ lean: async () => spots }) }));
  jest.spyOn(Sensor, 'find').mockImplementation(() => ({ lean: async () => sensors }));
}

// Opens the stream and collects the events, like the browser would
function openStream() {
  return new Promise((resolve, reject) => {
    const client = { events: [], raw: '', headers: null };
    const req = http.get({ port, path: '/api/spots/stream' }, (res) => {
      client.status = res.statusCode;
      client.headers = res.headers;
      let buffer = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        client.raw += chunk;
        buffer += chunk;
        let end = buffer.indexOf('\n\n');
        while (end >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const event = block.match(/^event: (.*)$/m);
          const data = block.match(/^data: (.*)$/m);
          if (event && data) client.events.push({ event: event[1], data: JSON.parse(data[1]) });
          end = buffer.indexOf('\n\n');
        }
      });
      client.close = () => req.destroy();
      opened.push(client);
      resolve(client);
    });
    req.on('error', reject);
  });
}

// Waits until check() is true (or fails the test after 2 seconds)
async function waitFor(check) {
  const end = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

beforeAll((done) => {
  stream.settings.pollMs = 50; // check fast in the tests (1 second in the real server)
  stream.settings.pingMs = 100;
  server = app.listen(0, () => {
    port = server.address().port;
    done();
  });
});

afterAll((done) => {
  stream.closeAll();
  server.closeAllConnections();
  server.close(done);
});

beforeEach(() => {
  resetData();
  useData();
});

afterEach(async () => {
  // close the connections also when a test failed in the middle
  opened.splice(0).forEach((c) => c.close());
  await waitFor(() => stream.clientCount() === 0);
  jest.restoreAllMocks();
});

describe('findChanges and sseMessage', () => {
  const spot = (id, status, lastUpdate) => ({ id, location: id, status, coordinates: null, lastUpdate });

  test('TC-MK17: finds new spots and spots whose state changed, but not a new lastUpdate time', () => {
    const before = new Map([['a', stream.mapKey(spot('a', 'empty', 't1'))], ['b', stream.mapKey(spot('b', 'empty', 't1'))]]);
    const now = [spot('a', 'empty', 't2'), spot('b', 'occupied', 't2'), spot('c', 'empty', 't2')];

    const { changed, removed } = stream.findChanges(before, now);
    expect(changed.map((s) => s.id)).toEqual(['b', 'c']);
    expect(removed).toEqual([]);
  });

  test('TC-MK18: reports a spot that was removed from the database', () => {
    const before = new Map([['a', stream.mapKey(spot('a', 'empty'))], ['b', stream.mapKey(spot('b', 'empty'))]]);
    const { changed, removed } = stream.findChanges(before, [spot('a', 'empty')]);
    expect(changed).toEqual([]);
    expect(removed).toEqual(['b']);
  });

  test('TC-MK19: builds a correct SSE message', () => {
    expect(stream.sseMessage('update', { total: 1 })).toBe('event: update\ndata: {"total":1}\n\n');
  });
});

describe('GET /api/spots/stream', () => {
  test('TC-MK20: opens an event stream and sends a snapshot of all spots first', async () => {
    const client = await openStream();
    await waitFor(() => client.events.length >= 1);

    expect(client.status).toBe(200);
    expect(client.headers['content-type']).toContain('text/event-stream');
    expect(client.headers['cache-control']).toBe('no-cache');
    expect(client.raw.startsWith('retry: 3000\n\n')).toBe(true);
    expect(client.events[0].event).toBe('snapshot');
    expect(client.events[0].data.total).toBe(3);
    expect(client.events[0].data.counts).toEqual({ empty: 2, occupied: 1, reserved: 0, unknown: 0 });

    await waitFor(() => client.raw.includes(': ping\n\n')); // keep-alive comment
    client.close();
  });

  test('TC-MK21: when a spot changes, sends only that spot and the new counts', async () => {
    const client = await openStream();
    await waitFor(() => client.events.length >= 1);

    spots[0] = { ...spots[0], spotStatus: 'Taken' }; // a car parks on spot 01
    await waitFor(() => client.events.some((e) => e.event === 'update'));

    const update = client.events.find((e) => e.event === 'update').data;
    expect(update.spots).toHaveLength(1);
    expect(update.spots[0]).toMatchObject({ id: 's1', status: 'occupied' });
    expect(update.counts).toEqual({ empty: 1, occupied: 2, reserved: 0, unknown: 0 });
    expect(update.removed).toEqual([]);
    client.close();
  });

  test('TC-MK22: nothing is sent when no spot changed (only the sensor time is newer)', async () => {
    const client = await openStream();
    await waitFor(() => client.events.length >= 1);

    sensors.forEach((s) => { s.sensorLastSeen = new Date(); }); // sensor heartbeat
    await sleep(250); // about 5 checks

    expect(client.events.filter((e) => e.event === 'update')).toHaveLength(0);
    client.close();
  });

  test('TC-MK23: every connected browser gets the update, and checking stops when all leave', async () => {
    const a = await openStream();
    const b = await openStream();
    await waitFor(() => a.events.length >= 1 && b.events.length >= 1);
    expect(stream.clientCount()).toBe(2);

    spots[2] = { ...spots[2], spotStatus: 'Reserved' };
    await waitFor(() => a.events.some((e) => e.event === 'update') && b.events.some((e) => e.event === 'update'));

    a.close();
    b.close();
    await waitFor(() => stream.clientCount() === 0);

    const callsAfterClose = ParkingSpot.find.mock.calls.length;
    await sleep(200);
    expect(ParkingSpot.find.mock.calls.length).toBe(callsAfterClose); // no more database queries
  });

  test('TC-MK24: a spot whose sensor goes silent becomes unknown on the map (RQ28)', async () => {
    sensors[0].sensorLastSeen = new Date(Date.now() - SENSOR_TIMEOUT_MS + 150); // limit is 150 ms away
    const client = await openStream();
    await waitFor(() => client.events.length >= 1);
    expect(client.events[0].data.spots[0].status).toBe('empty');

    await waitFor(() => client.events.some((e) => e.event === 'update'));
    const update = client.events.find((e) => e.event === 'update').data;
    expect(update.spots[0]).toMatchObject({ id: 's1', status: 'unknown' });
    client.close();
  });

  test('TC-MK25: a database error while checking does not close the stream; later changes still arrive', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const client = await openStream();
    await waitFor(() => client.events.length >= 1);

    ParkingSpot.find.mockImplementation(() => ({ sort: () => ({ lean: async () => { throw new Error('DB down'); } }) }));
    await sleep(150);
    useData(); // database works again
    spots[1] = { ...spots[1], spotStatus: 'Available' };

    await waitFor(() => client.events.some((e) => e.event === 'update'));
    expect(client.events.find((e) => e.event === 'update').data.spots[0]).toMatchObject({ id: 's2', status: 'empty' });
    client.close();
  });

  test('TC-MK26: a database error when connecting returns 500 without the inside error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    ParkingSpot.find.mockImplementation(() => ({ sort: () => ({ lean: async () => { throw new Error('DB down'); } }) }));

    const res = await request(app).get('/api/spots/stream');
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('DB down');
    expect(stream.clientCount()).toBe(0);
  });
});
