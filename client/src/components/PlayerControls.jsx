import React, { useState } from 'react';
import { parseYouTubeId } from '../lib/youtube';

// Helper to format seconds into mm:ss format
function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function PlayerControls({
  canControl,
  playState,
  currentTime,
  duration,
  hasVideo,
  onPlay,
  onPause,
  onSeek,
  onChangeVideo
}) {
  const [videoInput, setVideoInput] = useState('');
  const [inputError, setInputError] = useState('');
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  // Handle Load Video submit
  const handleLoadVideo = (e) => {
    e.preventDefault();
    setInputError('');

    const parsedId = parseYouTubeId(videoInput);
    if (!parsedId) {
      setInputError('Please enter a valid YouTube video URL or 11-character video ID.');
      return;
    }

    onChangeVideo(parsedId);
    setVideoInput('');
  };

  // Handle seek slider interaction
  const handleSeekChange = (e) => {
    setSeekValue(parseFloat(e.target.value));
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true);
    setSeekValue(currentTime);
  };

  const handleSeekMouseUp = (e) => {
    setIsSeeking(false);
    onSeek(parseFloat(e.target.value));
  };

  const displayedTime = isSeeking ? seekValue : currentTime;
  const isPlaying = playState === 'playing';

  return (
    <div style={{
      backgroundColor: '#f9f9f9',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '16px',
      marginTop: '12px'
    }}>
      {/* Notice for non-controlling participants */}
      {!canControl && (
        <div style={{
          backgroundColor: '#fff3e0',
          color: '#e65100',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '13px',
          marginBottom: '12px',
          fontWeight: '500'
        }}>
          ℹ Only the host and moderators can control playback.
        </div>
      )}

      {/* Progress & Seek Bar */}
      <div style={{ marginBottom: '14px' }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#666',
          marginBottom: '4px'
        }}>
          <span>{formatTime(displayedTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={duration > 0 ? duration : 100}
          step={0.5}
          value={displayedTime}
          disabled={!canControl || !hasVideo}
          onMouseDown={handleSeekMouseDown}
          onChange={handleSeekChange}
          onMouseUp={handleSeekMouseUp}
          onTouchStart={handleSeekMouseDown}
          onTouchEnd={handleSeekMouseUp}
          style={{
            width: '100%',
            cursor: canControl && hasVideo ? 'pointer' : 'not-allowed',
            accentColor: '#1976d2'
          }}
        />
      </div>

      {/* Play/Pause Control Button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        {isPlaying ? (
          <button
            onClick={onPause}
            disabled={!canControl || !hasVideo}
            style={{
              padding: '8px 20px',
              backgroundColor: canControl && hasVideo ? '#e53935' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: canControl && hasVideo ? 'pointer' : 'not-allowed'
            }}
          >
            ⏸ Pause
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={!canControl || !hasVideo}
            style={{
              padding: '8px 20px',
              backgroundColor: canControl && hasVideo ? '#2e7d32' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              cursor: canControl && hasVideo ? 'pointer' : 'not-allowed'
            }}
          >
            ▶ Play
          </button>
        )}
        <span style={{ fontSize: '13px', color: '#555' }}>
          Status: <strong>{playState ? playState.toUpperCase() : 'STOPPED'}</strong>
        </span>
      </div>

      {/* Change Video Section (Host & Moderator only) */}
      {canControl && (
        <form onSubmit={handleLoadVideo} style={{ borderTop: '1px solid #eee', paddingTop: '12px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px' }}>
            Load New Video:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Paste YouTube URL or Video ID..."
              value={videoInput}
              onChange={(e) => {
                setVideoInput(e.target.value);
                if (inputError) setInputError('');
              }}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '13px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            />
            <button
              type="submit"
              style={{
                padding: '8px 16px',
                backgroundColor: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              Load
            </button>
          </div>
          {inputError && (
            <p style={{ color: '#d32f2f', fontSize: '12px', margin: '6px 0 0 0' }}>
              {inputError}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

export default PlayerControls;
