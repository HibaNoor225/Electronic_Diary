
// Socket.IO Logic
const Chat = require('../Models/Chat');
const GroupChat = require('../Models/groupChat');
const UserNotification = require('../Models/UserNotification'); // ✅ NEW
const onlineUsers = {};

module.exports = (io) => {
    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // User online
        socket.on('userOnline', (userId) => {
            if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid or missing userId for userOnline event:', userId);
                return;
            }
            socket.userId = userId;
            onlineUsers[userId] = socket.id;
            console.log(`User ${userId} is online with socket ${socket.id}`);

            Promise.all([
                Chat.find({
                    $or: [{ senderId: userId }, { recipientId: userId }]
                }).lean(),
                GroupChat.find({ participants: userId }).lean()
            ])
                .then(([personalChats, groupChats]) => {
                    const allChats = [...personalChats, ...groupChats];
                    allChats.forEach(chat => {
                        io.to(chat._id.toString()).emit('userOnline', userId);
                    });
                })
                .catch(err => {
                    console.error('Error notifying chats of userOnline:', err);
                });
        });

        // Join chat room (personal or group)
        socket.on('joinChat', ({ chatId, type }) => {
            if (!chatId || !type || !chatId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid or missing chatId/type for joinChat:', { chatId, type });
                return;
            }
            socket.join(chatId);
            console.log(`User ${socket.userId || 'unknown'} joined chat ${chatId} (${type})`);
        });

        // ---------------- Send Message ----------------
        socket.on('sendMessage', async ({ chatId, senderId, message, fileUrl, fileType, fileName, fileSize, replyTo, tempId, duration, type }) => {
            if (!chatId || !senderId || !type || (!message && !fileUrl)) {
                console.error('Missing required fields in sendMessage:', { chatId, senderId, type });
                return;
            }
            if (!chatId.match(/^[0-9a-fA-F]{24}$/) || !senderId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid chatId or senderId:', { chatId, senderId });
                return;
            }

            try {
                let chat;
                if (type === 'personal') {
                    chat = await Chat.findById(chatId);
                } else if (type === 'group') {
                    chat = await GroupChat.findById(chatId);
                }
                if (!chat) {
                    console.error('Chat not found:', chatId);
                    return;
                }

                // ✅ Check participant
                const isParticipant = type === 'personal'
                    ? (chat.senderId.toString() === senderId || chat.recipientId.toString() === senderId)
                    : (chat.participants.some(id => id.toString() === senderId));
                if (!isParticipant) {
                    console.error('User not in chat:', senderId);
                    return;
                }

                const newMsg = {
                    sender: senderId,
                    message: message || '',
                    fileUrl,
                    fileType,
                    fileName,
                    fileSize,
                    timestamp: new Date(),
                    replyTo: replyTo || null,
                    hiddenFor: [],
                    reactions: [],
                    deletedForEveryone: false,
                    duration: duration ? parseInt(duration) : null
                };

                chat.messages.push(newMsg);
                chat.lastMessage = fileUrl
                    ? (fileType === 'image' ? 'Shared a beautiful moment' : fileType === 'audio' ? 'Shared a voice message' : 'Shared a file')
                    : message || 'Message deleted';
                chat.updatedAt = new Date();
                await chat.save();

                const messageId = chat.messages[chat.messages.length - 1]._id.toString();

                io.to(chatId).emit('receiveMessage', {
                    _id: messageId,
                    chatId,
                    type,
                    sender: senderId,
                    message: newMsg.message,
                    fileUrl,
                    fileType,
                    fileName,
                    fileSize,
                    timestamp: newMsg.timestamp,
                    replyTo: newMsg.replyTo,
                    duration: newMsg.duration,
                    tempId
                });

                if (onlineUsers[senderId]) {
                    io.to(onlineUsers[senderId]).emit('messageConfirmed', {
                        chatId,
                        tempId,
                        messageId,
                        type
                    });
                }

                // ---------------- Create Notifications ----------------
                if (type === 'personal') {
                    const recipientId = chat.senderId.toString() === senderId ? chat.recipientId : chat.senderId;
                    await UserNotification.create({
                        user: recipientId,
                        sender: senderId,
                        type: 'chat',
                        message: 'sent you a new message'
                    });

                    if (onlineUsers[recipientId]) {
                        io.to(onlineUsers[recipientId]).emit('newNotification');
                    }
                } else if (type === 'group') {
                    const notifications = chat.participants
                        .filter(id => id.toString() !== senderId)
                        .map(recipientId => ({
                            user: recipientId,
                            sender: senderId,
                            type: 'chat',
                            message: 'sent a new message in group chat'
                        }));
                    await UserNotification.insertMany(notifications);

                    chat.participants.forEach(id => {
                        if (id.toString() !== senderId && onlineUsers[id.toString()]) {
                            io.to(onlineUsers[id.toString()]).emit('newNotification');
                        }
                    });
                }
            } catch (err) {
                console.error('Error saving message:', err);
            }
        });

        // Edit message
        socket.on('editMessage', async ({ chatId, messageId, userId, newText, type }) => {
            if (!chatId || !messageId || !userId || !newText || !type) {
                console.error('Missing fields in editMessage:', { chatId, messageId, userId, newText, type });
                return;
            }
            if (!chatId.match(/^[0-9a-fA-F]{24}$/) || !messageId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid IDs in editMessage:', { chatId, messageId, userId });
                return;
            }
            if (newText.trim() === '') {
                console.error('Edited message cannot be empty');
                return;
            }

            try {
                let chat;
                if (type === 'personal') {
                    chat = await Chat.findById(chatId);
                } else if (type === 'group') {
                    chat = await GroupChat.findById(chatId);
                }
                if (!chat) {
                    console.error('Chat not found:', chatId);
                    return;
                }

                const message = chat.messages.id(messageId);
                if (!message) {
                    console.error('Message not found:', messageId);
                    return;
                }

                if (message.sender.toString() !== userId) {
                    console.error('User not authorized to edit message:', userId);
                    return;
                }

                if (message.deletedForEveryone) {
                    console.error('Cannot edit a deleted message:', messageId);
                    return;
                }

                if (message.fileType) {
                    console.error('Only text messages can be edited:', messageId);
                    return;
                }

                message.message = newText.trim();
                message.edited = true;
                message.updatedAt = new Date();
                chat.lastMessage = newText.trim();
                chat.updatedAt = new Date();
                await chat.save();

                io.to(chatId).emit('messageEdited', {
                    messageId,
                    chatId,
                    type,
                    newText: newText.trim(),
                    updatedAt: message.updatedAt
                });
            } catch (err) {
                console.error('Error editing message:', err);
            }
        });

        // Delete for me
        socket.on('deleteMessageForMe', async ({ chatId, messageId, userId, type }) => {
            if (!chatId || !messageId || !userId || !type) {
                console.error('Missing fields in deleteMessageForMe:', { chatId, messageId, userId, type });
                return;
            }
            if (!chatId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid chatId or userId:', { chatId, userId });
                return;
            }

            try {
                let chat;
                if (type === 'personal') {
                    chat = await Chat.findById(chatId);
                } else if (type === 'group') {
                    chat = await GroupChat.findById(chatId);
                }
                if (!chat) {
                    console.error('Chat not found:', chatId);
                    return;
                }

                const message = chat.messages.id(messageId);
                if (!message) {
                    console.error('Message not found:', messageId);
                    return;
                }

                if (!message.hiddenFor) message.hiddenFor = [];
                if (!message.hiddenFor.includes(userId)) {
                    message.hiddenFor.push(userId);
                    chat.updatedAt = new Date();
                    await chat.save();
                }

                if (onlineUsers[userId]) {
                    io.to(onlineUsers[userId]).emit('messageDeletedForMe', { messageId, userId, type });
                }
            } catch (err) {
                console.error('Error deleting message for me:', err);
            }
        });

        // Delete for everyone
        socket.on('deleteMessageForEveryone', async ({ chatId, messageId, userId, type }) => {
            if (!chatId || !messageId || !userId || !type) {
                console.error('Missing fields in deleteMessageForEveryone:', { chatId, messageId, userId, type });
                return;
            }
            if (!chatId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid chatId or userId:', { chatId, userId });
                return;
            }

            try {
                let chat;
                if (type === 'personal') {
                    chat = await Chat.findById(chatId);
                } else if (type === 'group') {
                    chat = await GroupChat.findById(chatId);
                }
                if (!chat) {
                    console.error('Chat not found:', chatId);
                    return;
                }

                const message = chat.messages.id(messageId);
                if (!message) {
                    console.error('Message not found:', messageId);
                    return;
                }

                if (message.sender.toString() !== userId) {
                    console.error('User not authorized to delete message:', userId);
                    return;
                }

                message.message = '🚫 This message was deleted';
                message.deletedForEveryone = true;
                chat.lastMessage = 'Message deleted';
                chat.updatedAt = new Date();
                await chat.save();

                io.to(chatId).emit('messageDeletedForEveryone', { messageId, chatId, type });
            } catch (err) {
                console.error('Error deleting message for everyone:', err);
            }
        });

        // React to message
        socket.on('reactMessage', async ({ chatId, messageId, userId, reaction, type }) => {
            if (!chatId || !messageId || !userId || !reaction || !type) {
                console.error('Missing fields in reactMessage:', { chatId, messageId, userId, reaction, type });
                return;
            }
            if (!chatId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid chatId or userId:', { chatId, userId });
                return;
            }

            try {
                let chat;
                if (type === 'personal') {
                    chat = await Chat.findById(chatId);
                } else if (type === 'group') {
                    chat = await GroupChat.findById(chatId);
                }
                if (!chat) {
                    console.error('Chat not found:', chatId);
                    return;
                }

                const msg = chat.messages.id(messageId);
                if (!msg) {
                    console.error('Message not found:', messageId);
                    return;
                }

                if (!msg.reactions) msg.reactions = [];
                const existing = msg.reactions.find(r => r.userId.toString() === userId && r.emoji === reaction);
                if (existing) {
                    msg.reactions = msg.reactions.filter(r => !(r.userId.toString() === userId && r.emoji === reaction));
                } else {
                    msg.reactions.push({ userId, emoji: reaction });
                }

                chat.updatedAt = new Date();
                await chat.save();

                io.to(chatId).emit('messageReacted', { messageId, reaction, type });
            } catch (err) {
                console.error('Error reacting to message:', err);
            }
        });

        // Typing
        socket.on('typing', ({ chatId, senderId, type }) => {
            if (!chatId || !senderId || !type) return;
            socket.to(chatId).emit('typing', { senderId, type });
        });

        socket.on('stopTyping', ({ chatId, senderId, type }) => {
            if (!chatId || !senderId || !type) return;
            socket.to(chatId).emit('stopTyping', { senderId, type });
        });

        // Group-specific events
        socket.on('addMember', async ({ groupId, userId, adminId }) => {
            if (!groupId || !userId || !adminId) {
                console.error('Missing fields in addMember:', { groupId, userId, adminId });
                return;
            }
            if (!groupId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/) || !adminId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid IDs in addMember:', { groupId, userId, adminId });
                return;
            }

            try {
                const group = await GroupChat.findById(groupId);
                if (!group) {
                    console.error('Group not found:', groupId);
                    return;
                }
                if (group.adminId.toString() !== adminId) {
                    console.error('User not admin:', adminId);
                    return;
                }
                if (!group.participants.includes(userId)) {
                    group.participants.push(userId);
                    group.updatedAt = new Date();
                    await group.save();
                    io.to(groupId).emit('memberAdded', { userId, groupId });
                }
            } catch (error) {
                console.error('Error adding member:', error);
            }
        });

        socket.on('removeMember', async ({ groupId, userId, adminId }) => {
            if (!groupId || !userId || !adminId) {
                console.error('Missing fields in removeMember:', { groupId, userId, adminId });
                return;
            }
            if (!groupId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/) || !adminId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid IDs in removeMember:', { groupId, userId, adminId });
                return;
            }

            try {
                const group = await GroupChat.findById(groupId);
                if (!group) {
                    console.error('Group not found:', groupId);
                    return;
                }
                if (group.adminId.toString() !== adminId) {
                    console.error('User not admin:', adminId);
                    return;
                }
                group.participants = group.participants.filter(id => id.toString() !== userId);
                group.updatedAt = new Date();
                await group.save();
                io.to(groupId).emit('memberRemoved', { userId, groupId });
            } catch (error) {
                console.error('Error removing member:', error);
            }
        });

        socket.on('leaveGroup', async ({ groupId, userId }) => {
            if (!groupId || !userId) {
                console.error('Missing fields in leaveGroup:', { groupId, userId });
                return;
            }
            if (!groupId.match(/^[0-9a-fA-F]{24}$/) || !userId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid IDs in leaveGroup:', { groupId, userId });
                return;
            }

            try {
                const group = await GroupChat.findById(groupId);
                if (!group) {
                    console.error('Group not found:', groupId);
                    return;
                }
                group.participants = group.participants.filter(id => id.toString() !== userId);
                if (group.adminId.toString() === userId && group.participants.length > 0) {
                    group.adminId = group.participants[0];
                }
                group.updatedAt = new Date();
                await group.save();
                if (group.participants.length === 0) {
                    await GroupChat.deleteOne({ _id: groupId });
                    io.to(groupId).emit('groupDeleted', { groupId });
                } else {
                    io.to(groupId).emit('memberLeft', { userId, groupId });
                }
            } catch (error) {
                console.error('Error leaving group:', error);
            }
        });

        socket.on('deleteGroup', async ({ groupId, adminId }) => {
            if (!groupId || !adminId) {
                console.error('Missing fields in deleteGroup:', { groupId, adminId });
                return;
            }
            if (!groupId.match(/^[0-9a-fA-F]{24}$/) || !adminId.match(/^[0-9a-fA-F]{24}$/)) {
                console.error('Invalid IDs in deleteGroup:', { groupId, adminId });
                return;
            }

            try {
                const group = await GroupChat.findById(groupId);
                if (!group) {
                    console.error('Group not found:', groupId);
                    return;
                }
                if (group.adminId.toString() !== adminId) {
                    console.error('User not admin:', adminId);
                    return;
                }
                await GroupChat.deleteOne({ _id: groupId });
                io.to(groupId).emit('groupDeleted', { groupId });
            } catch (error) {
                console.error('Error deleting group:', error);
            }
        });

        socket.on('disconnect', async () => {
            const userId = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
            if (userId) {
                delete onlineUsers[userId];
                try {
                    const personalChats = await Chat.find({
                        $or: [{ senderId: userId }, { recipientId: userId }]
                    }).lean();
                    const groupChats = await GroupChat.find({ participants: userId }).lean();
                    const allChats = [...personalChats, ...groupChats];
                    allChats.forEach(chat => {
                        io.to(chat._id.toString()).emit('userOffline', userId);
                    });
                    console.log(`User ${userId} disconnected`);
                } catch (error) {
                    console.error('Error handling disconnect:', error);
                }
            }
        });
    });
};