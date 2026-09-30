// Characters used to generate room codes (digits and uppercase letters, excluding confusing characters 0, O, 1, I)
const CODE_CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// In-memory store for active rooms
// Map key: room code (string), Map value: Room object
const rooms = new Map();

// Map key: socketId (string), Map value: room code (string)
// Enables O(1) lookup to find which room a user belongs to
const socketToRoom = new Map();

// Helper to generate a random 6-character room code
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * CODE_CHARACTERS.length);
    code += CODE_CHARACTERS[randomIndex];
  }
  return code;
}

// Generate a unique room code that is not currently in use
function generateUniqueCode() {
  let attempts = 0;
  while (attempts < 1000) {
    const code = generateRoomCode();
    if (!rooms.has(code)) {
      return code;
    }
    attempts++;
  }
  throw new Error('Unable to generate unique room code. Server capacity full.');
}

// Calculate effective current playback time based on elapsed time if playing
function computeCurrentTime(video) {
  if (!video) return 0;
  if (video.playState === 'playing') {
    const elapsedSeconds = (Date.now() - video.updatedAt) / 1000;
    return Math.max(0, video.baseTime + elapsedSeconds);
  }
  return Math.max(0, video.baseTime);
}

// Get serialized syncState object for a room
function getSyncState(code) {
  const room = rooms.get(code);
  if (!room || !room.video) {
    return {
      playState: 'paused',
      currentTime: 0,
      videoId: null
    };
  }
  return {
    playState: room.video.playState,
    currentTime: computeCurrentTime(room.video),
    videoId: room.video.videoId
  };
}

// Create a new room with creator as host
function createRoom(hostSocketId, username) {
  const code = generateUniqueCode();
  const now = Date.now();

  const hostParticipant = {
    userId: hostSocketId,
    username: username,
    role: 'host',
    joinedAt: now
  };

  const room = {
    code: code,
    hostId: hostSocketId,
    participants: [hostParticipant],
    video: {
      videoId: null,
      playState: 'paused',
      baseTime: 0,
      updatedAt: now
    }
  };

  rooms.set(code, room);
  socketToRoom.set(hostSocketId, code);

  return room;
}

// Add a participant to an existing room
function joinRoom(code, socketId, username) {
  const room = rooms.get(code);
  if (!room) {
    return { error: 'Room not found. Please check the code.' };
  }

  const now = Date.now();
  const newParticipant = {
    userId: socketId,
    username: username,
    role: 'participant',
    joinedAt: now
  };

  room.participants.push(newParticipant);
  socketToRoom.set(socketId, code);

  return { room: room };
}

// Remove a user by socketId from their current room
function leaveRoom(socketId) {
  const code = socketToRoom.get(socketId);
  if (!code) {
    return null;
  }

  const room = rooms.get(code);
  socketToRoom.delete(socketId);

  if (!room) {
    return null;
  }

  // Find user details before removal
  const leavingUser = room.participants.find((p) => p.userId === socketId);
  const username = leavingUser ? leavingUser.username : 'Unknown';
  const wasHost = leavingUser ? leavingUser.role === 'host' : false;

  // Filter out the leaving participant
  room.participants = room.participants.filter((p) => p.userId !== socketId);

  // If room is empty, delete it from memory
  if (room.participants.length === 0) {
    rooms.delete(code);
    return {
      code: code,
      username: username,
      userId: socketId,
      participants: [],
      roomDeleted: true,
      promotedHost: null
    };
  }

  // If host left, auto-promote next host
  // Order of priority: oldest-joined moderator, otherwise oldest-joined participant
  let promotedHost = null;
  if (wasHost) {
    const moderators = room.participants
      .filter((p) => p.role === 'moderator')
      .sort((a, b) => a.joinedAt - b.joinedAt);

    let nextHost = null;
    if (moderators.length > 0) {
      nextHost = moderators[0];
    } else {
      const remaining = [...room.participants].sort((a, b) => a.joinedAt - b.joinedAt);
      if (remaining.length > 0) {
        nextHost = remaining[0];
      }
    }

    if (nextHost) {
      nextHost.role = 'host';
      room.hostId = nextHost.userId;
      promotedHost = {
        userId: nextHost.userId,
        username: nextHost.username,
        role: 'host'
      };
    }
  }

  return {
    code: code,
    username: username,
    userId: socketId,
    participants: room.participants,
    roomDeleted: false,
    promotedHost: promotedHost
  };
}

// Play action: updates playback state to playing
function updatePlay(code, clientTime) {
  const room = rooms.get(code);
  if (!room) return null;

  const now = Date.now();
  let baseTime;
  if (typeof clientTime === 'number' && Number.isFinite(clientTime) && clientTime >= 0) {
    baseTime = clientTime;
  } else {
    baseTime = computeCurrentTime(room.video);
  }

  room.video.baseTime = baseTime;
  room.video.playState = 'playing';
  room.video.updatedAt = now;

  return getSyncState(code);
}

// Pause action: updates playback state to paused
function updatePause(code, clientTime) {
  const room = rooms.get(code);
  if (!room) return null;

  const now = Date.now();
  let baseTime;
  if (typeof clientTime === 'number' && Number.isFinite(clientTime) && clientTime >= 0) {
    baseTime = clientTime;
  } else {
    baseTime = computeCurrentTime(room.video);
  }

  room.video.baseTime = baseTime;
  room.video.playState = 'paused';
  room.video.updatedAt = now;

  return getSyncState(code);
}

// Seek action: updates baseTime, playState unchanged
function updateSeek(code, targetTime) {
  const room = rooms.get(code);
  if (!room) return null;

  room.video.baseTime = targetTime;
  room.video.updatedAt = Date.now();

  return getSyncState(code);
}

// Change video: resets videoId, sets playState to paused at 0:00
function updateChangeVideo(code, videoId) {
  const room = rooms.get(code);
  if (!room) return null;

  room.video = {
    videoId: videoId,
    playState: 'paused',
    baseTime: 0,
    updatedAt: Date.now()
  };

  return getSyncState(code);
}

// Assign role: changes target user role between moderator and participant
function assignRole(code, targetUserId, newRole) {
  const room = rooms.get(code);
  if (!room) return null;

  const target = room.participants.find((p) => p.userId === targetUserId);
  if (!target) return null;

  target.role = newRole;
  return {
    targetUser: target,
    participants: room.participants
  };
}

// Remove participant: ejects target user from room
function removeParticipant(code, targetUserId) {
  const room = rooms.get(code);
  if (!room) return null;

  const target = room.participants.find((p) => p.userId === targetUserId);
  if (!target) return null;

  room.participants = room.participants.filter((p) => p.userId !== targetUserId);
  socketToRoom.delete(targetUserId);

  return {
    removedUser: target,
    participants: room.participants
  };
}

// Transfer host (Bonus B1): promotes target to host, demotes old host to moderator
function transferHost(code, targetUserId) {
  const room = rooms.get(code);
  if (!room) return null;

  const currentHost = room.participants.find((p) => p.userId === room.hostId);
  const target = room.participants.find((p) => p.userId === targetUserId);

  if (!target) return null;

  if (currentHost) {
    currentHost.role = 'moderator';
  }

  target.role = 'host';
  room.hostId = target.userId;

  return {
    oldHost: currentHost,
    newHost: target,
    participants: room.participants
  };
}

// Getters
function getRoom(code) {
  return rooms.get(code) || null;
}

function getParticipants(code) {
  const room = rooms.get(code);
  return room ? room.participants : [];
}

function getRoomBySocketId(socketId) {
  return socketToRoom.get(socketId) || null;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getSyncState,
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
};
