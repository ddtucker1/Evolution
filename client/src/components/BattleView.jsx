import { useState, useRef } from 'react';
import GameCard from './GameCard';
import AttackArrow from './AttackArrow';
import ChainFireAnimation from './ChainFireAnimation';

export default function BattleView({
  gameState,
  onSetup,
  onAttack,
  onChainAttack,
  onDraw,
  onReplace,
  onDismissReplacement,
  onBossSlow,
  onBossHeal,
  onBossHaste,
  onMainMenu,
}) {
  const [targetMode, setTargetMode] = useState(null);
  const [replaceMode, setReplaceMode] = useState(null);
  const [magicMode, setMagicMode] = useState(null);
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
    winnerId,
    players,
    attackAnimation,
    deathAnimation,
    pendingPlayerAttack,
    pendingReplacement,
    drawTimer,
    drawTimerMax,
    drawReady,
    deckRemaining,
    replacementsUsed,
    maxReplacements,
    bossCanAttack,
    opponentBossCanAttack,
    bossAbilityAvailable,
  } = gameState;

  const me = players?.find((p) => p.id === 'player') || players?.[0];
  const animationInProgress = !!attackAnimation || !!deathAnimation;
  const battleLocked = animationInProgress || !!winnerId;

  const handleBossSelect = (cardId) => {
    const fieldIds = myHand.filter((c) => c.instanceId !== cardId).map((c) => c.instanceId);
    onSetup(cardId, fieldIds);
  };

  const canAttackWith = (attacker) => {
    if (!attacker?.alive || attacker.cooldownRemaining > 0) return false;
    if (attacker.role === 'boss') return bossCanAttack;
    return attacker.role === 'field';
  };

  const handleAttackClick = (attacker) => {
    if (!canAttackWith(attacker) || winnerId) return;
    setMagicMode(null);
    const otherReady = getReadyChainAttackers().filter((c) => c.instanceId !== attacker.instanceId);
    if (otherReady.length === 0) {
      setTargetMode({ step: 'direct-target', attacker });
    } else {
      setTargetMode({ step: 'attack-choice', attacker });
    }
  };

  const handleTargetSelect = (target) => {
    if (!targetMode?.attacker) return;
    onAttack(targetMode.attacker.instanceId, target.instanceId);
    setTargetMode(null);
  };

  const getChainAttackerIds = (mode) => [
    mode.attacker.instanceId,
    ...(mode.partners || []),
  ];

  const handleChainTargetSelect = (target) => {
    if (!targetMode?.attacker || !targetMode.partners?.length) return;
    onChainAttack(getChainAttackerIds(targetMode), target.instanceId);
    setTargetMode(null);
  };

  const toggleChainPartner = (partnerId) => {
    if (targetMode?.step !== 'chain-partners') return;
    const partners = targetMode.partners || [];
    const next = partners.includes(partnerId)
      ? partners.filter((id) => id !== partnerId)
      : [...partners, partnerId];
    setTargetMode({ ...targetMode, partners: next });
  };

  const startChainPartnerSelect = () => {
    if (!targetMode?.attacker) return;
    setTargetMode({
      step: 'chain-partners',
      attacker: targetMode.attacker,
      partners: [],
    });
  };

  const startChainFromChoice = () => {
    if (!targetMode?.attacker) return;
    const otherReady = getReadyChainAttackers()
      .filter((c) => c.instanceId !== targetMode.attacker.instanceId);
    if (otherReady.length === 1) {
      setTargetMode({
        step: 'chain-target',
        attacker: targetMode.attacker,
        partners: [otherReady[0].instanceId],
      });
    } else {
      startChainPartnerSelect();
    }
  };

  const startSingleAttack = () => {
    if (!targetMode?.attacker) return;
    setTargetMode({ step: 'direct-target', attacker: targetMode.attacker });
  };

  const confirmChainPartners = () => {
    if (!targetMode?.attacker || !targetMode.partners?.length) return;
    setTargetMode({
      step: 'chain-target',
      attacker: targetMode.attacker,
      partners: targetMode.partners,
    });
  };

  const handleMagicTargetSelect = (target) => {
    if (!magicMode || !bossAbilityAvailable) return;
    if (magicMode === 'slow') onBossSlow(target.instanceId);
    else if (magicMode === 'heal') onBossHeal(target.instanceId);
    else if (magicMode === 'haste') onBossHaste(target.instanceId);
    setMagicMode(null);
  };

  const startBossMagic = (mode) => {
    if (!bossAbilityAvailable || winnerId) return;
    setTargetMode(null);
    setMagicMode(mode);
  };

  const handleReplaceSlotClick = (slotIndex) => {
    if (replaceMode) {
      onReplace(replaceMode.handCardId, slotIndex);
      setReplaceMode(null);
      return;
    }
    if (pendingReplacement?.slotIndex === slotIndex && myBattleHand?.length === 1) {
      onReplace(myBattleHand[0].instanceId, slotIndex);
    }
  };

  const handlePendingReplace = (handCard) => {
    if (pendingReplacement == null) return;
    onReplace(handCard.instanceId, pendingReplacement.slotIndex);
    setReplaceMode(null);
  };

  const startReplace = (handCard) => {
    if (replacementsUsed >= maxReplacements) return;
    setReplaceMode({ handCardId: handCard.instanceId });
    setTargetMode(null);
    setMagicMode(null);
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

  const getReadyChainAttackers = () => (
    getAliveFieldFighters(myPlayer.field).filter((c) => c.cooldownRemaining <= 0)
  );

  const getFighterById = (instanceId) => (
    myPlayer.field.find((c) => c?.instanceId === instanceId)
  );

  const getChainBonusPct = (count) => (count >= 3 ? 20 : 10);

  const getChainDamagePreview = (attackerIds, targets) => {
    const attackers = attackerIds
      .map((id) => targets.find((c) => c.instanceId === id))
      .filter(Boolean);
    if (attackers.length < 2) return 0;
    const totalAttack = attackers.reduce((sum, c) => sum + Math.round(c.attack ?? 0), 0);
    return Math.round(totalAttack * (attackers.length >= 3 ? 1.2 : 1.1));
  };

  const countAliveFighters = (field) => (field || []).filter((c) => c && c.alive).length;
  const myAliveFighters = countAliveFighters(myPlayer.field);
  const oppAliveFighters = countAliveFighters(oppPlayer?.field);
  const oppBossTargetable = !oppAliveFighters && oppPlayer?.boss?.alive;

  const getAttackableTargets = () => {
    const fighters = (oppPlayer?.field || []).filter((c) => c && c.alive);
    if (fighters.length) return fighters;
    if (oppBossTargetable) return [oppPlayer.boss];
    return [];
  };

  const getSlowTargets = () => {
    const fighters = (oppPlayer?.field || []).filter((c) => c && c.alive);
    if (fighters.length) return fighters;
    if (oppBossTargetable) return [oppPlayer.boss];
    return [];
  };

  const getHealTargets = () => getAliveFieldFighters(myPlayer.field);

  const getHasteTargets = () => {
    const fighters = getAliveFieldFighters(myPlayer.field);
    if (fighters.length) return fighters;
    if (myPlayer.boss?.alive && bossCanAttack) return [myPlayer.boss];
    return [];
  };

  const renderBattlefield = (player, isPlayer) => {
    const aliveFighters = countAliveFighters(player.field);
    const boss = player.boss;
    const field = player.field || [];

    const bossSlot = boss && (
      <div className="boss-side">
        {renderFieldSlot(boss, 'boss', isPlayer, {
          bossLocked: isPlayer ? !bossCanAttack : !opponentBossCanAttack,
          bossProtected: aliveFighters > 0,
        })}
        {isPlayer && boss.alive && !winnerId && (
          <div className="boss-magic-actions">
            <button
              type="button"
              className="boss-magic-btn slow-btn"
              disabled={!bossAbilityAvailable || !!winnerId}
              onClick={() => startBossMagic('slow')}
            >
              Slow Timer
            </button>
            <button
              type="button"
              className="boss-magic-btn heal-btn"
              disabled={!bossAbilityAvailable || !!winnerId}
              onClick={() => startBossMagic('heal')}
            >
              Heal Fighter
            </button>
            <button
              type="button"
              className="boss-magic-btn haste-btn"
              disabled={!bossAbilityAvailable || !!winnerId}
              onClick={() => startBossMagic('haste')}
            >
              Haste Timer
            </button>
            {!bossAbilityAvailable && (
              <span className="boss-magic-spent">Ability used this battle</span>
            )}
          </div>
        )}
      </div>
    );

    const fighterColumn = (
      <div className="fighter-column">
        {field.map((card, i) => renderFieldSlot(card, i, isPlayer))}
      </div>
    );

    return (
      <div className={`field-formation${isPlayer ? ' player-formation' : ' opponent-formation'}`}>
        {isPlayer ? (
          <>
            {bossSlot}
            {fighterColumn}
          </>
        ) : (
          <>
            {fighterColumn}
            {bossSlot}
          </>
        )}
      </div>
    );
  };

  const cardAnimProps = (card) => {
    const chainAttackerIds = attackAnimation?.isChainAttack
      ? (attackAnimation.attackerInstanceIds || [])
      : [];
    const isChainAttacker = chainAttackerIds.includes(card?.instanceId);
    return {
      isAttacking: attackAnimation?.attackerInstanceId === card?.instanceId || isChainAttacker,
      isHit: attackAnimation?.defenderInstanceId === card?.instanceId,
      isDying: deathAnimation?.instanceId === card?.instanceId,
      pendingDamage: attackAnimation?.defenderInstanceId === card?.instanceId ? (attackAnimation?.damage || 0) : 0,
    };
  };

  const renderFieldSlot = (card, slotIndex, isPlayer, options = {}) => {
    if (!card) {
      const canReplace = isPlayer && !battleLocked && replacementsUsed < maxReplacements
        && (replaceMode || (pendingReplacement?.slotIndex === slotIndex));
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

    const bossLocked = options.bossLocked ?? (card.role === 'boss' && !bossCanAttack);
    const bossProtected = options.bossProtected ?? false;
    const canSelectForAttack = isPlayer && phase === 'battle' && !winnerId && canAttackWith(card);
    const isQueuedAttacker = pendingPlayerAttack?.attackerId === card.instanceId
      || (pendingPlayerAttack?.isChain && pendingPlayerAttack?.attackerIds?.includes(card.instanceId));
    const isTargetSelected = targetMode?.attacker?.instanceId === card.instanceId
      || (targetMode?.step === 'chain-partners' && targetMode.partners?.includes(card.instanceId));

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
          card={{ ...card, bossLocked, bossProtected }}
          showCooldown
          hideRole
          disabled={bossLocked || (isPlayer && !canSelectForAttack)}
          selected={isQueuedAttacker || isTargetSelected}
          {...cardAnimProps(card)}
          onClick={() => {
            if (canSelectForAttack) handleAttackClick(card);
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

      {animationInProgress && pendingPlayerAttack && (
        <div className="attack-banner queued-attack-banner">
          {pendingPlayerAttack.isChain
            ? 'Chain attack queued — will execute when the current animation finishes'
            : 'Attack queued — will execute when the current animation finishes'}
        </div>
      )}

      {deathAnimation && (
        <div className="attack-banner death-banner">
          Card destroyed — shake and fade animation playing
        </div>
      )}

      <div className="battlefield" ref={battlefieldRef}>
        {attackAnimation && (
          <>
            {attackAnimation.isChainAttack && (
              <ChainFireAnimation chainCount={attackAnimation.chainCount || attackAnimation.attackerInstanceIds?.length || 2} />
            )}
            <AttackArrow
              containerRef={battlefieldRef}
              cardRefs={cardRefs}
              fromId={attackAnimation.attackerInstanceId}
              fromIds={attackAnimation.isChainAttack ? attackAnimation.attackerInstanceIds : undefined}
              toId={attackAnimation.defenderInstanceId}
            />
          </>
        )}
        <div className="player-zone">
          <h3>Your Battlefield</h3>
          {renderBattlefield(myPlayer, true)}
          {!bossCanAttack && myPlayer.boss?.alive && (
            <p className="boss-hint">Boss locked until all 3 fighters are defeated</p>
          )}
        </div>

        <div className="player-zone">
          <h3>{oppPlayer?.username || 'CPU Opponent'}</h3>
          {renderBattlefield(oppPlayer || { boss: null, field: [null, null, null] }, false)}
          {oppAliveFighters > 0 && oppPlayer?.boss?.alive && (
            <p className="boss-hint">Boss protected behind fighters</p>
          )}
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

      {pendingReplacement && !battleLocked && myBattleHand?.length > 0 && (
        <div className="target-overlay">
          <div className="target-panel replacement-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Fighter destroyed — replace from hand?</h3>
            <p className="replace-hint">
              Choose a card to deploy in slot {pendingReplacement.slotIndex + 1}
              {' '}({replacementsUsed}/{maxReplacements} replacements used)
            </p>
            <div className="hand-cards" style={{ marginBottom: 16 }}>
              {myBattleHand.map((card) => (
                <GameCard
                  key={card.instanceId}
                  card={card}
                  showCooldown
                  onClick={() => handlePendingReplace(card)}
                />
              ))}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={onDismissReplacement}>
              Skip for now
            </button>
          </div>
        </div>
      )}

      {targetMode && (() => {
        const attackableTargets = getAttackableTargets()
          .filter((c) => c && !c.hidden && c.alive !== false);
        const otherReady = getReadyChainAttackers()
          .filter((c) => c.instanceId !== targetMode.attacker.instanceId);
        const chainAttackerIds = targetMode.step === 'chain-target'
          ? getChainAttackerIds(targetMode)
          : [];
        const chainAttackers = chainAttackerIds
          .map((id) => getFighterById(id))
          .filter(Boolean);
        const chainBonus = getChainBonusPct(chainAttackerIds.length);
        const chainDamagePreview = getChainDamagePreview(chainAttackerIds, myPlayer.field);

        const renderTargetCards = (onSelect) => (
          <div className="field-cards" style={{ marginBottom: 16 }}>
            {attackableTargets.map((card) => (
              <GameCard
                key={card.instanceId}
                card={card}
                hideRole
                onClick={() => onSelect(card)}
              />
            ))}
          </div>
        );

        if (targetMode.step === 'direct-target') {
          return (
            <div className="target-overlay" onClick={() => setTargetMode(null)}>
              <div className="target-panel" onClick={(e) => e.stopPropagation()}>
                <h3>Choose target to attack</h3>
                <p className="replace-hint">
                  Attacking with <strong>{targetMode.attacker.name}</strong>
                </p>
                {animationInProgress && (
                  <p className="replace-hint">This attack will execute after the current animation finishes</p>
                )}
                {renderTargetCards(handleTargetSelect)}
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        if (targetMode.step === 'attack-choice') {
          const readyCount = 1 + otherReady.length;
          return (
            <div className="target-overlay" onClick={() => setTargetMode(null)}>
              <div className="target-panel" onClick={(e) => e.stopPropagation()}>
                <h3>Choose attack type</h3>
                <p className="replace-hint">
                  <strong>{targetMode.attacker.name}</strong> is ready
                  {readyCount > 1 ? ` — ${readyCount} fighters are ready to strike.` : '.'}
                </p>
                <div className="attack-type-buttons">
                  <button
                    type="button"
                    className="btn-gold attack-type-btn"
                    onClick={startSingleAttack}
                  >
                    Single Attack
                  </button>
                  <button
                    type="button"
                    className="btn-gold attack-type-btn chain-type-btn"
                    onClick={startChainFromChoice}
                  >
                    Chain Attack
                  </button>
                </div>
                <p className="replace-hint">
                  {otherReady.length === 1
                    ? 'Chain with your other ready fighter for +10% power.'
                    : 'Chain with one or both other ready fighters for bonus power (+10% for 2, +20% for 3).'}
                </p>
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        if (targetMode.step === 'chain-partners') {
          return (
            <div className="target-overlay" onClick={() => setTargetMode(null)}>
              <div className="target-panel" onClick={(e) => e.stopPropagation()}>
                <h3>Chain Attack — choose allies</h3>
                <p className="replace-hint">
                  <strong>{targetMode.attacker.name}</strong> will lead the chain. Select one or both other ready fighters.
                </p>
                <div className="field-cards chain-partner-cards" style={{ marginBottom: 16 }}>
                  {otherReady.map((card) => {
                    const selected = targetMode.partners?.includes(card.instanceId);
                    return (
                      <button
                        key={card.instanceId}
                        type="button"
                        className={`chain-partner-btn${selected ? ' selected' : ''}`}
                        onClick={() => toggleChainPartner(card.instanceId)}
                      >
                        <GameCard card={card} hideRole selected={selected} />
                        <span className="chain-partner-label">
                          {selected ? 'Included' : 'Tap to include'}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="btn-gold chain-attack-start-btn"
                  style={{ width: '100%', marginBottom: 8 }}
                  disabled={!targetMode.partners?.length}
                  onClick={confirmChainPartners}
                >
                  Attack
                </button>
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        if (targetMode.step === 'chain-target') {
          return (
            <div className="target-overlay" onClick={() => setTargetMode(null)}>
              <div className="target-panel" onClick={(e) => e.stopPropagation()}>
                <h3>Chain Attack — choose target</h3>
                <p className="replace-hint">
                  {chainAttackers.length === 2
                    ? 'Both ready fighters attack together — pick an opponent.'
                    : `Combines ${chainAttackers.map((c) => c.name).join(', ')} (+${chainBonus}% power, ${chainDamagePreview} ATK).`}
                </p>
                {animationInProgress && (
                  <p className="replace-hint">This attack will execute after the current animation finishes</p>
                )}
                {renderTargetCards(handleChainTargetSelect)}
                <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setTargetMode(null)}>Cancel</button>
              </div>
            </div>
          );
        }

        return null;
      })()}

      {magicMode === 'slow' && (
        <div className="target-overlay" onClick={() => setMagicMode(null)}>
          <div className="target-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Slow Timer — choose opponent</h3>
            <p className="replace-hint">Doubles the target&apos;s attack timer for the rest of the battle</p>
            <div className="field-cards" style={{ marginBottom: 16 }}>
              {getSlowTargets().map((card) => (
                <GameCard
                  key={card.instanceId}
                  card={card}
                  onClick={() => handleMagicTargetSelect(card)}
                />
              ))}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setMagicMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      {magicMode === 'heal' && (
        <div className="target-overlay" onClick={() => setMagicMode(null)}>
          <div className="target-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Heal Fighter — choose ally</h3>
            <p className="replace-hint">Fully restores the selected fighter&apos;s HP</p>
            <div className="field-cards" style={{ marginBottom: 16 }}>
              {getHealTargets().length > 0 ? getHealTargets().map((card) => (
                <GameCard
                  key={card.instanceId}
                  card={card}
                  onClick={() => handleMagicTargetSelect(card)}
                />
              )) : (
                <p className="replace-hint">No fighters available to heal</p>
              )}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setMagicMode(null)}>Cancel</button>
          </div>
        </div>
      )}

      {magicMode === 'haste' && (
        <div className="target-overlay" onClick={() => setMagicMode(null)}>
          <div className="target-panel" onClick={(e) => e.stopPropagation()}>
            <h3>Haste Timer — choose ally</h3>
            <p className="replace-hint">Halves the target&apos;s remaining cooldown</p>
            <div className="field-cards" style={{ marginBottom: 16 }}>
              {getHasteTargets().length > 0 ? getHasteTargets().map((card) => (
                <GameCard
                  key={card.instanceId}
                  card={card}
                  showCooldown
                  onClick={() => handleMagicTargetSelect(card)}
                />
              )) : (
                <p className="replace-hint">No attackers available to hasten</p>
              )}
            </div>
            <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setMagicMode(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function getAliveFieldFighters(field) {
  return (field || []).filter((c) => c && c.alive);
}
