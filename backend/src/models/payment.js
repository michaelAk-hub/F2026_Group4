const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema
(
    {
        paymentAmount:
        {
            type: Number
        },

        paymentMethod:
        {
            type: String
        },

        paymentStatus:
        {
            type: String,
            required: true,
            enum: ['Incomplete','Complete'],
            default: 'Incomplete'
        }
    },
    {
    timestamps: true,
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
    }
);

paymentSchema.virtual('triggers',
{
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'paymentID'
});

module.exports = mongoose.model('Payment',paymentSchema);