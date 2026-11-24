const addSensorButton = document.getElementById("add-sensor");
const cancelSensorButton = document.getElementById("cancel-sensor");
const sensorEditor = document.getElementById("sensor-editor");
const sensorSpot = document.getElementById("sensor-spot");
let sensorBeingEdited = null;

// Use the same form for adding and editing a sensor.
function openSensorEditor(sensor) {
  sensorBeingEdited = sensor || null;
  sensorSpot.disabled = Boolean(sensor);
  document.getElementById("sensor-new-spot-field").hidden = Boolean(sensor);
  document.getElementById("sensor-form").reset();
  // Clear the previous form warning when the parking spots are loaded.
    if (sensorSpot.options.length > 1) {
    document.getElementById("sensor-form-error").textContent = "";
    }
  document.getElementById("sensor-editor-title").textContent =
    sensor ? "Edit sensor" : "Add sensor";

  if (sensor) {
    const [latitude = "", longitude = ""] = (sensor.coordinates || "").split(",");
    sensorSpot.value = sensor.spotId;
    document.getElementById("sensor-latitude").value = latitude.trim();
    document.getElementById("sensor-longitude").value = longitude.trim();
  }

  sensorEditor.hidden = false;
  sensorSpot.focus();
}

addSensorButton.addEventListener("click", () => {
  openSensorEditor();
});

cancelSensorButton.addEventListener("click", () => {
  sensorEditor.hidden = true;
  addSensorButton.focus();
});

async function loadSensorSpots() {
  const errorMessage = document.getElementById("sensor-form-error");
  const token = localStorage.getItem("token");

  try {
    const result = await getFromApi("/spots", token);

    for (const spot of result.spots) {
      sensorSpot.add(new Option(spot.location, spot.id));
    }
  } catch (error) {
    errorMessage.textContent = "Couldn’t load parking spots. Refresh to try again.";
  }
}

document.getElementById("sensor-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = event.currentTarget;
  const saveButton = form.querySelector('button[type="submit"]');
  if (saveButton.disabled) return;

  const latitude = document.getElementById("sensor-latitude").value;
  const longitude = document.getElementById("sensor-longitude").value;
  const errorMessage = document.getElementById("sensor-form-error");
  errorMessage.textContent = "";

  if ((latitude === "") !== (longitude === "")) {
    errorMessage.textContent = "Enter both latitude and longitude, or leave both blank.";
    return;
  }

  const coordinates = latitude === "" ? null : `${latitude},${longitude}`;
  const token = localStorage.getItem("token");
  const sensor = sensorBeingEdited;

  saveButton.disabled = true;
  try {
    if (sensor) {
      await requestApi("PUT", `/sensors/${encodeURIComponent(sensor.id)}`, { coordinates }, token);
    } else {
      const spotId = sensorSpot.value;
      const spotLocation = document.getElementById("sensor-new-spot").value.trim();

      if (Boolean(spotId) === Boolean(spotLocation)) {
        errorMessage.textContent = "Choose an existing spot or enter a new spot name.";
        return;
      }

      const data = spotId ? { spotId, coordinates } : { spotLocation, coordinates };
      await requestApi("POST", "/sensors", data, token);
    }

    sensorEditor.hidden = true;
    addSensorButton.focus();
    await loadSensors();
  } catch (error) {
    errorMessage.textContent = error.message;
  } finally {
    saveButton.disabled = false;
  }
});

async function deleteSensor(sensor) {
  const status = document.getElementById("sensor-list-status");
  const token = localStorage.getItem("token");

  try {
    await requestApi("DELETE", `/sensors/${encodeURIComponent(sensor.id)}`, undefined, token);
    await loadSensors();
  } catch (error) {
    status.textContent = error.message;
  }
}

async function loadSensors() {
  const status = document.getElementById("sensor-list-status");
  status.textContent = "Loading sensors…";

  try {
    const token = localStorage.getItem("token");
    const result = await getFromApi("/sensors", token);

    renderSensorRows(result.sensors, deleteSensor);
    status.textContent = result.sensors.length === 0 ? "No sensors found." : "";
    } catch (error) {
    status.textContent = error.message;
  }
}

if (whereToGo("admin") === null) {
  loadSensorSpots();
  loadSensors();
}

// Turn each sensor into one row in the table.
function renderSensorRows(sensors, onDelete) {
  const tableBody = document.querySelector("#sensor-table tbody");
  tableBody.replaceChildren();

  for (const sensor of sensors) {
    const row = tableBody.insertRow();
    row.insertCell().textContent = sensor.spotLocation;
    row.insertCell().textContent = sensor.coordinates || "—";
    row.insertCell().textContent = sensor.availability;

    // The fourth cell will hold the Edit and Delete buttons.
    const actions = row.insertCell();
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "filter-btn";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => openSensorEditor(sensor));
    actions.appendChild(editButton); 
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "filter-btn";
    deleteButton.textContent = "Delete";
    deleteButton.disabled = typeof onDelete !== "function";
    deleteButton.addEventListener("click", () => {
      if (window.confirm(`Delete the sensor at ${sensor.spotLocation}?`)) {
        onDelete(sensor);
      }
    });

    actions.appendChild(deleteButton); }
}

if (typeof module !== "undefined") {
  module.exports = { renderSensorRows };
}