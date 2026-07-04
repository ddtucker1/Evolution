import { useState, useEffect } from 'react';

export default function useBattleBackground(active) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!active) {
      setUrl(null);
      return undefined;
    }

    let cancelled = false;
    fetch('/desktop-image/image', { method: 'HEAD' })
      .then((res) => {
        if (!cancelled && res.ok) setUrl('/desktop-image/image');
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [active]);

  return url;
}
