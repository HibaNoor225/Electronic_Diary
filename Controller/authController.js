const User = require('../Models/User');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const generateToken = require('../utils/tokenGeneration');
const { upload, validateImageDimensions } = require('../middleware/uploadImage');

// Promisify upload middleware
const runUploadMiddleware = (req, res) => {
  return new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

// Promisify dimension validation middleware
const runImageDimensionValidation = (req, res) => {
  return new Promise((resolve, reject) => {
    validateImageDimensions(req, res, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
};

class UserController {
  // ---------------- Register ----------------
  async register(req, res) {
    try {
      if (!req.body.password && !req.body.googleId && !req.body.facebookId) {
        return sendError(res, "Password required for manual registration", 400, { password: "Password is required" });
      }

      const user = new User(req.body);
      await user.save();

      const token = generateToken(user);
      const hasProfile = false;

      return sendSuccess(res, "User registered successfully", {
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          hasProfile
        }
      });

    } catch (err) {
      console.error("Registration error:", err);

      if (err.name === "ValidationError") {
        const fieldErrors = {};
        for (let field in err.errors) fieldErrors[field] = err.errors[field].message;
        return sendError(res, "Validation failed", 400, fieldErrors);
      }

      if (err.code === 11000 && err.keyValue?.email) {
        return sendError(res, "Email already in use", 400, { email: "Email is already registered" });
      }

      return sendError(res, "User registration failed", err.code || 500);
    }
  }

  // ---------------- Manual Login ----------------
  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });
      if (!user) return sendError(res, "Invalid credentials", 401);

      if (!user.password) {
        return sendError(res, "Please login using your social account", 401);
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return sendError(res, "Invalid credentials", 401);
      }

      const token = generateToken(user);
      const hasProfile = Boolean(user.fullName && user.username);

      return sendSuccess(res, "Login successful", {
        token,
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          role: user.role,
          hasProfile
        }
      });

    } catch (err) {
      console.error("Login error:", err);
      return sendError(res, "Login failed", 500);
    }
  }

  // ---------------- Google Login ----------------
  async googleLogin(req, res) {
    try {
      const googleProfile = req.user;
      const email = googleProfile.emails?.[0]?.value;

      let user = await User.findOne({ googleId: googleProfile.id });

      if (!user) {
        user = await User.findOne({ email });
        if (user) {
          user.googleId = googleProfile.id;
          await user.save();
        } else {
          user = await User.create({
            username: googleProfile.displayName,
            email,
            googleId: googleProfile.id,
            role: 'user'
          });
        }
      }

      const token = generateToken(user);
      const hasProfile = Boolean(user.fullName && user.username);

     const redirectUrl = hasProfile
  ? `http://localhost:3000/HTML/dashboard.html?token=${token}`
  : `http://localhost:3000/HTML/profile.html?token=${token}`;

return res.redirect(redirectUrl);


    } catch (err) {
      console.error("Google login error:", err);
      return sendError(res, "Google login failed", 500);
    }
  }

  // ---------------- Facebook Login ----------------
  async facebookLogin(req, res) {
    try {
      const fbProfile = req.user;
      const email = fbProfile.emails?.[0]?.value || `${fbProfile.id}@facebook.com`;

      let user = await User.findOne({ facebookId: fbProfile.id });

      if (!user) {
        user = await User.findOne({ email });
        if (user) {
          user.facebookId = fbProfile.id;
          await user.save();
        } else {
          user = await User.create({
            username: fbProfile.displayName,
            email,
            facebookId: fbProfile.id,
            role: 'user'
          });
        }
      }

      const token = generateToken(user);
      const hasProfile = Boolean(user.fullName && user.username);

      const redirectUrl = hasProfile
  ? `http://localhost:3000/HTML/dashboard.html?token=${token}`
  : `http://localhost:3000/HTML/profile.html?token=${token}`;

return res.redirect(redirectUrl);


    } catch (err) {
      console.error("Facebook login error:", err);
      return sendError(res, "Facebook login failed", 500);
    }
  }

  // ---------------- Update Profile ----------------
  async updateProfile(req, res) {
    try {
      await runUploadMiddleware(req, res);
      await runImageDimensionValidation(req, res);

      const { fullName, username, bio, gender, age } = req.body;
      const updateData = { fullName, username, bio, gender, age };

      if (req.file) {
        updateData.profilePhoto = `/uploads/profilePhotos/${req.file.filename}`;
      }

      const updatedUser = await User.findByIdAndUpdate(req.info.id, updateData, { new: true });
      if (!updatedUser) return sendError(res, 'User not found', 404);

      return sendSuccess(res, 'Profile updated successfully', {
        id: updatedUser._id,
        fullName: updatedUser.fullName,
        username: updatedUser.username,
        bio: updatedUser.bio,
        gender: updatedUser.gender,
        age: updatedUser.age,
        profilePhoto: updatedUser.profilePhoto
      });

    } catch (err) {
      console.error("Profile update error:", err);
      return sendError(res, err.message || 'Failed to update profile', 500);
    }
  }

 getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
};

getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
};

}

module.exports = new UserController();
