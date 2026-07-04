import { useState } from 'react';
import GameCard from './GameCard';

export default function BattleView({
  gameState,
  onSetup,
  onAttack,
  onUseStandard,
  onDraw,
  onReplace,
  onMainMenu,
}) {
  const [bossId, setBossId] = useState(null);
  const [fieldIds, setFieldIds] = useState([]);
  const [targetMode, setTargetMode] = useState(null);
  const [replaceMode, setReplaceMode] = useState(null);

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
    drawTimer,
    drawTimerMax,
    drawReady,
    deckRemaining,
    replacementsUsed,
    maxReplacements,
    bossCanAttack,
  } = gameState;

  const me = players?.find((p) => p.id === 'player') || players?.[0];

  const toggleField = (id) => {
    if (bossId === id) return;
    setFieldIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  const handleSetupConfirm = () => {
    if (!bossId || fieldIds.length !== 3) return;
    onSetup(bossId, fieldIds);
  };

  const canAttackWith = (attacker) => {
    if (attackAnimation || !attacker?.alive || attacker.cooldownRemaining > 0) return false;
    if (attacker.role === 'boss') return bossCanAttack;
    return attacker.role === 'field';
  };

  const handleAttackClick = (attacker) => {
    if (!canAttackWith(attacker)) return;
    setTargetMode({ type: 'attack', attacker });
  };

  const handleStandardClick = (card) => {
    if (card.used) return;
    setTargetMode({ type: 'standard', card });
  };

  const handleTargetSelect = (target, targetPlayerId) => {
    if (!targetMode) return;
    if (targetMode.type === 'attack') {
      onAttack(targetMode.attacker.instanceId, target.instanceId);
    } else {
      onUseStandard(targetMode.card.instanceId, target.instanceId, targetPlayerId);
    }
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
    if (handCard.type !== 'unique' || replacementsUsed >= maxReplacements) return;
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
          <p>Select 1 card as your <strong>Boss</strong> (attacks only after all 3 fighters fall) and 3 fighters for the field.</p>
        </div>

        <div className="hand-cards" style={{ justifyContent: 'center', margin: '20px 0' }}>
          {myHand?.map((card) => (
            <div key={card.instanceId} style={{ textAlign: 'center' }}>
              <GameCard
                card={card}
                selected={bossId === card.instanceId || fieldIds.includes(card.instanceId)}
              />
              <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'center' }}>
                <button
                  className={bossId === card.instanceId ? 'btn-gold' : 'btn-secondary'}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    setFieldIds((prev) => prev.filter((id) => id !== card.instanceId));
                    setBossId(card.instanceId);
                  }}
                >
                  Boss
                </button>
                <button
                  className={fieldIds.includes(card.instanceId) ? 'btn-primary' : 'btn-secondary'}
                  style={{ padding: '4px 8px', fontSize: 11 }}
                  onClick={() => {
                    if (bossId === card.instanceId) setBossId(null);
                    toggleField(card.instanceId);
                  }}
                  disabled={bossId === card.instanceId}
                >
                  Field
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Boss: {bossId ? '✓' : '—'} | Field: {fieldIds.length}/3
          </p>
          <button className="btn-primary" onClick={handleSetupConfirm} disabled={!bossId || fieldIds.length !== 3}>
            Confirm Deployment
          </button>
        </div>
      </div>
    );
  }

  const myPlayer = {
    boss: myBoss || me?.boss,
    field: myField?.length ? myField : (me?.field || [null, null, null]),
  };
  const oppPlayer = opponent || players?.find((p) => p.id !== me?.id);
  const battleLocked = !!attackAnimation || !!winnerId;

  const cardAnimProps = (card) => ({
    isAttacking: attackAnimation?.attackerInstanceId === card?.instanceId,
    isHit: attackAnimation?.defenderInstanceId === card?.instanceId,
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
      <GameCard
        key={card.instanceId}
        card={{ ...card, bossLocked }}
        showCooldown
        disabled={battleLocked || bossLocked}
        {...cardAnimProps(card)}
        onClick={() => {
          if (phase === 'battle' && isPlayer && !battleLocked) handleAttackClick(card);
        }}
      />
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

      <div className="battlefield">
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
          <h4>Your Hand — tap a fighter to replace an empty slot, or use support cards</h4>
          {replaceMode && (
            <p className="replace-hint">Select an empty field slot to deploy your fighter</p>
          )}
          <div className="hand-cards">
            {myBattleHand.map((card) => (
              <div key={card.instanceId} className="hand-card-wrap">
                <GameCard
                  card={card}
                  disabled={card.used}
                  selected={replaceMode?.handCardId === card.instanceId}
                  showCooldown={card.type === 'unique'}
                  onClick={() => {
                    if (card.type === 'unique' && replacementsUsed < maxReplacements) {
                      startReplace(card);
                    } else if (card.type === 'standard' && !card.used) {
                      handleStandardClick(card);
                    }
                  }}
                />
                {card.type === 'unique' && replacementsUsed < maxReplacements && (
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
            <h3>
              {targetMode.type === 'attack'
                ? 'Choose target to attack'
                : `Choose target for ${targetMode.card.name}`}
            </h3>
            <div className="field-cards" style={{ marginBottom: 16 }}>
              {targetMode.type === 'attack' ? (
                (oppPlayer?.field || [])
                  .concat(oppPlayer?.boss ? [oppPlayer.boss] : [])
                  .filter((c) => c && !c.hidden && c.alive !== false)
                  .map((card) => (
                    <GameCard
                      key={card.instanceId}
                      card={card}
                      onClick={() => handleTargetSelect(card, oppPlayer.id)}
                    />
                  ))
              ) : (
                <>
                  <p style={{ width: '100%', fontSize: 12, color: 'var(--text-secondary)' }}>Your cards:</p>
                  {[myPlayer.boss, ...(myPlayer.field || [])].filter((c) => c?.alive !== false).map((card) => (
                    <GameCard
                      key={card.instanceId}
                      card={card}
                      onClick={() => handleTargetSelect(card, me?.id || 'player')}
                    />
                  ))}
                  <p style={{ width: '100%', fontSize: 12, color: 'var(--text-secondary)', marginTop: 12 }}>Enemy cards:</p>
                  {[oppPlayer?.boss, ...(oppPlayer?.field || [])].filter((c) => c && !c.hidden && c.alive !== false).map((card) => (
                    <GameCard
                      key={card.instanceId}
                      card={card}
                      onClick={() => handleTargetSelect(card, oppPlayer.id)}
                    />
                  ))}
                </>
              )}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
