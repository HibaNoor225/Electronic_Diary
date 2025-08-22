const Message = require('../Models/Chat');

module.exports = (io) => {
    const onlineUsers = {};

    io.on('connection', (socket) => {
        console.log('New client connected:', socket.id);

        // Add user to online list
        socket.on('userOnline', (userId) => {
            onlineUsers[userId] = socket.id;
        });
socket.on('sendMessage', async ({ senderId, recipientId, message }) => {
    if (!senderId || !recipientId || !message) return;

    try {
        // Find existing chat between sender and recipient
        let chat = await Message.findOne({
            $or: [
                { senderId, recipientId },
                { senderId: recipientId, recipientId: senderId }
            ]
        });

        if (!chat) {
            // Create new chat if it doesn't exist
            chat = new Message({
                senderId,
                recipientId,
                messages: [],
                lastMessage: ''
            });
        }

        // Push new message
        chat.messages.push({
            sender: senderId,
            message,
            timestamp: new Date()
        });
        chat.lastMessage = message;
        chat.updatedAt = new Date();

        await chat.save();

        // Emit message to recipient if online
        const recipientSocket = onlineUsers[recipientId];
        if (recipientSocket) {
            io.to(recipientSocket).emit('receiveMessage', {
                sender: senderId,
                message,
                timestamp: new Date()
            });
        }

    } catch (err) {
        console.error('Error saving message:', err);
    }
});


        // Handle disconnect
        socket.on('disconnect', () => {
            for (let [userId, id] of Object.entries(onlineUsers)) {
                if (id === socket.id) delete onlineUsers[userId];
            }
        });
    });
};
