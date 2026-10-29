const mongoose = require('mongoose');

// User = the driver. Login details (email, password) are in Account.js
const userSchema = new mongoose.Schema
(
    {
        userName:
        {
            type: String,
            required: [true, 'Name is required'],
            trim: true,      // remove spaces at the start and end
            minlength: 2,
        },

        // RQ02: every driver must give a car number
        // 3 letters, an optional space and 3 numbers, same rule as the register form (e.g. "KAB 123" or "KAB123")
        userCarNumber:
        {
            type: String,
            required: [true, 'Car number is required'],
            trim: true,
            uppercase: true, // "kab 123" is saved as "KAB 123"
            match: [/^[A-Z]{3} ?[0-9]{3}$/, 'Use 3 letters and 3 numbers: ABC123 or ABC 123']
        },

        // e.g. "Card" (optional)
        userPaymentMethod:
        {
            type: String
        }
    },
    {
        timestamps: true,           // adds createdAt and updatedAt
        toJSON: {virtuals: true},   // show the virtual fields below when we send the user
        toObject: {virtuals: true}
    }
);

// Virtual fields are not saved in the database.
// They let us find the user's reservations and account with .populate('makes') / .populate('has')
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
