const express = require('express');
const router = express.Router();
const User = require('../Models/User');
const bcrypt = require("bcrypt");
const { Category, Mood } = require('../Models/CategoryMood');
const Record = require('../Models/Record'); // Activity log

// Helper to log activity
async function logActivity(userId, detail) {
  try {
    await Record.create({ user: userId, detail, date: new Date() });
    console.log(`[ActivityLog] User: ${userId}, Detail: ${detail}`);
  } catch (err) {
    console.error('[ActivityLog] Failed to log activity:', err.message);
  }
}

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

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword, fullName });
    await user.save();

    await logActivity(user._id, 'User account created');

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    console.error('Create user error:', err);
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

    await logActivity(req.params.id, 'User profile updated');

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete user
router.delete('/user/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logActivity(req.params.id, 'User account deleted');

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get user
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await logActivity(req.params.id, 'Fetched user profile');

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ success: false, message: "Error fetching user", error: err.message });
  }
});

// ==================== CATEGORY & MOOD ROUTES ==================== //

router.put('/category/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const isActive = status === 'public';

    const category = await Category.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found' });

    await logActivity(req.info?.id || "Anonymous", `Category ${req.params.id} set to ${status}`);

    res.json({ success: true, data: category });
  } catch (err) {
    console.error('Category update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/mood/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const isActive = status === 'public';

    const mood = await Mood.findByIdAndUpdate(req.params.id, { isActive }, { new: true });
    if (!mood) return res.status(404).json({ success: false, message: 'Mood not found' });

    await logActivity(req.info?.id || "Anonymous", `Mood ${req.params.id} set to ${status}`);

    res.json({ success: true, data: mood });
  } catch (err) {
    console.error('Mood update error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== PASSWORD RESET ==================== //
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

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(400).json({ success: false, message: "Old password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logActivity(userId, 'User reset password');

    res.status(200).json({ success: true, message: "Password updated successfully" });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, message: "Error updating password", error: err.message });
  }
});

module.exports = router;
