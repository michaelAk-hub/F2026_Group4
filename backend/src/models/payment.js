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

        // Task 5.4: a cancelled paid reservation gets a full refund. The payment is kept (it is the
        // refund record) so the driver still sees it in their payment history.
        refundedAt:
        {
            type: Date
        },

        refundAmount:
        {
            type: Number
        },

        paymentStatus:
        {
            type: String,
            required: true,
            enum: ['Incomplete','Complete','Refunded'],
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