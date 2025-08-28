const express = require('express');
const router = express.Router();
const userNotificationController = require('../Controller/userNotificationController');

// Middleware: ensure user logged in
const  ensureAuth = require('../middleware/authMiddleware'); 

// Get all notifications for user
router.get('/', ensureAuth, userNotificationController.getUserNotifications);

// Mark single notification as read
router.patch('/:id/read', ensureAuth, userNotificationController.markAsRead);

// Mark all notifications as read
router.patch('/readAll', ensureAuth, userNotificationController.markAllAsRead);

console.log("✅ userNotificationRoutes loaded");
router.delete('/:id', ensureAuth, (req, res, next) => {
  console.log("✅ DELETE /api/notifications/:id hit", req.params.id);
  next();
}, userNotificationController.deleteNotification);

module.exports = router;
