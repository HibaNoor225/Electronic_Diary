const mongoose = require('mongoose');

const userNotificationSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  }, // receiver of the notification

  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, // optional (for chats, invites, tags)

type: { 
  type: String, 
  enum: ['chat', 'tag', 'invite',  'like', 'comment'], 
  required: true 
}, // categorize notification

  message: { 
    type: String, 
    required: true 
  }, // "User X sent you a message"

  isRead: { 
    type: Boolean, 
    default: false 
  }, // unread by default

  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for faster queries (fetching notifications by user, sorted by newest)
userNotificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.UserNotification || mongoose.model('UserNotification', userNotificationSchema);
