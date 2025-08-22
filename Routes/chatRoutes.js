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

    // ✅ find or create chat
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

    // ✅ construct file message (no text message required)
    const newMessage = {
  sender: senderId,
  message: "",  // still keep empty if file-only
  fileUrl,
  fileType,
  timestamp: new Date()
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


module.exports = router;