const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema
(
    {
        violationType:
        {
            type: String
        },

        violationDate:
        {
            type: Date
        },

        violationStatus:
        {
            type: String,
            enum: ['Unresolved','Resolved'],
            default: 'Unresolved'
        },

        parkingSpotID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ParkingSpot',
            required: true
        },

        administratorID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Administrator',
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Violation',violationSchema);