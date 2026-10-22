/**
 * Main router: connects each URL group to its own route file.
 * Everything here is mounted under /api in app.js, so
 * '/health' below becomes '/api/health'.
 *
 * Each week a new line is added here for the new feature.
 */
const express = require('express');
const healthRoutes = require('./health');

const router = express.Router();

router.use('/health', healthRoutes);
// Week 2: router.use('/auth', require('./auth'));   -> /api/auth/register, /api/auth/login
// Week 3: router.use('/spots', require('./spots')); -> /api/spots

module.exports = router;
