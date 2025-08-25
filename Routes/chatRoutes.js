const express = require('express');
const router = express.Router();
const Chat = require('../Models/Chat');
const User = require('../Models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'uploads/';
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

// Get all chats for a user
router.get('/chat/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const chats = await Chat.find({
            $or: [{ senderId: userId }, { recipientId: userId }]
        })
            .sort({ updatedAt: -1 })
            .lean();

        const chatData = await Promise.all(chats.map(async (chat) => {
            const otherUserId = chat.senderId === userId ? chat.recipientId : chat.senderId;
            const otherUser = await User.findById(otherUserId).select('username profilePic');
            return {
                userId: otherUserId,
                username: otherUser?.username || 'Unknown',
                profilePic: otherUser?.profilePic || '/default-avatar.png',
                lastMessage: chat.lastMessage || '',
                lastMessageTime: chat.updatedAt
            };
        }));

        res.json({ success: true, chats: chatData });
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ success: false, message: 'Error fetching chats' });
    }
});

// Get messages for a specific chat
router.get('/chat/:userId/:recipientId', async (req, res) => {
    try {
        const { userId, recipientId } = req.params;
        let chat = await Chat.findOne({
            $or: [
                { senderId: userId, recipientId },
                { senderId: recipientId, recipientId: userId }
            ]
        }).lean();

        if (!chat) {
            chat = new Chat({ senderId: userId, recipientId, messages: [] });
            await chat.save();
        }

        res.json({
            success: true,
            chatId: chat._id,
            messages: chat.messages || []
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Error fetching messages' });
    }
});

// Send a message
router.post("/sendMessage", async (req, res) => {
    try {
        const { senderId, recipientId, message, replyTo } = req.body;

        if (!senderId || !recipientId || !message) {
            return res.status(400).json({ success: false, error: "Missing fields" });
        }

        let chat = await Chat.findOne({
            $or: [
                { senderId, recipientId },
                { senderId: recipientId, recipientId: senderId }
            ]
        });

        if (!chat) {
            chat = new Chat({ senderId, recipientId, messages: [], lastMessage: "" });
        }

        const newMessage = {
            sender: senderId,
            message,
            timestamp: new Date(),
            replyTo: replyTo || null,
            hiddenFor: [],
            reactions: [],
            deletedForEveryone: false
        };

        chat.messages.push(newMessage);
        chat.lastMessage = message;
        chat.updatedAt = new Date();
        await chat.save();

        res.json({ success: true, message: newMessage });
    } catch (err) {
        console.error('Error sending message:', err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

// Upload a file
router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { senderId, recipientId } = req.body;
        if (!senderId || !recipientId) {
            return res.status(400).json({ success: false, message: 'Missing sender or recipient' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        const fileType = req.file.mimetype.startsWith("image")
            ? "image"
            : req.file.mimetype.startsWith("video")
            ? "video"
            : req.file.mimetype.startsWith("audio")
            ? "audio"
            : "file";

        let chat = await Chat.findOne({
            $or: [
                { senderId, recipientId },
                { senderId: recipientId, recipientId: senderId }
            ]
        });

        if (!chat) {
            chat = new Chat({
                senderId,
                recipientId,
                messages: []
            });
        }

        const newMessage = {
            sender: senderId,
            message: "",
            fileUrl,
            fileType,
            timestamp: new Date(),
            hiddenFor: [],
            reactions: [],
            deletedForEveryone: false
        };

        chat.messages.push(newMessage);
        chat.lastMessage = fileType === "image" ? "Shared a beautiful moment" : "Shared a file";
        chat.updatedAt = new Date();
        await chat.save();

        res.json({ success: true, message: newMessage });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Error uploading file' });
    }
});

// React to a message
router.post("/:chatId/react/:messageId", async (req, res) => {
    try {
        const { chatId, messageId } = req.params;
        const { emoji, userId } = req.body;

        if (!emoji || !userId) {
            return res.status(400).json({ success: false, message: 'Missing emoji or userId' });
        }

        const chat = await Chat.findOne({ _id: chatId });
        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (!message.reactions) message.reactions = [];

        const existing = message.reactions.find(r => r.userId === userId && r.emoji === emoji);
        if (existing) {
            message.reactions = message.reactions.filter(r => !(r.userId === userId && r.emoji === emoji));
        } else {
            message.reactions.push({ emoji, userId });
        }

        await chat.save();
        res.json({ success: true, reactions: message.reactions });

        // Emit via socket (handled in chatSocket.js)
    } catch (error) {
        console.error('Error reacting to message:', error);
        res.status(500).json({ success: false, message: 'Error reacting to message' });
    }
});

// Delete a message
router.post("/:chatId/delete/:messageId", async (req, res) => {
    try {
        const { chatId, messageId } = req.params;
        const { userId, forEveryone } = req.body;

        if (!userId) {
            return res.status(400).json({ success: false, message: 'Missing userId' });
        }

        const chat = await Chat.findOne({ _id: chatId });
        if (!chat) {
            return res.status(404).json({ success: false, message: 'Chat not found' });
        }

        const message = chat.messages.id(messageId);
        if (!message) {
            return res.status(404).json({ success: false, message: 'Message not found' });
        }

        if (forEveryone && message.sender !== userId) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete for everyone' });
        }

        if (forEveryone) {
            message.deletedForEveryone = true;
            message.message = "🚫 This message was deleted";
            chat.lastMessage = "Message deleted";
        } else {
            if (!message.hiddenFor.includes(userId)) {
                message.hiddenFor.push(userId);
            }
        }

        await chat.save();
        res.json({ success: true, message });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ success: false, message: 'Error deleting message' });
    }
});

module.exports = router;