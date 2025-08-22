
const app = require('./app.js');
const http = require('http');
const { Server } = require('socket.io');
const chatSocket = require('./Socket/chatSocket');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: { origin: '*' } // replace '*' with your front-end URL
});

// Initialize chat socket events
chatSocket(io);

// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
