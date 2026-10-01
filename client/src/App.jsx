import React, { useState, useEffect } from 'react';
import { socket } from './lib/socket';
import Home from './pages/Home';
import Room from './pages/Room';

function App() {
  // Track whether client is connected to backend Socket.IO server
  const [connectionStatus, setConnectionStatus] = useState(
    socket.connected ? 'connected' : 'connecting'
  );

  // Active room state: null when in lobby, or { roomId, username, role, participants, syncState }
  const [roomData, setRoomData] = useState(null);

  // Message to display on Home screen (e.g. after disconnect or removal)
  const [homeNotice, setHomeNotice] = useState('');

  useEffect(() => {
    function onConnect() {
      setConnectionStatus('connected');
    }

    function onDisconnect(reason) {
      setConnectionStatus('disconnected');
      // If server drops connection while in a room, reset back to Home with friendly message
      setRoomData((currentRoom) => {
        if (currentRoom) {
          setHomeNotice('Disconnected from server. Please rejoin or create a room.');
        }
        return null;
      });
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setConnectionStatus('connected');
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Called when user successfully creates or joins a room
  const handleRoomJoined = (data) => {
    setHomeNotice('');
    setRoomData(data);
  };

  // Called when user clicks "Leave room" or is removed
  const handleLeaveRoom = (message) => {
    setRoomData(null);
    if (message) {
      setHomeNotice(message);
    }
  };

  return (
    <div className="app-container">
      {/* Switch between Home and Room view */}
      {!roomData ? (
        <>
          <div
            className={`status-bar ${
              connectionStatus === 'connected'
                ? 'status-connected'
                : connectionStatus === 'connecting'
                ? 'status-connecting'
                : 'status-disconnected'
            }`}
          >
            <strong>
              {connectionStatus === 'connected'
                ? 'Connected'
                : connectionStatus === 'connecting'
                ? 'Connecting…'
                : 'Disconnected · reconnecting'}
            </strong>
          </div>
          <Home onRoomJoined={handleRoomJoined} initialError={homeNotice} />
        </>
      ) : (
        <Room roomData={roomData} onLeaveRoom={handleLeaveRoom} connectionStatus={connectionStatus} />
      )}
    </div>
  );
}

export default App;
