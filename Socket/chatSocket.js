const Chat = require("../Models/Chat");

const onlineUsers = {};

module.exports = (io) => {
    io.on("connection", (socket) => {
        console.log("New client connected:", socket.id);

        socket.on("userOnline", (userId) => {
            socket.userId = userId;
            onlineUsers[userId] = socket.id;
            console.log(`User ${userId} is online with socket ${socket.id}`);
            io.emit("userOnline", userId);
        });

        socket.on("sendMessage", async ({ senderId, recipientId, message, fileUrl, fileType, replyTo }) => {
            if (!senderId || !recipientId) return;
            try {
                let chat = await Chat.findOne({
                    $or: [
                        { senderId, recipientId },
                        { senderId: recipientId, recipientId: senderId }
                    ]
                });

                if (!chat) {
                    chat = new Chat({ senderId, recipientId, messages: [], lastMessage: "" });
                }

                const newMsg = {
                    sender: senderId,
                    message: message || "",
                    fileUrl,
                    fileType,
                    timestamp: new Date(),
                    replyTo: replyTo || null,
                    hiddenFor: [],
                    reactions: [],
                    deletedForEveryone: false
                };

                chat.messages.push(newMsg);
                chat.lastMessage = fileUrl
                    ? (fileType === "image" ? "Shared a beautiful moment" : "Shared a file")
                    : message || "Message deleted";
                chat.updatedAt = new Date();
                await chat.save();

                const recipientSocket = onlineUsers[recipientId];
                if (recipientSocket) {
                    io.to(recipientSocket).emit("receiveMessage", { chatId: chat._id, ...newMsg });
                }

                const senderSocket = onlineUsers[senderId];
                if (senderSocket) {
                    io.to(senderSocket).emit("receiveMessage", { chatId: chat._id, ...newMsg });
                }
            } catch (err) {
                console.error("Error saving message:", err);
            }
        });

        socket.on("deleteMessageForMe", async ({ chatId, messageId, userId }) => {
            try {
                const chat = await Chat.findOne({ _id: chatId });
                if (!chat) {
                    console.error("Chat not found for ID:", chatId);
                    return;
                }

                const message = chat.messages.id(messageId);
                if (!message) {
                    console.error("Message not found for ID:", messageId);
                    return;
                }

                if (!message.hiddenFor.includes(userId)) {
                    message.hiddenFor.push(userId);
                    await chat.save();
                }

                const userSocket = onlineUsers[userId];
                if (userSocket) {
                    io.to(userSocket).emit("messageDeletedForMe", { messageId, userId });
                }
            } catch (err) {
                console.error("Error deleting message for me:", err);
            }
        });

        socket.on("deleteMessageForEveryone", async ({ chatId, messageId, userId }) => {
            try {
                const chat = await Chat.findOne({ _id: chatId });
                if (!chat) {
                    console.error("Chat not found for ID:", chatId);
                    return;
                }

                const message = chat.messages.id(messageId);
                if (!message) {
                    console.error("Message not found for ID:", messageId);
                    return;
                }

                if (message.sender !== userId) {
                    console.error("User not authorized to delete message");
                    return;
                }

                message.message = "🚫 This message was deleted";
                message.deletedForEveryone = true;
                chat.lastMessage = "Message deleted";
                await chat.save();

                const recipientSocket = onlineUsers[chat.recipientId];
                const senderSocket = onlineUsers[chat.senderId];
                if (recipientSocket) {
                    io.to(recipientSocket).emit("messageDeletedForEveryone", { messageId });
                }
                if (senderSocket) {
                    io.to(senderSocket).emit("messageDeletedForEveryone", { messageId });
                }
            } catch (err) {
                console.error("Error deleting message for everyone:", err);
            }
        });

        socket.on("reactMessage", async ({ chatId, messageId, userId, reaction }) => {
            try {
                const chat = await Chat.findOne({ _id: chatId });
                if (!chat) return;

                const msg = chat.messages.id(messageId);
                if (!msg) return;

                if (!msg.reactions) msg.reactions = [];

                const existing = msg.reactions.find(r => r.userId === userId && r.emoji === reaction);
                if (existing) {
                    msg.reactions = msg.reactions.filter(r => !(r.userId === userId && r.emoji === reaction));
                } else {
                    msg.reactions.push({ userId, emoji: reaction });
                }

                await chat.save();

                const recipientSocket = onlineUsers[chat.recipientId];
                const senderSocket = onlineUsers[chat.senderId];
                if (recipientSocket) {
                    io.to(recipientSocket).emit("messageReacted", { messageId, reaction });
                }
                if (senderSocket) {
                    io.to(senderSocket).emit("messageReacted", { messageId, reaction });
                }
            } catch (err) {
                console.error("Error reacting to message:", err);
            }
        });

        socket.on("typing", ({ senderId, recipientId }) => {
            const recipientSocket = onlineUsers[recipientId];
            if (recipientSocket) {
                io.to(recipientSocket).emit("typing", { senderId });
            }
        });

        socket.on("stopTyping", ({ senderId, recipientId }) => {
            const recipientSocket = onlineUsers[recipientId];
            if (recipientSocket) {
                io.to(recipientSocket).emit("stopTyping", { senderId });
            }
        });

        socket.on("disconnect", () => {
            const userId = Object.keys(onlineUsers).find(key => onlineUsers[key] === socket.id);
            if (userId) {
                delete onlineUsers[userId];
                io.emit("userOffline", userId);
                console.log(`User ${userId} disconnected`);
            }
        });
    });
};