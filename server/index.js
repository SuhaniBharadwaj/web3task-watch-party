// Import required modules using CommonJS (require)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

// Import in-memory room management functions
const {
  createRoom,
  joinRoom,
  leaveRoom,
  getRoomBySocketId
} = require('./rooms');

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

// Helper function to validate username (string, trimmed, 1-20 characters)
function validateUsername(username) {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a valid text string.' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, error: 'Username must be between 1 and 20 characters.' };
  }
  return { valid: true, username: trimmed };
}

// Helper function to validate room code (trimmed, uppercase, non-empty)
function validateRoomCode(roomId) {
  if (typeof roomId !== 'string') {
    return { valid: false, error: 'Room code must be a valid text string.' };
  }
  const trimmed = roomId.trim().toUpperCase();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Room code cannot be empty.' };
  }
  return { valid: true, code: trimmed };
}

// Handle incoming WebSocket connections
io.on('connection', (socket) => {
  console.log(`client connected: ${socket.id}`);

  // Stage 1: Ping/Pong handler for connectivity check
  socket.on('ping_test', (data) => {
    socket.emit('pong_test', {
      message: `pong: ${data && data.message ? data.message : ''}`,
      serverTime: new Date().toISOString()
    });
  });

  // Stage 2: Create room event with acknowledgement callback
  socket.on('create_room', (data, callback) => {
    try {
      const sendReply = (payload) => {
        if (typeof callback === 'function') callback(payload);
      };

      if (!data || typeof data !== 'object') {
        return sendReply({ ok: false, error: 'Invalid request data.' });
      }

      // Validate username
      const userValidation = validateUsername(data.username);
      if (!userValidation.valid) {
        return sendReply({ ok: false, error: userValidation.error });
      }

      // Check if user is already in another room
      if (getRoomBySocketId(socket.id)) {
        return sendReply({ ok: false, error: 'You are already in a room. Leave current room first.' });
      }

      // Create new room and add user as host
      const room = createRoom(socket.id, userValidation.username);

      // Join the Socket.IO channel for this room code
      socket.join(room.code);

      // Acknowledge back to creator with room details
      sendReply({
        ok: true,
        roomId: room.code,
        participants: room.participants
      });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ ok: false, error: err.message || 'Server error creating room.' });
      }
    }
  });

  // Stage 2: Join room event with acknowledgement callback
  socket.on('join_room', (data, callback) => {
    try {
      const sendReply = (payload) => {
        if (typeof callback === 'function') callback(payload);
      };

      if (!data || typeof data !== 'object') {
        return sendReply({ ok: false, error: 'Invalid request data.' });
      }

      // Validate username
      const userValidation = validateUsername(data.username);
      if (!userValidation.valid) {
        return sendReply({ ok: false, error: userValidation.error });
      }

      // Validate room code
      const roomValidation = validateRoomCode(data.roomId);
      if (!roomValidation.valid) {
        return sendReply({ ok: false, error: roomValidation.error });
      }

      // Check if user is already in another room
      if (getRoomBySocketId(socket.id)) {
        return sendReply({ ok: false, error: 'You are already in a room. Leave current room first.' });
      }

      // Attempt to join the room
      const result = joinRoom(roomValidation.code, socket.id, userValidation.username);
      if (result.error) {
        return sendReply({ ok: false, error: result.error });
      }

      // Join the Socket.IO channel for this room
      socket.join(roomValidation.code);

      // Reply to joining user with current room details
      sendReply({
        ok: true,
        roomId: roomValidation.code,
        participants: result.room.participants
      });

      // Broadcast user_joined event to other users in the room
      socket.to(roomValidation.code).emit('user_joined', {
        username: userValidation.username,
        userId: socket.id,
        role: 'participant',
        participants: result.room.participants
      });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ ok: false, error: err.message || 'Server error joining room.' });
      }
    }
  });

  // Stage 2: Leave room event
  socket.on('leave_room', (data, callback) => {
    try {
      const result = leaveRoom(socket.id);
      if (result) {
        // Leave the Socket.IO channel
        socket.leave(result.code);

        // Notify remaining participants in the room
        io.to(result.code).emit('user_left', {
          username: result.username,
          userId: result.userId,
          participants: result.participants
        });
      }

      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ ok: false, error: 'Server error leaving room.' });
      }
    }
  });

  // Listen for client disconnection and perform cleanup
  socket.on('disconnect', () => {
    console.log(`client disconnected: ${socket.id}`);
    try {
      const result = leaveRoom(socket.id);
      if (result) {
        // Notify remaining room participants
        io.to(result.code).emit('user_left', {
          username: result.username,
          userId: result.userId,
          participants: result.participants
        });
      }
    } catch (err) {
      console.error('Error handling disconnect cleanup:', err);
    }
  });
});

// Start listening for incoming requests and WebSocket connections
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
