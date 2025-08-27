const express = require('express');
const Chat = require('../Models/Chat');
const GroupChat = require('../Models/groupChat');
const Invitation = require('../Models/Invitations');
const User = require('../Models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = 'Uploads/';
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
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'application/pdf',
            'audio/mpeg', 'audio/wav', 'audio/webm'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

module.exports = (io) => {
    const router = express.Router();

    // =================== GET ALL CHATS ===================
    router.get('/chat/:userId', async (req, res) => {
        try {
            const userId = req.params.userId;
            if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ success: false, message: 'Invalid user ID' });
            }

            const personalChats = await Chat.find({
                $or: [{ senderId: userId }, { recipientId: userId }]
            }).sort({ updatedAt: -1 }).lean();

            const personalChatData = await Promise.all(personalChats.map(async (chat) => {
                const otherUserId = chat.senderId === userId ? chat.recipientId : chat.senderId;
                const otherUser = await User.findById(otherUserId).select('username profilePic').lean();
                return {
                    chatId: chat._id.toString(),
                    type: 'personal',
                    userId: otherUserId,
                    username: otherUser?.username || 'Unknown',
                    profilePic: otherUser?.profilePic || null,
                    lastMessage: chat.lastMessage || '',
                    lastMessageTime: chat.updatedAt
                };
            }));

            const groupChats = await GroupChat.find({ participants: userId })
                .sort({ updatedAt: -1 })
                .lean();

            const groupChatData = groupChats.map(group => ({
                chatId: group._id.toString(),
                type: 'group',
                groupName: group.groupName,
                participants: group.participants.map(id => id.toString()),
                adminId: group.adminId.toString(),
                lastMessage: group.lastMessage || '',
                lastMessageTime: group.updatedAt
            }));

            const chats = [...personalChatData, ...groupChatData].sort(
                (a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)
            );

            res.json({ success: true, chats });
        } catch (error) {
            console.error('Error fetching chats:', error);
            res.status(500).json({ success: false, message: 'Error fetching chats' });
        }
    });

    // =================== GET MESSAGES ===================
    router.get('/messages/:chatId', async (req, res) => {
        try {
            const { chatId } = req.params;
            const userId = req.query.userId;
            if (!chatId.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ success: false, message: 'Invalid chat ID' });
            }

            let chat = await Chat.findById(chatId).lean();
            let type = 'personal';
            if (!chat) {
                chat = await GroupChat.findById(chatId).lean();
                type = 'group';
            }
            if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

            const messages = chat.messages || [];
            const filteredMessages = messages.filter(
                msg => !msg.hiddenFor?.includes(userId)
            );

            res.json({
                success: true,
                chatId: chat._id.toString(),
                type,
                messages: filteredMessages.map(msg => ({
                    ...msg,
                    _id: msg._id?.toString() || null,
                    sender: msg.sender?.toString() || null,
                    replyTo: msg.replyTo?.toString() || null,
                    hiddenFor: msg.hiddenFor?.map(id => id.toString()) || [],
                    reactions: msg.reactions?.map(r => ({
                        ...r,
                        userId: r.userId?.toString() || null
                    })) || []
                }))
            });
        } catch (error) {
            console.error('Error fetching messages:', error);
            res.status(500).json({ success: false, message: 'Error fetching messages' });
        }
    });

    // =================== SEND MESSAGE ===================
    router.post('/sendMessage', async (req, res) => {
        try {
            const { chatId, senderId, message, replyTo, type, fileUrl, fileType, fileName, fileSize, duration } = req.body;
            if (!chatId || !senderId || !type || (!message && !fileUrl)) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }

            let chat = (type === 'personal')
                ? await Chat.findById(chatId)
                : await GroupChat.findById(chatId);

            if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

            const newMessage = {
                sender: senderId,
                message: message || '',
                timestamp: new Date(),
                replyTo: replyTo || null,
                hiddenFor: [],
                reactions: [],
                deletedForEveryone: false,
                fileUrl,
                fileType,
                fileName,
                fileSize,
                duration: duration ? parseInt(duration) : null
            };

            chat.messages.push(newMessage);
            chat.lastMessage = fileUrl
                ? (fileType === 'image' ? 'Shared a beautiful moment'
                    : fileType === 'audio' ? 'Shared a voice message'
                    : 'Shared a file')
                : message || 'Message';
            chat.updatedAt = new Date();
            await chat.save();

            io.to(chatId).emit('receiveMessage', {
                _id: newMessage._id.toString(),
                sender: senderId,
                message: newMessage.message,
                fileUrl,
                fileType,
                fileName,
                fileSize,
                timestamp: newMessage.timestamp,
                replyTo: newMessage.replyTo?.toString() || null,
                duration: newMessage.duration,
                type
            });

            res.json({ success: true, message: { ...newMessage, _id: newMessage._id.toString(), replyTo: newMessage.replyTo?.toString() || null }, chatId, type });
        } catch (error) {
            console.error('Error sending message:', error);
            res.status(500).json({ success: false, message: 'Error sending message' });
        }
    });

    // =================== EDIT MESSAGE ===================
    router.post('/message/edit', async (req, res) => {
        try {
            const { messageId, userId, type, chatId, newText } = req.body;

            // Validate input
            if (!messageId || !userId || !type || !chatId || !newText) {
                return res.status(400).json({ success: false, message: 'Missing required fields' });
            }
            if (!chatId.match(/^[0-9a-fA-F]{24}$/) || !messageId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                return res.status(400).json({ success: false, message: 'Invalid chat ID, message ID, or user ID' });
            }
            if (newText.trim() === '') {
                return res.status(400).json({ success: false, message: 'Edited message cannot be empty' });
            }

            // Find chat
            let chat = (type === 'personal')
                ? await Chat.findById(chatId)
                : await GroupChat.findById(chatId);

            if (!chat) {
                return res.status(404).json({ success: false, message: 'Chat not found' });
            }

            // Find message
            const message = chat.messages.id(messageId);
            if (!message) {
                return res.status(404).json({ success: false, message: 'Message not found' });
            }

            // Check if user is the sender
            if (message.sender.toString() !== userId) {
                return res.status(403).json({ success: false, message: 'Only the sender can edit this message' });
            }

            // Check if message is already deleted
            if (message.deletedForEveryone) {
                return res.status(400).json({ success: false, message: 'Cannot edit a deleted message' });
            }

            // Check if message is text (only text messages can be edited)
            if (message.fileType) {
                return res.status(400).json({ success: false, message: 'Only text messages can be edited' });
            }

            // Update message
            message.message = newText.trim();
            message.edited = true; // Add edited flag
            message.updatedAt = new Date();
            chat.lastMessage = newText.trim();
            chat.updatedAt = new Date();
            await chat.save();

            // Emit socket event
            io.to(chatId).emit('messageEdited', {
                messageId,
                chatId,
                type,
                newText: newText.trim(),
                updatedAt: message.updatedAt
            });

            res.json({ success: true, message: { ...message.toObject(), _id: message._id.toString() } });
        } catch (error) {
            console.error('Error editing message:', error);
            res.status(500).json({ success: false, message: 'Error editing message' });
        }
    });

    // =================== FILE UPLOAD ===================
    router.post('/upload', upload.single('file'), async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

            const fileUrl = `/Uploads/${req.file.filename}`;
            const fileType = req.file.mimetype.startsWith('image')
                ? 'image'
                : req.file.mimetype.startsWith('audio')
                ? 'audio'
                : 'file';

            res.json({
                success: true,
                fileUrl,
                fileType,
                fileName: req.file.originalname,
                fileSize: req.file.size
            });
        } catch (error) {
            console.error('Error uploading file:', error);
            res.status(500).json({ success: false, message: 'Error uploading file' });
        }
    });

    // =================== REACT TO MESSAGE ===================
    router.post('/message/react/:messageId', async (req, res) => {
        try {
            const { messageId } = req.params;
            const { emoji, userId, type, chatId } = req.body;

            let chat = (type === 'personal')
                ? await Chat.findById(chatId)
                : await GroupChat.findById(chatId);

            if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

            const message = chat.messages.id(messageId);
            if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

            if (!message.reactions) message.reactions = [];
            const existing = message.reactions.find(r => r.userId?.toString() === userId && r.emoji === emoji);
            if (existing) {
                message.reactions = message.reactions.filter(r => !(r.userId?.toString() === userId && r.emoji === emoji));
            } else {
                message.reactions.push({ emoji, userId });
            }

            await chat.save();

            io.to(chatId).emit('messageReacted', { messageId, reaction: emoji, type });

            res.json({ success: true, reactions: message.reactions.map(r => ({ ...r, userId: r.userId?.toString() })) });
        } catch (error) {
            console.error('Error reacting to message:', error);
            res.status(500).json({ success: false, message: 'Error reacting to message' });
        }
    });

    // =================== DELETE FOR ME ===================
    router.post('/message/delete/me', async (req, res) => {
        try {
            const { messageId, userId, type, chatId } = req.body;

            let chat = (type === 'personal')
                ? await Chat.findById(chatId)
                : await GroupChat.findById(chatId);

            if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

            const message = chat.messages.id(messageId);
            if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

            if (!message.hiddenFor.includes(userId)) {
                message.hiddenFor.push(userId);
            }

            await chat.save();
            io.to(chatId).emit('messageDeletedForMe', { messageId, userId, type });

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting message for me:', error);
            res.status(500).json({ success: false, message: 'Error deleting message' });
        }
    });

    // =================== DELETE FOR EVERYONE ===================
    router.post('/message/delete/everyone', async (req, res) => {
        try {
            const { messageId, userId, type, chatId } = req.body;

            let chat = (type === 'personal')
                ? await Chat.findById(chatId)
                : await GroupChat.findById(chatId);

            if (!chat) return res.status(404).json({ success: false, message: 'Chat not found' });

            const message = chat.messages.id(messageId);
            if (!message) return res.status(404).json({ success: false, message: 'Message not found' });

            message.deletedForEveryone = true;
            message.message = '🚫 This message was deleted';
            chat.lastMessage = 'Message deleted';
            await chat.save();

            io.to(chatId).emit('messageDeletedForEveryone', { messageId, chatId, type });

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting message for everyone:', error);
            res.status(500).json({ success: false, message: 'Error deleting message' });
        }
    });

    // =================== GROUP ROUTES ===================
    router.post('/group/create', async (req, res) => {
        try {
            const { groupName, members, createdBy } = req.body;
            const group = new GroupChat({
                groupName,
                participants: members,
                adminId: createdBy,
                createdBy,
                messages: [],
                lastMessage: '',
                updatedAt: new Date()
            });
            await group.save();

            io.to(group._id.toString()).emit('groupCreated', {
                groupId: group._id.toString(),
                groupName,
                participants: group.participants.map(id => id.toString()),
                adminId: group.adminId.toString()
            });

            res.json({ success: true, group });
        } catch (error) {
            console.error('Error creating group:', error);
            res.status(500).json({ success: false, message: 'Error creating group' });
        }
    });

    router.post('/group/:groupId/add', async (req, res) => {
        try {
            const { groupId } = req.params;
            const { userId } = req.body;

            const group = await GroupChat.findById(groupId);
            group.participants.push(userId);
            await group.save();

            io.to(groupId).emit('memberAdded', { userId, groupId });
            res.json({ success: true, group });
        } catch (error) {
            console.error('Error adding member:', error);
            res.status(500).json({ success: false, message: 'Error adding member' });
        }
    });

    router.post('/group/:groupId/remove', async (req, res) => {
        try {
            const { groupId } = req.params;
            const { userId } = req.body;

            const group = await GroupChat.findById(groupId);
            group.participants = group.participants.filter(id => id.toString() !== userId);
            await group.save();

            io.to(groupId).emit('memberRemoved', { userId, groupId });
            res.json({ success: true, group });
        } catch (error) {
            console.error('Error removing member:', error);
            res.status(500).json({ success: false, message: 'Error removing member' });
        }
    });

    router.post('/group/:groupId/leave', async (req, res) => {
        try {
            const { groupId } = req.params;
            const { userId } = req.body;

            const group = await GroupChat.findById(groupId);
            group.participants = group.participants.filter(id => id.toString() !== userId);

            if (group.adminId.toString() === userId && group.participants.length > 0) {
                group.adminId = group.participants[0];
            }

            await group.save();
            io.to(groupId).emit('memberLeft', { userId, groupId });

            if (group.participants.length === 0) {
                await GroupChat.deleteOne({ _id: groupId });
                io.to(groupId).emit('groupDeleted', { groupId });
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error leaving group:', error);
            res.status(500).json({ success: false, message: 'Error leaving group' });
        }
    });

    router.post('/group/delete', async (req, res) => {
        try {
            const { groupId } = req.body;
            await GroupChat.deleteOne({ _id: groupId });

            io.to(groupId).emit('groupDeleted', { groupId });
            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting group:', error);
            res.status(500).json({ success: false, message: 'Error deleting group' });
        }
    });

    // =================== FRIENDS ===================
    router.get('/friends/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const chats = await Chat.find({
                $or: [{ senderId: userId }, { recipientId: userId }]
            }).lean();

            const chatUserIds = chats.map(chat =>
                chat.senderId.toString() === userId
                    ? chat.recipientId.toString()
                    : chat.senderId.toString()
            );

            const invitations = await Invitation.find({
                $or: [{ senderId: userId }, { recipientId: userId }]
            }).lean();

            const inviteUserIds = invitations.map(inv =>
                inv.senderId.toString() === userId
                    ? inv.recipientId.toString()
                    : inv.senderId.toString()
            );

            const allUserIds = [...new Set([...chatUserIds, ...inviteUserIds])];
            const friends = await User.find({ _id: { $in: allUserIds } })
                .select('username profilePic')
                .lean();

            res.json({
                success: true,
                friends: friends.map(friend => ({
                    ...friend,
                    _id: friend._id.toString(),
                    profilePic: friend.profilePic || null
                }))
            });
        } catch (error) {
            console.error('Error fetching friend list:', error);
            res.status(500).json({ success: false, message: 'Error fetching friends' });
        }
    });

    router.get('/user/:userId', async (req, res) => {
        try {
            const { userId } = req.params;
            const user = await User.findById(userId).select('username').lean();
            if (!user) return res.status(404).json({ success: false, message: 'User not found' });
            res.json({ success: true, user: { username: user.username || 'Unknown' } });
        } catch (error) {
            console.error('Error fetching user details:', error);
            res.status(500).json({ success: false, message: 'Error fetching user details' });
        }
    });

    return router;
};