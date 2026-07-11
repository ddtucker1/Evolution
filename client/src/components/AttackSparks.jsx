import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const VIDEO_CANDIDATES = [
  '/desktop-video/attack-sparks',
  '/effects/attack-sparks.mp4',
  '/effects/attack-sparks.webm',
];

let cachedVideoUrlPromise;

function resolveAttackSparksUrl() {
  if (!cachedVideoUrlPromise) {
    cachedVideoUrlPromise = (async () => {
      for (const url of VIDEO_CANDIDATES) {
        try {
          const res = await fetch(url, { method: 'HEAD' });
          if (res.ok) return url;
        } catch {
          // try next candidate
        }
      }
      return null;
    })();
  }
  return cachedVideoUrlPromise;
}

export default function AttackSparks({
  cardRefs,
  targetId,
  durationMs,
  paused = false,
}) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);
  const videoRef = useRef(null);
  const delayRemainingRef = useRef(Math.max(0, (durationMs || 0) / 2));

  useEffect(() => {
    let cancelled = false;
    resolveAttackSparksUrl().then((url) => {
      if (!cancelled) setVideoUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!targetId || visible || paused) return undefined;

    const started = Date.now();
    const delay = delayRemainingRef.current;
    const timer = setTimeout(() => {
      delayRemainingRef.current = 0;
      setVisible(true);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (delayRemainingRef.current > 0) {
        delayRemainingRef.current = Math.max(0, delay - (Date.now() - started));
      }
    };
  }, [targetId, paused, visible]);

  useLayoutEffect(() => {
    if (!visible || !targetId) {
      setPos(null);
      return undefined;
    }

    const update = () => {
      const targetEl = cardRefs?.current?.[targetId];
      if (!targetEl) {
        setPos(null);
        return;
      }
      const tr = targetEl.getBoundingClientRect();
      // Cards are position:fixed on desktop, so use viewport coordinates
      // and a fixed overlay so mix-blend-mode composites over the card.
      setPos({
        x: tr.left + tr.width / 2,
        y: tr.top + tr.height / 2,
        size: Math.max(tr.width, tr.height) * 1.45 * 16,
      });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [visible, targetId, cardRefs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!visible || !video || !videoUrl) return undefined;

    let cancelled = false;
    video.muted = true;
    const play = () => {
      if (cancelled) return;
      try {
        video.currentTime = 0;
      } catch {
        // ignore seek errors before metadata
      }
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };

    if (video.readyState >= 2) play();
    else {
      const onReady = () => play();
      video.addEventListener('loadeddata', onReady, { once: true });
      video.load();
      return () => {
        cancelled = true;
        video.removeEventListener('loadeddata', onReady);
        video.pause();
      };
    }

    return () => {
      cancelled = true;
      video.pause();
    };
  }, [visible, videoUrl, targetId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !visible) return;
    if (paused) {
      video.pause();
      return;
    }
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});
  }, [paused, visible]);

  if (!videoUrl || !targetId) return null;

  if (!visible || !pos) {
    return (
      <video
        ref={videoRef}
        className="attack-sparks-preload"
        src={videoUrl}
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="attack-sparks-overlay"
      style={{
        left: pos.x,
        top: pos.y,
        width: pos.size,
        height: pos.size,
      }}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        className="attack-sparks-video"
        src={videoUrl}
        muted
        playsInline
        autoPlay
        preload="auto"
      />
    </div>
  );
}
