// Logout and page access (driver / admin) - Stefania (Week 2)
// After login, login.js saves "token" and "role" in localStorage.
// role is "driver" or "admin".

function isLoggedIn() {
  return localStorage.getItem("token") !== null;
}

function getRole() {
  return localStorage.getItem("role");
}

// forget who is logged in
function clearLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

// RQ04: log out and go back to the login page
function logout() {
  clearLogin();
  window.location.href = "login.html";
}

// RQ24: returns the page the user must be sent to,
// or null if the user is allowed to stay on this page
function whereToGo(pageRole) {
  if (!isLoggedIn()) {
    return "login.html";
  }

  var role = getRole();

  if (role === pageRole) {
    return null;
  }
  if (role === "admin") {
    return "admin.html";
  }
  if (role === "driver") {
    return "dashboard.html";
  }

  // unknown role
  return "login.html";
}

// every page calls this at the end, for example requireRole("driver")
function requireRole(pageRole) {
  var page = whereToGo(pageRole);

  if (page === "login.html") {
    clearLogin();
  }
  if (page !== null) {
    window.location.href = page;
  }
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = { isLoggedIn, getRole, clearLogin, logout, whereToGo, requireRole };
}
