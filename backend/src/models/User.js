const mongoose = require('mongoose');

// User = the driver. Login details (email, password) are in Account.js
const userSchema = new mongoose.Schema
(
    {
        userName:
        {
            type: String,
            required: [true, 'Name is required'],
            trim: true,
            minlength: 2,
        },

        // RQ02: every driver must give a car number
        userCarNumber:
        {
            type: String,
            required: [true, 'Car number is required'],
            trim: true,
            uppercase: true,
            minlength: 5
        },

        userPaymentMethod:
        {
            type: String
        }
    },
    {
        timestamps: true,
        toJSON: {virtuals: true},
        toObject: {virtuals: true}
    }
);

userSchema.virtual('makes',
{
    ref: 'Reservation',
    localField: '_id',
    foreignField: 'userID'
});

userSchema.virtual('has',
{
    ref: 'Account',
    localField: '_id',
    foreignField: 'userID'
});

module.exports = mongoose.model('User',userSchema);
