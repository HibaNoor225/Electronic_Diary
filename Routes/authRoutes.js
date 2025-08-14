const express = require('express');
const passport = require('passport');
const authController = require('../Controller/authController');
const verifyToken = require('../middleware/authMiddleware');
const authValidator = require('../validators/userValidator');
const limit = require('../utils/limiter.js');

const router = express.Router();

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

router.post('/update-profile', verifyToken, authController.updateProfile);

module.exports = router;
