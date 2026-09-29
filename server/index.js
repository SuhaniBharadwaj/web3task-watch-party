// Import required modules using CommonJS (require)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Port to listen on (from environment variable or default to 3001)
const PORT = process.env.PORT || 3001;

// Allowed frontend origin for CORS
const CLIENT_ORIGIN = 'http://localhost:5173';

// Initialize Express application
const app = express();

// Enable CORS for Express REST routes
app.use(cors({
  origin: CLIENT_ORIGIN
}));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.json({ ok: true });
});

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach it to the HTTP server
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST']
  }
});

// Handle incoming WebSocket connections
io.on('connection', (socket) => {
  // Log when a client connects with their unique socket id
  console.log(`client connected: ${socket.id}`);

  // Listen for the "ping_test" event from the client
  socket.on('ping_test', (data) => {
    // Reply back to the same client with a "pong_test" event
    socket.emit('pong_test', {
      message: `pong: ${data && data.message ? data.message : ''}`,
      serverTime: new Date().toISOString()
    });
  });

  // Listen for client disconnection
  socket.on('disconnect', () => {
    // Log when a client disconnects
    console.log(`client disconnected: ${socket.id}`);
  });
});

// Start listening for incoming requests and WebSocket connections
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
