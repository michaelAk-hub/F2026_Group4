// Creates test parking spots, each with one sensor, so the simulator has something to use.
// Run: npm run seed:sensors        (5 spots)
//      npm run seed:sensors -- 10  (10 spots)
// Safe to run again: spots that already exist are skipped.
const mongoose = require('mongoose');
const {loadConfig} = require('../src/config/env');
const config = loadConfig();
const { connectDB } = require('../src/config/db');
const ParkingSpot = require('../src/models/parkingSpot');
const Sensor = require('../src/models/sensor');

async function main() {
  const count = parseInt(process.argv[2] || '5', 10);
  await connectDB(config.mongodbUri);

  for (let i = 1; i <= count; i++) {
    const spotLocation = `Lot A - Spot ${String(i).padStart(2, '0')}`;

    let spot = await ParkingSpot.findOne({ spotLocation });
    if (!spot) spot = await ParkingSpot.create({ spotLocation });

    const hasSensor = await Sensor.exists({ parkingSpotID: spot._id });
    if (!hasSensor) {
      await Sensor.create({
        sensorAvailability: 'Unavailable', // becomes Available when the sensor connects
        parkingSpotID: spot._id,
      });
      console.log(`Created ${spotLocation} with a sensor`);
    } else {
      console.log(`Skipped ${spotLocation} (already has a sensor)`);
    }
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
