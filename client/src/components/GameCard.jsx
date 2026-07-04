export default function GameCard({
  card,
  onClick,
  selected,
  disabled,
  showCooldown = true,
  isAttacking = false,
  isHit = false,
}) {
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
  const bossLocked = card.bossLocked;
  const isReady = !isStandard && card.alive && card.cooldownRemaining <= 0 && !bossLocked;
  const isDead = card.alive === false;
  const timerMax = card.cooldown || 0;
  const timerRemaining = Math.max(0, card.cooldownRemaining ?? 0);
  const timerProgress = timerMax > 0 ? ((timerMax - timerRemaining) / timerMax) * 100 : 100;

  const classes = [
    'game-card',
    isStandard ? 'standard' : '',
    card.role === 'boss' ? 'boss' : '',
    selected ? 'selected' : '',
    isDead ? 'dead' : '',
    isReady ? 'ready' : '',
    disabled ? 'disabled' : '',
    bossLocked ? 'boss-locked' : '',
    isAttacking ? 'attacking' : '',
    isHit ? 'hit' : '',
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
            {timerMax > 0 && (
              <>
                <br />
                <span className="timer-stat">Timer: {timerMax}s</span>
              </>
            )}
          </div>
          <div className="hp-bar">
            <div className="hp-fill" style={{ width: `${(card.hp / card.maxHp) * 100}%` }} />
          </div>
          {showCooldown && timerMax > 0 && (
            <div className={`timer-bar${isReady ? ' timer-ready' : ''}`}>
              <div className="timer-fill" style={{ width: `${timerProgress}%` }} />
            </div>
          )}
          {showCooldown && timerMax > 0 && (
            <div className={`timer-countdown${isReady ? ' timer-countdown-ready' : ''}`}>
              {bossLocked ? 'Boss locked' : isReady ? 'Ready to attack!' : `${timerRemaining}s`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
