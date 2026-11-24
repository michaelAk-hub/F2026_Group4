// Admin sensor management (Member 3, Week 6).
// RQ17: an administrator can add, remove and update the parking sensors.
// Only an administrator can use these routes (RQ24, see routes/sensors.js).
const mongoose = require('mongoose');
const ParkingSpot = require('../models/parkingSpot');
const Sensor = require('../models/sensor');

// The coordinates are saved as text "latitude,longitude", e.g. "34.6786,33.0413" (as the map uses them).
// Gives back the cleaned text, or null if the text is not two correct numbers.
function cleanCoordinates(text) {
  const match = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/.exec(String(text)); // "number,number"
  if (!match) return null; // not two numbers
  const lat = Number(match[1]); // e.g. 34.6786
  const lng = Number(match[3]); // e.g. 33.0413
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null; // not a place on the earth
  return `${lat},${lng}`; // without spaces
}

// The name of a spot, e.g. "Lot A - Spot 06". Gives back null if it is empty or too long.
function cleanLocation(text) {
  if (typeof text !== 'string') return null; // no name was sent
  const name = text.trim(); // no spaces at the start and the end
  if (name === '' || name.length > 50) return null; // empty or too long
  return name;
}

// What we send back for one sensor
function toJson(sensor, spot) {
  return {
    id: sensor._id,
    spotId: spot ? spot._id : sensor.parkingSpotID,
    spotLocation: spot ? spot.spotLocation : null,
    availability: sensor.sensorAvailability, // "Available" (sends data) or "Unavailable"
    coordinates: sensor.sensorLocationCoordinates || null,
    lastSeen: sensor.sensorLastSeen || null, // the last message of the sensor
  };
}

// GET /api/sensors -> all sensors with the name of their spot, sorted by the name
async function listSensors(req, res) {
  const sensors = await Sensor.find().populate('parkingSpotID'); // populate() also reads the spot
  const list = sensors.map((s) => toJson(s, s.parkingSpotID));
  list.sort((a, b) => String(a.spotLocation).localeCompare(String(b.spotLocation))); // Spot 01, Spot 02, ...
  res.json({ total: list.length, sensors: list });
}

// POST /api/sensors
// Body: { spotId, coordinates } for a spot that already exists,
//   or  { spotLocation, coordinates } for a spot by its name (it is created if it is new, RQ32).
async function addSensor(req, res) {
  const { spotId, spotLocation, coordinates } = req.body;

  // The coordinates are optional, but if they are sent they must be correct
  let cleanCoords;
  if (coordinates !== undefined && coordinates !== null && coordinates !== '') {
    cleanCoords = cleanCoordinates(coordinates);
    if (!cleanCoords) {
      return res.status(400).json({ message: 'The coordinates must be "latitude,longitude", e.g. 34.6786,33.0413.' });
    }
  }

  // Find the spot of the new sensor
  let spot;
  if (spotId !== undefined) {
    // An existing spot, chosen by its id
    if (!mongoose.isValidObjectId(spotId)) {
      return res.status(400).json({ message: 'Please choose a parking spot.' });
    }
    spot = await ParkingSpot.findById(spotId);
    if (!spot) {
      return res.status(404).json({ message: 'Parking spot not found.' });
    }
  } else {
    // A spot by its name: the same name means the same spot, a new name makes a new spot
    const name = cleanLocation(spotLocation);
    if (!name) {
      return res.status(400).json({ message: 'Please give the parking spot (at most 50 characters).' });
    }
    spot = await ParkingSpot.findOne({ spotLocation: name });
    if (!spot) spot = await ParkingSpot.create({ spotLocation: name }); // new spot, starts Available
  }

  // The map shows one sensor for each spot, so a spot cannot have two
  if (await Sensor.exists({ parkingSpotID: spot._id })) {
    return res.status(409).json({ message: 'This parking spot already has a sensor.' });
  }

  // A new sensor has not sent anything yet, so it starts Unavailable (as in scripts/seed-sensors.js).
  // It becomes Available with its first MQTT message, until then the map shows the spot as unknown (RQ28).
  const sensor = await Sensor.create({
    sensorAvailability: 'Unavailable',
    sensorLocationCoordinates: cleanCoords,
    parkingSpotID: spot._id,
  });

  res.status(201).json({ message: 'Sensor added.', sensor: toJson(sensor, spot) });
}

// PUT /api/sensors/:id
// Body: { coordinates, spotLocation }, one of them or both.
// coordinates: null or "" removes them. spotLocation: the new name of the spot of the sensor.
async function updateSensor(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sensor not found.' });
  }
  const sensor = await Sensor.findById(req.params.id);
  if (!sensor) {
    return res.status(404).json({ message: 'Sensor not found.' });
  }

  const { coordinates, spotLocation } = req.body;
  if (coordinates === undefined && spotLocation === undefined) {
    return res.status(400).json({ message: 'Nothing to change: send coordinates or spotLocation.' });
  }

  // First check everything, then save, so a wrong value does not leave half a change
  let newCoords;
  if (coordinates !== undefined) {
    if (coordinates === null || coordinates === '') {
      newCoords = null; // remove the coordinates
    } else {
      newCoords = cleanCoordinates(coordinates);
      if (!newCoords) {
        return res.status(400).json({ message: 'The coordinates must be "latitude,longitude", e.g. 34.6786,33.0413.' });
      }
    }
  }

  const spot = await ParkingSpot.findById(sensor.parkingSpotID);
  let newName;
  if (spotLocation !== undefined) {
    newName = cleanLocation(spotLocation);
    if (!newName) {
      return res.status(400).json({ message: 'Please give the parking spot (at most 50 characters).' });
    }
    // Two spots with the same name would be confusing on the map
    const other = await ParkingSpot.exists({ spotLocation: newName, _id: { $ne: sensor.parkingSpotID } });
    if (other) {
      return res.status(409).json({ message: 'Another parking spot already has this name.' });
    }
  }

  // Save the changes
  if (coordinates !== undefined) {
    sensor.sensorLocationCoordinates = newCoords === null ? undefined : newCoords; // undefined = removed
    await sensor.save();
  }
  if (newName && spot) {
    spot.spotLocation = newName;
    await spot.save();
  }

  res.json({ message: 'Sensor updated.', sensor: toJson(sensor, spot) });
}

// DELETE /api/sensors/:id
// Only the sensor is removed. The spot stays, because reservations and payments
// point to it; without a sensor the map shows it as unknown (RQ28).
async function removeSensor(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Sensor not found.' });
  }
  const sensor = await Sensor.findByIdAndDelete(req.params.id);
  if (!sensor) {
    return res.status(404).json({ message: 'Sensor not found.' });
  }
  res.json({ message: 'Sensor removed. The spot is shown as unknown until a new sensor is added.' });
}

module.exports = { listSensors, addSensor, updateSensor, removeSensor, cleanCoordinates };
