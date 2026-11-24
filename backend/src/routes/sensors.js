const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listSensors, addSensor, updateSensor, removeSensor } = require('../controllers/sensorsController');

const router = express.Router();

// Only a logged in administrator can manage the sensors (RQ17, RQ24)
router.use(requireAuth, requireRole('admin'));

// /api/sensors (Member 3, week 6)
router.get('/', listSensors); // all sensors
router.post('/', addSensor); // add a sensor
router.put('/:id', updateSensor); // change its coordinates or the name of its spot
router.delete('/:id', removeSensor); // remove it

module.exports = router;
