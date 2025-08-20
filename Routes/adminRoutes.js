const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const bcrypt = require("bcrypt");
const { Category, Mood } = require('../Models/CategoryMood');

// ==================== USER ROUTES ==================== //

// Create user
router.post('/user', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, message: 'Username, email, and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already exists' });

    const user = new User({ username, email, password: password, fullName });
    await user.save();

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update user
router.put('/user/:id', async (req, res) => {
  try {
    const { username, email, password, fullName, isActive } = req.body;
    const updateData = { username, email, fullName, isActive };

    if (password) {
      const hashed = await bcrypt.hash(password, 10);
      updateData.password = hashed;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete user
router.delete('/user/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/user/:id', async (req, res) => {
  try {
    console.log("Fetching user with ID:", req.params.id);  // ✅ log ID
    const user = await User.findById(req.params.id);

    if (!user) {
      console.log("User not found!");
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("Found user:", user);  // ✅ log user object
    res.status(200).json(user);  // send raw user
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Error fetching user", error: error.message });
  }
});

// ==================== CATEGORY ROUTES ==================== //
// Category toggle
router.put('/category/:id', async (req, res) => {
  try {
    const { status } = req.body; // 'public' | 'private'
    const isActive = status === 'public';

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Mood toggle
router.put('/mood/:id', async (req, res) => {
  try {
    const { status } = req.body; // 'public' | 'private'
    const isActive = status === 'public';

    const mood = await Mood.findByIdAndUpdate(
      req.params.id,
      { isActive },
      { new: true }
    );
    if (!mood) return res.status(404).json({ success: false, message: 'Mood not found' });

    res.json({ success: true, data: mood });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Reset password route
router.put("/user/reset-password/:id", async (req, res) => {
    const { oldPassword, newPassword, confirmPassword } = req.body;
    const userId = req.params.id;

    if (!oldPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: "New password and confirm password do not match" });
    }

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Check if old password matches
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) return res.status(400).json({ success: false, message: "Old password is incorrect" });

        // Hash new password and save
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ success: true, message: "Password updated successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: "Error updating password", error: err.message });
    }
});

module.exports = router;



module.exports = router;
