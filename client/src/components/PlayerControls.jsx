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
    <div className="player-controls">
      {/* Notice for non-controlling participants */}
      {!canControl && (
        <div className="playback-notice">
          <span aria-hidden="true">i</span>
          Only the host and moderators can control playback.
        </div>
      )}

      {/* Progress & Seek Bar */}
      <div className="seek-section">
        <div className="seek-times">
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
          className="seek-slider"
        />
      </div>

      {/* Play/Pause Control Button */}
      <div className="playback-actions">
        {isPlaying ? (
          <button
            onClick={onPause}
            disabled={!canControl || !hasVideo}
            className="playback-button"
          >
            <span aria-hidden="true">Ⅱ</span> Pause
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={!canControl || !hasVideo}
            className="playback-button"
          >
            <span aria-hidden="true">▶</span> Play
          </button>
        )}
        <span className="playback-state">
          Status: <strong>{playState ? playState.toUpperCase() : 'STOPPED'}</strong>
        </span>
      </div>

      {/* Change Video Section (Host & Moderator only) */}
      {canControl ? (
        <form onSubmit={handleLoadVideo} className="load-video-form">
          <label htmlFor="load-video-input">
            Load new video
          </label>
          <div className="load-video-row">
            <input
              id="load-video-input"
              type="text"
              placeholder="Paste a YouTube URL or video ID"
              value={videoInput}
              onChange={(e) => {
                setVideoInput(e.target.value);
                if (inputError) setInputError('');
              }}
            />
            <button type="submit" className="load-video-button">
              Load
            </button>
          </div>
          {inputError && (
            <p className="input-error" role="alert">
              {inputError}
            </p>
          )}
        </form>
      ) : (
        <div className="load-video-unavailable" aria-label="Loading a new video is unavailable to participants">
          Video selection is available to the host and moderators.
        </div>
      )}
    </div>
  );
}

export default PlayerControls;
