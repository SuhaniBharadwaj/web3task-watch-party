import React, { useState, useEffect } from 'react';
import { socket } from './lib/socket';

function App() {
  // State to track whether the socket is currently connected to the server
  const [isConnected, setIsConnected] = useState(socket.connected);

  // State to store the client's unique socket ID assigned by the server
  const [socketId, setSocketId] = useState(socket.id || '');

  // State to store the most recent pong response received from the server
  const [pongReply, setPongReply] = useState(null);

  useEffect(() => {
    // Called when the socket successfully connects to the server
    function onConnect() {
      setIsConnected(true);
      setSocketId(socket.id);
    }

    // Called when the socket disconnects from the server
    function onDisconnect() {
      setIsConnected(false);
      setSocketId('');
    }

    // Called when the server replies with a "pong_test" event
    function onPongTest(data) {
      setPongReply(data);
    }

    // Register event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('pong_test', onPongTest);

    // Sync initial state if socket is already connected
    if (socket.connected) {
      setIsConnected(true);
      setSocketId(socket.id);
    }

    // Clean up event listeners when the component unmounts
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('pong_test', onPongTest);
    };
  }, []);

  // Handler for sending a "ping_test" event to the server
  const handleSendPing = () => {
    socket.emit('ping_test', { message: 'hello' });
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '540px',
      margin: '40px auto',
      padding: '24px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
    }}>
      <h2 style={{ marginTop: 0 }}>YouTube Watch Party - Stage 1</h2>

      {/* Connection status display */}
      <div style={{ marginBottom: '12px', fontSize: '16px' }}>
        <strong>Status: </strong>
        <span style={{
          color: isConnected ? '#2e7d32' : '#d32f2f',
          fontWeight: 'bold'
        }}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {/* Socket ID display (shown when connected) */}
      {isConnected && (
        <div style={{ marginBottom: '16px', fontSize: '14px' }}>
          <strong>Socket ID: </strong>
          <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '4px' }}>
            {socketId}
          </code>
        </div>
      )}

      {/* Button to emit ping_test event */}
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={handleSendPing}
          disabled={!isConnected}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            cursor: isConnected ? 'pointer' : 'not-allowed',
            borderRadius: '4px',
            border: '1px solid #aaa',
            backgroundColor: isConnected ? '#1976d2' : '#ccc',
            color: '#fff',
            fontWeight: 'bold'
          }}
        >
          Send ping
        </button>
      </div>

      {/* Display last pong_test reply from server */}
      <div style={{
        backgroundColor: '#fafafa',
        border: '1px solid #eee',
        borderRadius: '6px',
        padding: '16px'
      }}>
        <h4 style={{ margin: '0 0 8px 0' }}>Last Pong Reply:</h4>
        {pongReply ? (
          <div>
            <p style={{ margin: '4px 0' }}>
              <strong>Message:</strong> {pongReply.message}
            </p>
            <p style={{ margin: '4px 0' }}>
              <strong>Server Time:</strong> {pongReply.serverTime}
            </p>
          </div>
        ) : (
          <p style={{ margin: 0, color: '#777' }}>
            No pong received yet. Click &quot;Send ping&quot; above.
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
