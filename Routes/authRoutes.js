const express = require('express');
const passport = require('passport');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const User = require('../Models/User');
const authController = require('../Controller/authController');
const verifyToken = require('../middleware/authMiddleware');
const authValidator = require('../validators/userValidator');
const limit = require('../utils/limiter.js');
const Record = require('../Models/Record'); 
const { upload, processProfilePhoto } = require('../middleware/uploadImage');
const { sendPasswordResetEmail } = require('../utils/sendAdminNotifications');


const router = express.Router();
async function logActivity(userId, detail) {
    try {
        if (!userId) return; // skip if no user
        await Record.create({ user: userId, detail, date: new Date() });
    } catch (err) {
        console.error('[ActivityLog] Failed to log activity:', err.message);
    }
}

// Normal register
router.post(
  '/register',
  authValidator.registerValidator(),
  authValidator.validate,
  authController.register
);

// Normal login
router.post(
  '/login',
  limit.loginLimiter,
  authValidator.loginValidator(),
  authValidator.validate,
  authController.login
);


// Google login
router.get(
  '/google',
  
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/login-failed' }),
  authController.googleLogin
);

// Facebook login
router.get(
  '/facebook',
  passport.authenticate('facebook', { scope: ['email'] })
);

router.get(
  '/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: '/auth/login-failed' }),
  authController.facebookLogin
);

// Login failed route
router.get('/login-failed', (req, res) => {
  res.status(401).json({ error: 'Login failed' });
});



router.post(
  '/update-profile',
  verifyToken,
  upload,               // handles file upload
  processProfilePhoto,  // resizes & compresses
  authController.updateProfile
);

router.get('/profile', verifyToken, authController.getProfile);


router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: 'Email not found' });

        // Generate token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Save hashed token and expiry
        user.resetPasswordToken = resetTokenHash;
        user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
        await user.save({ validateBeforeSave: false });

        const resetUrl = `${req.protocol}://${req.get('host')}/forgotPassword.html?id=${user._id}&token=${resetToken}`;


        const message = `
            You requested a password reset.
            Click this link to reset your password:
            ${resetUrl}
            This link will expire in 1 hour.
        `;

       await sendPasswordResetEmail({
    to: user.email,
    resetUrl: resetUrl   // pass the URL here
});
await logActivity(user._id, 'Requested password reset');

        res.status(200).json({ success: true, message: 'Password reset link sent to your email' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error sending password reset email' });
    }
});



// Updated reset password route using query params
router.put('/reset-password', async (req, res) => {
    const { id, token } = req.query; // get from query instead of params
    const { newPassword, confirmPassword } = req.body;

    // Basic validation
    if (!newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    try {
        // Hash the token to match the one stored in DB
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token and expiry
        const user = await User.findOne({
            _id: id,
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired token' });
        }

        // Update password
        user.password =newPassword;
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save();
await logActivity(user._id, 'Password reset successfully');
        res.status(200).json({ success: true, message: 'Password has been reset successfully' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error resetting password' });
    }
});

module.exports = router;
