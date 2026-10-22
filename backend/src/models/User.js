/**
 * User model
 *
 * Describes how a user is stored in MongoDB (the "users" collection).
 * A user is either a driver (books and pays for parking) or an admin
 * (manages sensors, violations and reports).
 *
 * Based on the project report:
 *  - RQ01: register with name, email, password and car number
 *  - RQ02: a car number is needed before a driver can reserve a spot
 *  - RQ03 / RQ16: drivers and admins log in with email and password
 *  - RQ23: passwords are stored only as a salted hash, never as plain text
 *  - RQ24: role-based access (driver vs admin)
 *
 * The password hashing itself (bcrypt) is added in week 2 with the
 * register/login endpoints. This model only stores the result.
 */
const mongoose = require('mongoose');

// The two roles the system knows. Exported so other files (e.g. the
// role-check middleware in week 2) use exactly the same values.
const ROLES = ['driver', 'admin'];

// A schema is the "shape" of a document: which fields it has, their type
// and the rules (validation) each field must pass before it is saved.
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'], // [rule, error message]
      trim: true,                           // removes spaces at the start/end
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,     // MongoDB index: two users cannot share an email
      lowercase: true,  // "Maria@Mail.com" is saved as "maria@mail.com"
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Email is not valid'], // simple "x@y.z" check
    },
    passwordHash: {
      type: String,
      required: true,
      // select: false = this field is NOT returned by normal queries.
      // The login code must ask for it explicitly with .select('+passwordHash').
      select: false,
    },
    carNumber: {
      type: String,
      trim: true,
      uppercase: true, // "kab 123" is saved as "KAB 123"
      // Required only when the user is a driver (RQ02); admins have no car.
      // A function is used so the rule can look at this user's role.
      required: [function () { return this.role === 'driver'; }, 'Car number is required'],
    },
    role: {
      type: String,
      enum: ROLES,        // only "driver" or "admin" are accepted
      default: 'driver',  // new sign-ups are drivers unless set otherwise
    },
  },
  // timestamps: Mongoose adds and updates createdAt and updatedAt for us.
  { timestamps: true }
);

// toJSON runs whenever a user is turned into JSON (e.g. res.json(user)).
// We remove the password hash and Mongoose's internal version field so they
// are never sent to the frontend, even by mistake.
userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

// mongoose.model() turns the schema into a class we can use:
// User.create({...}), User.findOne({ email }), etc.
module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
