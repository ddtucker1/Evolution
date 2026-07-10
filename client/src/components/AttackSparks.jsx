import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const VIDEO_CANDIDATES = [
  '/desktop-video/attack-sparks',
  '/effects/attack-sparks.mp4',
  '/effects/attack-sparks.webm',
];

async function resolveAttackSparksUrl() {
  for (const url of VIDEO_CANDIDATES) {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      if (res.ok) return url;
    } catch {
      // try next candidate
    }
  }
  return null;
}

export default function AttackSparks({
  containerRef,
  cardRefs,
  targetId,
  durationMs,
  paused = false,
}) {
  const [videoUrl, setVideoUrl] = useState(null);
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState(null);
  const videoRef = useRef(null);
  const delayRemainingRef = useRef(null);
  const attackActiveRef = useRef(false);

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
    if (!targetId || !durationMs) {
      attackActiveRef.current = false;
      delayRemainingRef.current = null;
      setVisible(false);
      return undefined;
    }

    if (!attackActiveRef.current) {
      attackActiveRef.current = true;
      delayRemainingRef.current = Math.max(0, durationMs / 2);
      setVisible(false);
    }

    if (paused || delayRemainingRef.current == null || visible) return undefined;

    const started = Date.now();
    const delay = delayRemainingRef.current;
    const timer = setTimeout(() => {
      delayRemainingRef.current = 0;
      setVisible(true);
    }, delay);

    return () => {
      clearTimeout(timer);
      if (delayRemainingRef.current != null && delayRemainingRef.current > 0) {
        delayRemainingRef.current = Math.max(0, delay - (Date.now() - started));
      }
    };
  }, [targetId, durationMs, paused, visible]);

  useLayoutEffect(() => {
    if (!visible || !targetId) {
      setPos(null);
      return undefined;
    }

    const update = () => {
      const container = containerRef?.current;
      const targetEl = cardRefs?.current?.[targetId];
      if (!container || !targetEl) {
        setPos(null);
        return;
      }
      const cr = container.getBoundingClientRect();
      const tr = targetEl.getBoundingClientRect();
      setPos({
        x: tr.left + tr.width / 2 - cr.left,
        y: tr.top + tr.height / 2 - cr.top,
        size: Math.max(tr.width, tr.height) * 1.35,
      });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
    };
  }, [visible, targetId, containerRef, cardRefs]);

  useEffect(() => {
    const video = videoRef.current;
    if (!visible || !video || !videoUrl) return undefined;

    video.pause();
    video.currentTime = 0;
    const playPromise = video.play();
    if (playPromise?.catch) playPromise.catch(() => {});

    return () => {
      video.pause();
    };
  }, [visible, videoUrl, targetId]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else if (visible) {
      const playPromise = video.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    }
  }, [paused, visible]);

  if (!visible || !pos || !videoUrl) return null;

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
        preload="auto"
      />
    </div>
  );
}
