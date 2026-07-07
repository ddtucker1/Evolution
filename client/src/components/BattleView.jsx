import { useState, useRef, useEffect, useCallback } from 'react';
import GameCard from './GameCard';
import CardBack from './CardBack';
import AttackArrow from './AttackArrow';
import ChainFireAnimation from './ChainFireAnimation';
import BloodSplatter from './BloodSplatter';
import PoisonCloudAnimation from './PoisonCloudAnimation';

function formatBattleElapsed(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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
  onMainMenu,
  onTogglePause,
  onToggleSpeed,
  onShowHelp,
}) {
  const [targetMode, setTargetMode] = useState(null);
  const [replaceMode, setReplaceMode] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [magicMode, setMagicMode] = useState(null);
  const battlefieldRef = useRef(null);
  const cardRefs = useRef({});
  const battleLogRef = useRef(null);
  const [bossDefeatPhase, setBossDefeatPhase] = useState(null);
  const [loserIsPlayer, setLoserIsPlayer] = useState(false);
  const bossDefeatStartedRef = useRef(false);

  const handleBloodSplatterComplete = useCallback(() => {
    setBossDefeatPhase('labels');
  }, []);

  const me = gameState?.players?.find((p) => p.id === 'player') || gameState?.players?.[0];
  const myBossInstanceId = gameState?.myBoss?.instanceId || me?.boss?.instanceId;
  const oppBossInstanceId = gameState?.opponent?.boss?.instanceId
    || gameState?.players?.find((p) => p.id !== me?.id)?.boss?.instanceId;

  useEffect(() => {
    const deathAnim = gameState?.deathAnimation;
    if (!deathAnim) return;
    const isBossDeath = deathAnim.role === 'boss'
      || deathAnim.instanceId === myBossInstanceId
      || deathAnim.instanceId === oppBossInstanceId;
    if (!isBossDeath || bossDefeatStartedRef.current) return;
    bossDefeatStartedRef.current = true;
    setLoserIsPlayer(deathAnim.instanceId === myBossInstanceId);
    setBossDefeatPhase('blood');
  }, [gameState?.deathAnimation, myBossInstanceId, oppBossInstanceId]);

  useEffect(() => {
    const el = battleLogRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [gameState?.log?.length]);

  useEffect(() => {
    const winner = gameState?.winnerId;
    if (!winner || bossDefeatStartedRef.current) return;
    bossDefeatStartedRef.current = true;
    setLoserIsPlayer(winner !== me?.id && winner !== 'player');
    setBossDefeatPhase('blood');
  }, [gameState?.winnerId, me?.id]);

  useEffect(() => {
    if (gameState?.canDeployFighter) return;
    setReplaceMode(null);
    setSelectedSlot(null);
  }, [gameState?.canDeployFighter]);

  if (!gameState) return null;

  const {
    phase,
    myHand,
    myBattleHand,
    oppBattleHand,
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
    canDeployFighter,
    bossAbilitiesUsed,
    bossMagicPhase,
    bossPhase,
    log,
    gamePaused,
    gameSpeed,
    poisonAnimation,
    battleElapsed,
    timersPaused,
    poisonDamage,
  } = gameState;

  const battleEnded = !!winnerId;
  const canDeployFromHand = canDeployFighter;
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
    ? (bossAbilitiesUsed?.attack2x || bossAbilitiesUsed?.defenseHalved)
    : (bossAbilitiesUsed?.slow || bossAbilitiesUsed?.heal || bossAbilitiesUsed?.haste);

  const startBossMagic = (mode) => {
    if (bossMagicExhausted || winnerId) return;
    setTargetMode(null);
    setReplaceMode(null);
    setSelectedSlot(null);
    setMagicMode(mode);
  };

  const handleReplaceSlotClick = (slotIndex) => {
    if (!canDeployFromHand) return;
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
    if (battleEnded || !canDeployFromHand) return;
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

  const showBloodOnPlayer = bossDefeatPhase && loserIsPlayer;
  const showBloodOnOpponent = bossDefeatPhase && !loserIsPlayer;
  const showVictoryLabels = bossDefeatPhase === 'labels';
  const playerWon = showVictoryLabels && !loserIsPlayer;
  const opponentWon = showVictoryLabels && loserIsPlayer;

  const getReadyChainAttackers = () => (
    getAliveFieldFighters(myPlayer.field).filter((c) => (c.cooldownElapsed ?? 0) >= (c.cooldown ?? 0))
  );

  const countAliveFighters = (field) => (field || []).filter((c) => c && c.alive).length;
  const myAliveFighters = countAliveFighters(myPlayer.field);
  const oppAliveFighters = countAliveFighters(oppPlayer?.field);
  const oppBossTargetable = !oppAliveFighters && oppPlayer?.boss?.alive;
  const isBossOnlySide = (isPlayer) => {
    const bossOnly = isPlayer ? bossCanAttack : opponentBossCanAttack;
    if (!bossOnly) return false;
    if (isPlayer) return !canDeployFromHand;
    const oppHand = oppBattleHand?.length ?? 0;
    const oppReplacementsLeft = (opponent?.maxReplacements ?? maxReplacements) - (opponent?.replacementsUsed ?? 0);
    const oppEmptySlots = (oppPlayer?.field || []).filter((c) => !c || !c.alive).length;
    return !(oppHand > 0 && oppReplacementsLeft > 0 && oppEmptySlots > 0);
  };

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
    const exhausted = abilitiesUsed?.attack2x || abilitiesUsed?.defenseHalved;
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
    </div>
    );
  };

  const renderBossMagicActions = (abilitiesUsed, isPlayerSide) => (
    bossMagicPhase === 2
      ? renderBossMagicActionsPhase2(abilitiesUsed, isPlayerSide)
      : renderBossMagicActionsPhase1(abilitiesUsed, isPlayerSide)
  );

  const renderStatusEffects = (card, isPlayer, enlarged = false) => {
    if (card.role === 'boss') {
      const bossActive = isPlayer ? bossCanAttack : opponentBossCanAttack;
      if (!bossActive) return null;
    }
    const effects = [];
    if (card.hasted) effects.push({ key: 'haste', label: 'Haste', className: 'status-haste' });
    if (card.slowed) effects.push({ key: 'slow', label: 'Slow', className: 'status-slow' });
    if (card.attackDoubled) effects.push({ key: 'attack2x', label: '2x ATK', className: 'status-attack2x' });
    if (card.defenseHalved) effects.push({ key: 'defenseHalved', label: '½ DEF', className: 'status-defense-halved' });
    if (card.poisoned) {
      const poisonLabel = (poisonDamage ?? 1) >= 2 ? 'Lethal Poison' : 'Poison';
      effects.push({ key: 'poison', label: poisonLabel, className: 'status-poison' });
    }
    if (!effects.length) return null;
    return (
      <div className={`card-status-effects${enlarged ? ' card-status-effects-enlarged' : ''}`}>
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
    const handCount = isPlayer ? (myBattleHand?.length ?? 0) : (oppBattleHand?.length ?? 0);
    const handFull = handCount >= 3;
    const fadingAway = isBossOnlySide(isPlayer);
    const timerComplete = timerMax > 0 && timer >= timerMax;
    const canDraw = isPlayer && drawReady && !battleEnded && !fadingAway && !handFull;
    const blocked = timerComplete && remaining > 0 && handFull && !fadingAway;
    const ready = canDraw;
    const progress = timerMax > 0 ? Math.min(100, (timer / timerMax) * 100) : 0;

    const timerText = fadingAway
      ? ''
      : ready
        ? 'Click to draw!'
        : blocked
          ? 'Hand full'
          : remaining > 0
            ? `${Math.max(0, timerMax - timer)}s until draw`
            : 'Deck empty';

    return (
      <div className={`deck-draw-zone${fadingAway ? ' fade-away' : ''}`}>
        <div
          className={[
            'deck-pile',
            ready ? 'draw-ready' : '',
            blocked ? 'draw-blocked' : '',
            isPlayer && drawQueued ? 'selected' : '',
            !isPlayer ? 'deck-pile-opponent' : '',
            fadingAway ? 'fade-away' : '',
          ].filter(Boolean).join(' ')}
          onClick={() => ready && onDraw()}
          aria-disabled={!ready}
        >
          <CardBack />
          <div className="deck-pile-overlay">
            {remaining > 0 && (
              <span className="deck-pile-count-badge">{remaining}</span>
            )}
            <div className="draw-timer-bar">
              <div className="draw-timer-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="draw-timer-text">{timerText}</div>
          </div>
        </div>
      </div>
    );
  };

  const renderHandCardSlot = (row, hand, isPlayer) => {
    const interactive = isPlayer && !isBossOnlySide(isPlayer) && canDeployFromHand;
    const fadingAway = isBossOnlySide(isPlayer);
    const card = hand?.[row];
    const showFaceDown = !isPlayer && !!card;

    return (
      <div
        key={`hand-${row}`}
        className={`grid-cell grid-cell-hand grid-cell-hand-${row}${fadingAway ? ' fade-away' : ''}`}
      >
        {card && (
          <div className="hand-card-wrap">
            <GameCard
              card={card}
              faceDown={showFaceDown}
              selected={interactive && (replaceMode?.handCardId === card.instanceId || selectedSlot != null)}
              showCooldown={!showFaceDown}
              hideStatusEffects
              disabled={interactive ? battleEnded : true}
              isFadingAway={fadingAway}
              onClick={interactive ? () => handleHandCardClick(card) : undefined}
            />
          </div>
        )}
      </div>
    );
  };

  const renderBattlefield = (player, isPlayer) => {
    const aliveFighters = countAliveFighters(player.field);
    const boss = player.boss;
    const field = player.field || [];
    const hand = isPlayer ? myBattleHand : oppBattleHand;
    const bossOnlyBoard = isBossOnlySide(isPlayer);

    const magicActions = boss?.alive && (
      isPlayer
        ? (!winnerId && renderBossMagicActions(bossAbilitiesUsed, true))
        : renderBossMagicActions(player.bossAbilitiesUsed, false)
    );

    return (
      <div className={`formation-grid${isPlayer ? ' player-formation' : ' opponent-formation'}${bossOnlyBoard ? ' boss-only-board' : ''}`}>
        {!bossOnlyBoard && [0, 1, 2].map((row) => renderHandCardSlot(row, hand, isPlayer))}
        {!bossOnlyBoard && (
          <div className="grid-cell grid-cell-deck">
            {renderDeckPile(isPlayer)}
          </div>
        )}
        {boss && (
          <div className="grid-cell grid-cell-boss">
            {renderFieldSlot(boss, 'boss', isPlayer, {
              bossLocked: isPlayer ? !bossCanAttack : !opponentBossCanAttack,
              bossProtected: aliveFighters > 0,
            })}
          </div>
        )}
        {magicActions && (
          <div className="grid-cell grid-cell-abilities">
            {magicActions}
          </div>
        )}
        {!bossOnlyBoard && field.map((card, i) => (
          <div key={`fighter-cell-${i}`} className={`grid-cell grid-cell-fighter grid-cell-fighter-${i}`}>
            {renderFieldSlot(card, i, isPlayer)}
          </div>
        ))}
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
    const attackableTargets = getAttackableTargets();
    const otherReady = targetMode?.attacker
      ? getReadyChainAttackers().filter((c) => c.instanceId !== targetMode.attacker.instanceId)
      : [];

    const isDying = deathAnimation?.instanceId === card?.instanceId;
    const showAsEmptyDeploySlot = isPlayer && card && !card.alive && !isDying;

    if (!card || showAsEmptyDeploySlot) {
      const canDeployToSlot = isPlayer && !battleEnded && canDeployFromHand;
      const emptySlotLabel = canDeployToSlot
        ? 'Deploy here'
        : isPlayer && (myBattleHand?.length ?? 0) > 0 && replacementsUsed >= maxReplacements
          ? 'No replacements left'
          : 'Empty slot';
      return (
        <div
          key={`empty-${slotIndex}`}
          className={`field-slot empty${canDeployToSlot ? ' replace-ready' : ''}`}
          onClick={() => canDeployToSlot && handleReplaceSlotClick(slotIndex)}
        >
          <span>{emptySlotLabel}</span>
        </div>
      );
    }

    const bossLocked = options.bossLocked ?? (card.role === 'boss' && !bossCanAttack);
    const bossProtected = options.bossProtected ?? false;
    const bossSoloActive = card.role === 'boss' && isBossOnlySide(isPlayer);
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
      <div
        key={card.instanceId}
        className={`field-card-row${isPlayer ? ' player-side' : ' opponent-side'}${bossSoloActive ? ' boss-solo-row' : ''}`}
      >
        {!isPlayer && renderStatusEffects(card, isPlayer, bossSoloActive)}
        <div
          className={`field-card-anchor${isTargetHighlighted ? ' target-highlight' : ''}${bossSoloActive ? ' boss-solo-active' : ''}`}
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
        {isPlayer && renderStatusEffects(card, isPlayer, bossSoloActive)}
      </div>
    );
  };

  const battleLogEntries = log || [];

  const elapsedSeconds = battleElapsed ?? 0;
  const timerPaused = gamePaused || timersPaused;
  const speedMultiplier = gameSpeed ?? 1;

  const statusLabel = gamePaused
    ? 'Paused'
    : bossPhase
      ? 'Boss Phase'
      : replacementsUsed >= maxReplacements && (myBattleHand?.length ?? 0) > 0
        ? 'Replacements used — hand locked'
        : `Replacements: ${replacementsUsed}/${maxReplacements}`;

  return (
    <div className="battle-screen">
      <div className="battle-layout">
        {phase === 'battle' && (
          <aside className="battle-sidebar" aria-label="Battle controls and log">
            <div className="battle-sidebar-controls">
              <button type="button" className="btn-secondary battle-quit-btn" onClick={onMainMenu}>
                Quit
              </button>
              <button type="button" className="btn-secondary battle-help-btn" onClick={onShowHelp}>
                Help
              </button>
              <button
                type="button"
                className={`btn-secondary battle-pause-btn${gamePaused ? ' battle-pause-btn-active' : ''}`}
                onClick={onTogglePause}
                disabled={!!winnerId}
              >
                {gamePaused ? 'Resume' : 'Pause'}
              </button>
            </div>
            <div className="battle-elapsed-timer-row">
              <div className={`battle-elapsed-timer${timerPaused ? ' battle-elapsed-timer-paused' : ''}`}>
                <span className="battle-elapsed-label">Battle Time</span>
                <span className="battle-elapsed-value">{formatBattleElapsed(elapsedSeconds)}</span>
                {timerPaused && <span className="battle-elapsed-paused">Paused</span>}
              </div>
              <button
                type="button"
                className={`btn-secondary battle-speed-btn${speedMultiplier === 3 ? ' battle-speed-btn-active' : ''}`}
                onClick={onToggleSpeed}
                disabled={!!winnerId}
                title={speedMultiplier === 3 ? 'Return to normal speed' : 'Speed up game 3×'}
                aria-pressed={speedMultiplier === 3}
              >
                {speedMultiplier === 3 ? '3×' : '1×'}
              </button>
            </div>
            <span className="battle-status-label">{statusLabel}</span>
            <div className="battle-log-panel">
              <h4 className="battle-log-title">Battle Log</h4>
              <div className="battle-log-lines" ref={battleLogRef}>
                {battleLogEntries.length === 0 ? (
                  <p className="battle-log-empty">No events yet.</p>
                ) : (
                  battleLogEntries.map((entry, index) => (
                    <p key={`${index}-${entry}`}>{entry}</p>
                  ))
                )}
              </div>
            </div>
          </aside>
        )}

        <div className="battle-main">
      <div className="battlefield" ref={battlefieldRef}>
        {poisonAnimation && <PoisonCloudAnimation />}
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
        <div className={`player-zone zone-player${showBloodOnPlayer ? ' blood-splattered' : ''}${bossCanAttack ? ' boss-only-zone' : ''}`}>
          {showBloodOnPlayer && (
            <BloodSplatter active onComplete={handleBloodSplatterComplete} />
          )}
          {playerWon && (
            <div className="zone-result-label zone-result-victorious">Victorious</div>
          )}
          {showVictoryLabels && loserIsPlayer && (
            <div className="zone-result-label zone-result-loser">Loser</div>
          )}
          {(replaceMode || selectedSlot != null) && canDeployFromHand && (
            <p className="replace-hint">
              {replaceMode
                ? 'Select an empty field slot to deploy'
                : `Slot ${selectedSlot + 1} selected — tap a hand card to deploy`}
            </p>
          )}
          {renderBattlefield(myPlayer, true)}
        </div>

        <div className={`player-zone zone-opponent${showBloodOnOpponent ? ' blood-splattered' : ''}${opponentBossCanAttack ? ' boss-only-zone' : ''}`}>
          {showBloodOnOpponent && (
            <BloodSplatter active onComplete={handleBloodSplatterComplete} />
          )}
          {opponentWon && (
            <div className="zone-result-label zone-result-victorious">Victorious</div>
          )}
          {showVictoryLabels && !loserIsPlayer && (
            <div className="zone-result-label zone-result-loser">Loser</div>
          )}
          {renderBattlefield(oppPlayer || { boss: null, field: [null, null, null] }, false)}
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

      {showVictoryLabels && (
        <div className="battle-end-actions">
          <button type="button" className="btn-secondary" onClick={onMainMenu}>Main Menu</button>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}

function getAliveFieldFighters(field) {
  return (field || []).filter((c) => c && c.alive);
}
