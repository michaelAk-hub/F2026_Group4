/**
 * @jest-environment jsdom
 */
// Tests for logout and page access (driver / admin) - Stefania (Week 2)

const fs = require('fs');
const path = require('path');
const auth = require('../js/auth');

// pretend a user is logged in (mock data until the real login is ready)
function fakeLogin(role) {
  localStorage.setItem('token', 'test-token');
  localStorage.setItem('role', role);
}

beforeEach(() => {
  localStorage.clear();
});

describe('logout (RQ04)', () => {
  test('clearLogin removes the token and the role', () => {
    fakeLogin('driver');
    auth.clearLogin();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('role')).toBeNull();
  });

  test('after logout the user is not logged in', () => {
    fakeLogin('driver');
    auth.clearLogin();
    expect(auth.isLoggedIn()).toBe(false);
  });
});

describe('page access (RQ24)', () => {
  test('not logged in -> sent to the login page', () => {
    expect(auth.whereToGo('driver')).toBe('login.html');
    expect(auth.whereToGo('admin')).toBe('login.html');
  });

  test('driver can stay on a driver page', () => {
    fakeLogin('driver');
    expect(auth.whereToGo('driver')).toBeNull();
  });

  test('driver cannot open an admin page', () => {
    fakeLogin('driver');
    expect(auth.whereToGo('admin')).toBe('dashboard.html');
  });

  test('admin can stay on an admin page', () => {
    fakeLogin('admin');
    expect(auth.whereToGo('admin')).toBeNull();
  });

  test('admin opening a driver page is sent to the admin page', () => {
    fakeLogin('admin');
    expect(auth.whereToGo('driver')).toBe('admin.html');
  });

  test('unknown role -> sent to the login page', () => {
    fakeLogin('hacker');
    expect(auth.whereToGo('driver')).toBe('login.html');
  });
});

// check that the pages really use auth.js
function loadPage(fileName) {
  const html = fs.readFileSync(path.join(__dirname, '..', fileName), 'utf8');
  document.documentElement.innerHTML = html;
  return html;
}

const driverPages = ['dashboard.html', 'reservation.html', 'my-reservations.html'];

for (let i = 0; i < driverPages.length; i++) {
  const page = driverPages[i];

  describe(page + ' uses auth.js', () => {
    test('loads js/auth.js and allows only drivers', () => {
      const html = loadPage(page);
      expect(document.querySelector('script[src="js/auth.js"]')).not.toBeNull();
      expect(html).toContain('requireRole("driver")');
    });

    test('Logout link calls logout()', () => {
      loadPage(page);
      const links = document.querySelectorAll('.menu-links a');
      const logoutLink = links[links.length - 1];
      expect(logoutLink.textContent).toBe('Logout');
      expect(logoutLink.getAttribute('onclick')).toContain('logout()');
    });
  });
}

describe('admin.html', () => {
  test('loads js/auth.js and allows only admins', () => {
    const html = loadPage('admin.html');
    expect(document.querySelector('script[src="js/auth.js"]')).not.toBeNull();
    expect(html).toContain('requireRole("admin")');
  });

  test('has a Logout link that calls logout()', () => {
    loadPage('admin.html');
    const links = document.querySelectorAll('.menu-links a');
    const logoutLink = links[links.length - 1];
    expect(logoutLink.textContent).toBe('Logout');
    expect(logoutLink.getAttribute('onclick')).toContain('logout()');
  });
});
