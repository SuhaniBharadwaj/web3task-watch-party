import React, { useState, useEffect } from 'react';
import { socket } from './lib/socket';
import Home from './pages/Home';
import Room from './pages/Room';

function App() {
  // Track whether client is connected to backend Socket.IO server
  const [isConnected, setIsConnected] = useState(socket.connected);

  // Active room state: null when in lobby, or { roomId, username, role, participants }
  const [roomData, setRoomData] = useState(null);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      // If server drops connection, reset back to Home
      setRoomData(null);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    if (socket.connected) {
      setIsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  // Called when user successfully creates or joins a room
  const handleRoomJoined = (data) => {
    setRoomData(data);
  };

  // Called when user clicks "Leave room"
  const handleLeaveRoom = () => {
    setRoomData(null);
  };

  return (
    <div>
      {/* Small top banner showing backend connection status */}
      <div style={{
        textAlign: 'center',
        padding: '6px 12px',
        fontSize: '12px',
        backgroundColor: isConnected ? '#e8f5e9' : '#ffebee',
        color: isConnected ? '#2e7d32' : '#c62828',
        fontWeight: '500'
      }}>
        Backend: {isConnected ? 'Connected' : 'Disconnected (Reconnecting...)'}
      </div>

      {/* Switch between Home and Room view */}
      {!roomData ? (
        <Home onRoomJoined={handleRoomJoined} />
      ) : (
        <Room roomData={roomData} onLeaveRoom={handleLeaveRoom} />
      )}
    </div>
  );
}

export default App;
