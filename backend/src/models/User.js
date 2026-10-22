const mongoose = require('mongoose');

// User model: how a user is saved in the database.
// Fields come from the report (RQ01 - RQ03, RQ23, RQ24).
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // no two users with the same email
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is not valid'],
    },
    // We never save the real password, only the hashed one (RQ23).
    // select: false means it is not returned when we search for users.
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    // Drivers need a car number to reserve a spot (RQ02), admins do not.
    carNumber: {
      type: String,
      trim: true,
      uppercase: true,
      required: [
        function () {
          return this.role === 'driver';
        },
        'Car number is required',
      ],
    },
    // Driver or admin (RQ24)
    role: {
      type: String,
      enum: ['driver', 'admin'],
      default: 'driver',
    },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

// Hide the password hash when a user is sent back as JSON.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
