const mongoose = require('mongoose');

// Report RQ01-RQ03, RQ16, RQ23-RQ24: drivers register with name, email,
// password and car number; admins log in with email and password.
// Only the hash of the password is stored (hashing is added in week 2).
const ROLES = ['driver', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is not valid'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    carNumber: {
      type: String,
      trim: true,
      uppercase: true,
      // Required for drivers (RQ02), not for admins.
      required: [function () { return this.role === 'driver'; }, 'Car number is required'],
    },
    role: {
      type: String,
      enum: ROLES,
      default: 'driver',
    },
  },
  { timestamps: true }
);

// Never send the password hash back in API responses.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
