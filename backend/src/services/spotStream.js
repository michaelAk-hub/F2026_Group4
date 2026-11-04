// Live updates of the parking spots for the map (Member 5, Week 3).
// GET /api/spots/stream uses Server-Sent Events (SSE): the browser keeps the
// connection open with  new EventSource('/api/spots/stream')  and the server
// writes a message every time a spot changes.
//
// One shared timer checks the spots every POLL_MS for ALL connected browsers,
// so the database work is the same for 1 or 100 users (RQ21). Checking is also
// needed because a spot becomes "unknown" when its sensor goes silent (RQ28),
// even if nothing is written to the database.
const { loadSpots } = require('../controllers/spotsController');

const settings = {
  pollMs: 1000, // RQ22: a change reaches the map within 5 seconds
  pingMs: 20000, // a comment line keeps the connection open through proxies
};

const clients = new Set(); // open responses (one per browser)
let lastSent = new Map(); // spot id -> what the map shows for it
let pollTimer = null;
let pingTimer = null;
let checking = false;

// One SSE message:  "event: <name>\ndata: <json>\n\n"
function sseMessage(event, data) {
  return 'event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n';
}

// Only these fields matter for the map. lastUpdate is left out on purpose:
// it changes with every sensor heartbeat and would send useless updates.
function mapKey(spot) {
  return JSON.stringify([spot.status, spot.location, spot.coordinates]);
}

// Compares the last state with the new one and returns what changed
function findChanges(previous, spots) {
  const changed = spots.filter((s) => previous.get(s.id) !== mapKey(s));
  const ids = new Set(spots.map((s) => s.id));
  const removed = [...previous.keys()].filter((id) => !ids.has(id));
  return { changed, removed };
}

function remember(spots) {
  lastSent = new Map(spots.map((s) => [s.id, mapKey(s)]));
}

function sendToAll(text) {
  clients.forEach((res) => res.write(text));
}

// Runs every POLL_MS while at least one browser is connected
async function check() {
  if (checking) return; // the previous check is still running
  checking = true;
  try {
    const result = await loadSpots();
    const { changed, removed } = findChanges(lastSent, result.spots);
    if (changed.length > 0 || removed.length > 0) {
      remember(result.spots);
      sendToAll(sseMessage('update', { total: result.total, counts: result.counts, spots: changed, removed }));
    }
  } catch (err) {
    // keep the browsers connected; the next check tries again
    console.error('[SSE] Could not check the spots:', err.message);
  } finally {
    checking = false;
  }
}

function startTimers() {
  pollTimer = setInterval(check, settings.pollMs);
  pingTimer = setInterval(() => sendToAll(': ping\n\n'), settings.pingMs);
}

function stopTimers() {
  clearInterval(pollTimer);
  clearInterval(pingTimer);
  pollTimer = null;
  pingTimer = null;
  lastSent = new Map();
}

// GET /api/spots/stream
async function streamSpots(req, res, next) {
  let first;
  try {
    first = await loadSpots(); // if the database fails here, the error handler sends 500
  } catch (err) {
    return next(err);
  }

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  // retry: the browser reconnects after 3 seconds if the connection drops
  res.write('retry: 3000\n\n');
  res.write(sseMessage('snapshot', first));

  if (clients.size === 0) {
    remember(first.spots);
    startTimers();
  }
  clients.add(res);

  // The browser closed the page -> forget it; stop the timers when nobody is left
  req.on('close', () => {
    clients.delete(res);
    if (clients.size === 0) stopTimers();
  });
}

function clientCount() {
  return clients.size;
}

// Ends every open stream and stops the timers (when the server stops, and in the tests)
function closeAll() {
  clients.forEach((res) => res.end());
  clients.clear();
  stopTimers();
}

module.exports = { streamSpots, sseMessage, findChanges, mapKey, clientCount, closeAll, settings };
