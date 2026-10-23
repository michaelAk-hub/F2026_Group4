const mongoose = require('mongoose');

// Account = login details. It belongs to a User (driver) or to an Administrator
const accountSchema = new mongoose.Schema
(
    {
        accountEmail:
        {
            type: String,
            required: [true, 'Email is required'],
            unique: true,     // two accounts cannot have the same email
            lowercase: true,  // "Maria@Example.com" is saved as "maria@example.com"
            trim: true,
            match: [/^\S+@\S+\.\S+$/, 'Email is not valid'] // must look like name@site.com
        },

        // we save only the hash of the password, never the password itself
        accountPasswordHash:
        {
            type: String,
            required: true,
            select: false     // not returned when we read accounts from the database
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
    { timestamps: true }      // adds createdAt and updatedAt
);

// never send the password hash back
accountSchema.set('toJSON',
    {
    transform(account, ret)
    {
        delete ret.accountPasswordHash;
        delete ret.__v;       // __v is an internal Mongoose field
        return ret;
    },
});
module.exports = mongoose.model('Account',accountSchema);
