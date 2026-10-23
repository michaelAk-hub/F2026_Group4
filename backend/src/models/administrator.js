const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema
(
    {},

    {
        timestamps: true,
        toJSON: {virtuals: true},
        toObject: {virtuals: true}
    }
);

adminSchema.virtual('manages',
{
    ref: 'Account',
    localField: '_id',
    foreignField: 'administratorID'
});

adminSchema.virtual('records',
{
    ref: 'Violation',
    localField: '_id',
    foreignField: 'administratorID'
});

adminSchema.virtual('generates',
{
    ref: 'Report',
    localField: '_id',
    foreignField: 'administratorID'
});

module.exports = mongoose.model('Administrator',adminSchema);