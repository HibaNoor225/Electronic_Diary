const express = require('express');
const router = express.Router();
const diaryController = require('../Controller/diaryController');
const  { uploadDiary, uploadChunk, handleChunkUpload,handleMergeChunks, processDiaryImages } = require('../middleware/uploadDiary');
const authMiddleware = require('../middleware/authMiddleware'); 

router.post("/upload-chunk", authMiddleware, uploadChunk, handleChunkUpload);

// Merge chunks after all are uploaded
router.post("/merge-chunks", authMiddleware, handleMergeChunks);
// ---------- Add a new event ----------
router.post(
  '/', 
  authMiddleware,
  uploadDiary,          // for normal (non-chunked) uploads
  diaryController.addEvent
);

// ---------- Search routes ----------
router.get('/search/name', authMiddleware, diaryController.searchByName);
router.get('/search/mood', authMiddleware, diaryController.searchByMood);
router.get('/search/category', authMiddleware, diaryController.searchByCategory);
router.get('/search', authMiddleware, diaryController.searchEvents);

// ---------- Get all events for a date ----------
router.get('/:date', authMiddleware, diaryController.getEventsByDate);

// ---------- Edit an event ----------
router.put(
  '/:date/:eventId', 
  authMiddleware,
  uploadDiary,          // for normal uploads
  diaryController.editEvent
);

// ---------- Delete an event ----------
router.delete('/:date/:eventId', authMiddleware, diaryController.deleteEvent);

module.exports = router;
