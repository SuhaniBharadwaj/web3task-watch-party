// Allowed room code regex (6 characters using permitted charset)
const ROOM_CODE_REGEX = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

// YouTube Video ID regex (exactly 11 characters of base64url characters)
const VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

// Validate username: string, trimmed, 1 to 20 characters
function validateUsername(username) {
  if (typeof username !== 'string') {
    return { valid: false, error: 'Username must be a text string.' };
  }
  const trimmed = username.trim();
  if (trimmed.length < 1 || trimmed.length > 20) {
    return { valid: false, error: 'Username must be between 1 and 20 characters.' };
  }
  return { valid: true, value: trimmed };
}

// Validate room code: string, trimmed, uppercased, exactly 6 valid characters
function validateRoomCode(code) {
  if (typeof code !== 'string') {
    return { valid: false, error: 'Room code must be a text string.' };
  }
  const trimmed = code.trim().toUpperCase();
  if (!ROOM_CODE_REGEX.test(trimmed)) {
    return { valid: false, error: 'Room code must be a 6-character code.' };
  }
  return { valid: true, value: trimmed };
}

// Validate YouTube video ID: string, exactly 11 characters
function validateVideoId(videoId) {
  if (typeof videoId !== 'string') {
    return { valid: false, error: 'Video ID must be a text string.' };
  }
  const trimmed = videoId.trim();
  if (!VIDEO_ID_REGEX.test(trimmed)) {
    return { valid: false, error: 'Invalid YouTube Video ID (must be 11 characters).' };
  }
  return { valid: true, value: trimmed };
}

// Validate playback time: finite number >= 0
function validateTime(time) {
  if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) {
    return { valid: false, error: 'Time must be a non-negative finite number.' };
  }
  return { valid: true, value: time };
}

// Validate assignable role: only 'moderator' or 'participant'
function validateAssignableRole(role) {
  if (typeof role !== 'string') {
    return { valid: false, error: 'Role must be a string.' };
  }
  const normalized = role.trim().toLowerCase();
  if (normalized !== 'moderator' && normalized !== 'participant') {
    return { valid: false, error: 'Assignable role must be either moderator or participant.' };
  }
  return { valid: true, value: normalized };
}

module.exports = {
  validateUsername,
  validateRoomCode,
  validateVideoId,
  validateTime,
  validateAssignableRole
};
