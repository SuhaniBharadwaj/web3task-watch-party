import React, { useState, useEffect, useCallback } from 'react';
import { socket } from '../lib/socket';
import VideoPlayer from '../components/VideoPlayer';
import PlayerControls from '../components/PlayerControls';
import ParticipantList from '../components/ParticipantList';
import Toast from '../components/Toast';

function Room({ roomData, onLeaveRoom }) {
  // Room state
  const [participants, setParticipants] = useState(roomData.participants || []);
  const [myRole, setMyRole] = useState(roomData.role || 'participant');
  const [syncState, setSyncState] = useState(roomData.syncState || {
    playState: 'paused',
    currentTime: 0,
    videoId: null
  });
  const [videoId, setVideoId] = useState(roomData.syncState ? roomData.syncState.videoId : null);

  // Playback progress tracked from player (currentTime, duration)
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).slice(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Determine whether current user is allowed to control playback
  const canControl = myRole === 'host' || myRole === 'moderator';

  // Register real-time Socket.IO event listeners
  useEffect(() => {
    // 1. sync_state: remote playback updates
    function handleSyncState(newSyncState) {
      if (newSyncState) {
        setSyncState(newSyncState);
        if (newSyncState.videoId !== undefined) {
          setVideoId(newSyncState.videoId);
        }
      }
    }

    // 2. user_joined
    function handleUserJoined(data) {
      if (data && data.participants) {
        setParticipants(data.participants);
        addToast(`${data.username} joined the party.`, 'info');
      }
    }

    // 3. user_left
    function handleUserLeft(data) {
      if (data && data.participants) {
        setParticipants(data.participants);
        addToast(`${data.username} left the room.`, 'info');
      }
    }

    // 4. role_assigned
    function handleRoleAssigned(data) {
      if (data && data.participants) {
        setParticipants(data.participants);
        // If our own role changed, update local state
        if (data.userId === socket.id) {
          setMyRole(data.role);
          addToast(`Your role was changed to ${data.role.toUpperCase()}.`, 'info');
        } else {
          addToast(`${data.username} is now a ${data.role}.`, 'info');
        }
      }
    }

    // 5. participant_removed
    function handleParticipantRemoved(data) {
      if (data && data.participants) {
        setParticipants(data.participants);
        addToast(`${data.username} was removed from the room.`, 'info');
      }
    }

    // 6. removed_from_room (sent to target user only)
    function handleRemovedFromRoom(data) {
      onLeaveRoom(data && data.reason ? data.reason : 'You were removed by the host.');
    }

    // 7. room_error
    function handleRoomError(data) {
      addToast(data && data.message ? data.message : 'An error occurred.', 'error');
    }

    socket.on('sync_state', handleSyncState);
    socket.on('user_joined', handleUserJoined);
    socket.on('user_left', handleUserLeft);
    socket.on('role_assigned', handleRoleAssigned);
    socket.on('participant_removed', handleParticipantRemoved);
    socket.on('removed_from_room', handleRemovedFromRoom);
    socket.on('room_error', handleRoomError);

    // Clean up all socket listeners when component unmounts
    return () => {
      socket.off('sync_state', handleSyncState);
      socket.off('user_joined', handleUserJoined);
      socket.off('user_left', handleUserLeft);
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('participant_removed', handleParticipantRemoved);
      socket.off('removed_from_room', handleRemovedFromRoom);
      socket.off('room_error', handleRoomError);
    };
  }, [addToast, onLeaveRoom]);

  // Playback control handlers (emitted only from user interaction)
  const handlePlay = () => {
    socket.emit('play', { currentTime: progress.currentTime });
  };

  const handlePause = () => {
    socket.emit('pause', { currentTime: progress.currentTime });
  };

  const handleSeek = (time) => {
    socket.emit('seek', { time });
  };

  const handleChangeVideo = (newVideoId) => {
    socket.emit('change_video', { videoId: newVideoId });
  };

  // Host action handlers
  const handleAssignRole = (userId, role) => {
    socket.emit('assign_role', { userId, role });
  };

  const handleRemoveParticipant = (userId) => {
    if (window.confirm('Are you sure you want to remove this participant?')) {
      socket.emit('remove_participant', { userId });
    }
  };

  // Bonus B1: Host Transfer
  const handleTransferHost = (userId) => {
    if (window.confirm('Transfer host role? You will become a moderator.')) {
      socket.emit('transfer_host', { userId });
    }
  };

  // Explicit user leave button click (never emit from useEffect cleanup)
  const handleLeave = () => {
    socket.emit('leave_room', { roomId: roomData.roomId }, () => {
      onLeaveRoom();
    });
  };

  // Copy shareable invite link to clipboard
  const handleCopyLink = () => {
    try {
      const shareUrl = `${window.location.origin}/?room=${roomData.roomId}`;
      navigator.clipboard.writeText(shareUrl);
      addToast('Invite link copied to clipboard!', 'success');
    } catch (err) {
      addToast(`Share code: ${roomData.roomId}`, 'info');
    }
  };

  const handleProgressUpdate = useCallback((newProgress) => {
    setProgress(newProgress);
  }, []);

  return (
    <div className="room-container">
      {/* Toast notifications container */}
      <Toast toasts={toasts} onDismiss={removeToast} />

      {/* Room Header bar */}
      <div className="room-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ margin: 0, fontSize: '20px' }}>Watch Party</h2>
            <span className="room-code-badge">{roomData.roomId}</span>
            <button
              onClick={handleCopyLink}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #ccc',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              📋 Copy Invite Link
            </button>
          </div>
          <div style={{ marginTop: '6px', fontSize: '13px', color: '#666' }}>
            Logged in as <strong>{roomData.username}</strong> ({myRole.toUpperCase()})
          </div>
        </div>

        <button
          onClick={handleLeave}
          style={{
            padding: '8px 16px',
            backgroundColor: '#d32f2f',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Leave Party
        </button>
      </div>

      {/* Main Grid: Video Player + Sidebar */}
      <div className="room-grid">
        {/* Left Column: Player & Controls */}
        <div className="video-section">
          <VideoPlayer
            videoId={videoId}
            syncState={syncState}
            onProgressUpdate={handleProgressUpdate}
            canControl={canControl}
          />

          <PlayerControls
            canControl={canControl}
            playState={syncState.playState}
            currentTime={progress.currentTime}
            duration={progress.duration}
            hasVideo={Boolean(videoId)}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
            onChangeVideo={handleChangeVideo}
          />
        </div>

        {/* Right Column: Participant List & Controls */}
        <div className="sidebar-section">
          <ParticipantList
            participants={participants}
            currentUserId={socket.id}
            currentUserRole={myRole}
            onAssignRole={handleAssignRole}
            onRemoveParticipant={handleRemoveParticipant}
            onTransferHost={handleTransferHost}
          />
        </div>
      </div>
    </div>
  );
}

export default Room;
