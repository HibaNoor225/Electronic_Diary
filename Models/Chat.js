const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    recipientId: { type: String, required: true },
    messages: [{
        sender: { type: String, required: true },
        message: { type: String, default: '' }, // Text (optional)
        fileUrl: { type: String, default: null }, // File path
        fileType: { type: String, default: null }, // "image", "video", "audio", "file"
        timestamp: { type: Date, default: Date.now },
        deletedForEveryone: { type: Boolean, default: false }, // For deleteForEveryone
        hiddenFor: [{ type: String }], // For deleteForMe
        reactions: [{
            emoji: String,
            userId: { type: String }
        }],
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat.messages',
            default: null
        }
    }],
    lastMessage: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', chatSchema);