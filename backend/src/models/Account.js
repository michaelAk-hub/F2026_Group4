const mongoose = require('mongoose');

// Account = login details. It belongs to a User (driver) or to an Administrator
const accountSchema = new mongoose.Schema
(
    {
        accountEmail:
        {
            type: String,
            required: [true, 'Email is required'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Email is not valid']
        },

        accountPasswordHash:
        {
            type: String,
            required: true,
            select: false
        },

        // needed only when the account is not an administrator
        userID:
        {
            type:mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [function () { return !this.administratorID; }, 'Account needs a user or an administrator']
        },

        administratorID:
        {
            type:mongoose.Schema.Types.ObjectId,
            ref: 'Administrator'
        }
    },
    { timestamps: true }
);

// never send the password hash back
accountSchema.set('toJSON',
    {
    transform(account, ret)
    {
        delete ret.accountPasswordHash;
        delete ret.__v;
        return ret;
    },
});
module.exports = mongoose.model('Account',accountSchema);
