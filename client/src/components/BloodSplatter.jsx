import { useState, useEffect, useRef } from 'react';

const DURATION_MS = 6000;
const DROP_INTERVAL_MS = 500;
const TOTAL_DROPS = 12;

const SHAPE_TYPES = ['circle', 'ellipse', 'blob', 'drip', 'splatter', 'streak'];

function mulberry32(seed) {
  let state = seed;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function bloodColor(rng) {
  const r = 70 + Math.floor(rng() * 60);
  const g = 3 + Math.floor(rng() * 10);
  const b = 3 + Math.floor(rng() * 10);
  const a = 0.62 + rng() * 0.32;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function createDrop(index) {
  const rng = mulberry32(index * 7919 + 137);
  const type = SHAPE_TYPES[Math.floor(rng() * SHAPE_TYPES.length)];
  const x = 16 + rng() * 368;
  const y = 12 + rng() * 296;
  const size = 10 + rng() * 58;
  const rotation = rng() * 360;
  return {
    id: index,
    type,
    x,
    y,
    size,
    rotation,
    color: bloodColor(rng),
    delay: index * DROP_INTERVAL_MS,
  };
}

function BlobShape({ drop }) {
  const { x, y, size, color, rotation } = drop;
  const s = size * 0.5;
  const d = `M${x} ${y - s * 0.6}
    C${x + s * 0.9} ${y - s * 0.3}, ${x + s * 0.7} ${y + s * 0.5}, ${x + s * 0.2} ${y + s * 0.7}
    C${x - s * 0.5} ${y + s * 0.9}, ${x - s * 0.8} ${y + s * 0.1}, ${x - s * 0.4} ${y - s * 0.5}
    C${x - s * 0.1} ${y - s * 0.9}, ${x + s * 0.5} ${y - s * 0.8}, ${x} ${y - s * 0.6} Z`;
  return <path d={d} fill={color} transform={`rotate(${rotation} ${x} ${y})`} />;
}

function SplatterShape({ drop }) {
  const { x, y, size, color } = drop;
  const s = size * 0.35;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={s * 1.4} ry={s} fill={color} />
      <circle cx={x - s * 1.6} cy={y - s * 0.4} r={s * 0.45} fill={color} />
      <circle cx={x + s * 1.5} cy={y + s * 0.3} r={s * 0.38} fill={color} />
      <circle cx={x + s * 0.2} cy={y - s * 1.5} r={s * 0.32} fill={color} />
      <circle cx={x - s * 0.8} cy={y + s * 1.2} r={s * 0.28} fill={color} />
    </g>
  );
}

function DripShape({ drop }) {
  const { x, y, size, color } = drop;
  const h = size * 1.8;
  const w = size * 0.22;
  return (
    <path
      d={`M${x - w} ${y} Q${x} ${y + h * 0.4} ${x + w * 0.3} ${y + h * 0.7}
         Q${x + w} ${y + h} ${x} ${y + h}
         Q${x - w} ${y + h} ${x - w * 0.3} ${y + h * 0.7}
         Q${x} ${y + h * 0.4} ${x + w} ${y} Z`}
      fill={color}
    />
  );
}

function StreakShape({ drop }) {
  const { x, y, size, color, rotation } = drop;
  const len = size * 2.2;
  const w = size * 0.18;
  return (
    <rect
      x={x - w / 2}
      y={y - len / 2}
      width={w}
      height={len}
      rx={w}
      fill={color}
      transform={`rotate(${rotation} ${x} ${y})`}
    />
  );
}

function DropShape({ drop }) {
  const { type, x, y, size, color, rotation } = drop;
  switch (type) {
    case 'circle':
      return <circle cx={x} cy={y} r={size * 0.42} fill={color} />;
    case 'ellipse':
      return (
        <ellipse
          cx={x}
          cy={y}
          rx={size * 0.55}
          ry={size * 0.34}
          fill={color}
          transform={`rotate(${rotation} ${x} ${y})`}
        />
      );
    case 'blob':
      return <BlobShape drop={drop} />;
    case 'drip':
      return <DripShape drop={drop} />;
    case 'splatter':
      return <SplatterShape drop={drop} />;
    case 'streak':
      return <StreakShape drop={drop} />;
    default:
      return <circle cx={x} cy={y} r={size * 0.4} fill={color} />;
  }
}

export default function BloodSplatter({ active, onComplete }) {
  const [visibleDrops, setVisibleDrops] = useState([]);
  const [fullCoverage, setFullCoverage] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    if (!active || completedRef.current) return undefined;

    const drops = Array.from({ length: TOTAL_DROPS }, (_, i) => createDrop(i));
    const timers = drops.map((drop) => (
      setTimeout(() => {
        setVisibleDrops((prev) => [...prev, drop]);
      }, drop.delay)
    ));

    const coverageTimer = setTimeout(() => setFullCoverage(true), DURATION_MS - 700);
    const completeTimer = setTimeout(() => {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
    }, DURATION_MS);

    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(coverageTimer);
      clearTimeout(completeTimer);
    };
  }, [active, onComplete]);

  if (!active && visibleDrops.length === 0 && !fullCoverage) return null;

  return (
    <div
      className={`blood-splatter-overlay${fullCoverage ? ' blood-splatter-full' : ''}`}
      aria-hidden="true"
    >
      <svg className="blood-splatter-svg" viewBox="0 0 400 320" preserveAspectRatio="none">
        {visibleDrops.map((drop) => (
          <g key={drop.id} className="blood-drop-appear">
            <DropShape drop={drop} />
          </g>
        ))}
      </svg>
      <div className={`blood-coverage-wash${fullCoverage ? ' visible' : ''}`} />
    </div>
  );
}
