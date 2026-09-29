import React, { useState, useEffect } from 'react';
import { socket } from '../lib/socket';

function Room({ roomData, onLeaveRoom }) {
  // Store the active list of participants in the room
  const [participants, setParticipants] = useState(roomData.participants || []);

  useEffect(() => {
    // Handler when a new user joins the room
    function handleUserJoined(data) {
      if (data && data.participants) {
        setParticipants(data.participants);
      }
    }

    // Handler when a user leaves the room or disconnects
    function handleUserLeft(data) {
      if (data && data.participants) {
        setParticipants(data.participants);
      }
    }

    // Register real-time Socket.IO event listeners
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);

    // Clean up event listeners when component unmounts
    return () => {
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
    };
  }, []);

  // Handler for leaving the room
  const handleLeave = () => {
    socket.emit('leave_room', { roomId: roomData.roomId }, () => {
      // Trigger callback to return to Home view
      onLeaveRoom();
    });
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      maxWidth: '560px',
      margin: '40px auto',
      padding: '24px',
      border: '1px solid #e0e0e0',
      borderRadius: '10px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
      backgroundColor: '#ffffff'
    }}>
      {/* Header bar with Room Code and Leave Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #eee',
        paddingBottom: '16px',
        marginBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '20px' }}>Watch Party Room</h2>
          <span style={{ fontSize: '14px', color: '#666' }}>Room Code: </span>
          <code style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#1976d2',
            backgroundColor: '#e3f2fd',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            {roomData.roomId}
          </code>
        </div>
        <button
          onClick={handleLeave}
          style={{
            padding: '8px 14px',
            backgroundColor: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Leave room
        </button>
      </div>

      {/* Current User Info */}
      <div style={{
        backgroundColor: '#f5f5f5',
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '24px',
        fontSize: '14px'
      }}>
        <div style={{ marginBottom: '4px' }}>
          <strong>You are: </strong> {roomData.username}
        </div>
        <div>
          <strong>Your Role: </strong>
          <span style={{
            textTransform: 'uppercase',
            fontWeight: 'bold',
            color: roomData.role === 'host' ? '#e65100' : '#2e7d32',
            fontSize: '13px'
          }}>
            {roomData.role}
          </span>
        </div>
      </div>

      {/* Participants Roster */}
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px' }}>
          Participants ({participants.length})
        </h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {participants.map((participant) => {
            const isMe = participant.userId === socket.id;
            return (
              <li
                key={participant.userId}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  marginBottom: '8px',
                  borderRadius: '6px',
                  backgroundColor: isMe ? '#e8f5e9' : '#fafafa',
                  border: isMe ? '1px solid #c8e6c9' : '1px solid #eee'
                }}
              >
                <div>
                  <span style={{ fontWeight: isMe ? 'bold' : 'normal', fontSize: '15px' }}>
                    {participant.username}
                  </span>
                  {isMe && (
                    <span style={{ fontSize: '12px', color: '#666', marginLeft: '6px' }}>
                      (You)
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  padding: '3px 8px',
                  borderRadius: '12px',
                  backgroundColor: participant.role === 'host' ? '#ffe0b2' : '#e0e0e0',
                  color: participant.role === 'host' ? '#bf360c' : '#424242',
                  textTransform: 'capitalize'
                }}>
                  {participant.role}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default Room;
