const User = require('../Models/User');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const generateToken = require('../utils/tokenGeneration');
const { upload, validateImageDimensions } = require('../middleware/uploadImage');

class UserController {

  // Register a new user
  async register(req, res) {
    try {
      if (!req.body.password && !req.body.googleId && !req.body.facebookId) {
        return sendError(res, "Password required for manual registration", 400, { password: "Password is required" });
      }

      const user = new User(req.body);
      await user.save();

      // Generate token
      const token = generateToken(user);
      const hasProfile = false; // First-time user has no profile

      sendSuccess(res, "User registered successfully", {
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

  // Manual login
async login(req, res) {
  try {
    const { email, password } = req.body;
    console.log("Login attempt for:", email); // <- log email

    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found!");
      return sendError(res, "Invalid credentials", 401);
    }

    if (!user.password) {
      console.log("User has no password (social login)");
      return sendError(res, "Please login using social account", 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    console.log("Password valid?", isPasswordValid); // <- log password check

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

  

  // Google login
  async googleLogin(req, res) {
    try {
      const googleProfile = req.user;
      const email = googleProfile.emails?.[0]?.value;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          username: googleProfile.displayName,
          email,
          googleId: googleProfile.id,
          role: 'user'
        });
      }

      const token = generateToken(user);
      const hasProfile = Boolean(user.fullName && user.username);


      if (hasProfile) {
        return res.redirect(`http://localhost:3000/HTML/dashboard.html?token=${token}`);
      } else {
        return res.redirect(`http://localhost:3000/HTML/profile.html?token=${token}`);
      }
    } catch (err) {
      console.error(err);
      return sendError(res, "Google login failed", 500);
    }
  }

  // Facebook login
  async facebookLogin(req, res) {
    try {
      const fbProfile = req.user;
      const email = fbProfile.emails?.[0]?.value || `${fbProfile.id}@facebook.com`;

      let user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          username: fbProfile.displayName,
          email,
          facebookId: fbProfile.id,
          role: 'user'
        });
      }

      const token = generateToken(user);
     const hasProfile = Boolean(user.fullName && user.username);


      if (hasProfile) {
        return res.redirect(`http://localhost:3000/HTML/dashboard.html?token=${token}`);
      } else {
        return res.redirect(`http://localhost:3000/HTML/profile.html?token=${token}`);
      }
    } catch (err) {
      console.error(err);
      return sendError(res, "Facebook login failed", 500);
    }
  }

  // Update profile
  async updateProfile(req, res) {
    upload(req, res, async (err) => {
      if (err) return sendError(res, err.message || 'File upload failed', 400);

      await validateImageDimensions(req, res, async () => {
        try {
          const { fullName, username, bio, gender, age } = req.body;
          const updateData = { fullName, username, bio, gender, age };

          if (req.file) {
            updateData.profilePhoto = `/uploads/profilePhotos/${req.file.filename}`;
          }

          const updatedUser = await User.findByIdAndUpdate(req.info.id, updateData, { new: true });
          if (!updatedUser) return sendError(res, 'User not found', 404);

          sendSuccess(res, 'Profile added successfully', {
            id: updatedUser._id,
            fullName: updatedUser.fullName,
            username: updatedUser.username,
            bio: updatedUser.bio,
            gender: updatedUser.gender,
            age: updatedUser.age,
            profilePhoto: updatedUser.profilePhoto
          });
        } catch (err) {
          console.error(err);
          sendError(res, 'Failed to update profile', 500);
        }
      });
    });
  }
}

module.exports = new UserController();
