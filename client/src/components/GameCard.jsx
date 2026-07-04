import { getLevelDigit } from '../evolveEngine';

export default function GameCard({
  card,
  onClick,
  selected,
  disabled,
  showCooldown = true,
  isAttacking = false,
  isHit = false,
  isDying = false,
  pendingDamage = 0,
  cooldownPreview = null,
  levelLabel = null,
  levelDigit = null,
  hideRole = false,
  hideStatusEffects = false,
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
  const bossProtected = card.bossProtected;
  const timerMax = card.cooldown || 0;
  const timerElapsed = Math.max(0, card.cooldownElapsed ?? 0);
  const timerRemaining = Math.max(0, timerMax - timerElapsed);
  const isReady = card.alive && timerElapsed >= timerMax && !bossLocked && !bossProtected;
  const isDead = card.alive === false && !isDying;
  const timerProgress = timerMax > 0 ? (timerElapsed / timerMax) * 100 : 100;
  const maxHp = card.maxHp || 0;
  const currentHp = Math.max(0, (card.hp ?? maxHp) - (isHit ? pendingDamage : 0));
  const hpPercent = maxHp > 0 ? (currentHp / maxHp) * 100 : 0;
  const displayTimer = cooldownPreview ?? card.timer ?? null;
  const timerLabel = displayTimer != null
    ? `${displayTimer}s`
    : (timerMax > 0 ? `${timerMax}s` : '—');

  const classes = [
    'game-card',
    card.role === 'boss' ? 'boss' : '',
    selected ? 'selected' : '',
    isDead ? 'dead' : '',
    isReady ? 'ready' : '',
    disabled ? 'disabled' : '',
    bossLocked ? 'boss-locked' : '',
    bossProtected ? 'boss-protected' : '',
    isAttacking ? 'attacking' : '',
    isHit ? 'hit' : '',
    isDying ? 'dying' : '',
  ].filter(Boolean).join(' ');

  const displayLevel = levelDigit ?? (levelLabel ? levelLabel.replace(/\D/g, '') || null : getLevelDigit(card));

  return (
    <div className={classes} onClick={disabled ? undefined : onClick}>
      {card.role && !hideRole && <span className="card-role">{card.role}</span>}
      <div className="card-name-row">
        <div className="card-name">{card.name}</div>
        {displayLevel != null && <span className="card-level-digit">{displayLevel}</span>}
      </div>
      <div className="card-stats">
        DEF: {Math.round(card.defense ?? 0)}
        <br />
        <div className="stat-row">
          <span>HP: {Math.round(currentHp)}/{Math.round(maxHp)}</span>
          {maxHp > 0 && showCooldown && (
            <div className="hp-bar hp-bar-inline">
              <div className="hp-fill" style={{ width: `${hpPercent}%` }} />
            </div>
          )}
        </div>
        ATK: {Math.round(card.attack ?? 0)}
        <br />
        {card.ability?.label && (
          <>
            <span className="card-ability">{card.ability.label}</span>
            <br />
          </>
        )}
        <div className="stat-row">
          <span className="timer-stat">Timer: {timerLabel}</span>
          {showCooldown && timerMax > 0 && (
            <div className={`timer-bar timer-bar-inline${isReady ? ' timer-ready' : ''}`}>
              <div className="timer-fill" style={{ width: `${timerProgress}%` }} />
            </div>
          )}
        </div>
      </div>
      {showCooldown && timerMax > 0 && (
        <div className={`timer-countdown${isReady ? ' timer-countdown-ready' : ''}`}>
          {bossProtected ? 'Protected' : bossLocked ? 'Boss locked' : isReady ? 'Ready to attack!' : `${timerRemaining}s`}
        </div>
      )}
    </div>
  );
}
