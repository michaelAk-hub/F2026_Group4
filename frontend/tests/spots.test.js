/**
 * @jest-environment jsdom
 */
// Tests for the spot details panel, status filter and legend - Stefania (Week 3)
// and the "+ RESERVE A SPOT" button (Week 5)
// The map is empty in dashboard.html; Maria's map.js fills it from the server.
// Here drawSpots() puts spots into #map the same way her map.js does.

const fs = require('fs');
const path = require('path');
const spots = require('../js/spots');

// 01-10 on top, 11-20 on the bottom (example data)
const exampleStatuses = [
  'empty', 'empty', 'occupied', 'empty', 'reserved', 'empty', 'occupied', 'empty', 'unknown', 'empty',
  'empty', 'occupied', 'empty', 'empty', 'empty', 'occupied', 'empty', 'empty', 'empty', 'empty'
];

function drawSpots(statuses) {
  const map = document.getElementById('map');
  const rows = [];
  for (let i = 0; i < statuses.length; i++) {
    if (i % 10 === 0) {
      const row = document.createElement('div');
      row.className = 'parking-row';
      rows.push(row);
    }
    const tile = document.createElement('div');
    tile.className = 'spot ' + statuses[i];
    tile.dataset.spotId = 'spot-' + (i + 1);
    tile.textContent = String(i + 1).padStart(2, '0');
    rows[rows.length - 1].appendChild(tile);
  }
  map.replaceChildren(...rows);
  map.hidden = false;
}

// the browser tells refreshSpots about a new drawing a moment later
function waitForRefresh() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// find a spot on the map by its number, for example "05"
function findSpot(label) {
  const all = document.querySelectorAll('#map .spot');
  for (let i = 0; i < all.length; i++) {
    if (all[i].textContent === label) {
      return all[i];
    }
  }
  return null;
}

function visibleSpots() {
  return document.querySelectorAll('#map .spot:not(.hidden-spot)');
}

beforeEach(() => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  document.documentElement.innerHTML = html;
  spots.setupSpots();
  spots.filterSpots('all');
  spots.hideSpotDetails();
  drawSpots(exampleStatuses);
});

describe('small helper functions', () => {
  test('statusName makes the first letter capital', () => {
    expect(spots.statusName('empty')).toBe('Empty');
    expect(spots.statusName('reserved')).toBe('Reserved');
  });

  test('getStatus reads the status class of a spot', () => {
    expect(spots.getStatus(findSpot('05'))).toBe('reserved');
    expect(spots.getStatus(findSpot('03'))).toBe('occupied');
  });

  test('a spot without a status class counts as unknown', () => {
    const spot = document.createElement('div');
    spot.className = 'spot';
    expect(spots.getStatus(spot)).toBe('unknown');
  });
});

describe('spot details panel (RQ07)', () => {
  test('before a click the panel asks the user to click a spot', () => {
    expect(document.getElementById('detail-empty').hidden).toBe(false);
    expect(document.getElementById('detail-info').hidden).toBe(true);
  });

  test('clicking a spot shows its number and status', () => {
    findSpot('05').click();
    expect(document.getElementById('detail-info').hidden).toBe(false);
    expect(document.getElementById('detail-id').textContent).toBe('05');
    expect(document.getElementById('detail-status').textContent).toBe('Reserved');
  });

  test('the clicked spot is marked on the map', () => {
    findSpot('03').click();
    findSpot('12').click();
    expect(findSpot('12').classList.contains('selected')).toBe(true);
    expect(findSpot('03').classList.contains('selected')).toBe(false);
  });

  test('the Reserve link is shown only for an empty spot', () => {
    findSpot('01').click();
    expect(document.getElementById('detail-reserve').hidden).toBe(false);
    findSpot('03').click();
    expect(document.getElementById('detail-reserve').hidden).toBe(true);
  });

  test('an unknown spot says there is no sensor data', () => {
    findSpot('09').click();
    expect(document.getElementById('detail-status').textContent).toBe('Unknown');
    expect(document.getElementById('detail-message').textContent).toContain('No data');
  });
});

describe('status filter', () => {
  test('Occupied shows only the occupied spots', () => {
    spots.filterSpots('occupied');
    const shown = visibleSpots();
    expect(shown.length).toBe(4);
    for (let i = 0; i < shown.length; i++) {
      expect(shown[i].classList.contains('occupied')).toBe(true);
    }
  });

  test('All shows every spot again', () => {
    spots.filterSpots('empty');
    spots.filterSpots('all');
    expect(visibleSpots().length).toBe(20);
  });

  test('clicking a legend button filters the map', () => {
    document.querySelector('#legend button[data-status="reserved"]').click();
    expect(visibleSpots().length).toBe(1);
    expect(visibleSpots()[0].textContent).toBe('05');
  });

  test('only the chosen button is active', () => {
    spots.filterSpots('empty');
    const active = document.querySelectorAll('#legend button.active');
    expect(active.length).toBe(1);
    expect(active[0].dataset.status).toBe('empty');
  });
});

describe('when the map is drawn again with new data', () => {
  test('the chosen filter is kept', async () => {
    spots.filterSpots('occupied');
    drawSpots(exampleStatuses);
    await waitForRefresh();
    expect(visibleSpots().length).toBe(4);
  });

  test('the panel shows the new status of the clicked spot', async () => {
    findSpot('01').click();
    const changed = exampleStatuses.slice();
    changed[0] = 'occupied';
    drawSpots(changed);
    await waitForRefresh();
    expect(document.getElementById('detail-status').textContent).toBe('Occupied');
    expect(document.getElementById('detail-reserve').hidden).toBe(true);
    expect(findSpot('01').classList.contains('selected')).toBe(true);
  });

  test('if the clicked spot is gone, the panel goes back to its message', async () => {
    findSpot('20').click();
    drawSpots(exampleStatuses.slice(0, 10));
    await waitForRefresh();
    expect(document.getElementById('detail-info').hidden).toBe(true);
    expect(document.getElementById('detail-empty').hidden).toBe(false);
  });
});

describe('legend (RQ26)', () => {
  test('has All and the 4 spot states', () => {
    const buttons = document.querySelectorAll('#legend button');
    const states = [];
    for (let i = 0; i < buttons.length; i++) {
      states.push(buttons[i].dataset.status);
    }
    expect(states).toEqual(['all', 'empty', 'occupied', 'reserved', 'unknown']);
  });

  test('each status button has a dot in its colour', () => {
    const states = ['empty', 'occupied', 'reserved', 'unknown'];
    for (let i = 0; i < states.length; i++) {
      const button = document.querySelector('#legend button[data-status="' + states[i] + '"]');
      expect(button.querySelector('.dot.' + states[i])).not.toBeNull();
    }
  });
});

describe('+ RESERVE A SPOT button (Week 5)', () => {
  test('without a chosen spot it stays on the dashboard and shows only the free spots', () => {
    expect(spots.quickReserve()).toBeNull();
    expect(visibleSpots().length).toBe(14);
    expect(document.getElementById('detail-empty').textContent).toContain('Choose a green spot');
  });

  test('with a free spot chosen it goes to the reservation page with that spot', () => {
    findSpot('01').click();
    expect(spots.quickReserve()).toBe('reservation.html?spotId=spot-1');
  });

  test('an occupied spot is not sent to the reservation page', () => {
    findSpot('03').click();
    expect(spots.quickReserve()).toBeNull();
    expect(document.getElementById('detail-info').hidden).toBe(true);
  });

  test('clicking the button without a spot does not open the reservation page', () => {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    document.querySelector('#quick-actions a.btn').dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(document.getElementById('legend').querySelector('button.active').dataset.status).toBe('empty');
  });

  test('clicking a spot after the message shows its details again', () => {
    spots.quickReserve();
    findSpot('02').click();
    expect(document.getElementById('detail-info').hidden).toBe(false);
    expect(document.getElementById('detail-id').textContent).toBe('02');
  });
});

test('dashboard loads js/spots.js after the map and calls setupSpots()', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'dashboard.html'), 'utf8');
  expect(html.indexOf('js/spots.js')).toBeGreaterThan(html.indexOf('js/map.js'));
  expect(html).toContain('setupSpots()');
});
