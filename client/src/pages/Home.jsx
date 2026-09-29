import React, { useState } from 'react';
import { socket } from '../lib/socket';

function Home({ onRoomJoined }) {
  // Input states
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');

  // Error and loading states
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Validate username helper
  const getTrimmedUsername = () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Please enter a username.');
      return null;
    }
    if (trimmed.length > 20) {
      setError('Username must be 20 characters or fewer.');
      return null;
    }
    return trimmed;
  };

  // Handle Create Room button click
  const handleCreateRoom = (e) => {
    e.preventDefault();
    setError('');

    const validUsername = getTrimmedUsername();
    if (!validUsername) return;

    setIsLoading(true);

    // Emit create_room event to the server with an acknowledgement callback
    socket.emit('create_room', { username: validUsername }, (response) => {
      setIsLoading(false);

      if (response && response.ok) {
        // Success: pass room info up to App.jsx
        onRoomJoined({
          roomId: response.roomId,
          username: validUsername,
          role: 'host',
          participants: response.participants
        });
      } else {
        // Show error message returned by server
        setError((response && response.error) || 'Failed to create room.');
      }
    });
  };

  // Handle Join Room button click
  const handleJoinRoom = (e) => {
    e.preventDefault();
    setError('');

    const validUsername = getTrimmedUsername();
    if (!validUsername) return;

    const trimmedCode = roomCode.trim().toUpperCase();
    if (!trimmedCode) {
      setError('Please enter a room code.');
      return;
    }

    setIsLoading(true);

    // Emit join_room event to the server with an acknowledgement callback
    socket.emit('join_room', { roomId: trimmedCode, username: validUsername }, (response) => {
      setIsLoading(false);

      if (response && response.ok) {
        // Success: find our role in the returned participants list
        const myInfo = response.participants.find((p) => p.userId === socket.id);
        const myRole = myInfo ? myInfo.role : 'participant';

        onRoomJoined({
          roomId: response.roomId,
          username: validUsername,
          role: myRole,
          participants: response.participants
        });
      } else {
        // Show error message returned by server
        setError((response && response.error) || 'Failed to join room.');
      }
    });
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '460px',
      margin: '60px auto',
      padding: '28px',
      border: '1px solid #e0e0e0',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      backgroundColor: '#ffffff'
    }}>
      <h2 style={{ marginTop: 0, textAlign: 'center', color: '#1a1a1a' }}>
        YouTube Watch Party
      </h2>

      {/* Error alert banner */}
      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          color: '#c62828',
          padding: '10px 14px',
          borderRadius: '6px',
          marginBottom: '18px',
          fontSize: '14px',
          border: '1px solid #ffcdd2'
        }}>
          {error}
        </div>
      )}

      {/* Username Input Field */}
      <div style={{ marginBottom: '22px' }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 'bold', fontSize: '14px' }}>
          Your Username:
        </label>
        <input
          type="text"
          placeholder="e.g. Alice"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={20}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            boxSizing: 'border-box',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontSize: '15px'
          }}
        />
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '22px 0' }} />

      {/* Create Room Section */}
      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Start a New Party</h3>
        <button
          onClick={handleCreateRoom}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '11px',
            backgroundColor: '#1976d2',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1
          }}
        >
          {isLoading ? 'Creating...' : 'Create Room'}
        </button>
      </div>

      <div style={{ textAlign: 'center', color: '#888', margin: '16px 0', fontSize: '13px' }}>
        — OR —
      </div>

      {/* Join Room Section */}
      <div>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px' }}>Join an Existing Party</h3>
        <input
          type="text"
          placeholder="6-character room code (e.g. ABC234)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px 12px',
            boxSizing: 'border-box',
            border: '1px solid #ccc',
            borderRadius: '6px',
            fontSize: '15px',
            letterSpacing: '2px',
            marginBottom: '10px'
          }}
        />
        <button
          onClick={handleJoinRoom}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '11px',
            backgroundColor: '#388e3c',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.7 : 1
          }}
        >
          {isLoading ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    </div>
  );
}

export default Home;
