// Import required modules using CommonJS (require)
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');

// Import permissions and validation helpers
const { can } = require('./permissions');
const {
  validateUsername,
  validateRoomCode,
  validateVideoId,
  validateTime,
  validateAssignableRole
} = require('./validators');

// Import in-memory room management functions
const {
  createRoom,
  joinRoom,
  leaveRoom,
  getSyncState,
  getActiveSyncStates,
  computeCurrentTime,
  updatePlay,
  updatePause,
  updateSeek,
  updateChangeVideo,
  assignRole,
  removeParticipant,
  transferHost,
  getRoom,
  getParticipants,
  getRoomBySocketId
} = require('./rooms');

// Port to listen on (from environment or default to 3001)
const PORT = process.env.PORT || 3001;

// Allowed frontend origin for CORS
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

// Initialize Express application
const app = express();

// Enable CORS for Express REST routes
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? true : CLIENT_ORIGIN,
  credentials: true
}));

// Simple health check endpoint (used by Render health check)
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true });
});

// Serve frontend static build in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  // Fallback all non-API routes to index.html for single-page app
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/health')) {
      return next();
    }
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? true : CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const SYNC_BROADCAST_INTERVAL_MS = 4000;
const syncBroadcastInterval = setInterval(() => {
  for (const { code, syncState } of getActiveSyncStates()) {
    io.to(code).emit('sync_state', syncState);
  }
}, SYNC_BROADCAST_INTERVAL_MS);
syncBroadcastInterval.unref();
server.on('close', () => clearInterval(syncBroadcastInterval));

// Simple in-memory rate limiting: max 20 events per 5 seconds per socket
const rateLimits = new Map();

function checkRateLimit(socketId) {
  const now = Date.now();
  let record = rateLimits.get(socketId);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + 5000 };
    rateLimits.set(socketId, record);
    return true;
  }
  record.count++;
  if (record.count > 20) {
    return false;
  }
  return true;
}

// Helper to send room_error to a specific socket
function sendRoomError(socket, code, message) {
  socket.emit('room_error', { code, message });
}

// Helper to verify user is in a room and derive their role from server state
function getSenderContext(socket) {
  const roomCode = getRoomBySocketId(socket.id);
  if (!roomCode) {
    return { inRoom: false };
  }
  const room = getRoom(roomCode);
  if (!room) {
    return { inRoom: false };
  }
  const participant = room.participants.find((p) => p.userId === socket.id);
  if (!participant) {
    return { inRoom: false };
  }
  return {
    inRoom: true,
    roomCode: roomCode,
    room: room,
    sender: participant
  };
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

  // 1. CREATE ROOM
  socket.on('create_room', (data, callback) => {
    try {
      const sendReply = (payload) => {
        if (typeof callback === 'function') callback(payload);
      };

      if (!data || typeof data !== 'object') {
        return sendReply({ ok: false, error: 'Invalid request data.', code: 'INVALID_PAYLOAD' });
      }

      const userVal = validateUsername(data.username);
      if (!userVal.valid) {
        return sendReply({ ok: false, error: userVal.error, code: 'INVALID_PAYLOAD' });
      }

      if (getRoomBySocketId(socket.id)) {
        return sendReply({ ok: false, error: 'You are already in a room. Leave current room first.', code: 'ALREADY_IN_ROOM' });
      }

      const room = createRoom(socket.id, userVal.value);
      socket.join(room.code);

      const syncState = getSyncState(room.code);
      const you = room.participants[0];

      sendReply({
        ok: true,
        roomId: room.code,
        you: you,
        participants: room.participants,
        syncState: syncState
      });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ ok: false, error: err.message || 'Server error creating room.', code: 'INVALID_PAYLOAD' });
      }
    }
  });

  // 2. JOIN ROOM
  socket.on('join_room', (data, callback) => {
    try {
      const sendReply = (payload) => {
        if (typeof callback === 'function') callback(payload);
      };

      if (!data || typeof data !== 'object') {
        return sendReply({ ok: false, error: 'Invalid request data.', code: 'INVALID_PAYLOAD' });
      }

      const userVal = validateUsername(data.username);
      if (!userVal.valid) {
        return sendReply({ ok: false, error: userVal.error, code: 'INVALID_PAYLOAD' });
      }

      const roomVal = validateRoomCode(data.roomId);
      if (!roomVal.valid) {
        return sendReply({ ok: false, error: roomVal.error, code: 'INVALID_PAYLOAD' });
      }

      if (getRoomBySocketId(socket.id)) {
        return sendReply({ ok: false, error: 'You are already in a room. Leave current room first.', code: 'ALREADY_IN_ROOM' });
      }

      const result = joinRoom(roomVal.value, socket.id, userVal.value);
      if (result.error) {
        return sendReply({ ok: false, error: result.error, code: 'ROOM_NOT_FOUND' });
      }

      socket.join(roomVal.value);

      const syncState = getSyncState(roomVal.value);
      const you = result.room.participants.find((p) => p.userId === socket.id);

      sendReply({
        ok: true,
        roomId: roomVal.value,
        you: you,
        participants: result.room.participants,
        syncState: syncState
      });

      // Broadcast to existing room participants
      socket.to(roomVal.value).emit('user_joined', {
        username: userVal.value,
        userId: socket.id,
        role: 'participant',
        participants: result.room.participants
      });
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ ok: false, error: err.message || 'Server error joining room.', code: 'INVALID_PAYLOAD' });
      }
    }
  });

  // 3. LEAVE ROOM
  socket.on('leave_room', (data, callback) => {
    try {
      const result = leaveRoom(socket.id);
      if (result) {
        socket.leave(result.code);

        // Notify remaining participants of the user's departure
        io.to(result.code).emit('user_left', {
          username: result.username,
          userId: result.userId,
          participants: result.participants
        });

        // If a new host was automatically promoted, notify the room
        if (result.promotedHost) {
          io.to(result.code).emit('role_assigned', {
            userId: result.promotedHost.userId,
            username: result.promotedHost.username,
            role: 'host',
            participants: result.participants
          });
        }
      }

      if (typeof callback === 'function') {
        callback({ ok: true });
      }
    } catch (err) {
      if (typeof callback === 'function') {
        callback({ ok: false, error: 'Server error leaving room.', code: 'INVALID_PAYLOAD' });
      }
    }
  });

  // 4. PLAY
  socket.on('play', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      if (!can(ctx.sender.role, 'play')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host and moderators can control playback.');
      }

      if (!ctx.room.video.videoId) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'No video is currently loaded.');
      }

      let clientTime = null;
      if (data && data.currentTime !== undefined) {
        const timeVal = validateTime(data.currentTime);
        if (!timeVal.valid) {
          return sendRoomError(socket, 'INVALID_PAYLOAD', timeVal.error);
        }
        clientTime = timeVal.value;
      }

      const syncState = updatePlay(ctx.roomCode, clientTime);
      io.to(ctx.roomCode).emit('sync_state', syncState);
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling play event.');
    }
  });

  // 5. PAUSE
  socket.on('pause', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      if (!can(ctx.sender.role, 'pause')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host and moderators can control playback.');
      }

      if (!ctx.room.video.videoId) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'No video is currently loaded.');
      }

      let clientTime = null;
      if (data && data.currentTime !== undefined) {
        const timeVal = validateTime(data.currentTime);
        if (!timeVal.valid) {
          return sendRoomError(socket, 'INVALID_PAYLOAD', timeVal.error);
        }
        clientTime = timeVal.value;
      }

      const syncState = updatePause(ctx.roomCode, clientTime);
      io.to(ctx.roomCode).emit('sync_state', syncState);
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling pause event.');
    }
  });

  // 6. SEEK
  socket.on('seek', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      if (!can(ctx.sender.role, 'seek')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host and moderators can seek.');
      }

      if (!ctx.room.video.videoId) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'No video is currently loaded.');
      }

      if (!data || data.time === undefined) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Seek time is required.');
      }

      const timeVal = validateTime(data.time);
      if (!timeVal.valid) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', timeVal.error);
      }

      const syncState = updateSeek(ctx.roomCode, timeVal.value);
      io.to(ctx.roomCode).emit('sync_state', { ...syncState, forceSeek: true });
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling seek event.');
    }
  });

  // 7. CHANGE VIDEO
  socket.on('change_video', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      if (!can(ctx.sender.role, 'change_video')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host and moderators can change the video.');
      }

      if (!data || !data.videoId) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Video ID is required.');
      }

      const videoVal = validateVideoId(data.videoId);
      if (!videoVal.valid) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', videoVal.error);
      }

      const syncState = updateChangeVideo(ctx.roomCode, videoVal.value);
      io.to(ctx.roomCode).emit('sync_state', syncState);
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling change_video event.');
    }
  });

  // 8. ASSIGN ROLE
  socket.on('assign_role', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      // Only host can assign roles
      if (!can(ctx.sender.role, 'assign_role')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host can assign roles.');
      }

      if (!data || typeof data !== 'object') {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Invalid role assignment payload.');
      }

      const roleVal = validateAssignableRole(data.role);
      if (!roleVal.valid) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', roleVal.error);
      }

      if (!data.userId || typeof data.userId !== 'string') {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Target user ID is required.');
      }

      if (data.userId === socket.id) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Host cannot change their own role.');
      }

      const target = ctx.room.participants.find((p) => p.userId === data.userId);
      if (!target) {
        return sendRoomError(socket, 'TARGET_NOT_FOUND', 'Target user is not in this room.');
      }

      if (target.role === 'host') {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Cannot modify the host role directly.');
      }

      const result = assignRole(ctx.roomCode, data.userId, roleVal.value);
      if (result) {
        io.to(ctx.roomCode).emit('role_assigned', {
          userId: result.targetUser.userId,
          username: result.targetUser.username,
          role: result.targetUser.role,
          participants: result.participants
        });
      }
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling assign_role event.');
    }
  });

  // 9. REMOVE PARTICIPANT
  socket.on('remove_participant', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      // Only host can remove participants
      if (!can(ctx.sender.role, 'remove_participant')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host can remove participants.');
      }

      if (!data || !data.userId || typeof data.userId !== 'string') {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Target user ID is required.');
      }

      if (data.userId === socket.id) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Host cannot remove themselves.');
      }

      const target = ctx.room.participants.find((p) => p.userId === data.userId);
      if (!target) {
        return sendRoomError(socket, 'TARGET_NOT_FOUND', 'Target user is not in this room.');
      }

      const result = removeParticipant(ctx.roomCode, data.userId);
      if (result) {
        // Send notification to target socket and have them leave the Socket.IO channel
        const targetSocket = io.sockets.sockets.get(data.userId);
        if (targetSocket) {
          targetSocket.emit('removed_from_room', { reason: 'Removed by host' });
          targetSocket.leave(ctx.roomCode);
        }

        // Broadcast to remaining room members
        io.to(ctx.roomCode).emit('participant_removed', {
          userId: result.removedUser.userId,
          username: result.removedUser.username,
          participants: result.participants
        });
      }
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling remove_participant event.');
    }
  });

  // 10. TRANSFER HOST (Bonus B1)
  socket.on('transfer_host', (data) => {
    try {
      if (!checkRateLimit(socket.id)) {
        return sendRoomError(socket, 'RATE_LIMITED', 'Too many requests. Please slow down.');
      }

      const ctx = getSenderContext(socket);
      if (!ctx.inRoom) {
        return sendRoomError(socket, 'NOT_IN_ROOM', 'You are not in a room.');
      }

      if (!can(ctx.sender.role, 'transfer_host')) {
        return sendRoomError(socket, 'PERMISSION_DENIED', 'Only the host can transfer host permissions.');
      }

      if (!data || !data.userId || typeof data.userId !== 'string') {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'Target user ID is required.');
      }

      if (data.userId === socket.id) {
        return sendRoomError(socket, 'INVALID_PAYLOAD', 'You are already the host.');
      }

      const target = ctx.room.participants.find((p) => p.userId === data.userId);
      if (!target) {
        return sendRoomError(socket, 'TARGET_NOT_FOUND', 'Target user is not in this room.');
      }

      const result = transferHost(ctx.roomCode, data.userId);
      if (result) {
        // Broadcast new host
        io.to(ctx.roomCode).emit('role_assigned', {
          userId: result.newHost.userId,
          username: result.newHost.username,
          role: 'host',
          participants: result.participants
        });

        // Broadcast old host becoming moderator
        io.to(ctx.roomCode).emit('role_assigned', {
          userId: result.oldHost.userId,
          username: result.oldHost.username,
          role: 'moderator',
          participants: result.participants
        });
      }
    } catch (err) {
      sendRoomError(socket, 'INVALID_PAYLOAD', 'Error handling transfer_host event.');
    }
  });

  // DISCONNECT HANDLER
  socket.on('disconnect', () => {
    console.log(`client disconnected: ${socket.id}`);
    rateLimits.delete(socket.id);

    try {
      const result = leaveRoom(socket.id);
      if (result) {
        // Notify remaining participants
        io.to(result.code).emit('user_left', {
          username: result.username,
          userId: result.userId,
          participants: result.participants
        });

        // If host disconnected and another member was promoted, notify room
        if (result.promotedHost) {
          io.to(result.code).emit('role_assigned', {
            userId: result.promotedHost.userId,
            username: result.promotedHost.username,
            role: 'host',
            participants: result.participants
          });
        }
      }
    } catch (err) {
      console.error('Error handling disconnect cleanup:', err);
    }
  });
});

// Start listening for incoming requests and WebSocket connections
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
