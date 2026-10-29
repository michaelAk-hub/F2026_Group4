// Turns sensor messages into database updates.
// No MQTT code here, so it is easy to test (see tests/sensorService.test.js).
const mongoose = require('mongoose');
const ParkingSpot = require('../models/parkingSpot');
const Sensor = require('../models/sensor');
const Reservation = require('../models/reservation');

// parking/spots/<parkingSpotID>/status        -> JSON from the sensor
// parking/spots/<parkingSpotID>/availability  -> "online" or "offline"
const TOPIC_REGEX = /^parking\/spots\/([^/]+)\/(status|availability)$/;

// The sensor says "free" or "occupied". We translate it to our spotStatus:
//   occupied                         -> Taken
//   free, spot was Taken             -> Reserved if a reservation is running now, else Available
//   free, spot was Available/Reserved-> unchanged (a reserved spot stays reserved)
async function applyReading(parkingSpotID, reading) {
  const spot = await ParkingSpot.findById(parkingSpotID);
  if (!spot) return { found: false };

  const previous = spot.spotStatus;
  let next = previous;

  if (reading.status === 'occupied') {
    next = 'Taken';
  } else if (previous === 'Taken') {
    const now = new Date();
    const activeReservation = await Reservation.exists({
      parkingSpotID,
      reservationStartTime: { $lte: now },
      reservationEndTime: { $gte: now },
    });
    next = activeReservation ? 'Reserved' : 'Available';
  }

  if (next !== previous) {
    spot.spotStatus = next;
    await spot.save();
  }

  // A sensor that sends data is clearly working
  await setSensorAvailability(parkingSpotID, true);

  return { found: true, previous, current: next, changed: next !== previous };
}

// Mark the sensor(s) of this spot as Available / Unavailable
async function setSensorAvailability(parkingSpotID, online) {
  const wanted = online ? 'Available' : 'Unavailable';
  const update = {sensorAvailability: wanted};
  if (online) update.sensorLastSeen = new Date();

  const result = await Sensor.updateMany( {parkingSpotID}, {$set: update} );
  return result.modifiedCount;
}

// Called for every MQTT message. Never throws for bad input, only logs.
async function handleMessage(topic, payload) {
  const match = TOPIC_REGEX.exec(topic);
  if (!match) return;

  const [, parkingSpotID, kind] = match;
  if (!mongoose.isValidObjectId(parkingSpotID)) {
    console.warn(`[MQTT] Ignored ${topic}: spot id is not valid`);
    return;
  }

  if (kind === 'availability') {
    const text = payload.toString().trim();
    if (text !== 'online' && text !== 'offline') {
      console.warn(`[MQTT] Ignored ${topic}: unknown value "${text}"`);
      return;
    }
    await setSensorAvailability(parkingSpotID, text === 'online');
    console.log(`[MQTT] Sensor of spot ${parkingSpotID} is ${text}`);
    return;
  }

  let reading;
  try {
    reading = JSON.parse(payload.toString());
  } catch {
    console.warn(`[MQTT] Ignored ${topic}: message is not valid JSON`);
    return;
  }
  if (!reading || !['free', 'occupied'].includes(reading.status)) {
    console.warn(`[MQTT] Ignored ${topic}: status must be "free" or "occupied"`);
    return;
  }

  const result = await applyReading(parkingSpotID, reading);
  if (!result.found) {
    console.warn(`[MQTT] Ignored ${topic}: no parking spot with this id`);
  } else if (result.changed) {
    console.log(`[MQTT] Spot ${parkingSpotID}: ${result.previous} -> ${result.current}`);
  }
}

module.exports = { handleMessage, applyReading, setSensorAvailability, TOPIC_REGEX };
