import { useState, useRef } from 'react';
import GameCard from './GameCard';
import AttackArrow from './AttackArrow';

export default function BattleView({
  gameState,
  onSetup,
  onAttack,
  onDraw,
  onReplace,
  onMainMenu,
}) {
  const [targetMode, setTargetMode] = useState(null);
  const [replaceMode, setReplaceMode] = useState(null);
  const battlefieldRef = useRef(null);
  const cardRefs = useRef({});

  if (!gameState) return null;

  const {
    phase,
    myHand,
    myBattleHand,
    myBoss,
    myField,
    opponent,
    log,
    winnerId,
    players,
    attackAnimation,
    deathAnimation,
    drawTimer,
    drawTimerMax,
    drawReady,
    deckRemaining,
    replacementsUsed,
    maxReplacements,
    bossCanAttack,
  } = gameState;

  const me = players?.find((p) => p.id === 'player') || players?.[0];

  const handleBossSelect = (cardId) => {
    const fieldIds = myHand.filter((c) => c.instanceId !== cardId).map((c) => c.instanceId);
    onSetup(cardId, fieldIds);
  };

  const canAttackWith = (attacker) => {
    if (attackAnimation || deathAnimation || !attacker?.alive || attacker.cooldownRemaining > 0) return false;
    if (attacker.role === 'boss') return bossCanAttack;
    return attacker.role === 'field';
  };

  const handleAttackClick = (attacker) => {
    if (!canAttackWith(attacker)) return;
    setTargetMode({ type: 'attack', attacker });
  };

  const handleTargetSelect = (target) => {
    if (!targetMode) return;
    onAttack(targetMode.attacker.instanceId, target.instanceId);
    setTargetMode(null);
  };

  const handleReplaceSlotClick = (slotIndex) => {
    if (replaceMode) {
      onReplace(replaceMode.handCardId, slotIndex);
      setReplaceMode(null);
      return;
    }
    const slot = myField?.[slotIndex];
    if (!slot && replacementsUsed < maxReplacements) {
      // highlight empty slots when user has fighters in hand — handled via replace mode from hand
    }
  };

  const startReplace = (handCard) => {
    if (replacementsUsed >= maxReplacements) return;
    setReplaceMode({ handCardId: handCard.instanceId });
    setTargetMode(null);
  };

  if (phase === 'setup') {
    return (
      <div>
        <div className="setup-instructions">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 12 }}>
            Deployment Phase
          </h2>
          <p>Click <strong>Boss</strong> on one card. The other three become your fighters automatically.</p>
        </div>

        <div className="hand-cards" style={{ justifyContent: 'center', margin: '20px 0' }}>
          {myHand?.map((card) => (
            <div key={card.instanceId} style={{ textAlign: 'center' }}>
              <GameCard card={card} />
              <button
                className="btn-gold setup-boss-btn"
                onClick={() => handleBossSelect(card.instanceId)}
              >
                Boss
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const myPlayer = {
    boss: myBoss || me?.boss,
    field: myField?.length ? myField : (me?.field || [null, null, null]),
  };
  const oppPlayer = opponent || players?.find((p) => p.id !== me?.id);
  const battleLocked = !!attackAnimation || !!deathAnimation || !!winnerId;

  const cardAnimProps = (card) => ({
    isAttacking: attackAnimation?.attackerInstanceId === card?.instanceId,
    isHit: attackAnimation?.defenderInstanceId === card?.instanceId,
    isDying: deathAnimation?.instanceId === card?.instanceId,
  });

  const renderFieldSlot = (card, slotIndex, isPlayer) => {
    if (!card) {
      const canReplace = isPlayer && !battleLocked && replacementsUsed < maxReplacements && replaceMode;
      return (
        <div
          key={`empty-${slotIndex}`}
          className={`field-slot empty${canReplace ? ' replace-ready' : ''}`}
          onClick={() => canReplace && handleReplaceSlotClick(slotIndex)}
        >
          <span>{canReplace ? 'Deploy here' : 'Empty slot'}</span>
        </div>
      );
    }

    const bossLocked = card.role === 'boss' && !bossCanAttack;
    return (
      <div
        key={card.instanceId}
        className="field-card-anchor"
        ref={(el) => {
          if (el) cardRefs.current[card.instanceId] = el;
          else delete cardRefs.current[card.instanceId];
        }}
      >
        <GameCard
          card={{ ...card, bossLocked }}
          showCooldown
          disabled={battleLocked || bossLocked}
          {...cardAnimProps(card)}
          onClick={() => {
            if (phase === 'battle' && isPlayer && !battleLocked) handleAttackClick(card);
          }}
        />
      </div>
    );
  };

  const drawProgress = drawTimerMax > 0 ? (drawTimer / drawTimerMax) * 100 : 0;

  return (
    <div>
      <div className="battle-top-bar">
        <button className="btn-secondary" onClick={onMainMenu}>Main Menu</button>
        <span className="replacement-counter">
          Replacements: {replacementsUsed}/{maxReplacements}
        </span>
      </div>

      {attackAnimation && (
        <div className="attack-banner">
          Attack in progress — all timers paused ({Math.round((attackAnimation.durationMs || 1000) / 1000)}s)
          {attackAnimation.damage > 0 && (
            <span className="attack-banner-damage"> · {attackAnimation.damage} damage</span>
          )}
        </div>
      )}

      {winnerId && (
        <div className="card" style={{ textAlign: 'center', marginBottom: 16, borderColor: 'var(--accent-gold)' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)' }}>
            {winnerId === me?.id || winnerId === 'player' ? 'Victory!' : 'Defeat'}
          </h2>
          <button className="btn-secondary" onClick={onMainMenu} style={{ marginTop: 12 }}>Main Menu</button>
        </div>
      )}

      <div className="deck-draw-zone">
        <div
          className={`deck-pile${drawReady ? ' draw-ready' : ''}`}
          onClick={() => !battleLocked && drawReady && onDraw()}
        >
          <div className="deck-pile-label">Play Deck</div>
          <div className="deck-pile-count">{deckRemaining} cards</div>
          <div className="draw-timer-bar">
            <div className="draw-timer-fill" style={{ width: `${drawProgress}%` }} />
          </div>
          <div className="draw-timer-text">
            {drawReady ? 'Click to draw!' : `${drawTimerMax - drawTimer}s until draw`}
          </div>
        </div>
      </div>

      {deathAnimation && (
        <div className="attack-banner death-banner">
          Card destroyed — shake and fade animation playing
        </div>
      )}

      <div className="battlefield" ref={battlefieldRef}>
        {attackAnimation && (
          <AttackArrow
            containerRef={battlefieldRef}
            cardRefs={cardRefs}
            fromId={attackAnimation.attackerInstanceId}
            toId={attackAnimation.defenderInstanceId}
          />
        )}
        <div className="player-zone">
          <h3>Your Battlefield</h3>
          <div className="field-cards">
            {myPlayer.boss && renderFieldSlot(myPlayer.boss, 'boss', true)}
            {(myPlayer.field || []).map((card, i) => renderFieldSlot(card, i, true))}
          </div>
          {!bossCanAttack && myPlayer.boss?.alive && (
            <p className="boss-hint">Boss locked until all 3 fighters are defeated</p>
          )}
        </div>

        <div className="player-zone">
          <h3>{oppPlayer?.username || 'CPU Opponent'}</h3>
          <div className="field-cards">
            {oppPlayer?.boss && renderFieldSlot(oppPlayer.boss, 'boss', false)}
            {(oppPlayer?.field || []).map((card, i) => renderFieldSlot(card, i, false))}
          </div>
        </div>
      </div>

      {myBattleHand?.length > 0 && phase === 'battle' && !battleLocked && (
        <div className="hand-area">
          <h4>Your Hand — tap a fighter to replace an empty slot</h4>
          {replaceMode && (
            <p className="replace-hint">Select an empty field slot to deploy your fighter</p>
          )}
          <div className="hand-cards">
            {myBattleHand.map((card) => (
              <div key={card.instanceId} className="hand-card-wrap">
                <GameCard
                  card={card}
                  selected={replaceMode?.handCardId === card.instanceId}
                  showCooldown
                  onClick={() => {
                    if (replacementsUsed < maxReplacements) startReplace(card);
                  }}
                />
                {replacementsUsed < maxReplacements && (
                  <span className="hand-card-label">Replace</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="battle-log">
        {log?.map((entry, i) => <p key={i}>{entry}</p>)}
      </div>

      {targetMode && (
        <div className="target-overlay" onClick={() => setTargetMode(null)}>
          <div className="target-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Choose target to attack</h3>
            <div className="field-cards" style={{ marginBottom: 16 }}>
              {(oppPlayer?.field || [])
                .concat(oppPlayer?.boss ? [oppPlayer.boss] : [])
                .filter((c) => c && !c.hidden && c.alive !== false)
                .map((card) => (
                  <GameCard
                    key={card.instanceId}
                    card={card}
                    onClick={() => handleTargetSelect(card)}
                  />
                ))}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
