export default function BloodSplatter() {
  return (
    <div className="blood-splatter-overlay" aria-hidden="true">
      <svg className="blood-splatter-svg" viewBox="0 0 400 320" preserveAspectRatio="none">
        <ellipse cx="48" cy="52" rx="58" ry="44" fill="rgba(100, 8, 8, 0.82)" />
        <ellipse cx="168" cy="88" rx="72" ry="52" fill="rgba(120, 10, 10, 0.78)" />
        <ellipse cx="312" cy="64" rx="64" ry="48" fill="rgba(90, 6, 6, 0.8)" />
        <ellipse cx="96" cy="176" rx="84" ry="60" fill="rgba(110, 8, 8, 0.76)" />
        <ellipse cx="248" cy="196" rx="92" ry="68" fill="rgba(130, 12, 12, 0.74)" />
        <ellipse cx="352" cy="168" rx="56" ry="42" fill="rgba(95, 8, 8, 0.77)" />
        <ellipse cx="40" cy="252" rx="68" ry="48" fill="rgba(105, 10, 10, 0.75)" />
        <ellipse cx="188" cy="272" rx="76" ry="52" fill="rgba(115, 8, 8, 0.73)" />
        <ellipse cx="320" cy="268" rx="80" ry="54" fill="rgba(100, 8, 8, 0.76)" />
        <circle cx="128" cy="36" r="14" fill="rgba(80, 4, 4, 0.85)" />
        <circle cx="284" cy="28" r="11" fill="rgba(85, 5, 5, 0.82)" />
        <circle cx="64" cy="132" r="16" fill="rgba(75, 4, 4, 0.84)" />
        <circle cx="200" cy="148" r="12" fill="rgba(88, 6, 6, 0.8)" />
        <circle cx="336" cy="120" r="15" fill="rgba(78, 4, 4, 0.83)" />
        <circle cx="24" cy="208" r="10" fill="rgba(82, 5, 5, 0.81)" />
        <circle cx="156" cy="228" r="13" fill="rgba(90, 6, 6, 0.79)" />
        <circle cx="276" cy="240" r="11" fill="rgba(86, 5, 5, 0.8)" />
        <circle cx="380" cy="220" r="14" fill="rgba(80, 4, 4, 0.82)" />
        <path d="M72 8 Q76 80 68 140 Q64 200 60 310" stroke="rgba(70, 4, 4, 0.55)" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M220 4 Q228 90 216 180 Q208 250 200 316" stroke="rgba(65, 3, 3, 0.5)" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M340 12 Q348 100 332 190 Q324 260 316 314" stroke="rgba(68, 4, 4, 0.52)" strokeWidth="7" fill="none" strokeLinecap="round" />
      </svg>
    </div>
  );
}
