export default function GameCard({ card, onClick, selected, disabled, showCooldown = true }) {
  if (card?.hidden) {
    return (
      <div className="game-card disabled" style={{ opacity: 0.3 }}>
        <div className="card-name">???</div>
        <div className="card-stats">Hidden</div>
      </div>
    );
  }

  if (!card) return null;

  const isStandard = card.type === 'standard';
  const isReady = !isStandard && card.alive && card.cooldownRemaining <= 0;
  const isDead = card.alive === false;

  const classes = [
    'game-card',
    isStandard ? 'standard' : '',
    card.role === 'boss' ? 'boss' : '',
    selected ? 'selected' : '',
    isDead ? 'dead' : '',
    isReady ? 'ready' : '',
    disabled ? 'disabled' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={disabled ? undefined : onClick}>
      {card.role && <span className="card-role">{card.role}</span>}
      <div className="card-name">{card.name}</div>
      {isStandard ? (
        <div className="card-stats">
          {card.effect?.replace(/_/g, ' ')}
          <br />Value: {card.value}
          {card.used && (
            <>
              <br />
              <span style={{ color: '#e74c3c' }}>Used</span>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="card-stats">
            ATK: {card.attack} | DEF: {card.defense}
            <br />HP: {card.hp}/{card.maxHp}
          </div>
          <div className="hp-bar">
            <div className="hp-fill" style={{ width: `${(card.hp / card.maxHp) * 100}%` }} />
          </div>
          {showCooldown && card.cooldown > 0 && (
            <div className="cooldown-bar">
              <div
                className="cooldown-fill"
                style={{ width: `${((card.cooldown - card.cooldownRemaining) / card.cooldown) * 100}%` }}
              />
            </div>
          )}
          {isReady && <div style={{ fontSize: 10, color: '#2ecc71', marginTop: 4 }}>READY</div>}
        </>
      )}
    </div>
  );
}
