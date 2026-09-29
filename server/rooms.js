// Characters used to generate room codes (digits and uppercase letters, excluding confusing characters 0, O, 1, I)
const CODE_CHARACTERS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

// In-memory store for active rooms
// Map key: room code (string), Map value: { code, hostId, participants }
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

// Create a new room with the given host socket ID and username
function createRoom(hostSocketId, username) {
  const code = generateUniqueCode();

  const hostParticipant = {
    userId: hostSocketId,
    username: username,
    role: 'host'
  };

  const room = {
    code: code,
    hostId: hostSocketId,
    participants: [hostParticipant]
  };

  // Save room in memory
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

  // Create participant object
  const newParticipant = {
    userId: socketId,
    username: username,
    role: 'participant'
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

  // Find the user's username before removing them
  const leavingUser = room.participants.find((p) => p.userId === socketId);
  const username = leavingUser ? leavingUser.username : 'Unknown';

  // Filter out the leaving participant
  room.participants = room.participants.filter((p) => p.userId !== socketId);

  // If room is empty, delete it from memory
  let roomDeleted = false;
  if (room.participants.length === 0) {
    rooms.delete(code);
    roomDeleted = true;
  }

  return {
    code: code,
    username: username,
    userId: socketId,
    participants: room.participants,
    roomDeleted: roomDeleted
  };
}

// Get array of participants for a room code
function getParticipants(code) {
  const room = rooms.get(code);
  return room ? room.participants : [];
}

// Check which room code a socket is currently in (or null)
function getRoomBySocketId(socketId) {
  return socketToRoom.get(socketId) || null;
}

module.exports = {
  createRoom,
  joinRoom,
  leaveRoom,
  getParticipants,
  getRoomBySocketId
};
