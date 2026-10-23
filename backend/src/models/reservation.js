const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema
(
    {
        reservationStartTime:
        {
            type: Date,
            required: true
        },

        reservationEndTime:
        {
            type: Date,
            required: true
        },

        reservationStatus:
        {
            type: String,
            required: true,
            enum: ['Unpaid','Paid'],
            default: 'Unpaid'
        },

        userID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },

        parkingSpotID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ParkingSpot',
            required: true
        },

        paymentID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Payment',
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model('Reservation',reservationSchema);