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
            enum: ['Unresolved','Resolved', 'Dismissed'],
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
            required: false // Added when an admin resolves a violation
        },

        userID:
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false // Added when the violator is known
        },

        violationNote:
        {
            type: String,
            trim: true,
            maxlength: 500 // The note the administrator writes when resolving or dismissing
        }
    },
    { timestamps: true }
);

// One OPEN violation per spot (several resolved or dismissed ones are fine)
violationSchema.index({parkingSpotID: 1}, {unique: true, partialFilterExpression: {violationStatus: 'Unresolved'}});

module.exports = mongoose.model('Violation',violationSchema);