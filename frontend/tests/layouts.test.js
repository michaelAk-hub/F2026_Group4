/**
 * @jest-environment jsdom
 */
// Tests for my 3 pages - Stefania (Week 1)
// Each test loads the html file and checks that the main parts are there

const fs = require('fs');
const path = require('path');

function loadPage(fileName) {
  const filePath = path.join(__dirname, '..', fileName);
  const html = fs.readFileSync(filePath, 'utf8');
  document.documentElement.innerHTML = html;
}

// things that all 3 pages must have
const pages = ['dashboard.html', 'reservation.html', 'my-reservations.html'];

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];

  describe(page, () => {
    beforeEach(() => {
      loadPage(page);
    });

    test('uses tokens.css and layout.css', () => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      expect(links.length).toBe(2);
      expect(links[0].getAttribute('href')).toBe('css/tokens.css');
      expect(links[1].getAttribute('href')).toBe('css/layout.css');
    });

    test('menu is in the left sidebar', () => {
      expect(document.querySelector('.sidebar .menu-links')).not.toBeNull();
    });

    test('menu has 4 links and the last one is Logout', () => {
      const links = document.querySelectorAll('.menu-links a');
      expect(links.length).toBe(4);
      expect(links[3].textContent).toBe('Logout');
    });

    test('all menu links go to pages that exist', () => {
      const links = document.querySelectorAll('.menu-links a');
      for (let j = 0; j < links.length; j++) {
        const file = path.join(__dirname, '..', links[j].getAttribute('href'));
        expect(fs.existsSync(file)).toBe(true);
      }
    });

    test('only the current page is active in the menu', () => {
      const active = document.querySelectorAll('.menu-links a.active');
      expect(active.length).toBe(1);
      expect(active[0].getAttribute('href')).toBe(page);
    });
  });
}

describe('dashboard page', () => {
  beforeEach(() => {
    loadPage('dashboard.html');
  });

  test('shows the title', () => {
    expect(document.querySelector('h1').textContent).toBe('Parking Dashboard');
  });

  test('legend has the 4 spot states', () => {
    const items = document.querySelectorAll('#legend li');
    expect(items.length).toBe(4);
    expect(items[0].textContent).toBe('Empty');
    expect(items[1].textContent).toBe('Occupied');
    expect(items[2].textContent).toBe('Reserved');
    expect(items[3].textContent).toBe('Unknown');
  });

  test('map has 20 spots', () => {
    const spots = document.querySelectorAll('#map .spot');
    expect(spots.length).toBe(20);
  });

  test('every spot has a status colour', () => {
    const spots = document.querySelectorAll('#map .spot');
    for (let i = 0; i < spots.length; i++) {
      const c = spots[i].classList;
      const hasColour = c.contains('empty') || c.contains('occupied') || c.contains('reserved') || c.contains('unknown');
      expect(hasColour).toBe(true);
    }
  });

  test('map has 2 rows of 10 spots and a road between them', () => {
    const rows = document.querySelectorAll('#map .parking-row');
    expect(rows.length).toBe(2);
    expect(rows[0].querySelectorAll('.spot').length).toBe(10);
    expect(rows[1].querySelectorAll('.spot').length).toBe(10);
    expect(document.querySelector('#map .driving-lane')).not.toBeNull();
  });

  test('the Empty number in the summary is the same as the green spots', () => {
    const greenSpots = document.querySelectorAll('#map .spot.empty').length;
    const numbers = document.querySelectorAll('#summary .numbers b');
    expect(Number(numbers[1].textContent)).toBe(greenSpots);
  });

  test('the Total, Occupied and Reserved numbers match the map', () => {
    const numbers = document.querySelectorAll('#summary .numbers b');
    expect(numbers.length).toBe(4);
    expect(Number(numbers[0].textContent)).toBe(document.querySelectorAll('#map .spot').length);
    expect(Number(numbers[2].textContent)).toBe(document.querySelectorAll('#map .spot.occupied').length);
    expect(Number(numbers[3].textContent)).toBe(document.querySelectorAll('#map .spot.reserved').length);
  });

  test('reserve button goes to the reservation page', () => {
    const button = document.querySelector('#quick-actions a.btn');
    expect(button.getAttribute('href')).toBe('reservation.html');
  });
});

describe('reservation page', () => {
  beforeEach(() => {
    loadPage('reservation.html');
  });

  test('summary shows the spot and the total amount', () => {
    const summary = document.getElementById('reservation-summary').textContent;
    expect(summary).toContain('Parking spot');
    expect(summary).toContain('Total amount');
  });

  test('payment form has the 4 card fields with labels', () => {
    const ids = ['cardName', 'cardNumber', 'expiry', 'cvv'];
    for (let i = 0; i < ids.length; i++) {
      expect(document.getElementById(ids[i])).not.toBeNull();
      expect(document.querySelector('label[for="' + ids[i] + '"]')).not.toBeNull();
    }
  });

  test('has a pay button', () => {
    const button = document.querySelector('#payment-form button');
    expect(button.textContent).toContain('PAY');
  });
});

describe('my reservations page', () => {
  beforeEach(() => {
    loadPage('my-reservations.html');
  });

  test('has 4 filter buttons', () => {
    const buttons = document.querySelectorAll('#filters .filter-btn');
    expect(buttons.length).toBe(4);
    expect(buttons[0].textContent).toBe('All');
  });

  test('table has 5 columns', () => {
    const headers = document.querySelectorAll('#reservations-table th');
    expect(headers.length).toBe(5);
  });

  test('every row has 5 cells', () => {
    const rows = document.querySelectorAll('#reservations-table tbody tr');
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i].querySelectorAll('td').length).toBe(5);
    }
  });

  test('no reservations message is hidden when there are rows', () => {
    const message = document.getElementById('empty-message');
    expect(message.hidden).toBe(true);
  });
});
