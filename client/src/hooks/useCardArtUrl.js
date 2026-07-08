import { useEffect, useState } from 'react';
import { getCardArtCandidates } from '../utils/cardArt';

function loadFirstAvailableImage(urls) {
  return new Promise((resolve) => {
    if (!urls.length) {
      resolve(null);
      return;
    }

    let index = 0;
    const tryNext = () => {
      if (index >= urls.length) {
        resolve(null);
        return;
      }

      const image = new Image();
      image.onload = () => resolve(urls[index]);
      image.onerror = () => {
        index += 1;
        tryNext();
      };
      image.src = urls[index];
    };

    tryNext();
  });
}

export function useCardArtUrl(level) {
  const [availableUrl, setAvailableUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const candidates = getCardArtCandidates(level);

    loadFirstAvailableImage(candidates).then((url) => {
      if (!cancelled) setAvailableUrl(url);
    });

    return () => {
      cancelled = true;
    };
  }, [level]);

  return availableUrl;
}
