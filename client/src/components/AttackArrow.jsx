import { useLayoutEffect, useState } from 'react';

export default function AttackArrow({ containerRef, fromId, toId, cardRefs }) {
  const [line, setLine] = useState(null);

  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef?.current;
      const fromEl = fromId ? cardRefs.current[fromId] : null;
      const toEl = toId ? cardRefs.current[toId] : null;
      if (!container || !fromEl || !toEl) {
        setLine(null);
        return;
      }

      const cr = container.getBoundingClientRect();
      const fr = fromEl.getBoundingClientRect();
      const tr = toEl.getBoundingClientRect();
      setLine({
        x1: fr.left + fr.width / 2 - cr.left,
        y1: fr.top + fr.height / 2 - cr.top,
        x2: tr.left + tr.width / 2 - cr.left,
        y2: tr.top + tr.height / 2 - cr.top,
      });
    };

    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
    };
  }, [containerRef, fromId, toId, cardRefs]);

  if (!line) return null;

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
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        className="attack-arrow-line"
        markerEnd="url(#attack-arrowhead)"
      />
    </svg>
  );
}
