/*
  Run: npm test (Node.js 18 or newer).
  Node includes this test runner, so no extra package needs to be installed.
  Each test gives a function some input and checks the expected result.
*/
const test = require("node:test");
const assert = require("node:assert/strict");
const validators = require("../../frontend/js/validators.js");

// Checks for isValidEmail
test("isValidEmail: accepts 'maria@uni.edu'", function () {
  assert.equal(validators.isValidEmail("maria@uni.edu"), true);
});

test("isValidEmail: accepts ' maria@uni.edu '", function () {
  assert.equal(validators.isValidEmail(" maria@uni.edu "), true);
});

test("isValidEmail: accepts 'maria+parking@uni.edu'", function () {
  assert.equal(validators.isValidEmail("maria+parking@uni.edu"), true);
});

test("isValidEmail: rejects ''", function () {
  assert.equal(validators.isValidEmail(""), false);
});

test("isValidEmail: rejects 'maria.uni.edu'", function () {
  assert.equal(validators.isValidEmail("maria.uni.edu"), false);
});

test("isValidEmail: rejects '@.'", function () {
  assert.equal(validators.isValidEmail("@."), false);
});

test("isValidEmail: rejects 'a@b.'", function () {
  assert.equal(validators.isValidEmail("a@b."), false);
});

test("isValidEmail: rejects 'a@@b.com'", function () {
  assert.equal(validators.isValidEmail("a@@b.com"), false);
});

test("isValidEmail: rejects 'a b@c.com'", function () {
  assert.equal(validators.isValidEmail("a b@c.com"), false);
});

test("isValidEmail: rejects 'a@b..com'", function () {
  assert.equal(validators.isValidEmail("a@b..com"), false);
});

test("isValidEmail: rejects 'a@-b.com'", function () {
  assert.equal(validators.isValidEmail("a@-b.com"), false);
});

test("isValidEmail: rejects '.a@b.com'", function () {
  assert.equal(validators.isValidEmail(".a@b.com"), false);
});

// Checks for isValidCarNumber
test("isValidCarNumber: accepts 'ABC123'", function () {
  assert.equal(validators.isValidCarNumber("ABC123"), true);
});

test("isValidCarNumber: accepts ' ABC 123 '", function () {
  assert.equal(validators.isValidCarNumber(" ABC 123 "), true);
});

test("isValidCarNumber: accepts 'AB-123'", function () {
  assert.equal(validators.isValidCarNumber("AB-123"), false);
});

test("isValidCarNumber: rejects ''", function () {
  assert.equal(validators.isValidCarNumber(""), false);
});

test("isValidCarNumber: rejects 'A1'", function () {
  assert.equal(validators.isValidCarNumber("A1"), false);
});

test("isValidCarNumber: rejects 'AB#123'", function () {
  assert.equal(validators.isValidCarNumber("AB#123"), false);
});

test("isValidCarNumber: rejects '---'", function () {
  assert.equal(validators.isValidCarNumber("---"), false);
});

test("isValidCarNumber: rejects '   '", function () {
  assert.equal(validators.isValidCarNumber("   "), false);
});

test("isValidCarNumber: rejects 'ABCDEFGHIJK'", function () {
  assert.equal(validators.isValidCarNumber("ABCDEFGHIJK"), false);
});

// Checks for isValidPassword
test("isValidPassword: accepts 'parking123'", function () {
  assert.equal(validators.isValidPassword("parking123"), true);
});

test("isValidPassword: accepts '12345678'", function () {
  assert.equal(validators.isValidPassword("12345678"), true);
});

test("isValidPassword: rejects 'a1'", function () {
  assert.equal(validators.isValidPassword("a1"), false);
});

test("isValidPassword: rejects 'onlyletters'", function () {
  assert.equal(validators.isValidPassword("onlyletters"), false);
});

test("isValidPassword: rejects ''", function () {
  assert.equal(validators.isValidPassword(""), false);
});

// Return a fresh example each time, so one test cannot affect another.
function validRegistration() {
  return {
    name: "Maria",
    email: "maria@uni.edu",
    password: "parking123",
    confirmPassword: "parking123",
    carNumber: "ABC123"
  };
}

test("registration accepts valid information", function () {
  assert.equal(validators.validateRegister(validRegistration()).valid, true);
});

test("empty registration has one error for every field", function () {
  var result = validators.validateRegister({});
  assert.equal(result.valid, false);
  assert.deepEqual(Object.keys(result.errors).sort(),
    ["carNumber", "confirmPassword", "email", "name", "password"]);
});

test("only the incorrect email receives an error", function () {
  var data = validRegistration();
  data.email = "wrong";
  assert.deepEqual(Object.keys(validators.validateRegister(data).errors), ["email"]);
});

test("different passwords are rejected", function () {
  var data = validRegistration();
  data.confirmPassword = "other1234";
  assert.equal(validators.validateRegister(data).errors.confirmPassword,
    "Passwords do not match.");
});

test("a name containing only spaces is rejected", function () {
  var data = validRegistration();
  data.name = "   ";
  assert.equal(validators.validateRegister(data).valid, false);
});

// Login does not apply registration rules to an existing password.
// The backend will verify the credentials in Week 2.
test("login accepts a filled email and password", function () {
  assert.equal(validators.validateLogin({email: "maria@uni.edu", password: "x"}).valid, true);
});

test("login rejects a missing password", function () {
  assert.equal(validators.validateLogin({email: "maria@uni.edu", password: ""}).valid, false);
});

test("login rejects a password containing only spaces", function () {
  assert.equal(validators.validateLogin({email: "maria@uni.edu", password: "   "}).valid, false);
});

test("login rejects an invalid email", function () {
  assert.equal(validators.validateLogin({email: "@.", password: "parking123"}).valid, false);
});

// Angle brackets belong to display-name notation, not this address field.
test("email rejects angle brackets", function () {
  assert.equal(validators.isValidEmail("a<@b.com"), false);
});

// Reject an extra number.
test("car number rejects ABC1234", function () {
  assert.equal(validators.isValidCarNumber("ABC1234"), false);
});

// Reject a missing letter.
test("car number rejects AB123", function () {
  assert.equal(validators.isValidCarNumber("AB123"), false);
});