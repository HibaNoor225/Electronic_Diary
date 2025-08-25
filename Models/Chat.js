const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    recipientId: { type: String, required: true },
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
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat.messages',
            default: null
        },
        duration: { type: Number, default: null } // Add duration field for audio messages
    }],
    lastMessage: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', chatSchema);