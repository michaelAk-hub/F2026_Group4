const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { listViolations, closeViolation } = require('../controllers/violationController');

const router = express.Router();

// Only administrators can see and close violations (RQ24)
router.use(requireAuth, requireRole('admin'));

// /api/violations
router.get('/', listViolations);
router.put('/:id', closeViolation);

module.exports = router;
