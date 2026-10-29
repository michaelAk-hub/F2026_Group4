// Connects the API to Mosquitto and passes every sensor message to sensorService.
const mqtt = require('mqtt');
const { handleMessage } = require('./sensorService');

const TOPICS = ['parking/spots/+/status', 'parking/spots/+/availability'];

function startMqtt(url) {
  const client = mqtt.connect(url, {
    clientId: `smart-parking-api-${process.pid}`,
    reconnectPeriod: 5000, // try again every 5 seconds if the broker is down
  });

  client.on('connect', () => {
    console.log('MQTT connected to ' + url);
    client.subscribe(TOPICS, { qos: 1 }, (err) => {
      if (err) console.error('MQTT subscribe failed:', err.message);
    });
  });

  client.on('message', (topic, payload) => {
    handleMessage(topic, payload).catch((err) => {
      console.error(`[MQTT] Error while handling ${topic}:`, err);
    });
  });

  client.on('error', (err) => console.error('MQTT error:', err.message));

  return client;
}

module.exports = { startMqtt };
