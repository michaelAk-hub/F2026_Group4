const mongoose = require('mongoose');

const parkingSpotSchema = new mongoose.Schema
(
    {
        spotLocation:
        {
            type: String,
            required: true
        },

        spotStatus:
        {
            type: String,
            required: true,
            enum: ['Available', 'Reserved', 'Taken'],
            default: 'Available'
        },
    },
    
    {
        timestamps: true,
        toJSON: {virtuals: true},
        toObject: {virtuals: true}
    }
);

parkingSpotSchema.virtual('occupies',
{
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'parkingSpotID'
});

parkingSpotSchema.virtual('subject_to',
{
    ref: 'Violation',
    localField: '_id',
    foreignField: 'parkingSpotID'
});

parkingSpotSchema.virtual('monitored_by',
{
    ref: 'Sensor',
    localField: '_id',
    foreignField: 'parkingSpotID'
});

module.exports = mongoose.model('ParkingSpot',parkingSpotSchema);