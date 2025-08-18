const express = require('express');
const router = express.Router();
const userController = require('../Controller/userController');
const authMiddleware = require('../middleware/authMiddleware');

// GET user profile with paginated posts
router.get('/profile/:userId', userController.getUserProfile);
// Delete a post
router.delete('/post/:postId', authMiddleware, userController.deletePost);


module.exports = router;
