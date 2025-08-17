const express = require('express');
const router = express.Router();
const userController = require('../Controller/userController');

// GET user profile with paginated posts
router.get('/profile/:userId', userController.getUserProfile);

module.exports = router;
