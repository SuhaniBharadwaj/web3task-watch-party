import React, { useState, useEffect } from 'react';
import { socket } from '../lib/socket';

function Home({ onRoomJoined, initialError }) {
  // Input states
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');

  // Error and loading states
  const [error, setError] = useState(initialError || '');
  const [isLoading, setIsLoading] = useState(false);

  // Check for ?room=CODE in URL query params on mount
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const roomParam = searchParams.get('room');
      if (roomParam) {
        setRoomCode(roomParam.trim().toUpperCase());
      }
    } catch (e) {
      // Ignore URL parsing errors
    }
  }, []);

  // Update error if parent passes down initialError
  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

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

    // Emit create_room event to the server with acknowledgement callback
    socket.emit('create_room', { username: validUsername }, (response) => {
      setIsLoading(false);

      if (response && response.ok) {
        onRoomJoined({
          roomId: response.roomId,
          username: validUsername,
          role: response.you.role || 'host',
          participants: response.participants,
          syncState: response.syncState
        });
      } else {
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
    if (!trimmedCode || trimmedCode.length !== 6) {
      setError('Please enter a valid 6-character room code.');
      return;
    }

    setIsLoading(true);

    // Emit join_room event to the server with acknowledgement callback
    socket.emit('join_room', { roomId: trimmedCode, username: validUsername }, (response) => {
      setIsLoading(false);

      if (response && response.ok) {
        const myInfo = response.participants.find((p) => p.userId === socket.id);
        const myRole = myInfo ? myInfo.role : 'participant';

        onRoomJoined({
          roomId: response.roomId,
          username: validUsername,
          role: myRole,
          participants: response.participants,
          syncState: response.syncState
        });
      } else {
        setError((response && response.error) || 'Failed to join room.');
      }
    });
  };

  // Everything above is unchanged logic. Only the markup below was redesigned.
  return (
    <main className="hp">
      <section className="hp-visual">
        <div className="hp-brand">
          <span className="hp-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M8 5.75c0-.78.85-1.26 1.52-.86l9.2 5.5a1 1 0 0 1 0 1.72l-9.2 5.5A1 1 0 0 1 8 16.75z" fill="currentColor" />
            </svg>
          </span>
          <span className="hp-wordmark">Watch Party</span>
        </div>
        <div aria-hidden="true">
          <div className="hp-stars" />
          <div className="hp-moon" />
          <div className="hp-city hp-city-back" />
          <div className="hp-city hp-city-front" />
        </div>
      </section>

      <section className="hp-panel" aria-labelledby="hp-title">
        <div className="hp-form">
          <h1 id="hp-title" className="hp-title">Who’s watching?</h1>

          {error && (
            <div className="hp-error" role="alert">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5 18 17H2z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /><path d="M10 7v4.5m0 2.5v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              <span>{error}</span>
            </div>
          )}

          <div className="hp-field">
            <label htmlFor="watch-party-username">Your name</label>
            <input
              id="watch-party-username"
              className="hp-input"
              type="text"
              placeholder="e.g. Alice"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              disabled={isLoading}
            />
          </div>

          <button className="hp-btn primary" onClick={handleCreateRoom} disabled={isLoading}>
            {isLoading && <span className="hp-spinner" aria-hidden="true" />}
            {isLoading ? 'Creating room…' : 'Create a room'}
          </button>

          <div className="hp-divider"><span>or join with a code</span></div>

          <div className="hp-field">
            <label htmlFor="watch-party-code">Room code</label>
            <input
              id="watch-party-code"
              className="hp-input code"
              type="text"
              placeholder="Enter the 6-character code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              disabled={isLoading}
            />
          </div>

          <button className="hp-btn secondary" onClick={handleJoinRoom} disabled={isLoading}>
            {isLoading && <span className="hp-spinner" aria-hidden="true" />}
            {isLoading ? 'Joining room…' : 'Join room'}
          </button>
        </div>
      </section>
    </main>
  );
}

export default Home;
