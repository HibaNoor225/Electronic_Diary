const express = require('express');
const router = express.Router();
const Chat = require('../Models/Chat');
const User = require('../Models/User');

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
                username: otherUser.username || 'Unknown',
                profilePic: otherUser.profilePic || '/default-avatar.png',
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

router.get('/chat/:userId/:recipientId', async (req, res) => {
    try {
        const { userId, recipientId } = req.params;
        const messages = await Chat.findOne({
            $or: [
                { senderId: userId, recipientId },
                { senderId: recipientId, recipientId: userId }
            ]
        }).lean();

        res.json({
            success: true,
            messages: messages ? messages.messages : []
        });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Error fetching messages' });
    }
});


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

router.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/${req.file.filename}`;
        res.json({ success: true, fileUrl });
    } catch (error) {
        console.error('Error uploading file:', error);
        res.status(500).json({ success: false, message: 'Error uploading file' });
    }
});
module.exports = router;