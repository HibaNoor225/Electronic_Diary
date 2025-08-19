const express = require('express');
const router = express.Router();
const { suggestCategory, suggestMood,getSuggestions } = require('../Controller/suggestionsController');
const adminAuth = require('../middleware/adminAuth'); // optional if admin review needed
const verifyToken=require("../middleware/authMiddleware")
// User suggestions for category or mood
router.post('/category', verifyToken,suggestCategory);
router.post('/mood', verifyToken,suggestMood);
router.get('/', verifyToken,getSuggestions);
module.exports = router;
