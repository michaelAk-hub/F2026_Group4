// Fills the database with 20 example parking spots (01-20) and their sensors,
// the same as the example on dashboard.html, so GET /api/spots can be tried.
// Run with: npm run seed   (it deletes the old spots and sensors first)
const mongoose = require('mongoose');
const { loadConfig } = require('../src/config/env');
const { connectDB } = require('../src/config/db');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');

const OCCUPIED = ['03', '07', '12', '16'];
const RESERVED = ['05'];
const NO_SENSOR = ['09']; // shown as unknown

async function seed() {
  const config = loadConfig();
  await connectDB(config.mongodbUri);

  await Sensor.deleteMany({});
  await ParkingSpot.deleteMany({});

  for (let i = 1; i <= 20; i += 1) {
    const location = String(i).padStart(2, '0');
    let spotStatus = 'Available';
    if (OCCUPIED.includes(location)) spotStatus = 'Taken';
    if (RESERVED.includes(location)) spotStatus = 'Reserved';

    const spot = await ParkingSpot.create({ spotLocation: location, spotStatus });

    if (!NO_SENSOR.includes(location)) {
      await Sensor.create({
        parkingSpotID: spot._id,
        sensorAvailability: spotStatus === 'Taken' ? 'Unavailable' : 'Available',
      });
    }
  }

  console.log('Added 20 parking spots and 19 sensors');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
