export default function Lobby({ onStartNPC, cardCount = 12 }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 8 }}>
        Battle CPU
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.6 }}>
        Deploy 4 cards from your shuffled deck — 1 Boss and 3 fighters — then fight in real-time combat.
        Each unique card&apos;s timer equals its <strong>attack value in seconds</strong>, plus random
        <strong> 10–25 attack</strong> and <strong>30–100 HP</strong>. Timers pause during attacks.
      </p>

      <div className="mode-grid" style={{ gridTemplateColumns: '1fr', maxWidth: 420 }}>
        <div className="mode-card" onClick={onStartNPC}>
          <h3>Start Battle vs CPU</h3>
          <p>Practice against an AI opponent. Works fully offline on your laptop — no login required.</p>
          <p style={{ color: 'var(--accent-green)', marginTop: 8, fontSize: 11 }}>● {cardCount} unique card types in deck</p>
        </div>
      </div>
    </div>
  );
}
