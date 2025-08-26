const mongoose = require('mongoose');

const groupChatSchema = new mongoose.Schema({
  groupName: { type: String, required: true },
  participants: [{ type: String, required: true }], // Array of user IDs
  adminId: { type: String, required: true }, // Admin user ID
  createdBy: { type: String, required: true }, // Creator user ID
  createdAt: { type: Date, default: Date.now },
  lastMessage: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  messages: [{
    sender: { type: String, required: true },
    message: { type: String, default: '' },
    fileUrl: { type: String, default: null },
    fileType: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
    deletedForEveryone: { type: Boolean, default: false },
    hiddenFor: [{ type: String }],
    reactions: [{
      emoji: String,
      userId: { type: String }
    }],
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'GroupChat.messages', default: null },
    duration: { type: Number, default: null } // For audio messages
  }]
});

// Indexes for faster queries
groupChatSchema.index({ participants: 1 });
groupChatSchema.index({ createdAt: -1 });

module.exports = mongoose.model('GroupChat', groupChatSchema);