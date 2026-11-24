/*
  admin-dashboard.js - Michalis Koutoumbas (Member 5, Week 6)
  Admin dashboard (RQ18): live occupied spots and revenue.
  - Occupancy and the map: live from GET /api/spots/stream (Server-Sent Events, Member 5 Week 3).
    The server sends a "snapshot" with all spots, then an "update" with only the spots that changed.
  - Revenue and latest payments: GET /api/admin/dashboard (administrators only), every 30 seconds.
  It uses api.js (API_BASE_URL, getFromApi - Maria).
*/
var SUMMARY_REFRESH_MS = 30000;

// The latest state of every spot: spot id -> spot
var spotsById = {};

// 4 -> "€4.00"
function formatEuro(amount) {
  return "€" + Number(amount || 0).toFixed(2);
}

// "Lot A - Spot 07" -> "07" (the same label as the driver map)
function spotNumber(location) {
  if (typeof location !== "string" || !location.trim()) {
    return "?";
  }
  var match = location.match(/ - Spot (\d+)$/);
  return match ? match[1] : location;
}

// How many spots are in each state
function countStates(spots) {
  var counts = { empty: 0, occupied: 0, reserved: 0, unknown: 0 };
  for (var i = 0; i < spots.length; i++) {
    if (counts[spots[i].status] !== undefined) {
      counts[spots[i].status]++;
    }
  }
  return counts;
}

function setText(id, text) {
  var element = document.getElementById(id);
  if (element) {
    element.textContent = text;
  }
}

// The spots in the order of the car park (01, 02, ...)
function sortedSpots() {
  return Object.keys(spotsById)
    .map(function (id) { return spotsById[id]; })
    .sort(function (a, b) { return String(a.location).localeCompare(String(b.location), "en", { numeric: true }); });
}

// The 6 occupancy boxes
function renderOccupancy(spots) {
  var counts = countStates(spots);
  var total = spots.length;
  setText("occ-total", total);
  setText("occ-occupied", counts.occupied);
  setText("occ-empty", counts.empty);
  setText("occ-reserved", counts.reserved);
  setText("occ-unknown", counts.unknown);
  setText("occ-percent", total > 0 ? Math.round((counts.occupied / total) * 100) + "%" : "0%");
}

// The map: rows of 10 spots, with the driving lane after the first row (like the driver map)
function renderMap(spots) {
  var map = document.getElementById("admin-map");
  if (!map) {
    return;
  }
  map.replaceChildren();

  for (var start = 0; start < spots.length; start += 10) {
    var row = document.createElement("div");
    row.className = "parking-row " + (start === 0 ? "top-row" : "bottom-row");

    spots.slice(start, start + 10).forEach(function (spot) {
      var tile = document.createElement("div");
      tile.className = "spot " + spot.status;
      tile.textContent = spotNumber(spot.location);
      tile.title = "Spot " + spotNumber(spot.location) + ": " + spot.status;
      tile.setAttribute("aria-label", tile.title);
      row.appendChild(tile);
    });
    map.appendChild(row);

    if (start === 0 && spots.length > 10) {
      var lane = document.createElement("div");
      lane.className = "driving-lane";
      var entrance = document.createElement("span");
      entrance.textContent = "ENTRANCE";
      var line = document.createElement("div");
      line.className = "lane-line";
      var exit = document.createElement("span");
      exit.textContent = "EXIT";
      lane.append(entrance, line, exit);
      map.appendChild(lane);
    }
  }
}

function renderSpots() {
  var spots = sortedSpots();
  renderOccupancy(spots);
  renderMap(spots);
}

// "snapshot": all spots at once
function applySnapshot(data) {
  spotsById = {};
  (data.spots || []).forEach(function (spot) { spotsById[spot.id] = spot; });
  renderSpots();
}

// "update": only the spots that changed, and the ids of removed spots
function applyUpdate(data) {
  (data.spots || []).forEach(function (spot) { spotsById[spot.id] = spot; });
  (data.removed || []).forEach(function (id) { delete spotsById[id]; });
  renderSpots();
}

function showMessage(text) {
  var message = document.getElementById("admin-message");
  if (!message) {
    return;
  }
  message.textContent = text || "";
  message.hidden = !text;
}

function setLive(isLive) {
  var status = document.getElementById("live-status");
  if (!status) {
    return;
  }
  status.textContent = isLive ? "● Live" : "Reconnecting…";
  status.classList.toggle("offline", !isLive);
}

// Revenue boxes and the latest payments table (data from GET /api/admin/dashboard)
function renderSummary(data) {
  var revenue = data.revenue || {};
  [["rev-24h", revenue.last24h], ["rev-7d", revenue.last7d], ["rev-30d", revenue.last30d]].forEach(function (pair) {
    var value = pair[1] || { amount: 0, payments: 0 };
    setText(pair[0], formatEuro(value.amount));
    setText(pair[0] + "-count", value.payments + (value.payments === 1 ? " payment" : " payments"));
  });
  var refunds = (data.refunds && data.refunds.last30d) || { amount: 0, payments: 0 };
  setText("refunds-30d", formatEuro(refunds.amount));
  setText("refunds-30d-count", refunds.payments + (refunds.payments === 1 ? " refund" : " refunds"));
  setText("active-reservations", data.occupancy ? data.occupancy.activeReservations : 0);

  var body = document.querySelector("#latest-payments tbody");
  if (body) {
    body.replaceChildren();
    (data.latestPayments || []).forEach(function (payment) {
      var row = body.insertRow();
      var paidAt = new Date(payment.paidAt);
      var cells = [
        payment.receiptId || "—",
        payment.spot ? spotNumber(payment.spot) : "—",
        formatEuro(payment.amount),
        isNaN(paidAt) ? "—" : paidAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
      ];
      cells.forEach(function (text) { row.insertCell().textContent = text; }); // textContent: never HTML
    });
    var none = document.getElementById("no-payments");
    if (none) {
      none.hidden = (data.latestPayments || []).length > 0;
    }
  }
  setText("updated-at", "Revenue updated at " + new Date().toLocaleTimeString("en-GB"));
}

async function loadSummary() {
  try {
    var data = await getFromApi("/admin/dashboard", localStorage.getItem("token"));
    renderSummary(data);
    showMessage("");
    return true;
  } catch (error) {
    showMessage("Could not load the revenue: " + error.message);
    return false;
  }
}

// The live map. EventSource reconnects by itself if the connection drops.
function startLiveMap() {
  var source = new EventSource(API_BASE_URL + "/spots/stream");
  source.addEventListener("snapshot", function (event) {
    applySnapshot(JSON.parse(event.data));
    setLive(true);
  });
  source.addEventListener("update", function (event) {
    applyUpdate(JSON.parse(event.data));
    setLive(true);
  });
  source.onerror = function () { setLive(false); };
  return source;
}

// admin.html calls this once
function startAdminDashboard() {
  loadSummary();
  setInterval(loadSummary, SUMMARY_REFRESH_MS);
  return startLiveMap();
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = {
    formatEuro, spotNumber, countStates, applySnapshot, applyUpdate, renderSummary,
    loadSummary, startLiveMap, startAdminDashboard, sortedSpots,
  };
}
