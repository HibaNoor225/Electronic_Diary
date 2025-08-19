const express = require('express');
const router = express.Router();
const { suggestCategory, suggestMood } = require('../Controller/suggestionsController');
const adminAuth = require('../middleware/adminAuth'); // optional if admin review needed

// User suggestions for category or mood
router.post('/category', suggestCategory);
router.post('/mood', suggestMood);

module.exports = router;
