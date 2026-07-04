export default function GameCard({
  card,
  onClick,
  selected,
  disabled,
  showCooldown = true,
  isAttacking = false,
  isHit = false,
  isDying = false,
  timerRangeLabel = null,
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

  const bossLocked = card.bossLocked;
  const isReady = card.alive && card.cooldownRemaining <= 0 && !bossLocked;
  const isDead = card.alive === false && !isDying;
  const timerMax = card.cooldown || 0;
  const timerRemaining = Math.max(0, card.cooldownRemaining ?? 0);
  const timerProgress = timerMax > 0 ? ((timerMax - timerRemaining) / timerMax) * 100 : 100;

  const classes = [
    'game-card',
    card.role === 'boss' ? 'boss' : '',
    selected ? 'selected' : '',
    isDead ? 'dead' : '',
    isReady ? 'ready' : '',
    disabled ? 'disabled' : '',
    bossLocked ? 'boss-locked' : '',
    isAttacking ? 'attacking' : '',
    isHit ? 'hit' : '',
    isDying ? 'dying' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={disabled ? undefined : onClick}>
      {card.role && <span className="card-role">{card.role}</span>}
      <div className="card-name">{card.name}</div>
      <div className="card-stats">
        DEF: {card.defense ?? 0}
        <br />HP: {card.hp ?? card.maxHp}/{card.maxHp ?? card.hp}
        <br />ATK: {card.attack ?? 0}
        <br />
        <span className="timer-stat">
          Timer: {timerRangeLabel || (timerMax > 0 ? `${timerMax}s` : '—')}
        </span>
      </div>
      {card.maxHp > 0 && (
        <div className="hp-bar">
          <div className="hp-fill" style={{ width: `${((card.hp ?? card.maxHp) / card.maxHp) * 100}%` }} />
        </div>
      )}
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
    </div>
  );
}
