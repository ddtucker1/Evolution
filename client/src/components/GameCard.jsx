import { useRef, useEffect } from 'react';
import { getCardLevel, getLevelDigit } from '../combineEngine';
import {
  FIGHTER_ABILITY_UNLOCK_LEVEL,
  getFighterAbilityDescription,
  getFighterAbilityLabel,
  isFighterAbilityDoubled,
} from '../../../shared/fighterAbilities.js';
import CardBack from './CardBack';
import { truncateCardName } from '../utils/truncateCardName';

export default function GameCard({
  card,
  onClick,
  selected,
  disabled,
  showCooldown = true,
  isAttacking = false,
  isHit = false,
  isDying = false,
  isFadingAway = false,
  pendingDamage = 0,
  cooldownPreview = null,
  levelLabel = null,
  levelDigit = null,
  hideRole = false,
  hideStatusEffects = false,
  faceDown = false,
}) {
  const timerElapsed = Math.max(0, card?.cooldownElapsed ?? 0);
  const prevElapsedRef = useRef(timerElapsed);
  const timerReset = card && !card.hidden && !faceDown && timerElapsed < prevElapsedRef.current - 0.5;
  useEffect(() => {
    prevElapsedRef.current = timerElapsed;
  }, [timerElapsed]);

  if (card?.hidden) {
    return (
      <div className="game-card disabled" style={{ opacity: 0.3 }}>
        <div className="card-name-row">
          <div className="card-name" title="???">???</div>
        </div>
        <div className="card-stats">
          <div>DEF: —</div>
          <div className="stat-row">
            <span>HP: —/—</span>
            <div className="hp-bar hp-bar-inline stat-bar-placeholder" />
          </div>
          <div>ATK: —</div>
          <div className="card-ability-slot" aria-hidden="true" />
          <div className="stat-row">
            <span className="timer-stat">Timer: —</span>
            <div className="timer-bar timer-bar-inline stat-bar-placeholder" />
          </div>
        </div>
        <div className="card-footer-slot">
          <div className="timer-countdown">Hidden</div>
        </div>
      </div>
    );
  }

  if (!card) return null;

  if (faceDown) {
    const classes = [
      'game-card',
      'game-card-face-down',
      selected ? 'selected' : '',
      disabled ? 'disabled' : '',
      isFadingAway ? 'fade-away' : '',
    ].filter(Boolean).join(' ');

    return (
      <div className={classes} onClick={disabled ? undefined : onClick}>
        <CardBack />
      </div>
    );
  }

  const bossLocked = card.bossLocked;
  const bossProtected = card.bossProtected;
  const timerMax = card.cooldown || 0;
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
  const showHpBar = showCooldown && maxHp > 0;
  const showTimerBar = showCooldown && timerMax > 0;
  const showCountdown = showCooldown && timerMax > 0;

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
    isFadingAway ? 'fade-away' : '',
  ].filter(Boolean).join(' ');

  const displayLevel = levelDigit ?? (levelLabel ? levelLabel.replace(/\D/g, '') || null : getLevelDigit(card));
  const cardLevel = getCardLevel(card);
  const showAbility = cardLevel >= FIGHTER_ABILITY_UNLOCK_LEVEL && card.specialAbility;
  const abilityDoubled = showAbility && isFighterAbilityDoubled(cardLevel);
  const abilityLabel = showAbility
    ? `${getFighterAbilityLabel(card.specialAbility)}${abilityDoubled ? ' 2x' : ''}`
    : null;
  const abilityDescription = showAbility
    ? getFighterAbilityDescription(card.specialAbility, abilityDoubled)
    : null;
  const displayName = truncateCardName(card.name);

  return (
    <div className={classes} onClick={disabled ? undefined : onClick}>
      {card.role && !hideRole && <span className="card-role">{card.role}</span>}
      <div className="card-name-row">
        <div className="card-name" title={card.name}>{displayName}</div>
        {displayLevel != null && <span className="card-level-digit">{displayLevel}</span>}
      </div>
      <div className="card-stats">
        <div>DEF: {Math.round(card.defense ?? 0)}</div>
        <div className="stat-row">
          <span>HP: {Math.round(currentHp)}/{Math.round(maxHp)}</span>
          <div className={`hp-bar hp-bar-inline${showHpBar ? '' : ' stat-bar-placeholder'}`}>
            {showHpBar && <div className="hp-fill" style={{ width: `${hpPercent}%` }} />}
          </div>
        </div>
        <div>ATK: {Math.round(card.attack ?? 0)}</div>
        <div className="card-ability-slot" aria-hidden={!showAbility}>
          {showAbility && (
            <span className="card-ability" title={abilityDescription}>
              {abilityLabel}
            </span>
          )}
        </div>
        <div className="stat-row">
          <span className="timer-stat">Timer: {timerLabel}</span>
          <div className={`timer-bar timer-bar-inline${showTimerBar ? '' : ' stat-bar-placeholder'}${isReady ? ' timer-ready' : ''}`}>
            {showTimerBar && (
              <div
                className="timer-fill"
                style={{
                  width: `${timerProgress}%`,
                  transition: timerReset ? 'none' : undefined,
                }}
              />
            )}
          </div>
        </div>
      </div>
      <div className="card-footer-slot">
        <div className={`timer-countdown${showCountdown && isReady ? ' timer-countdown-ready' : ''}${showCountdown ? '' : ' stat-bar-placeholder'}`}>
          {showCountdown
            ? (bossProtected ? 'Protected' : bossLocked ? 'Boss locked' : isReady ? 'Ready to attack!' : `${timerRemaining}s`)
            : '\u00a0'}
        </div>
      </div>
    </div>
  );
}
