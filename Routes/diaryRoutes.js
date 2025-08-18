const express = require('express');
const router = express.Router();
const diaryController = require('../Controller/diaryController');
const uploadDiary = require('../middleware/uploadDiary');
const authMiddleware = require('../middleware/authMiddleware'); // protect routes

// Add a new event
router.post('/', authMiddleware, uploadDiary, diaryController.addEvent);


router.get('/search/name',authMiddleware, diaryController.searchByName);
router.get('/search/mood', authMiddleware,diaryController.searchByMood);
router.get('/search/category',authMiddleware, diaryController.searchByCategory);
router.get('/search', authMiddleware,diaryController.searchEvents);

// Get all events for a date
router.get('/:date', authMiddleware, diaryController.getEventsByDate);

// Edit an event
router.put('/:date/:eventId', authMiddleware, uploadDiary, diaryController.editEvent);
router.delete('/:date/:eventId', authMiddleware, diaryController.deleteEvent);






module.exports = router;


