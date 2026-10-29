// ESP32 sensor simulator. Run: npm run simulator
//
// Pretends to be one ESP32 + ultrasonic sensor (like an HC-SR04) per Sensor
// in the database. Each simulated sensor:
//   - sends "online" when it connects, and the broker sends "offline" for it
//     (Last Will) if it disappears without saying goodbye
//   - sends its status ("free" / "occupied") when it changes
//   - sends the status again every HEARTBEAT_MS so we know it is still alive
//
// Topics (retained, QoS 1):
//   parking/spots/<parkingSpotID>/status
//   parking/spots/<parkingSpotID>/availability
//
// Run `npm run seed:sensors` first if you have no sensors yet.
const mqtt = require('mqtt');
const mongoose = require('mongoose');
const {loadConfig} = require('../src/config/env');
const config = loadConfig();
const { connectDB } = require('../src/config/db');
const Sensor = require('../src/models/sensor');

const TICK_MS = parseInt(process.env.SIM_TICK_MS || '3000', 10); // how often a car may arrive/leave
const HEARTBEAT_MS = parseInt(process.env.SIM_HEARTBEAT_MS || '30000', 10);
const CHANGE_CHANCE = 0.15; // chance per tick that the spot changes

class SimulatedSensor {
  constructor(sensorID, parkingSpotID, startOccupied) {
    this.sensorID = String(sensorID);
    this.parkingSpotID = String(parkingSpotID);
    this.status = startOccupied ? 'occupied' : 'free';
    this.battery = 100;
    this.distanceCm = this.readDistance();
    this.statusTopic = `parking/spots/${this.parkingSpotID}/status`;
    this.availabilityTopic = `parking/spots/${this.parkingSpotID}/availability`;
  }

  // Fake ultrasonic reading: a car is close (~20 cm), an empty spot is far (~200 cm)
  readDistance() {
    const base = this.status === 'occupied' ? 20 : 200;
    return Math.round(base + (Math.random() * 10 - 5));
  }

  payload() {
    return JSON.stringify({
      sensorID: this.sensorID,
      parkingSpotID: this.parkingSpotID,
      status: this.status,
      distanceCm: this.distanceCm,
      battery: this.battery,
      timestamp: new Date().toISOString(),
    });
  }

  publishStatus() {
    if (!this.client.connected) return;
    this.client.publish(this.statusTopic, this.payload(), { qos: 1, retain: true });
    console.log(`[sensor ${this.sensorID.slice(-6)}] ${this.status} (${this.distanceCm} cm)`);
  }

  start() {
    this.client = mqtt.connect(config.mqttUrl, {
      clientId: `esp32-${this.sensorID}`,
      reconnectPeriod: 2000,
      // Last Will: the broker publishes this if the sensor dies unexpectedly
      will: { topic: this.availabilityTopic, payload: 'offline', qos: 1, retain: true },
    });

    this.client.on('connect', () => {
      this.client.publish(this.availabilityTopic, 'online', { qos: 1, retain: true });
      this.publishStatus();
    });
    this.client.on('error', (err) => console.error('MQTT error:', err.message));

    this.tickTimer = setInterval(() => {
      const before = this.status;
      if (Math.random() < CHANGE_CHANCE) {
        this.status = this.status === 'free' ? 'occupied' : 'free';
      }
      this.distanceCm = this.readDistance();
      this.battery = Math.max(0, +(this.battery - 0.01).toFixed(2));
      if (this.status !== before) this.publishStatus();
    }, TICK_MS);

    this.heartbeatTimer = setInterval(() => this.publishStatus(), HEARTBEAT_MS);
  }

  stop() {
    clearInterval(this.tickTimer);
    clearInterval(this.heartbeatTimer);
    return new Promise((resolve) => {
      // The Last Will is NOT sent on a clean disconnect, so we say "offline" ourselves
      this.client.publish(this.availabilityTopic, 'offline', { qos: 1, retain: true }, () => {
        this.client.end(false, {}, resolve);
      });
    });
  }
}

async function main() {
  await connectDB(config.mongodbUri);

  // populate() fills in the ParkingSpot, so we can start from its current state
  const sensors = await Sensor.find().populate('parkingSpotID');
  const usable = sensors.filter((s) => s.parkingSpotID); // skip sensors whose spot was deleted

  if (usable.length === 0) {
    console.error('No sensors in the database. Run: npm run seed:sensors');
    await mongoose.disconnect();
    process.exit(1);
  }

  const simulated = usable.map(
    (s) => new SimulatedSensor(s._id, s.parkingSpotID._id, s.parkingSpotID.spotStatus === 'Taken')
  );
  simulated.forEach((s) => s.start());
  console.log(`Simulating ${simulated.length} sensors -> ${config.mqttUrl} (Ctrl+C to stop)`);

  process.on('SIGINT', async () => {
    console.log('\nStopping sensors...');
    await Promise.all(simulated.map((s) => s.stop()));
    await mongoose.disconnect();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
