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

  // Initialize YouTube IFrame Player when videoId is present
  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;

    loadYouTubeIframeAPI()
      .then((YT) => {
        if (!isMounted) return;

        // If player already exists, just cue/load the new video
        if (playerRef.current && typeof playerRef.current.loadVideoById === 'function') {
          isApplyingRemote.current = true;
          playerRef.current.loadVideoById({
            videoId: videoId,
            startSeconds: syncState ? syncState.currentTime : 0
          });
          if (syncState && syncState.playState === 'paused') {
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
              onReady: (event) => {
                if (!isMounted) return;
                setIsPlayerReady(true);

                // Apply initial sync state once player is ready
                if (syncState) {
                  isApplyingRemote.current = true;
                  if (syncState.currentTime > 0) {
                    event.target.seekTo(syncState.currentTime, true);
                  }
                  if (syncState.playState === 'playing') {
                    event.target.playVideo();
                  } else {
                    event.target.pauseVideo();
                  }
                  setTimeout(() => {
                    isApplyingRemote.current = false;
                  }, 600);
                }
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

      // Only seek if time difference is greater than 1.5 seconds to prevent jitter
      if (Math.abs(currentLocalTime - targetTime) > 1.5) {
        player.seekTo(targetTime, true);
      }

      if (syncState.playState === 'playing') {
        player.playVideo();
      } else {
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
      <div style={{
        aspectRatio: '16/9',
        backgroundColor: '#1a1a1a',
        color: '#ffffff',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        padding: '24px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>No video loaded</h3>
        <p style={{ margin: 0, color: '#aaa', fontSize: '14px', maxWidth: '400px' }}>
          {canControl
            ? 'Paste a YouTube video URL or ID in the controls below and click Load to start watching.'
            : 'Waiting for the host or a moderator to select a YouTube video.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', backgroundColor: '#000', borderRadius: '8px', overflow: 'hidden' }}>
      {/* YouTube Player mounting container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Transparent overlay preventing direct clicks on the YouTube iframe to bypass permissions */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 10,
          cursor: 'default'
        }}
      />

      {/* Autoplay unlock prompt button */}
      {needsUserInteraction && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 20
        }}>
          <button
            onClick={handleManualSyncClick}
            style={{
              padding: '12px 24px',
              backgroundColor: '#1976d2',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '15px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.5)'
            }}
          >
            ▶ Click to sync playback
          </button>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
