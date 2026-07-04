import { useLayoutEffect, useState } from 'react';

export default function AttackArrow({ containerRef, fromId, fromIds, toId, cardRefs }) {
  const [lines, setLines] = useState([]);

  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef?.current;
      const sourceIds = fromIds?.length ? fromIds : (fromId ? [fromId] : []);
      const toEl = toId ? cardRefs.current[toId] : null;
      if (!container || !sourceIds.length || !toEl) {
        setLines([]);
        return;
      }

      const cr = container.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();
      const nextLines = sourceIds
        .map((id) => {
          const fromEl = cardRefs.current[id];
          if (!fromEl) return null;
          const fr = fromEl.getBoundingClientRect();
          return {
            id,
            x1: fr.left + fr.width / 2 - cr.left,
            y1: fr.top + fr.height / 2 - cr.top,
            x2: tr.left + tr.width / 2 - cr.left,
            y2: tr.top + tr.height / 2 - cr.top,
          };
        })
        .filter(Boolean);
      setLines(nextLines);
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
    };
  }, [containerRef, fromId, fromIds, toId, cardRefs]);

  if (!lines.length) return null;

  return (
    <svg className="attack-arrow-overlay" aria-hidden="true">
      <defs>
        <marker
          id="attack-arrowhead"
          markerWidth="14"
          markerHeight="14"
          refX="12"
          refY="7"
          orient="auto"
        >
          <polygon points="0 0, 14 7, 0 14" className="attack-arrow-head" />
        </marker>
      </defs>
      {lines.map((line) => (
        <line
          key={line.id}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          className={`attack-arrow-line${fromIds?.length > 1 ? ' chain-attack-arrow' : ''}`}
          markerEnd="url(#attack-arrowhead)"
        />
      ))}
    </svg>
  );
}
