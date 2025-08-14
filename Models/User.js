const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  username: { 
  type: String, 
  required: function () {
    return !this.googleId && !this.facebookId;
  }
},


  email: { type: String, required: true, unique: true, lowercase: true },

  password: {
    type: String,
    required: function () {
      // Require password only if not using Google or Facebook login
      return !this.googleId && !this.facebookId;
    }
  },

  googleId: { type: String },  // For Google accounts
  facebookId: { type: String }, // For Facebook accounts
  fullName: { type: String },
    bio: { type: String, maxlength: 150 },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer-not-to-say'] },
    age: { type: Number, min: 13, max: 120 },
    profilePhoto: { type: String } // store image URL or path
}, {
  timestamps: true
});

// Hash password if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const hashed = await bcrypt.hash(this.password, 10);
    this.password = hashed;
    next();
  } catch (err) {
    next(err);
  }
});

// Compare password
userSchema.methods.comparePassword = async function (inputPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(inputPassword, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
