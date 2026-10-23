const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema
(
    {
        reportType:
        {
            type: String,
            enum:['Monetary','SpotReport'],
            default: 'Monetary'
        },

        reportGenerationDate:
        {
            type: Date,
            required: true
        },

        reportPeriodStart:
        {
            type: Date
        },
        reportPeriodEnd:
        {
            type: Date
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

module.exports = mongoose.model('Report',reportSchema);