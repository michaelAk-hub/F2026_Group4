/*
  map.js - Maria Antoniou (Week 3)
  RQ05 / UC03: load the parking map from GET /api/spots.
  RQ22: ask for current data every 2 seconds, aiming for the report's
  5-second display target. Real sensor-to-screen timing still needs testing.
  RQ26: use the four status colours from Stefania's layout.css.
  RQ28: the BACKEND decides when a sensor's spot is Unknown.

  Keep the car-park row layout described in the report. Coordinates are
  shown exactly as returned by the API, without guessing their format.
*/

var mapLoading = false;
var mapHasData = false;
var mapTimer = null;
var mapRequest = null;
var mapActive = false;

// Check the API reply before replacing the last successful map.
function validParkingData(data) {
  if (
    !data ||
    !Array.isArray(data.spots) ||
    !data.counts ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    data.total !== data.spots.length
  )
    return false;

  var states = ["empty", "occupied", "reserved", "unknown"];
  var counted = { empty: 0, occupied: 0, reserved: 0, unknown: 0 };
  var ids = new Set();
  for (var i = 0; i < data.spots.length; i++) {
    var spot = data.spots[i];
    if (
      !spot ||
      typeof spot.id !== "string" ||
      !spot.id ||
      ids.has(spot.id) ||
      typeof spot.location !== "string" ||
      !states.includes(spot.status) ||
      (spot.coordinates != null && typeof spot.coordinates !== "string")
    )
      return false;
    ids.add(spot.id);
    counted[spot.status]++;
  }
  for (var j = 0; j < states.length; j++) {
    var count = data.counts[states[j]];
    if (!Number.isInteger(count) || count < 0 || count !== counted[states[j]])
      return false;
  }
  return true;
}

function drawParkingMap(data) {
  var map = document.getElementById("map");
  var numbers = document.querySelectorAll("#summary .numbers b");
  var rows = document.createDocumentFragment();
  var row;

  for (var i = 0; i < data.spots.length; i++) {
    // Keep 10 spaces per row, and support additional spots (RQ32).
    if (i % 10 === 0) {
      row = document.createElement("div");
      row.className = "parking-row " + (i === 0 ? "top-row" : "bottom-row");
      rows.appendChild(row);
    }

    var spot = data.spots[i];
    var tile = document.createElement("div");
    tile.className = "spot " + spot.status;
    tile.dataset.spotId = spot.id;
    // Seeded locations look like "Lot A - Spot 01". Keep other names in full.
    var label = spot.location.match(/ - Spot (\d+)$/);
    tile.textContent = label ? label[1] : spot.location;
    // The title exposes the actual location and coordinates on hover.
    // Missing coordinates stay unavailable; we do not invent map positions.
    tile.title =
      spot.location +
      " - " +
      spot.status +
      "\nCoordinates: " +
      (spot.coordinates || "unavailable");
    tile.setAttribute("aria-label", tile.title);
    row.appendChild(tile);

    // Keep Stefania's road between the first two rows.
    if (i === 9 && data.spots.length > 10) {
      var lane = document.createElement("div");
      lane.className = "driving-lane";
      var entrance = document.createElement("span");
      entrance.textContent = "ENTRANCE";
      var line = document.createElement("div");
      line.className = "lane-line";
      var exit = document.createElement("span");
      exit.textContent = "EXIT";
      lane.append(entrance, line, exit);
      rows.appendChild(lane);
    }
  }

  // Replace spots only after the complete reply has been checked.
  // textContent above treats location names as text, not as HTML.
  map.replaceChildren(rows);
  map.hidden = data.spots.length === 0;
  numbers[0].textContent = data.total;
  numbers[1].textContent = data.counts.empty;
  numbers[2].textContent = data.counts.occupied;
  numbers[3].textContent = data.counts.reserved;
}

async function loadParkingMap() {
  // Do not overlap requests, or load data for a user who has logged out.
  if (!mapActive || mapLoading) return;
  if (
    !localStorage.getItem("token") ||
    localStorage.getItem("role") !== "driver"
  ) {
    stopParkingMap();
    document.getElementById("map").replaceChildren();
    document.getElementById("map").hidden = true;
    var numbers = document.querySelectorAll("#summary .numbers b");
    for (var i = 0; i < numbers.length; i++) numbers[i].textContent = "—";
    document.getElementById("map-message").textContent = "Please log in first.";
    return;
  }
  mapLoading = true;
  mapRequest = new AbortController();
  // A stalled connection should not block all later refreshes.
  var timeout = setTimeout(function () {
    mapRequest.abort();
  }, 2000);

  try {
    var response = await fetch(API_BASE_URL + "/spots", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      signal: mapRequest.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Cannot load parking spots.");
    var data = await response.json();
    if (!validParkingData(data)) throw new Error("Unexpected parking data.");
    if (!mapActive) return; // The user may have left while the request was running.

    drawParkingMap(data);
    mapHasData = true;
    document.getElementById("map-message").textContent =
      data.spots.length === 0
        ? "No parking spots are available to display."
        : "";
  } catch (error) {
    if (!mapActive) return;
    // UC03 allows the latest known status with an explicit warning.
    // Do not label a connection failure as a genuine Empty/Unknown sensor state.
    document.getElementById("map-message").textContent = mapHasData
      ? "Sensor data currently unavailable. Showing the latest known parking status."
      : "Sensor data currently unavailable. Cannot load parking spots.";
  } finally {
    clearTimeout(timeout);
    mapLoading = false;
    mapRequest = null;
  }
}

function startParkingMap() {
  if (mapActive) return; // Only create one refresh timer.
  if (
    !localStorage.getItem("token") ||
    localStorage.getItem("role") !== "driver"
  )
    return;
  mapActive = true;
  var loading = loadParkingMap();
  mapTimer = setInterval(loadParkingMap, 2000);
  return loading;
}

function stopParkingMap() {
  mapActive = false;
  clearInterval(mapTimer);
  mapTimer = null;
  if (mapRequest) mapRequest.abort();
}

// Stop requests on leaving. Restart if the browser restores this page with Back.
window.addEventListener("pagehide", stopParkingMap);
window.addEventListener("pageshow", startParkingMap);
startParkingMap();
