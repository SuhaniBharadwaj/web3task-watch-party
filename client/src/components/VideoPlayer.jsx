import React, { useEffect, useRef, useState } from 'react';
import { loadYouTubeIframeAPI } from '../lib/youtube';

function VideoPlayer({
  videoId,
  syncState,
  onProgressUpdate,
  canControl
}) {
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(false);
  const isApplyingRemote = useRef(false);
  const syncStateRef = useRef(syncState);
  const pendingForcedSeekRef = useRef(false);

  useEffect(() => {
    syncStateRef.current = syncState;
    if (syncState && syncState.forceSeek) {
      pendingForcedSeekRef.current = true;
    }
  }, [syncState]);

  // Initialize YouTube IFrame Player when videoId is present
  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (!isMounted) return;

        // If player already exists, just cue/load the new video
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          const latestSyncState = syncStateRef.current;
          isApplyingRemote.current = true;
          playerRef.current.loadVideoById({
            videoId: videoId,
            startSeconds: latestSyncState ? latestSyncState.currentTime : 0
          });
          if (latestSyncState && latestSyncState.playState === 'paused') {
            playerRef.current.pauseVideo();
          }
          setTimeout(() => {
            isApplyingRemote.current = false;
          }, 600);
          return;
        }

        // Create player instance
        if (containerRef.current) {
          playerRef.current = new YT.Player(containerRef.current, {
            videoId: videoId,
            playerVars: {
              controls: 0,        // Hide native controls
              disablekb: 1,       // Disable keyboard controls
              rel: 0,             // Do not show related videos
              modestbranding: 1,  // Minimal YouTube branding
              playsinline: 1
            },
            events: {
              onReady: () => {
                if (!isMounted) return;
                setIsPlayerReady(true);
              }
            }
          });
        }
      })
      .catch((err) => {
        console.error('Failed to load YouTube player:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [videoId]);

  // Apply remote sync_state updates
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current || !syncState) return;

    const player = playerRef.current;
    if (typeof player.getCurrentTime !== 'function') return;

    isApplyingRemote.current = true;

    try {
      const currentLocalTime = player.getCurrentTime();
      const targetTime = syncState.currentTime || 0;
      const forceSeek = pendingForcedSeekRef.current || syncState.forceSeek === true;

      // Only seek if time difference is greater than 1.5 seconds to prevent jitter
      if (forceSeek || Math.abs(currentLocalTime - targetTime) > 1.5) {
        player.seekTo(targetTime, true);
        pendingForcedSeekRef.current = false;
      }

      const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;
      if (syncState.playState === 'playing') {
        if (playerState !== 1 && playerState !== 3) {
          player.playVideo();
        }
      } else if (playerState !== 2) {
        player.pauseVideo();
      }
    } catch (err) {
      console.warn('Error applying remote sync state:', err);
    } finally {
      setTimeout(() => {
        isApplyingRemote.current = false;
      }, 500);
    }
  }, [syncState, isPlayerReady]);

  // Periodic polling for playback progress and autoplay check (every 500ms)
  useEffect(() => {
    if (!isPlayerReady || !playerRef.current) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (player && typeof player.getCurrentTime === 'function' && typeof player.getDuration === 'function') {
        try {
          const currentTime = player.getCurrentTime() || 0;
          const duration = player.getDuration() || 0;
          const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;

          onProgressUpdate({ currentTime, duration });

          // Autoplay detection: if room is supposed to be playing, but player is paused/unstarted (state 2 or -1)
          if (syncState && syncState.playState === 'playing' && playerState !== 1 && playerState !== 3) {
            setNeedsUserInteraction(true);
          } else {
            setNeedsUserInteraction(false);
          }
        } catch (e) {
          // ignore transient player errors
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlayerReady, syncState, onProgressUpdate]);

  // User click handler for autoplay unlock
  const handleManualSyncClick = () => {
    if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
      playerRef.current.playVideo();
      setNeedsUserInteraction(false);
    }
  };

  // If no video has been loaded yet, show helpful placeholder
  if (!videoId) {
    return (
      <div className="stage empty">
        <span className="empty-play" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false"><path d="M9 6.5c0-.8.88-1.29 1.56-.87l8.12 4.63a1 1 0 0 1 0 1.74l-8.12 4.63A1 1 0 0 1 9 15.76z" fill="currentColor" /></svg>
        </span>
        <h3>No video loaded</h3>
        <p>
          {canControl
            ? 'Paste a YouTube video URL or ID in the controls below and click Load to start watching.'
            : 'Waiting for the host or a moderator to select a YouTube video.'}
        </p>
      </div>
    );
  }

  return (
    <div className="stage">
      {/* YouTube Player mounting container */}
      <div className="player" ref={containerRef} />

      {/* Transparent overlay preventing direct clicks on the YouTube iframe to bypass permissions */}
      <div
        className="overlay"
      />

      {/* Autoplay unlock prompt button */}
      {needsUserInteraction && (
        <div className="sync-btn">
          <button
            onClick={handleManualSyncClick}
            className="sync-button"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 4.75c0-.58.63-.94 1.13-.65l7 4.25a.76.76 0 0 1 0 1.3l-7 4.25A.76.76 0 0 1 7 13.25z" fill="currentColor" /></svg>
            <span>Click to sync playback</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
