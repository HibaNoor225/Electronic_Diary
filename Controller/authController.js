const User = require('../Models/User');
const { sendSuccess, sendError } = require('../utils/responseFormatter');
const generateToken = require('../utils/tokenGeneration');
const { upload, validateImageDimensions } = require('../middleware/uploadImage');

const runUploadMiddleware = (req, res) => {
    return new Promise((resolve, reject) => {
        upload(req, res, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

// You'll need to do the same for your image dimension validation middleware
// if it also uses a callback.
const runImageDimensionValidation = (req, res) => {
    return new Promise((resolve, reject) => {
        validateImageDimensions(req, res, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};
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

  async googleLogin(req, res) {
  try {
    const googleProfile = req.user;
    const email = googleProfile.emails?.[0]?.value;

    // Step 1: Find user by Google ID first
    let user = await User.findOne({ googleId: googleProfile.id });

    // Step 2: If not found, check if a user with same email exists
    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        // Link Google ID to existing user
        user.googleId = googleProfile.id;
        await user.save();
      } else {
        // New user
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

    return res.redirect(
      hasProfile
        ? `http://localhost:3000/HTML/dashboard.html?token=${token}`
        : `http://localhost:3000/HTML/profile.html?token=${token}`
    );

  } catch (err) {
    console.error("Google login error:", err);
    return sendError(res, "Google login failed", 500);
  }
}

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

    return res.redirect(
      hasProfile
        ? `http://localhost:3000/HTML/dashboard.html?token=${token}`
        : `http://localhost:3000/HTML/profile.html?token=${token}`
    );

  } catch (err) {
    console.error("Facebook login error:", err);
    return sendError(res, "Facebook login failed", 500);
  }
}


  // Update profile
// A helper function to promisify the upload middleware.
// This allows you to use 'await' with the callback-based 'upload' function.



// The corrected and simplified updateProfile function
async updateProfile(req, res) {
    try {
        // Step 1: Run the file upload middleware.
        // The await keyword ensures this completes before moving on.
        await runUploadMiddleware(req, res);

        // Step 2: Run the image dimension validation.
        // Again, this is awaited for sequential execution.
        await runImageDimensionValidation(req, res);
        
        // Step 3: Extract data and prepare the update object.
        const { fullName, username, bio, gender, age } = req.body;
        const updateData = { fullName, username, bio, gender, age };

        // Step 4: If a file was successfully uploaded, add the photo path to the update.
        if (req.file) {
            updateData.profilePhoto = `/uploads/profilePhotos/${req.file.filename}`;
        }
        
        // Step 5: Find the user by ID and update their profile in the database.
        const updatedUser = await User.findByIdAndUpdate(req.info.id, updateData, { new: true });

        // Handle the case where the user is not found.
        if (!updatedUser) {
            return sendError(res, 'User not found', 404);
        }
        console.log("User ID:", req.info?.id);
console.log("Body:", req.body);
console.log("File:", req.file);

        // Step 6: Send a success response with the updated user data.
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
        // Catch any errors from the middleware or the database operation.
        console.error("Profile update error:", err);
        return sendError(res, err.message || 'Failed to update profile', 500);
    }
}
}

module.exports = new UserController();
