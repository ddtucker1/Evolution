export default function Lobby({ isOnline, onStartNPC, onFindMatch, onCancelMatch, matchmaking, onPlayOffline }) {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 8 }}>
        Choose Battle Mode
      </h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
        Deploy 4 cards from your shuffled deck — 1 Boss and 3 fighters. Then use support cards in real-time combat!
      </p>

      {matchmaking ? (
        <div className="card" style={{ textAlign: 'center', padding: 32 }}>
          <p style={{ marginBottom: 16 }}>{matchmaking.message}</p>
          <button className="btn-secondary" onClick={onCancelMatch}>Cancel</button>
        </div>
      ) : (
        <div className="mode-grid">
          <div className="mode-card" onClick={isOnline ? onStartNPC : onPlayOffline}>
            <h3>vs CPU</h3>
            <p>Practice against an AI opponent. Available offline.</p>
            {!isOnline && <p style={{ color: 'var(--accent-green)', marginTop: 8, fontSize: 11 }}>● Offline Ready</p>}
          </div>

          <div className={`mode-card ${!isOnline ? 'disabled' : ''}`} onClick={isOnline ? () => onFindMatch('casual') : undefined}>
            <h3>Casual PvP</h3>
            <p>Fight other players online. No cards lost on defeat.</p>
            {!isOnline && <p style={{ color: 'var(--accent-red)', marginTop: 8, fontSize: 11 }}>Requires internet</p>}
          </div>

          <div className={`mode-card ${!isOnline ? 'disabled' : ''}`} onClick={isOnline ? () => onFindMatch('competitive') : undefined}>
            <h3>Competitive</h3>
            <p>Winner takes a random card from the loser's deck!</p>
            {!isOnline && <p style={{ color: 'var(--accent-red)', marginTop: 8, fontSize: 11 }}>Requires internet</p>}
          </div>
        </div>
      )}
    </div>
  );
}
