const User = require('../Models/User');
const Diary = require('../Models/Diary');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const generateToken = require('../utils/tokenGeneration');
const { upload, validateImageDimensions } = require('../middleware/uploadImage');
const Record=require("../Models/Record") // <-- import record model

// Helper function to log activity
async function logActivity(userId, detail) {
    try {
        if (!userId) return; // skip if no user
        await Record.create({ user: userId, detail, date: new Date() });
    } catch (err) {
        console.error('[ActivityLog] Failed to log activity:', err.message);
    }
}


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
await logActivity(user._id, "User registered");

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

    if (!email || !password) {
      return sendError(res, "Email and password are required", 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log("Login failed: user not found");
      return sendError(res, "Invalid credentials", 401);
    }

    // Check if user is active
    if (user.isActive === false) {
      return sendError(
        res,
        `Your account has been deactivated by admin. Contact support at ${process.env.SUPPORT_EMAIL}`,
        403
      );
    }

    // If password not set (social login only)
    if (!user.password) {
      return sendError(res, "Please login using your social account", 401);
    }

    // Compare password safely
    let isPasswordValid = false;
    try {
      isPasswordValid = await user.comparePassword(password);
    } catch (err) {
      console.error("Password comparison error:", err);
      return sendError(res, "Server error during password verification", 500);
    }

    if (!isPasswordValid) {
      console.log("Login failed: wrong password");
      return sendError(res, "Invalid credentials", 401);
    }

    const token = generateToken(user);
    const hasProfile = Boolean(user.fullName && user.username);
    const isAdmin = user.email === process.env.ADMIN_EMAIL;
await logActivity(user._id, "User logged in");

    return sendSuccess(res, "Login successful", {
      token,
      isAdmin, // frontend can redirect to admin panel
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
    return sendError(res, "Server error, please try again", 500);
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
          role: 'user',
          isActive: true // make sure default is active
        });
      }
    }

    // Check if user is active
    if (!user.isActive) {
      return sendError(res, `Your account has been deactivated by admin. Contact support at ${process.env.SUPPORT_EMAIL}`, 403);
    }

    // Add logging here
    await logActivity(user._id, "User logged in via Google");

    const token = generateToken(user);
    const hasProfile = Boolean(user.fullName && user.username);
    const isAdmin = (user.email === process.env.ADMIN_EMAIL);

    const redirectUrl = isAdmin
      ? `http://localhost:3000/HTML/adminPanel.html?token=${token}`
      : hasProfile
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
          role: 'user',
          isActive: true
        });
      }
    }

    // Check if user is active
    if (!user.isActive) {
      return sendError(res, `Your account has been deactivated by admin. Contact support at ${process.env.SUPPORT_EMAIL}`, 403);
    }

    // Add logging here
    await logActivity(user._id, "User logged in via Facebook");

    const token = generateToken(user);
    const hasProfile = Boolean(user.fullName && user.username);
    const isAdmin = (user.email === process.env.ADMIN_EMAIL);

    const redirectUrl = isAdmin
      ? `http://localhost:3000/HTML/adminPanel.html?token=${token}`
      : hasProfile
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
    const { fullName, username, bio, gender, age } = req.body;
    const updateData = { fullName, username, bio, gender, age };

    if (req.file) {
      updateData.profilePhoto = req.file.paths || {
        original: `/uploads/profilePhotos/${req.file.filename}`
      };
    }

    const updatedUser = await User.findByIdAndUpdate(req.info.id, updateData, { new: true });
    if (!updatedUser) return sendError(res, 'User not found', 404);

    // Add logging here
    await logActivity(req.info.id, "User updated profile");

    return sendSuccess(res, 'Profile updated successfully', updatedUser);
  } catch (err) {
    console.error("Profile update error:", err);
    return sendError(res, err.message || 'Failed to update profile', 500);
  }
}

// ---------------- Get User By Id ----------------
getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Add logging here
    await logActivity(req.info.id, `Viewed profile of user ${userId}`);

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
};

// ---------------- Get Own Profile ----------------
getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.info.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Add logging here
    await logActivity(req.info.id, "Viewed own profile");

    res.json({ success: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error fetching user" });
  }
};

}

module.exports = new UserController();
