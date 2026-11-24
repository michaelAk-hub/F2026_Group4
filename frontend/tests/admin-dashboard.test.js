/**
 * @jest-environment jsdom
 */
// Tests for the admin dashboard page (js/admin-dashboard.js) - Michalis (Member 5, Week 6)
// The page is loaded into a simulated browser. The live stream (EventSource) and the API
// (getFromApi of api.js) are replaced with fake ones, so no server is needed.

const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');

// A fake EventSource that the test can "send" events through
class FakeEventSource {
  constructor(url) {
    this.url = url;
    this.listeners = {};
    FakeEventSource.last = this;
  }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  send(name, data) { this.listeners[name]({ data: JSON.stringify(data) }); }
}

const spot = (n, status) => ({ id: 's' + n, location: 'Lot A - Spot ' + String(n).padStart(2, '0'), status });

// 12 spots: 01-03 occupied, 04 reserved, 05 unknown, the rest empty
function snapshot() {
  const spots = [];
  for (let n = 12; n >= 1; n--) {
    spots.push(spot(n, n <= 3 ? 'occupied' : n === 4 ? 'reserved' : n === 5 ? 'unknown' : 'empty'));
  }
  return { total: 12, counts: {}, spots };
}

const SUMMARY = {
  occupancy: { activeReservations: 2 },
  revenue: { currency: 'EUR', last24h: { amount: 8, payments: 2 }, last7d: { amount: 12.5, payments: 3 }, last30d: { amount: 40, payments: 10 } },
  refunds: { last30d: { amount: 4, payments: 1 } },
  latestPayments: [
    { receiptId: 'RCPT-AAA111', amount: 4, paidAt: '2026-11-24T10:05:00.000Z', spot: 'Lot A - Spot 07' },
    { receiptId: '<img src=x onerror=alert(1)>', amount: 4, paidAt: '2026-11-24T09:00:00.000Z', spot: null },
  ],
};

let dashboard;
const text = (id) => document.getElementById(id).textContent;

beforeEach(() => {
  jest.resetModules();
  document.documentElement.innerHTML = html;
  localStorage.setItem('token', 'admin-token');
  global.API_BASE_URL = 'http://localhost:3000/api';
  global.getFromApi = jest.fn(async () => SUMMARY);
  global.EventSource = FakeEventSource;
  dashboard = require('../js/admin-dashboard');
});

afterEach(() => {
  delete global.getFromApi;
  delete global.EventSource;
  localStorage.clear();
});

test('TC-MK63: euros are shown with 2 decimals, and spot names with their number', () => {
  expect(dashboard.formatEuro(4)).toBe('€4.00');
  expect(dashboard.formatEuro(12.5)).toBe('€12.50');
  expect(dashboard.formatEuro(undefined)).toBe('€0.00');
  expect(dashboard.spotNumber('Lot A - Spot 07')).toBe('07');
  expect(dashboard.spotNumber('B2')).toBe('B2');
});

test('TC-MK64: the snapshot fills the occupancy boxes and draws the map in the order of the car park (RQ05, RQ18, RQ26)', () => {
  dashboard.applySnapshot(snapshot());

  expect(text('occ-total')).toBe('12');
  expect(text('occ-occupied')).toBe('3');
  expect(text('occ-empty')).toBe('7');
  expect(text('occ-reserved')).toBe('1');
  expect(text('occ-unknown')).toBe('1');
  expect(text('occ-percent')).toBe('25%');

  const tiles = [...document.querySelectorAll('#admin-map .spot')];
  expect(tiles.map((t) => t.textContent)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
  expect(tiles[0].className).toBe('spot occupied');
  expect(tiles[3].className).toBe('spot reserved');
  expect(document.querySelectorAll('#admin-map .parking-row')).toHaveLength(2);
  expect(document.querySelectorAll('#admin-map .driving-lane')).toHaveLength(1);
});

test('TC-MK65: an update changes only the spots it contains, and removed spots disappear (RQ18, RQ22)', () => {
  dashboard.applySnapshot(snapshot());
  dashboard.applyUpdate({ spots: [spot(6, 'occupied')], removed: ['s12'] });

  expect(text('occ-total')).toBe('11');
  expect(text('occ-occupied')).toBe('4');
  expect(text('occ-percent')).toBe('36%');
  const tiles = [...document.querySelectorAll('#admin-map .spot')];
  expect(tiles.map((t) => t.textContent)).not.toContain('12');
  expect(tiles[5].className).toBe('spot occupied');
  expect(tiles[0].className).toBe('spot occupied'); // unchanged spots keep their state
});

test('TC-MK66: the revenue, refunds and latest payments are shown, and server text is never treated as HTML (RQ18, RQ11)', () => {
  dashboard.renderSummary(SUMMARY);

  expect(text('rev-24h')).toBe('€8.00');
  expect(text('rev-24h-count')).toBe('2 payments');
  expect(text('rev-7d')).toBe('€12.50');
  expect(text('rev-30d')).toBe('€40.00');
  expect(text('refunds-30d')).toBe('€4.00');
  expect(text('refunds-30d-count')).toBe('1 refund');
  expect(text('active-reservations')).toBe('2');

  const rows = [...document.querySelectorAll('#latest-payments tbody tr')];
  expect(rows).toHaveLength(2);
  expect([...rows[0].cells].map((c) => c.textContent).slice(0, 3)).toEqual(['RCPT-AAA111', '07', '€4.00']);
  expect(rows[1].cells[1].textContent).toBe('—');
  expect(document.querySelector('#latest-payments img')).toBeNull(); // shown as text only
  expect(document.getElementById('no-payments').hidden).toBe(true);
});

test('TC-MK67: the live map listens to the spots stream and shows when the connection is lost (RQ22)', () => {
  const source = dashboard.startLiveMap();
  expect(source.url).toBe('http://localhost:3000/api/spots/stream');

  source.send('snapshot', snapshot());
  expect(text('live-status')).toBe('● Live');
  expect(text('occ-occupied')).toBe('3');

  source.onerror();
  expect(text('live-status')).toBe('Reconnecting…');
  expect(document.getElementById('live-status').classList.contains('offline')).toBe(true);

  source.send('update', { spots: [spot(1, 'empty')], removed: [] });
  expect(text('occ-occupied')).toBe('2');
  expect(text('live-status')).toBe('● Live');
});

test('TC-MK68: the revenue is loaded with the admin token; an error is shown in a clear message (RQ18, RQ27)', async () => {
  expect(await dashboard.loadSummary()).toBe(true);
  expect(global.getFromApi).toHaveBeenCalledWith('/admin/dashboard', 'admin-token');
  expect(document.getElementById('admin-message').hidden).toBe(true);

  global.getFromApi.mockRejectedValueOnce(new Error('Login expired, please log in again.'));
  expect(await dashboard.loadSummary()).toBe(false);
  expect(text('admin-message')).toBe('Could not load the revenue: Login expired, please log in again.');
  expect(document.getElementById('admin-message').hidden).toBe(false);
});

test('TC-MK69: admin.html loads the dashboard after api.js and still allows only admins (RQ24)', () => {
  const scripts = [...document.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
  expect(scripts).toEqual(['js/auth.js', 'js/api.js', 'js/admin-dashboard.js']);
  expect(html).toContain('requireRole("admin")');
  expect(html).toContain('startAdminDashboard()');
});
