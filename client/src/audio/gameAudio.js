const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.webm']);

const MUSIC_SOURCES = {
  gameplay: [
    '/desktop-music/gameplay',
    '/music/gameplay',
  ],
  boss: [
    '/desktop-music/gameplay-boss',
    '/music/gameplay-boss',
  ],
};

let currentTrack = null;
let currentMode = null;
let audioElement = null;
let loadPromise = null;

function isAudioFile(name) {
  const lower = name.toLowerCase();
  for (const ext of AUDIO_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

async function fetchTrackList(baseUrl) {
  try {
    const response = await fetch(`${baseUrl}/list`);
    if (response.ok) {
      const files = await response.json();
      if (Array.isArray(files) && files.length > 0) {
        return files.filter(isAudioFile);
      }
    }
  } catch {
    // Fall through to manifest fallback.
  }

  try {
    const response = await fetch(`${baseUrl}/manifest.json`);
    if (!response.ok) return [];
    const data = await response.json();
    const files = Array.isArray(data) ? data : (data.files || []);
    return files.filter(isAudioFile);
  } catch {
    return [];
  }
}

async function resolveTrackUrl(mode) {
  const bases = MUSIC_SOURCES[mode] || [];
  for (const base of bases) {
    const files = await fetchTrackList(base);
    if (files.length > 0) {
      return `${base}/${encodeURIComponent(files[0])}`;
    }
  }
  return null;
}

function ensureAudioElement() {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.loop = true;
    audioElement.preload = 'auto';
  }
  return audioElement;
}

async function playMode(mode) {
  if (currentMode === mode && currentTrack && audioElement && !audioElement.paused) {
    return;
  }

  if (loadPromise) {
    await loadPromise;
    if (currentMode === mode && currentTrack && audioElement && !audioElement.paused) {
      return;
    }
  }

  loadPromise = (async () => {
    const trackUrl = await resolveTrackUrl(mode);
    const audio = ensureAudioElement();

    if (!trackUrl) {
      if (audioElement) {
        audioElement.pause();
        audioElement.removeAttribute('src');
      }
      currentMode = mode;
      currentTrack = null;
      return;
    }

    if (currentTrack === trackUrl && currentMode === mode) {
      try {
        await audio.play();
      } catch {
        // Autoplay may be blocked until user interaction.
      }
      return;
    }

    currentMode = mode;
    currentTrack = trackUrl;
    audio.src = trackUrl;
    audio.load();
    try {
      await audio.play();
    } catch {
      // Autoplay may be blocked until user interaction.
    }
  })();

  try {
    await loadPromise;
  } finally {
    loadPromise = null;
  }
}

export function playGameplayMusic() {
  return playMode('gameplay');
}

export function playBossMusic() {
  return playMode('boss');
}

export function stopBattleMusic() {
  currentMode = null;
  currentTrack = null;
  if (audioElement) {
    audioElement.pause();
    audioElement.removeAttribute('src');
  }
}

export function resumeBattleMusicIfPaused() {
  if (audioElement?.src && audioElement.paused) {
    audioElement.play().catch(() => {});
  }
}
