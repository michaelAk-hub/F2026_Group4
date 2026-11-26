// Violations for the administrator (task 6.4): RQ14, RQ19.
//   GET /api/violations        the list (default: only the open ones)
//   PUT /api/violations/:id    resolve or dismiss a violation, with a note
// Only administrators can use these routes (see routes/violations.js).
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Violation = require('../models/violation');
const ParkingSpot = require('../models/parkingSpot');

const LIST_STATUSES = ['Unresolved', 'Resolved', 'Dismissed', 'all'];
const CLOSE_STATUSES = ['Resolved', 'Dismissed'];
const MAX_NOTE_LENGTH = 500;

// What the frontend gets for one violation
function toJson(violation, spotLocation) {
  return {
    id: violation._id,
    type: violation.violationType,
    date: violation.violationDate,
    status: violation.violationStatus,
    note: violation.violationNote || '',
    spotId: violation.parkingSpotID,
    spotLocation, // left out of the answer if the spot does not exist any more
    userId: violation.userID, // only when the driver is known
  };
}

// GET /api/violations?status=Unresolved|Resolved|Dismissed|all   (default: Unresolved)
async function listViolations(req, res) {
  const status = req.query.status === undefined ? 'Unresolved' : req.query.status;
  if (!LIST_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Status must be Unresolved, Resolved, Dismissed or all.' });
  }

  const filter = status === 'all' ? {} : { violationStatus: status };
  const violations = await Violation.find(filter).sort({ violationDate: -1 }).lean(); // newest first

  // the location of every spot, in one query
  const spots = await ParkingSpot.find({ _id: { $in: violations.map((v) => v.parkingSpotID) } })
    .select('spotLocation')
    .lean();
  const locationOf = new Map(spots.map((s) => [String(s._id), s.spotLocation]));

  res.json({ violations: violations.map((v) => toJson(v, locationOf.get(String(v.parkingSpotID)))) });
}

// PUT /api/violations/:id      body: { status: 'Resolved' | 'Dismissed', note }
async function closeViolation(req, res) {
  const { status, note } = req.body || {};

  if (!CLOSE_STATUSES.includes(status)) {
    return res.status(400).json({ message: 'Status must be Resolved or Dismissed.' });
  }
  if (note !== undefined && (typeof note !== 'string' || note.trim().length > MAX_NOTE_LENGTH)) {
    return res.status(400).json({ message: `The note must be text of at most ${MAX_NOTE_LENGTH} characters.` });
  }

  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(404).json({ message: 'Violation not found.' });
  }
  const violation = await Violation.findById(req.params.id);
  if (!violation) {
    return res.status(404).json({ message: 'Violation not found.' });
  }
  if (violation.violationStatus !== 'Unresolved') {
    return res.status(409).json({ message: 'This violation is already closed.' });
  }

  // The administrator who closes it is the one in the login token
  const account = await Account.findById(req.user.accountId);
  if (!account || !account.administratorID) {
    return res.status(403).json({ message: 'Administrator not found.' });
  }

  const changes = { violationStatus: status, administratorID: account.administratorID };
  if (note !== undefined) changes.violationNote = note.trim();

  // The filter violationStatus: 'Unresolved' means that when two administrators click at the
  // same moment, only one of them can close it. The other one gets 409.
  const update = await Violation.updateOne({ _id: violation._id, violationStatus: 'Unresolved' }, { $set: changes });
  if (update.modifiedCount !== 1) {
    return res.status(409).json({ message: 'This violation is already closed.' });
  }

  const updated = await Violation.findById(violation._id);
  const spot = await ParkingSpot.findById(updated.parkingSpotID).select('spotLocation');
  res.json({
    message: status === 'Resolved' ? 'Violation resolved.' : 'Violation dismissed.',
    violation: toJson(updated, spot ? spot.spotLocation : undefined),
  });
}

module.exports = { listViolations, closeViolation };
