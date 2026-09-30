// Helper to extract an 11-character YouTube video ID from various URL formats
export function parseYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;

  const trimmed = input.trim();

  // Case 1: Raw 11-character ID directly provided
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    // Add protocol if user entered youtube.com/... without https://
    const urlString = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;

    const url = new URL(urlString);

    // Case 2: youtu.be/<id>
    if (url.hostname.includes('youtu.be')) {
      const pathId = url.pathname.replace(/^\//, '').slice(0, 11);
      if (/^[A-Za-z0-9_-]{11}$/.test(pathId)) {
        return pathId;
      }
    }

    // Case 3: youtube.com/watch?v=<id>
    const vParam = url.searchParams.get('v');
    if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) {
      return vParam;
    }

    // Case 4: youtube.com/embed/<id>
    if (url.pathname.startsWith('/embed/')) {
      const embedId = url.pathname.split('/')[2];
      if (embedId && /^[A-Za-z0-9_-]{11}$/.test(embedId)) {
        return embedId;
      }
    }

    // Case 5: youtube.com/shorts/<id>
    if (url.pathname.startsWith('/shorts/')) {
      const shortId = url.pathname.split('/')[2];
      if (shortId && /^[A-Za-z0-9_-]{11}$/.test(shortId)) {
        return shortId;
      }
    }
  } catch (err) {
    return null;
  }

  return null;
}

// Singleton Promise to ensure YouTube IFrame API script tag is injected only once
let apiPromise = null;

export function loadYouTubeIframeAPI() {
  if (window.YT && window.YT.Player) {
    return Promise.resolve(window.YT);
  }

  if (apiPromise) {
    return apiPromise;
  }

  apiPromise = new Promise((resolve, reject) => {
    // Check if script tag is already in DOM
    const existingScript = document.getElementById('youtube-iframe-api');
    if (!existingScript) {
      const tag = document.createElement('script');
      tag.id = 'youtube-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = () => reject(new Error('Failed to load YouTube IFrame API script.'));
      document.body.appendChild(tag);
    }

    // YouTube calls window.onYouTubeIframeAPIReady when ready
    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousHandler === 'function') {
        previousHandler();
      }
      resolve(window.YT);
    };
  });

  return apiPromise;
}
