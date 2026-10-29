// GET /api/spots - list of parking spots for the live map (Member 5, Week 2)
const ParkingSpot = require('../models/parkingSpot');
const Sensor = require('../models/sensor');

// RQ28: if a sensor has not reported for this long, its spot is shown as Unknown
const SENSOR_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// The 4 states of the map (RQ26). They are also the CSS classes used on dashboard.html
const STATES = ['empty', 'occupied', 'reserved', 'unknown'];

// spotStatus saved in the database -> state shown on the map
const STATUS_TO_STATE = {
  Available: 'empty',
  Taken: 'occupied',
  Reserved: 'reserved',
};

// Decides the state of one spot. "now" can be passed in by the tests.
function spotState(spot, sensor, now = Date.now()) {
  // No sensor on this spot -> we do not really know if it is free
  if (!sensor) {
    return 'unknown';
  }

  // The sensor stopped sending data -> the saved status may be old (RQ28)
  const lastReport = new Date(sensor.updatedAt).getTime();
  if (!(now - lastReport <= SENSOR_TIMEOUT_MS)) {
    return 'unknown';
  }

  return STATUS_TO_STATE[spot.spotStatus] || 'unknown';
}

// What the API sends for one spot
function toSpotView(spot, sensor, now) {
  return {
    id: String(spot._id),
    location: spot.spotLocation,
    status: spotState(spot, sensor, now),
    coordinates: sensor && sensor.sensorLocationCoordinates ? sensor.sensorLocationCoordinates : null,
    lastUpdate: sensor ? sensor.updatedAt : null,
  };
}

// GET /api/spots          -> all spots
// GET /api/spots?status=empty -> only the spots in that state
async function listSpots(req, res, next) {
  try {
    const wanted = req.query.status;
    if (wanted !== undefined && !STATES.includes(wanted)) {
      return res.status(400).json({ error: 'status must be one of: ' + STATES.join(', ') });
    }

    // Read all spots and all sensors (2 queries instead of one per spot)
    const [spots, sensors] = await Promise.all([
      ParkingSpot.find().sort({ spotLocation: 1 }).lean(),
      Sensor.find().lean(),
    ]);

    // Find the sensor of each spot quickly: spot id -> sensor
    const sensorOfSpot = new Map(sensors.map((s) => [String(s.parkingSpotID), s]));

    const now = Date.now();
    const all = spots.map((spot) => toSpotView(spot, sensorOfSpot.get(String(spot._id)), now));

    // Numbers for the summary boxes of the dashboard (always for ALL spots)
    const counts = { empty: 0, occupied: 0, reserved: 0, unknown: 0 };
    all.forEach((s) => { counts[s.status] += 1; });

    const shown = wanted ? all.filter((s) => s.status === wanted) : all;

    res.json({ total: all.length, counts, spots: shown });
  } catch (err) {
    next(err); // database problem -> error handler sends 500
  }
}

module.exports = { listSpots, spotState, toSpotView, STATES, SENSOR_TIMEOUT_MS };
