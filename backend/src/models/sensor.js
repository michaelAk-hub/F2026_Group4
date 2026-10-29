const mongoose = require('mongoose');

const sensorSchema = new mongoose.Schema
(
    {
        sensorAvailability:
        {
            type: String,
            required: true,
            enum: ['Available', 'Unavailable']
        },

        sensorLocationCoordinates:
        {
            type: String
        },

        sensorLastSeen:
        {
            type: Date
        },

        parkingSpotID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ParkingSpot',
            required: true
        }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Sensor',sensorSchema);