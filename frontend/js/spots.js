// Spot details panel, status filter and legend - Stefania (Week 3)
// Maria's map.js draws the spots inside #map and draws them again every
// 2 seconds with the newest data. This file works on top of her map.

var STATUSES = ["empty", "occupied", "reserved", "unknown"];
var currentFilter = "all"; // the legend button the user chose
var selectedId = null;     // the spot the user clicked (its data-spot-id)

// "empty" -> "Empty"
function statusName(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// which of the 4 status classes a spot has
function getStatus(spot) {
  for (var i = 0; i < STATUSES.length; i++) {
    if (spot.classList.contains(STATUSES[i])) {
      return STATUSES[i];
    }
  }
  return "unknown";
}

function statusMessage(status) {
  if (status === "empty") {
    return "This spot is free. You can reserve it.";
  }
  if (status === "occupied") {
    return "A car is parked here.";
  }
  if (status === "reserved") {
    return "Another driver has reserved this spot.";
  }
  return "No data from the sensor of this spot.";
}

function findSpotById(id) {
  var spots = document.querySelectorAll("#map .spot");
  for (var i = 0; i < spots.length; i++) {
    if (spots[i].dataset.spotId === id) {
      return spots[i];
    }
  }
  return null;
}

// RQ07: show the details of the spot the user clicked
function showSpotDetails(spot) {
  var status = getStatus(spot);
  selectedId = spot.dataset.spotId;

  document.getElementById("detail-id").textContent = spot.textContent.trim();
  document.getElementById("detail-status").textContent = statusName(status);
  document.getElementById("detail-message").textContent = statusMessage(status);

  // the Reserve link is only for free spots
var reserveLink = document.getElementById("detail-reserve");
reserveLink.hidden = status !== "empty";
reserveLink.href = "reservation.html?spotId=" + encodeURIComponent(selectedId);

  document.getElementById("detail-empty").hidden = true;
  document.getElementById("detail-info").hidden = false;

  // mark the clicked spot on the map
  var old = document.querySelector("#map .spot.selected");
  if (old) {
    old.classList.remove("selected");
  }
  spot.classList.add("selected");
}

// go back to "Click on a spot..."
function hideSpotDetails() {
  selectedId = null;
  document.getElementById("detail-empty").hidden = false;
  document.getElementById("detail-info").hidden = true;
}

// show only the spots with this status ("all" shows every spot)
function filterSpots(status) {
  currentFilter = status;

  var spots = document.querySelectorAll("#map .spot");
  for (var i = 0; i < spots.length; i++) {
    if (status === "all" || spots[i].classList.contains(status)) {
      spots[i].classList.remove("hidden-spot");
    } else {
      spots[i].classList.add("hidden-spot");
    }
  }

  // the button of the chosen filter becomes active
  var buttons = document.querySelectorAll("#legend button");
  for (var j = 0; j < buttons.length; j++) {
    if (buttons[j].dataset.status === status) {
      buttons[j].classList.add("active");
    } else {
      buttons[j].classList.remove("active");
    }
  }
}

// After Maria's map draws new spots, the old ones (with our classes) are gone.
// So we use the filter again and show the newest status of the clicked spot.
function refreshSpots() {
  filterSpots(currentFilter);

  if (selectedId !== null) {
    var spot = findSpotById(selectedId);
    if (spot) {
      showSpotDetails(spot);
    } else {
      hideSpotDetails();
    }
  }
}

// the dashboard calls this once when the page opens
function setupSpots() {
  var map = document.getElementById("map");

  // one click listener for the whole map, so new spots also work
  map.addEventListener("click", function (event) {
    var spot = event.target.closest(".spot");
    if (spot) {
      showSpotDetails(spot);
    }
  });

  var buttons = document.querySelectorAll("#legend button");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function () {
      filterSpots(this.dataset.status);
    });
  }

  // the browser calls refreshSpots every time the spots in #map are replaced
  var observer = new MutationObserver(refreshSpots);
  observer.observe(map, { childList: true });
}

// lets the Jest tests use the functions (the browser ignores this)
if (typeof module !== "undefined") {
  module.exports = { statusName, getStatus, statusMessage, findSpotById, showSpotDetails, hideSpotDetails, filterSpots, refreshSpots, setupSpots };
}
