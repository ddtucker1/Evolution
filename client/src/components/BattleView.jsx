import { useState, useRef } from 'react';
import GameCard from './GameCard';
import AttackArrow from './AttackArrow';
import ChainFireAnimation from './ChainFireAnimation';
import BloodSplatter from './BloodSplatter';

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
  onBossAttack2x,
  onBossDefenseHalved,
  onBossPoisonAll,
  onMainMenu,
}) {
  const [targetMode, setTargetMode] = useState(null);
  const [replaceMode, setReplaceMode] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
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
    pendingPlayerActions,
    pendingReplacement,
    drawTimer,
    drawTimerMax,
    drawReady,
    deckRemaining,
    replacementsUsed,
    maxReplacements,
    bossCanAttack,
    opponentBossCanAttack,
    bossAbilitiesUsed,
    bossMagicPhase,
    bossPhase,
  } = gameState;

  const me = players?.find((p) => p.id === 'player') || players?.[0];
  const battleEnded = !!winnerId;
  const queuedActions = pendingPlayerActions || [];
  const drawQueued = queuedActions.some((action) => action.type === 'draw');
  const queuedAttackerIds = queuedActions.flatMap((action) => {
    if (action.type === 'attack') return [action.attackerId];
    if (action.type === 'chainAttack') return action.attackerIds || [];
    return [];
  });

  const handleBossSelect = (cardId) => {
    const fieldIds = myHand.filter((c) => c.instanceId !== cardId).map((c) => c.instanceId);
    onSetup(cardId, fieldIds);
  };

  const canAttackWith = (attacker) => {
    if (!attacker?.alive) return false;
    const elapsed = attacker.cooldownElapsed ?? 0;
    const max = attacker.cooldown ?? 0;
    if (elapsed < max) return false;
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
    if (targetMode?.step !== 'chain-target') return;
    const partners = targetMode.partners || [];
    const next = partners.includes(partnerId)
      ? partners.filter((id) => id !== partnerId)
      : [...partners, partnerId];
    setTargetMode({ ...targetMode, partners: next });
  };

  const startChainFromChoice = () => {
    if (!targetMode?.attacker) return;
    const otherReady = getReadyChainAttackers()
      .filter((c) => c.instanceId !== targetMode.attacker.instanceId);
    setTargetMode({
      step: 'chain-target',
      attacker: targetMode.attacker,
      partners: otherReady.map((c) => c.instanceId),
    });
  };

  const startSingleAttack = () => {
    if (!targetMode?.attacker) return;
    setTargetMode({ step: 'direct-target', attacker: targetMode.attacker });
  };

  const handleMagicTargetSelect = (target) => {
    if (!magicMode || bossMagicExhausted) return;
    if (magicMode === 'slow') onBossSlow(target.instanceId);
    else if (magicMode === 'haste') onBossHaste(target.instanceId);
    else if (magicMode === 'attack2x') onBossAttack2x(target.instanceId);
    else if (magicMode === 'defenseHalved') onBossDefenseHalved(target.instanceId);
    setMagicMode(null);
  };

  const bossMagicExhausted = bossMagicPhase === 2
    ? (bossAbilitiesUsed?.attack2x || bossAbilitiesUsed?.defenseHalved || bossAbilitiesUsed?.poisonAll)
    : (bossAbilitiesUsed?.slow || bossAbilitiesUsed?.heal || bossAbilitiesUsed?.haste);

  const startBossMagic = (mode) => {
    if (bossMagicExhausted || winnerId) return;
    setTargetMode(null);
    setReplaceMode(null);
    setSelectedSlot(null);
    setMagicMode(mode);
  };

  const handleReplaceSlotClick = (slotIndex) => {
    if (replaceMode) {
      onReplace(replaceMode.handCardId, slotIndex);
      setReplaceMode(null);
      setSelectedSlot(null);
      return;
    }
    if (selectedSlot === slotIndex && myBattleHand?.length === 1) {
      onReplace(myBattleHand[0].instanceId, slotIndex);
      setSelectedSlot(null);
      return;
    }
    if (replacementsUsed < maxReplacements && myBattleHand?.length > 0) {
      setSelectedSlot(slotIndex);
      setReplaceMode(null);
      setMagicMode(null);
    }
  };

  const handleHandCardClick = (handCard) => {
    if (battleEnded || replacementsUsed >= maxReplacements) return;
    if (selectedSlot != null) {
      onReplace(handCard.instanceId, selectedSlot);
      setSelectedSlot(null);
      setReplaceMode(null);
      return;
    }
    startReplace(handCard);
  };

  const startReplace = (handCard) => {
    if (replacementsUsed >= maxReplacements) return;
    setReplaceMode({ handCardId: handCard.instanceId });
    setSelectedSlot(null);
    setTargetMode(null);
    setMagicMode(null);
  };

  if (phase === 'setup') {
    return (
      <div className="setup-phase">
        <div className="setup-instructions">
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--accent-gold)', marginBottom: 12 }}>
            Deployment Phase
          </h2>
          <p>Click <strong>Boss</strong> on one card. The other three become your fighters automatically.</p>
        </div>

        <div className="hand-cards setup-hand-cards">
          {myHand?.map((card) => (
            <div key={card.instanceId} className="setup-card-wrap">
              <GameCard
                card={card}
                showCooldown={false}
                cooldownPreview={card.cooldown}
                hideRole
              />
              <button
                type="button"
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
    getAliveFieldFighters(myPlayer.field).filter((c) => (c.cooldownElapsed ?? 0) >= (c.cooldown ?? 0))
  );

  const countAliveFighters = (field) => (field || []).filter((c) => c && c.alive).length;
  const myAliveFighters = countAliveFighters(myPlayer.field);
  const oppAliveFighters = countAliveFighters(oppPlayer?.field);
  const oppBossTargetable = !oppAliveFighters && oppPlayer?.boss?.alive;
  const showDeckAndHand = !bossPhase;

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

  const canUseBossHeal = () => {
    const fighters = getAliveFieldFighters(myPlayer.field);
    if (fighters.length) return true;
    return !!(myPlayer.boss?.alive && bossCanAttack);
  };

  const getHasteTargets = () => {
    const fighters = getAliveFieldFighters(myPlayer.field);
    if (fighters.length) return fighters;
    if (myPlayer.boss?.alive && bossCanAttack) return [myPlayer.boss];
    return [];
  };

  const getAttack2xTargets = () => {
    const cards = getAliveFieldFighters(myPlayer.field).filter((c) => !c.attackDoubled);
    if (cards.length) return cards;
    if (myPlayer.boss?.alive && bossCanAttack && !myPlayer.boss.attackDoubled) return [myPlayer.boss];
    return [];
  };

  const getDefenseHalvedTargets = () => {
    const fighters = (oppPlayer?.field || []).filter((c) => c && c.alive && !c.defenseHalved);
    if (fighters.length) return fighters;
    if (oppBossTargetable && oppPlayer?.boss?.alive && !oppPlayer.boss.defenseHalved) {
      return [oppPlayer.boss];
    }
    return [];
  };

  const canUseBossPoisonAll = () => getAliveFieldFighters(oppPlayer?.field).length > 0;

  const renderBossMagicActionsPhase1 = (abilitiesUsed, isPlayerSide) => {
    const exhausted = abilitiesUsed?.slow || abilitiesUsed?.heal || abilitiesUsed?.haste;
    const healAvailable = isPlayerSide && canUseBossHeal();
    return (
    <div className={`boss-magic-actions${isPlayerSide ? '' : ' npc-boss-magic'}`}>
      <button
        type="button"
        className={`boss-magic-btn slow-btn${exhausted ? ' ability-used' : ''}`}
        disabled={!isPlayerSide || exhausted || !!winnerId}
        onClick={() => isPlayerSide && startBossMagic('slow')}
      >
        Slow Timer
      </button>
      <button
        type="button"
        className={`boss-magic-btn heal-btn${exhausted ? ' ability-used' : ''}`}
        disabled={!isPlayerSide || exhausted || !!winnerId || !healAvailable}
        onClick={() => {
          if (!isPlayerSide || exhausted || winnerId || !healAvailable) return;
          onBossHeal();
        }}
      >
        Heal All
      </button>
      <button
        type="button"
        className={`boss-magic-btn haste-btn${exhausted ? ' ability-used' : ''}`}
        disabled={!isPlayerSide || exhausted || !!winnerId}
        onClick={() => isPlayerSide && startBossMagic('haste')}
      >
        Haste Timer
      </button>
    </div>
    );
  };

  const renderBossMagicActionsPhase2 = (abilitiesUsed, isPlayerSide) => {
    const exhausted = abilitiesUsed?.attack2x || abilitiesUsed?.defenseHalved || abilitiesUsed?.poisonAll;
    const poisonAvailable = isPlayerSide && canUseBossPoisonAll();
    const attack2xAvailable = isPlayerSide && getAttack2xTargets().length > 0;
    const defenseHalvedAvailable = isPlayerSide && getDefenseHalvedTargets().length > 0;
    return (
    <div className={`boss-magic-actions${isPlayerSide ? '' : ' npc-boss-magic'}`}>
      <button
        type="button"
        className={`boss-magic-btn attack2x-btn${exhausted ? ' ability-used' : ''}`}
        disabled={!isPlayerSide || exhausted || !!winnerId || !attack2xAvailable}
        onClick={() => isPlayerSide && startBossMagic('attack2x')}
      >
        Attack 2x
      </button>
      <button
        type="button"
        className={`boss-magic-btn defense-halved-btn${exhausted ? ' ability-used' : ''}`}
        disabled={!isPlayerSide || exhausted || !!winnerId || !defenseHalvedAvailable}
        onClick={() => isPlayerSide && startBossMagic('defenseHalved')}
      >
        Defense Halved
      </button>
      <button
        type="button"
        className={`boss-magic-btn poison-all-btn${exhausted ? ' ability-used' : ''}`}
        disabled={!isPlayerSide || exhausted || !!winnerId || !poisonAvailable}
        onClick={() => {
          if (!isPlayerSide || exhausted || winnerId || !poisonAvailable) return;
          onBossPoisonAll();
        }}
      >
        Poison All
      </button>
    </div>
    );
  };

  const renderBossMagicActions = (abilitiesUsed, isPlayerSide) => (
    bossMagicPhase === 2
      ? renderBossMagicActionsPhase2(abilitiesUsed, isPlayerSide)
      : renderBossMagicActionsPhase1(abilitiesUsed, isPlayerSide)
  );

  const renderStatusEffects = (card) => {
    const effects = [];
    if (card.hasted) effects.push({ key: 'haste', label: 'Haste', className: 'status-haste' });
    if (card.slowed) effects.push({ key: 'slow', label: 'Slow', className: 'status-slow' });
    if (card.poisoned) effects.push({ key: 'poison', label: 'Poison', className: 'status-poison' });
    if (card.attackDoubled) effects.push({ key: 'attack2x', label: '2x ATK', className: 'status-attack2x' });
    if (card.defenseHalved) effects.push({ key: 'defenseHalved', label: '½ DEF', className: 'status-defense-halved' });
    if (!effects.length) return null;
    return (
      <div className="card-status-effects">
        {effects.map((effect) => (
          <span key={effect.key} className={`status-effect ${effect.className}`}>
            {effect.label}
          </span>
        ))}
      </div>
    );
  };

  const renderDeckPile = (isPlayer) => {
    const remaining = isPlayer ? deckRemaining : (oppPlayer?.deckRemaining ?? 0);
    const timer = isPlayer ? drawTimer : (oppPlayer?.drawTimer ?? 0);
    const timerMax = isPlayer ? drawTimerMax : (oppPlayer?.drawTimerMax ?? 0);
    const ready = isPlayer && drawReady && !battleEnded;
    const progress = timerMax > 0 ? (timer / timerMax) * 100 : 0;

    return (
      <div className="deck-draw-zone">
        <div
          className={`deck-pile${ready ? ' draw-ready' : ''}${isPlayer && drawQueued ? ' selected' : ''}${!isPlayer ? ' deck-pile-opponent' : ''}`}
          onClick={() => ready && onDraw()}
        >
          <div className="deck-pile-label">Play Deck</div>
          <div className="deck-pile-count">{remaining} cards</div>
          <div className="draw-timer-bar">
            <div className="draw-timer-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="draw-timer-text">
            {ready ? 'Click to draw!' : `${timerMax - timer}s until draw`}
          </div>
        </div>
      </div>
    );
  };

  const renderHandZone = () => {
    if (!myBattleHand?.length) {
      return <div className="zone-hand-row zone-hand-empty" aria-hidden="true" />;
    }

    return (
      <div className="zone-hand-row">
        <h4 className="zone-hand-label">Your Hand — deploy to empty slots</h4>
        {(replaceMode || selectedSlot != null) && (
          <p className="replace-hint">
            {replaceMode
              ? 'Select an empty field slot to deploy your fighter'
              : `Slot ${selectedSlot + 1} selected — tap a hand card to deploy`}
          </p>
        )}
        <div className="hand-cards">
          {myBattleHand.map((card) => (
            <div key={card.instanceId} className="hand-card-wrap">
              <GameCard
                card={card}
                selected={replaceMode?.handCardId === card.instanceId || selectedSlot != null}
                showCooldown
                hideStatusEffects
                disabled={battleEnded}
                onClick={() => handleHandCardClick(card)}
              />
              {replacementsUsed < maxReplacements && (
                <span className="hand-card-label">Deploy</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBattlefield = (player, isPlayer) => {
    const aliveFighters = countAliveFighters(player.field);
    const boss = player.boss;
    const field = player.field || [];

    const renderFighterAt = (index) => {
      const card = field[index];
      if (!card) return null;
      return (
        <div key={`fighter-pos-${index}`} className={`fighter-grid-pos fighter-pos-${index}`}>
          {renderFieldSlot(card, index, isPlayer)}
        </div>
      );
    };

    const edgeSlots = (
      <div className="formation-edge-slots">
        {field.map((card, i) => (
          <div
            key={`edge-slot-${i}`}
            className={`formation-edge-slot${card ? ' formation-edge-inactive' : ''}`}
          >
            {card ? (
              <div className="field-slot empty formation-edge-placeholder" aria-hidden="true">
                <span>Empty slot</span>
              </div>
            ) : (
              renderFieldSlot(null, i, isPlayer)
            )}
          </div>
        ))}
      </div>
    );

    const mainGrid = (
      <div className="formation-main">
        {boss && (
          <div className="boss-slot formation-boss">
            {renderFieldSlot(boss, 'boss', isPlayer, {
              bossLocked: isPlayer ? !bossCanAttack : !opponentBossCanAttack,
              bossProtected: aliveFighters > 0,
            })}
          </div>
        )}
        {renderFighterAt(0)}
        {renderFighterAt(1)}
        {renderFighterAt(2)}
      </div>
    );

    const showMagic = boss?.alive && (isPlayer ? !winnerId : true);
    const magicActions = showMagic && (
      isPlayer
        ? renderBossMagicActions(bossAbilitiesUsed, true)
        : renderBossMagicActions(player.bossAbilitiesUsed, false)
    );

    return (
      <>
        <div className={`field-formation${isPlayer ? ' player-formation' : ' opponent-formation'}`}>
          {isPlayer ? (
            <>
              {edgeSlots}
              {mainGrid}
            </>
          ) : (
            <>
              {mainGrid}
              {edgeSlots}
            </>
          )}
        </div>
        {magicActions && (
          <div className={`boss-magic-footer${isPlayer ? '' : ' boss-magic-footer-opponent'}`}>
            {magicActions}
          </div>
        )}
      </>
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
    const attackableTargets = getAttackableTargets();
    const otherReady = targetMode?.attacker
      ? getReadyChainAttackers().filter((c) => c.instanceId !== targetMode.attacker.instanceId)
      : [];

    const isBoss = slotIndex === 'boss';
    const slotWrapperClass = isBoss ? 'boss-card-slot' : 'fighter-slot';

    if (!card) {
      const canReplace = isPlayer && !battleEnded && replacementsUsed < maxReplacements
        && myBattleHand?.length > 0
        && (replaceMode || selectedSlot === slotIndex || pendingReplacement?.slotIndex === slotIndex);
      return (
        <div key={`empty-${slotIndex}`} className={slotWrapperClass}>
          <div
            className={`field-slot empty${canReplace ? ' replace-ready' : ''}`}
            onClick={() => canReplace && handleReplaceSlotClick(slotIndex)}
          >
            <span>{canReplace ? 'Deploy here' : 'Empty slot'}</span>
          </div>
        </div>
      );
    }

    const bossLocked = options.bossLocked ?? (card.role === 'boss' && !bossCanAttack);
    const bossProtected = options.bossProtected ?? false;
    const inTargetMode = !!targetMode && !winnerId;
    const canSelectForAttack = isPlayer && phase === 'battle' && !winnerId && !inTargetMode && canAttackWith(card);
    const isQueuedAttacker = queuedAttackerIds.includes(card.instanceId);
    const isLeadAttacker = targetMode?.attacker?.instanceId === card.instanceId;
    const isChainPartner = targetMode?.step === 'chain-target' && targetMode.partners?.includes(card.instanceId);
    const isChainPartnerCandidate = isPlayer
      && targetMode?.step === 'chain-target'
      && otherReady.some((c) => c.instanceId === card.instanceId);
    const isEnemyTargetable = !isPlayer
      && inTargetMode
      && (targetMode.step === 'direct-target' || targetMode.step === 'chain-target')
      && attackableTargets.some((t) => t.instanceId === card.instanceId);
    const isMagicTargetable = !!magicMode && !winnerId && !bossMagicExhausted && (
      (magicMode === 'slow' && !isPlayer && getSlowTargets().some((t) => t.instanceId === card.instanceId))
      || (magicMode === 'haste' && isPlayer && getHasteTargets().some((t) => t.instanceId === card.instanceId))
      || (magicMode === 'attack2x' && isPlayer && getAttack2xTargets().some((t) => t.instanceId === card.instanceId))
      || (magicMode === 'defenseHalved' && !isPlayer && getDefenseHalvedTargets().some((t) => t.instanceId === card.instanceId))
    );
    const isTargetHighlighted = isChainPartner || isLeadAttacker || isEnemyTargetable || isMagicTargetable;

    const handleFieldCardClick = () => {
      if (isMagicTargetable) {
        handleMagicTargetSelect(card);
        return;
      }
      if (isEnemyTargetable) {
        if (targetMode.step === 'direct-target') handleTargetSelect(card);
        else if (targetMode.step === 'chain-target') handleChainTargetSelect(card);
        return;
      }
      if (isChainPartnerCandidate) {
        toggleChainPartner(card.instanceId);
        return;
      }
      if (canSelectForAttack) handleAttackClick(card);
    };

    const cardClickable = canSelectForAttack || isEnemyTargetable || isChainPartnerCandidate || isMagicTargetable;

    return (
      <div key={card.instanceId} className={slotWrapperClass}>
        <div
          className={`field-card-row${isPlayer ? ' player-side' : ' opponent-side'}`}
        >
          {!isPlayer && renderStatusEffects(card)}
          <div
            className={`field-card-anchor${isTargetHighlighted ? ' target-highlight' : ''}`}
            ref={(el) => {
              if (el) cardRefs.current[card.instanceId] = el;
              else delete cardRefs.current[card.instanceId];
            }}
          >
            <GameCard
              card={{ ...card, bossLocked, bossProtected }}
              showCooldown
              hideRole
              hideStatusEffects
              disabled={bossLocked || (isPlayer && !cardClickable && !isLeadAttacker)}
              selected={isQueuedAttacker || isTargetHighlighted}
              {...cardAnimProps(card)}
              onClick={cardClickable || isLeadAttacker ? handleFieldCardClick : undefined}
            />
          </div>
          {isPlayer && renderStatusEffects(card)}
        </div>
      </div>
    );
  };

  return (
    <div className="battle-screen">
      <div className="battle-top-bar">
        <button className="btn-secondary" onClick={onMainMenu}>Main Menu</button>
        <span className="replacement-counter">
          {showDeckAndHand ? `Replacements: ${replacementsUsed}/${maxReplacements}` : 'Boss Phase'}
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
        <div className={`player-zone zone-player${winnerId && winnerId !== me?.id && winnerId !== 'player' ? ' blood-splattered' : ''}${bossPhase ? ' boss-phase' : ''}`}>
          {winnerId && winnerId !== me?.id && winnerId !== 'player' && <BloodSplatter />}
          {showDeckAndHand && renderDeckPile(true)}
          <h3>Your Battlefield</h3>
          {renderBattlefield(myPlayer, true)}
          {showDeckAndHand && renderHandZone()}
          {!bossCanAttack && myPlayer.boss?.alive && !bossPhase && (
            <p className="boss-hint">Boss locked until all 3 fighters are defeated</p>
          )}
        </div>

        <div className={`player-zone zone-opponent${winnerId && (winnerId === me?.id || winnerId === 'player') ? ' blood-splattered' : ''}${bossPhase ? ' boss-phase' : ''}`}>
          {winnerId && (winnerId === me?.id || winnerId === 'player') && <BloodSplatter />}
          {showDeckAndHand && renderDeckPile(false)}
          <h3>{oppPlayer?.username || 'CPU Opponent'}</h3>
          {renderBattlefield(oppPlayer || { boss: null, field: [null, null, null] }, false)}
          {showDeckAndHand && (
            <div
              className={`zone-hand-row zone-hand-empty${myBattleHand?.length ? ' zone-hand-spacer' : ''}`}
              aria-hidden="true"
            />
          )}
          {oppAliveFighters > 0 && oppPlayer?.boss?.alive && !bossPhase && (
            <p className="boss-hint">Boss protected behind fighters</p>
          )}
        </div>

        {targetMode?.step === 'attack-choice' && (
          <div className="battlefield-prompt">
            <h4>Choose attack type</h4>
            <p className="battlefield-prompt-detail">
              <strong>{targetMode.attacker.name}</strong> is ready
            </p>
            <div className="battlefield-prompt-actions">
              <button type="button" className="btn-gold" onClick={startSingleAttack}>
                Single Attack
              </button>
              <button type="button" className="btn-gold chain-type-btn" onClick={startChainFromChoice}>
                Chain Attack
              </button>
              <button type="button" className="btn-secondary" onClick={() => setTargetMode(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {(targetMode?.step === 'direct-target' || targetMode?.step === 'chain-target') && (
          <div className="battlefield-target-hint">
            <span>
              {targetMode.step === 'chain-target'
                ? 'Chain attack — tap allies to adjust, then click an enemy'
                : 'Click an enemy to attack'}
            </span>
            <button type="button" className="battlefield-hint-cancel" onClick={() => setTargetMode(null)}>
              Cancel
            </button>
          </div>
        )}

        {magicMode && (
          <div className="battlefield-target-hint magic-target-hint">
            <span>
              {magicMode === 'slow' && 'Slow Timer — click an enemy card'}
              {magicMode === 'haste' && 'Haste Timer — click one of your cards'}
              {magicMode === 'attack2x' && 'Attack 2x — click one of your cards'}
              {magicMode === 'defenseHalved' && 'Defense Halved — click an enemy card'}
            </span>
            <button type="button" className="battlefield-hint-cancel" onClick={() => setMagicMode(null)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function getAliveFieldFighters(field) {
  return (field || []).filter((c) => c && c.alive);
}
