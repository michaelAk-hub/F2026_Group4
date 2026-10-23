/*
  validators.js
  Summary: Contains the rules that check the register and login forms (valid email,
  password length, matching passwords, car number format). It does not touch the page,
  it only takes the values and returns { valid: true/false, errors: {...} }. Because
  it is separate from the HTML, the automated tests in tests/frontend can test it directly.
*/

function isValidEmail(email) {
  if (!email) {
    return false;
  }
  email = email.trim();
  // Split the address into the part before @ and the domain after @.
  var parts = email.split("@");
  if (parts.length !== 2) {
    return false; // There must be exactly one @ symbol.
  }

  // Spaces, tabs and line breaks cannot appear inside an email address.
  // In this small regular expression, \s means any whitespace character.
  if (/\s/.test(email)) {
    return false;
  }

  var name = parts[0];
  var domain = parts[1];
  if (name.length === 0 || domain.length === 0) {
    return false;
  }
  // Allow common email-name characters: letters, digits, dot, underscore,
  // percent, plus and hyphen. This intentionally supports ordinary addresses.
  if (!/^[A-Za-z0-9._%+-]+$/.test(name)) {
    return false;
  }
  if (name.startsWith(".") || name.endsWith(".") || name.includes("..")) {
    return false;
  }

  // A normal web email domain has at least two parts, such as uni.edu.
  var domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return false;
  }
  for (var i = 0; i < domainParts.length; i++) {
    var part = domainParts[i];
    // Domain parts contain letters, numbers or hyphens, but cannot
    // be empty or start/end with a hyphen.
    if (!/^[A-Za-z0-9-]+$/.test(part) || part.startsWith("-") || part.endsWith("-")) {
      return false;
    }
  }

  // This is a basic format check. Only the server can check account details.
  return true;
}

function isValidCarNumber(car) {
  // Reject an empty car number.
  if (!car) {
    return false;
  }

  // Remove accidental spaces before or after the value.
  car = car.trim();

  // Require 3 letters followed by 3 numbers.
  // Allow one optional space: ABC123 or ABC 123.
  return /^[A-Za-z]{3} ?[0-9]{3}$/.test(car);
}

function isValidPassword(password) {
  if (!password) {
    return false;
  }
  // at least 8 characters and at least one number
  return password.length >= 8 && /[0-9]/.test(password);
}

function validateRegister(data) {
  // Each property stores an error for one input, for example errors.email.
  var errors = {};

  if (!data.name || data.name.trim().length < 2) {
    errors.name = "Name must have at least 2 characters.";
  }
  if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!isValidPassword(data.password)) {
    errors.password = "Password needs 8+ characters and a number.";
  }
  if (!data.confirmPassword || data.confirmPassword !== data.password) {
    errors.confirmPassword = "Passwords do not match.";
  }
  if (!isValidCarNumber(data.carNumber)) {
errors.carNumber = "Use 3 letters and 3 numbers: ABC123 or ABC 123.";
  }

  // No error properties means that all checks passed.
  return { valid: Object.keys(errors).length === 0, errors: errors };
}

function validateLogin(data) {
  var errors = {};

  if (!isValidEmail(data.email)) {
    errors.email = "Enter a valid email address.";
  }
  // Login checks only that a password was entered. The server will check
  // whether it matches the stored password in Week 2.
  if (!data.password || data.password.trim().length === 0) {
    errors.password = "Password is required.";
  }

  // No error properties means that all checks passed.
  return { valid: Object.keys(errors).length === 0, errors: errors };
}

// This line lets Node.js (the tests) use the functions above.
// The browser ignores it.
if (typeof module !== "undefined") {
  module.exports = { isValidEmail, isValidCarNumber, isValidPassword, validateRegister, validateLogin };
}
