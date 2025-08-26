
const app = require('./app.js');
const http = require('http');
const { Server } = require('socket.io');
const chatSocket = require('./Socket/chatSocket');
const chatRoutes=require('./Routes/chatRoutes.js')

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
    cors: { origin: '*' } // replace '*' with your front-end URL
});

// Add this middleware to attach `io` to the `req` object
app.use((req, res, next) => {
req.io = io;
next();
});
// Initialize chat socket events

app.use('/chat/api', chatRoutes(io));
chatSocket(io);


// Start server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
