/*
  api.test.cjs — Maria Antoniou (Week 2)
  Checks api.js with simulated server replies. No backend is needed.
  Run from the repository root:
  node --test tests/frontend/api.test.cjs
*/
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Read the real API helper from the project.
const apiPath = path.join(__dirname, '../../frontend/js/api.js');
const apiCode = fs.readFileSync(apiPath, 'utf8');

// Each test gets a fresh copy of api.js with a fake fetch function.
// This lets us choose the server reply without contacting a server.
function loadApi(fakeFetch) {
  const context = vm.createContext({ fetch: fakeFetch });
  vm.runInContext(apiCode, context);
  return context.postToApi;
}

test('sends a POST request with JSON to the correct URL', async function () {
  let sentUrl;
  let sentOptions;
  const postToApi = loadApi(async function (url, options) {
    sentUrl = url;
    sentOptions = options;
    return {
      ok: true,
      json: async function () {
        return { token: 'example-token', role: 'driver' };
      }
    };
  });

  const data = { email: 'test@example.com', password: ' Test1234 ' };
  const reply = await postToApi('/auth/login', data);

  assert.equal(sentUrl, 'http://localhost:3000/api/auth/login');
  assert.equal(sentOptions.method, 'POST');
  assert.equal(sentOptions.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(sentOptions.body), data);
  assert.equal(reply.token, 'example-token');
  assert.equal(reply.role, 'driver');
});

test('returns a successful registration reply', async function () {
  const postToApi = loadApi(async function () {
    return {
      ok: true,
      json: async function () { return { message: 'Account created' }; }
    };
  });
  const reply = await postToApi('/auth/register', {});
  assert.equal(reply.message, 'Account created');
});

test('shows the server message when login is rejected', async function () {
  const postToApi = loadApi(async function () {
    return {
      ok: false,
      json: async function () {
        return { message: 'Incorrect email or password.' };
      }
    };
  });
  await assert.rejects(postToApi('/auth/login', {}), {
    message: 'Incorrect email or password.'
  });
});

test('uses a fallback when a failed reply has no message', async function () {
  const postToApi = loadApi(async function () {
    return { ok: false, json: async function () { return {}; } };
  });
  await assert.rejects(postToApi('/auth/login', {}), {
    message: 'The request failed. Please try again.'
  });
});

test('handles a connection failure', async function () {
  const postToApi = loadApi(async function () {
    throw new Error('Connection failed');
  });
  await assert.rejects(postToApi('/auth/login', {}), {
    message: 'Cannot connect to the server. Please try again later.'
  });
});

test('handles a reply that cannot be read as JSON', async function () {
  const postToApi = loadApi(async function () {
    return {
      ok: true,
      json: async function () { throw new Error('Invalid JSON'); }
    };
  });
  await assert.rejects(postToApi('/auth/login', {}), {
    message: 'The server returned an unexpected response. Please try again.'
  });
});
