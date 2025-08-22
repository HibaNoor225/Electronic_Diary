const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    recipientId: { type: String, required: true },
    messages: [{
        sender: { type: String, required: true },
        message: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
    }],
    lastMessage: { type: String, default: '' },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Chat', chatSchema);