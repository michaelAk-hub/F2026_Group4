/*
  map.js - Maria Antoniou
  RQ05 / UC03: display the parking spots and summary counters.
  RQ22: receive live updates from /api/spots/stream using EventSource.
  The five-second sensor-to-screen target still needs a timed check.
  RQ26: use the four status colours from Stefania's layout.css.
  RQ28: the backend decides when a sensor's spot is Unknown.

  The map uses the car-park row layout. Coordinates from the API
  appear in the hover text and accessible label.
*/

var mapLoading = false;
var mapHasData = false;
var mapTimer = null;
var mapRequest = null;
var mapActive = false;
var mapStream = null;
var streamSpots = null;

// Check the complete map before showing it to the driver.
function validParkingData(data) {
  if (
    !data ||
    !Array.isArray(data.spots) ||
    !data.counts ||
    !Number.isInteger(data.total) ||
    data.total < 0 ||
    data.total !== data.spots.length
  ) {
    return false;
  }

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
    ) {
      return false;
    }

    ids.add(spot.id);
    counted[spot.status]++;
  }

  for (var j = 0; j < states.length; j++) {
    var count = data.counts[states[j]];
    if (!Number.isInteger(count) || count < 0 || count !== counted[states[j]]) {
      return false;
    }
  }

  return true;
}

function drawParkingMap(data) {
  var map = document.getElementById("map");
  var numbers = document.querySelectorAll("#summary .numbers b");
  var rows = document.createDocumentFragment();
  var row;

  for (var i = 0; i < data.spots.length; i++) {
    // Start a new row every ten spots.
    if (i % 10 === 0) {
      row = document.createElement("div");
      row.className = "parking-row " + (i === 0 ? "top-row" : "bottom-row");
      rows.appendChild(row);
    }

    var spot = data.spots[i];
    var tile = document.createElement("div");
    tile.className = "spot " + spot.status;
    tile.dataset.spotId = spot.id;

    // "Lot A - Spot 01" appears as "01". Other locations keep their full names.
    var label = spot.location.match(/ - Spot (\d+)$/);
    tile.textContent = label ? label[1] : spot.location;

    tile.title =
      spot.location +
      " - " +
      spot.status +
      "\nCoordinates: " +
      (spot.coordinates || "unavailable");

    tile.setAttribute("aria-label", tile.title);
    row.appendChild(tile);

    // Put the driving lane between the first and second rows.
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

  map.replaceChildren(rows);
  map.hidden = data.spots.length === 0;

  numbers[0].textContent = data.total;
  numbers[1].textContent = data.counts.empty;
  numbers[2].textContent = data.counts.occupied;
  numbers[3].textContent = data.counts.reserved;
}

function displayParkingData(data) {
  drawParkingMap(data);
  mapHasData = true;

  document.getElementById("map-message").textContent =
    data.spots.length === 0 ? "No parking spots are available to display." : "";
}

// Stop updates and clear the driver's map if the login has ended.
function checkDriver() {
  if (
    localStorage.getItem("token") &&
    localStorage.getItem("role") === "driver"
  ) {
    return true;
  }

  stopParkingMap();
  mapHasData = false;

  var map = document.getElementById("map");
  map.replaceChildren();
  map.hidden = true;

  var numbers = document.querySelectorAll("#summary .numbers b");
  for (var i = 0; i < numbers.length; i++) {
    numbers[i].textContent = "—";
  }

  document.getElementById("map-message").textContent = "Please log in first.";
  return false;
}

// Load a complete map when the browser needs to use the regular spots API.
async function loadParkingMap() {
  if (!mapActive || mapLoading || !checkDriver()) return;

  mapLoading = true;
  var request = new AbortController();
  mapRequest = request;

  var timeout = setTimeout(function () {
    request.abort();
  }, 2000);

  try {
    var response = await fetch(API_BASE_URL + "/spots", {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      signal: request.signal,
      cache: "no-store",
    });

    if (!response.ok) throw new Error("Cannot load parking spots.");

    var data = await response.json();
    if (!mapActive || request.signal.aborted || !checkDriver()) return;
    if (!validParkingData(data)) throw new Error("Unexpected parking data.");

    displayParkingData(data);
  } catch (error) {
    if (!mapActive || !checkDriver()) return;

    document.getElementById("map-message").textContent = mapHasData
      ? "Sensor data currently unavailable. Showing the latest known parking status."
      : "Sensor data currently unavailable. Cannot load parking spots.";
  } finally {
    clearTimeout(timeout);
    mapLoading = false;
    mapRequest = null;
  }
}

// Use the original two-second refresh if streaming is unavailable.
function startPolling() {
  var loading = loadParkingMap();
  mapTimer = setInterval(loadParkingMap, 2000);
  return loading;
}

function openParkingStream() {
  var source = new EventSource(API_BASE_URL + "/spots/stream");
  mapStream = source;

  function receive(event) {
    if (source !== mapStream || !checkDriver()) return;

    try {
      var data = JSON.parse(event.data);

      // A snapshot is already a complete map. An update contains changes.
      if (event.type === "update") {
        if (
          !streamSpots ||
          !Array.isArray(data.spots) ||
          !Array.isArray(data.removed)
        ) {
          throw new Error("Incomplete parking update.");
        }

        // Start with the previous map so the other spots stay visible.
        var byId = new Map(streamSpots.map((spot) => [spot.id, spot]));

        for (var id of data.removed) {
          byId.delete(id);
        }

        for (var spot of data.spots) {
          byId.set(spot.id, spot);
        }

        data.spots = Array.from(byId.values());
      }

      if (!validParkingData(data)) throw new Error("Unexpected parking data.");

      displayParkingData(data);
      streamSpots = data.spots;
    } catch (error) {
      // If an update is incomplete, recover with a complete map from the API.
      source.close();
      mapStream = null;
      streamSpots = null;
      startPolling();
    }
  }

  source.addEventListener("snapshot", receive);
  source.addEventListener("update", receive);

  source.onerror = function () {
    if (source !== mapStream || !checkDriver()) return;

    streamSpots = null;
    document.getElementById("map-message").textContent = mapHasData
      ? "Live updates interrupted. Showing the latest known parking status."
      : "Waiting for the parking stream.";

    // After a temporary interruption, EventSource reconnects automatically.
    // If it closes permanently, use the regular spots API.
    if (source.readyState === EventSource.CLOSED) {
      mapStream = null;
      startPolling();
    }
  };
}

function startParkingMap() {
  if (mapActive) return;
  if (
    !localStorage.getItem("token") ||
    localStorage.getItem("role") !== "driver"
  ) {
    return;
  }

  mapActive = true;

  if (typeof EventSource === "function") {
    openParkingStream();
    return;
  }

  return startPolling();
}

function stopParkingMap() {
  mapActive = false;

  if (mapStream) mapStream.close();
  mapStream = null;
  streamSpots = null;

  clearInterval(mapTimer);
  mapTimer = null;

  if (mapRequest) mapRequest.abort();
}

// Handle logout in another tab, leaving the page and returning with Back.
window.addEventListener("storage", function () {
  if (mapActive) checkDriver();
});
window.addEventListener("pagehide", stopParkingMap);
window.addEventListener("pageshow", startParkingMap);

startParkingMap();