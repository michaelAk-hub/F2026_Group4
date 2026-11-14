const express = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/profileController');

const router = express.Router();

// Only a logged in driver has a profile (RQ12, RQ24)
router.use(requireAuth, requireRole('driver'));

// /api/me
router.get('/', getProfile);
router.put('/', updateProfile);

module.exports = router;
