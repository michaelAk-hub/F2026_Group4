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

        // RQ11: the receipt number the driver sees after paying, e.g. RCPT-3F9A1C07D2
        // sparse = payments that are still Incomplete have no receipt, and that is allowed
        receiptId:
        {
            type: String,
            unique: true,
            sparse: true
        },

        // PCI-DSS (C06): we keep ONLY the last 4 digits of the card.
        // The full card number, expiry and CVV are never saved.
        cardLast4:
        {
            type: String,
            match: [/^\d{4}$/, 'cardLast4 must be exactly 4 digits']
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