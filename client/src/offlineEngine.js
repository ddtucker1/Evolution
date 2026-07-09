import {
  getTimerPreview,
  isBaseCardId,
  generateRandomBaseStats,
  statTripleKey,
  CATALOG_SIZE,
  MAX_LIBRARY_SIZE,
} from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import {
  computeCpuTargetLevelSum,
  generateCpuDeck,
  getDeckLevelSum,
} from './cpuDeckGenerator.js';
import {
  FIGHTER_ABILITY_UNLOCK_LEVEL,
  FIGHTER_DEBUFF_DURATION,
  FIGHTER_ABILITY_CONFIG,
  isFighterAbilityDoubled,
  getFighterAbilityLabel,
} from '../../shared/fighterAbilities.js';

const CATALOG_VERSION = 5;
const CATALOG_STORAGE_KEY = 'cfb_card_catalog';

function buildRandomCatalog(count = CATALOG_SIZE) {
  const targetCount = Math.min(count, MAX_LIBRARY_SIZE);
  const used = new Set();
  const cards = [];
  let attempts = 0;

  while (cards.length < targetCount && attempts < targetCount * 500) {
    attempts += 1;
    const stats = generateRandomBaseStats();
    const key = statTripleKey(stats);
    if (used.has(key)) continue;
    used.add(key);

    const timer = getTimerPreview(stats.attack);
    cards.push({
      id: `uni_${cards.length + 1}`,
      name: generateCardName({ ...stats, timer }, key),
      attack: stats.attack,
      defense: stats.defense,
      hp: stats.hp,
      isBase: true,
    });
  }

  return cards;
}

function loadCatalogFromStorage() {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.version === CATALOG_VERSION && Array.isArray(parsed.cards) && parsed.cards.length === CATALOG_SIZE) {
      return parsed.cards;
    }
  } catch (_) {
    // ignore corrupt storage
  }
  return null;
}

function saveCatalogToStorage(cards) {
  localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ version: CATALOG_VERSION, cards }));
}

function trimCatalogToMax(cards) {
  if (cards.length <= MAX_LIBRARY_SIZE) return cards;
  return cards.slice(0, MAX_LIBRARY_SIZE);
}

function getOrCreateCatalog() {
  let cards = loadCatalogFromStorage();
  let needsSave = false;
  if (!cards) {
    cards = buildRandomCatalog(CATALOG_SIZE);
    needsSave = true;
  }
  const trimmed = trimCatalogToMax(cards);
  if (trimmed.length !== cards.length) {
    cards = trimmed;
    needsSave = true;
  }
  if (needsSave) {
    saveCatalogToStorage(cards);
  }
  return cards;
}

const CARD_DATA = {
  unique: getOrCreateCatalog(),
};

const baseAttacks = CARD_DATA.unique.map((c) => c.attack);
const CARD_TIMER_MIN = getTimerPreview(Math.min(...baseAttacks));
const CARD_TIMER_MAX = getTimerPreview(Math.max(...baseAttacks));

const DRAW_TIMER_MAX = 70;
const DEATH_ANIMATION_MS = 6000;
const DEATH_SHAKE_MS = 3000;
const PLAY_DECK_SIZE = 10;
const MAX_REPLACEMENTS = 3;
const MAX_BATTLE_HAND_SIZE = 3;
const ATTACK_ANIM_MS = 4000;
const TICK_BASE_MS = 1000;
const POISON_TRIGGER_TIME = 8 * 60;
const POISON2_TRIGGER_TIME = 10 * 60;
const POISON_ANIM_MS = 5000;
const POISON_TICK_INTERVAL = 6;
const POISON_DAMAGE = 2;
const POISON2_DAMAGE = 4;
const BATTLE_LOG_MAX_LINES = 20;

const LOOKUP = new Map();
for (const c of CARD_DATA.unique) LOOKUP.set(c.id, c);

let tickTimer = null;
let instanceCounter = 0;

function nextInstanceId(prefix, templateId) {
  instanceCounter += 1;
  return `${templateId}_${prefix}_${instanceCounter}`;
}

function getTemplate(id) { return LOOKUP.get(id); }

function isEvolvedLookupId(id) {
  return id.startsWith('evo_') || id.startsWith('test_l') || id.startsWith('test_tmp_');
}

export function registerEvolvedCards(cards) {
  for (const key of [...LOOKUP.keys()]) {
    if (isEvolvedLookupId(key)) {
      LOOKUP.delete(key);
    }
  }
  for (const c of cards || []) {
    LOOKUP.set(c.id, c);
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getSpeedMultiplier(game) {
  return game?.speedMultiplier || 1;
}

function scaleMs(baseMs, game) {
  return Math.max(1, Math.round(baseMs / getSpeedMultiplier(game)));
}

function getAttackAnimationMs(game) {
  return scaleMs(ATTACK_ANIM_MS, game);
}

function getTickIntervalMs(game) {
  return Math.max(1, Math.round(TICK_BASE_MS / getSpeedMultiplier(game)));
}

function getCooldownRemaining(card) {
  return Math.max(0, (card.cooldown || 0) - (card.cooldownElapsed || 0));
}

function isCardReady(card) {
  return (card.cooldownElapsed || 0) >= (card.cooldown || 0);
}

export function getLibraryCooldownSeconds(card) {
  if (typeof card === 'string') {
    const template = getTemplate(card);
    return getTimerPreview(template?.attack ?? 0);
  }
  return getTimerPreview(card?.attack ?? 0);
}

export function calculateAttackDamage(attacker, defender) {
  return Math.max(0, Math.round(attacker.attack) - Math.round(defender.defense));
}

function pushBattleLog(game, message) {
  game.log.push(message);
  if (game.log.length > BATTLE_LOG_MAX_LINES * 4) {
    game.log = game.log.slice(-BATTLE_LOG_MAX_LINES * 4);
  }
}

function formatSingleAttackLog(logPrefix, attacker, defender, damage) {
  const atk = Math.round(attacker.attack);
  const def = Math.round(defender.defense);
  const hpBefore = defender.hp;
  if (damage <= 0) {
    return `${logPrefix}: ${attacker.name} → ${defender.name} | ATK ${atk} − DEF ${def} = 0 (blocked)`;
  }
  const hpAfter = Math.max(0, hpBefore - damage);
  return `${logPrefix}: ${attacker.name} → ${defender.name} | ATK ${atk} − DEF ${def} = ${damage} dmg | HP ${hpBefore} → ${hpAfter}`;
}

function formatChainAttackLog(logPrefix, attackers, defender, damage) {
  const atkValues = attackers.map((a) => Math.round(a.attack));
  const totalAttack = atkValues.reduce((sum, v) => sum + v, 0);
  const bonus = attackers.length >= 3 ? 1.2 : 1.1;
  const bonusPct = attackers.length >= 3 ? 20 : 10;
  const effectiveAttack = Math.round(totalAttack * bonus);
  const def = Math.round(defender.defense);
  const atkBreakdown = attackers.map((a, i) => `${a.name}(${atkValues[i]})`).join(' + ');
  const hpBefore = defender.hp;
  if (damage <= 0) {
    return `${logPrefix}: chain (${attackers.length}) [${atkBreakdown}] = ${totalAttack} × ${bonus} (+${bonusPct}%) = ${effectiveAttack} − DEF ${def} = 0 (blocked)`;
  }
  const hpAfter = Math.max(0, hpBefore - damage);
  return `${logPrefix}: chain (${attackers.length}) [${atkBreakdown}] = ${totalAttack} × ${bonus} (+${bonusPct}%) = ${effectiveAttack} − DEF ${def} = ${damage} dmg | HP ${hpBefore} → ${hpAfter}`;
}

function formatDeployLog(logPrefix, card, slotIndex, used, max) {
  return `${logPrefix}: deployed ${card.name} to slot ${slotIndex + 1} | ATK ${card.attack} DEF ${card.defense} HP ${card.hp} (${used}/${max})`;
}

function formatDrawLog(logPrefix, card) {
  return `${logPrefix}: drew ${card.name} | ATK ${card.attack} DEF ${card.defense} HP ${card.hp}`;
}

function formatKillLog(victim) {
  return `${victim.name} defeated (HP reached 0)`;
}

function getPoisonDamage(game) {
  return game.poisonDamage || POISON_DAMAGE;
}

function formatPoisonTickLog(card, hpBefore, hpAfter, damage) {
  return `Poison → ${card.name} | HP ${hpBefore} − ${damage} = ${hpAfter}`;
}

function getActiveFieldCards(player) {
  const fighters = getAliveFieldFighters(player);
  if (fighters.length > 0) return fighters;
  if (player.boss?.alive) return [player.boss];
  return [];
}

function getAllActiveFieldCards(game) {
  const cards = [];
  for (const player of game.players) {
    for (const card of getActiveFieldCards(player)) {
      if (card?.alive) cards.push({ card, player });
    }
  }
  return cards;
}

function syncPoisonForPlayer(game, player) {
  const activeIds = new Set(getActiveFieldCards(player).map((c) => c.instanceId));

  if (player.boss && !activeIds.has(player.boss.instanceId)) {
    player.boss.poisoned = false;
  }
  for (const fighter of player.field || []) {
    if (fighter && !activeIds.has(fighter.instanceId)) {
      fighter.poisoned = false;
    }
  }

  if (game.poisonPhase !== 'active') return;

  for (const card of getActiveFieldCards(player)) {
    card.poisoned = true;
  }
}

function applyPoisonToAllActiveCards(game) {
  for (const player of game.players) {
    syncPoisonForPlayer(game, player);
  }
}

function maybeSetPendingReplacement(game, player, clearedSlotIndex) {
  if (
    clearedSlotIndex !== null
    && player?.id === 'player'
    && canDeployFighter(player)
    && !game.pendingReplacement
  ) {
    game.pendingReplacement = { slotIndex: clearedSlotIndex };
  }
}

function applyPoisonTick(game) {
  const damage = getPoisonDamage(game);
  let anyKilled = false;
  for (const { card, player } of getAllActiveFieldCards(game)) {
    if (!card.poisoned) continue;
    const hpBefore = card.hp;
    const killed = applyFlatDamage(card, damage);
    const hpAfter = card.hp;
    pushBattleLog(game, formatPoisonTickLog(card, hpBefore, hpAfter, damage));
    if (killed) {
      pushBattleLog(game, formatKillLog(card));
      if (card.role === 'field') {
        const idx = (player.field || []).findIndex((c) => c?.instanceId === card.instanceId);
        if (idx >= 0) {
          player.field[idx] = null;
          maybeSetPendingReplacement(game, player, idx);
          if (player.id === 'npc') runNpcReplaceAfterSlotClear(game);
        }
      }
      syncPoisonForPlayer(game, player);
      anyKilled = true;
    }
  }
  return anyKilled;
}

function startPoisonAnimation(game, { tier = 1 } = {}) {
  game.poisonPhase = 'animating';
  game.poisonAnimStartedAt = Date.now();
  if (tier >= 2) {
    pushBattleLog(game, 'The toxic clouds thicken and grow more deadly…');
  } else {
    pushBattleLog(game, 'Toxic clouds roll across the battlefield…');
  }
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));

  game.poisonAnimTier = tier;
  if (game.poisonAnimTimeout) clearTimeout(game.poisonAnimTimeout);
  const poisonDurationMs = scaleMs(POISON_ANIM_MS, game);
  game.poisonAnimTimeout = setTimeout(() => completePoisonAnimation(game, tier), poisonDurationMs);
}

function completePoisonAnimation(game, tier = 1) {
  if (game.poisonPhase !== 'animating') return;
  game.poisonPhase = 'active';
  game.poisonTickCounter = 0;
  game.poisonAnimStartedAt = null;
  if (game.poisonAnimTimeout) {
    clearTimeout(game.poisonAnimTimeout);
    game.poisonAnimTimeout = null;
  }
  if (tier >= 2) {
    game.poisonDamage = POISON2_DAMAGE;
    game.poisonTier2Triggered = true;
  } else {
    game.poisonDamage = POISON_DAMAGE;
  }
  applyPoisonToAllActiveCards(game);
  const count = getAllActiveFieldCards(game).length;
  const damage = getPoisonDamage(game);
  if (tier >= 2) {
    pushBattleLog(game, `Poison intensifies on ${count} active card${count === 1 ? '' : 's'} (−${damage} HP every ${POISON_TICK_INTERVAL}s)`);
  } else {
    pushBattleLog(game, `Poison spreads to ${count} active card${count === 1 ? '' : 's'} (−${damage} HP every ${POISON_TICK_INTERVAL}s)`);
  }
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
}

function tickPoison(game) {
  if (game.poisonPhase === null && (game.battleElapsed || 0) >= POISON_TRIGGER_TIME) {
    startPoisonAnimation(game);
    return;
  }

  if (
    game.poisonPhase === 'active'
    && !game.poisonTier2Triggered
    && (game.battleElapsed || 0) >= POISON2_TRIGGER_TIME
  ) {
    startPoisonAnimation(game, { tier: 2 });
    return;
  }

  if (game.poisonPhase === 'active') {
    game.poisonTickCounter = (game.poisonTickCounter || 0) + 1;
    if (game.poisonTickCounter >= POISON_TICK_INTERVAL) {
      game.poisonTickCounter = 0;
      const anyKilled = applyPoisonTick(game);
      if (anyKilled) {
        const w = checkWinner(game.players[0], game.players[1]);
        if (w) {
          finishOffline(game, w);
          return true;
        }
      }
    }
  }
  return false;
}

function makeBattleCard(templateId, instanceId) {
  const t = getTemplate(templateId);
  if (!t) return null;
  const isEvolved = (
    templateId.startsWith('evo_')
    || templateId.startsWith('test_l')
    || templateId.startsWith('npc_l')
  );
  const attack = Math.round(t.attack);
  const defense = Math.round(t.defense);
  const maxHp = Math.round(t.hp);
  const cooldown = getTimerPreview(attack);
  return {
    instanceId, templateId, name: t.name, type: 'unique',
    attack, defense,
    maxHp, hp: maxHp,
    cooldown, cooldownElapsed: 0,
    alive: true, role: null,
    isBase: t.isBase != null ? !!t.isBase : isBaseCardId(templateId),
    level: t.level ?? (isEvolved ? 1 : 0),
    specialAbility: t.specialAbility || null,
  };
}

function deckEntriesFromIds(deckIds, prefix) {
  return deckIds
    .filter((templateId) => getTemplate(templateId))
    .slice(0, PLAY_DECK_SIZE)
    .map((templateId) => ({
      templateId,
      instanceId: nextInstanceId(prefix, templateId),
    }));
}

function createPlayer(id, username, deckIds) {
  const shuffled = shuffle(deckEntriesFromIds(deckIds, id));
  const setupDraw = shuffled.splice(0, 4);
  return {
    id,
    username,
    deck: shuffled,
    setupHand: setupDraw.map((c) => makeBattleCard(c.templateId, c.instanceId)),
    battleHand: [],
    boss: null,
    field: [null, null, null],
    setupComplete: false,
    isWinner: false,
    drawTimer: 0,
    drawTimerMax: DRAW_TIMER_MAX,
    replacementsUsed: 0,
    maxReplacements: MAX_REPLACEMENTS,
  };
}

function clearNpcLookupCards() {
  for (const key of [...LOOKUP.keys()]) {
    if (key.startsWith('npc_')) {
      LOOKUP.delete(key);
    }
  }
}

function registerNpcDeckCards(cards) {
  clearNpcLookupCards();
  for (const card of cards || []) {
    LOOKUP.set(card.id, card);
  }
}

function buildNpcDeckFromPlayerDeck(deckIds) {
  const playerLevelSum = getDeckLevelSum(deckIds, (id) => getTemplate(id));
  const targetSum = computeCpuTargetLevelSum(playerLevelSum);
  const generated = generateCpuDeck(targetSum, { catalog: CARD_DATA.unique });
  registerNpcDeckCards(generated.cards);
  return generated.ids;
}

function getAliveFieldFighters(player) {
  return (player.field || []).filter((c) => c && c.alive);
}

function getFieldCards(player) {
  const fighters = getAliveFieldFighters(player);
  if (player.boss?.alive) return [player.boss, ...fighters];
  return fighters;
}

function canBossAttack(player) {
  return player.boss?.alive && getAliveFieldFighters(player).length === 0;
}

function hasEmptyFighterSlot(player) {
  return (player.field || []).some((c) => !c || !c.alive);
}

function canDeployFighter(player) {
  if (canBossAttack(player)) return false;
  if (player.replacementsUsed >= player.maxReplacements) return false;
  if (!player.battleHand?.length) return false;
  return hasEmptyFighterSlot(player);
}

function canDrawBattleCard(player) {
  if (canBossAttack(player)) return false;
  if (player.drawTimer < player.drawTimerMax || !player.deck.length) return false;
  if (player.battleHand.length >= MAX_BATTLE_HAND_SIZE) return false;
  return true;
}

function isCardInDeathPipeline(game, instanceId) {
  if (!instanceId) return false;
  if (game.deathAnimation?.instanceId === instanceId) return true;
  return !!(game.deathQueue || []).some((entry) => entry.instanceId === instanceId);
}

function cancelDeathPipelineForCard(game, instanceId) {
  if (!instanceId) return;
  if (game.deathQueue) {
    game.deathQueue = game.deathQueue.filter((entry) => entry.instanceId !== instanceId);
  }
  if (game.deathAnimation?.instanceId !== instanceId) return;

  if (game.deathTimeout) {
    clearTimeout(game.deathTimeout);
    game.deathTimeout = null;
  }
  game.deathAnimation = null;
  if (game.deathQueue?.length) startNextDeathAnimation(game);
}

function isBossOnlyPhase(player) {
  return player.boss?.alive && getAliveFieldFighters(player).length === 0;
}

function isBossPhase(game) {
  return game.players.some((p) => isBossOnlyPhase(p));
}

function canBossBeTargeted(player) {
  return canBossAttack(player);
}

function getAttackableTargets(opponent) {
  const fighters = getAliveFieldFighters(opponent);
  if (fighters.length) return fighters;
  if (canBossBeTargeted(opponent)) return [opponent.boss];
  return [];
}

function canCardAttack(attacker, player) {
  if (!attacker?.alive || !isCardReady(attacker)) return false;
  if (attacker.role === 'boss') return canBossAttack(player);
  return attacker.role === 'field';
}

function promoteToBoss(card) {
  card.role = 'boss';
  card.attack = Math.floor(card.attack * 2);
  card.maxHp = Math.floor(card.maxHp * 2);
  card.hp = card.maxHp;
}

function getReadyFieldFighters(player) {
  return getAliveFieldFighters(player).filter((c) => isCardReady(c));
}

function calculateChainAttackDamage(attackers, defender) {
  const totalAttack = attackers.reduce((sum, a) => sum + Math.round(a.attack), 0);
  const bonus = attackers.length >= 3 ? 1.2 : 1.1;
  const effectiveAttack = Math.round(totalAttack * bonus);
  return Math.max(0, effectiveAttack - Math.round(defender.defense));
}

function queuePlayerAction(game, action) {
  if (!game.pendingPlayerActions) game.pendingPlayerActions = [];
  game.pendingPlayerActions.push(action);
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true, queued: true };
}

function executeQueuedAttack(game, action) {
  const player = game.players[0];
  const opp = game.players[1];
  const defender = getFieldCards(opp).find((c) => c.instanceId === action.defenderId);
  if (!defender?.alive) return { success: false };
  if (!getAttackableTargets(opp).some((c) => c.instanceId === action.defenderId)) {
    return { success: false };
  }

  if (action.type === 'chainAttack') {
    const attackers = (action.attackerIds || [])
      .map((id) => getAliveFieldFighters(player).find((c) => c.instanceId === id))
      .filter(Boolean);
    if (attackers.length < 2) return { success: false };
    if (!attackers.every((a) => isCardReady(a))) return { success: false };
    return beginChainAttackAnimation(game, attackers, defender, 'You');
  }

  const attacker = getFieldCards(player).find((c) => c.instanceId === action.attackerId);
  if (!attacker || !canCardAttack(attacker, player)) return { success: false };
  return beginAttackAnimation(game, attacker, defender, 'You');
}

function executeQueuedAction(game, action) {
  switch (action.type) {
    case 'attack':
    case 'chainAttack':
      return executeQueuedAttack(game, action);
    case 'draw': {
      const player = game.players[0];
      const drew = drawCardForPlayer(game, player, 'You');
      return drew ? { success: true } : { success: false };
    }
    case 'replace':
      return executePlayerReplace(game, action.handCardId, action.slotIndex);
    default:
      return { success: false };
  }
}

function processPendingActions(game) {
  if (isBattlePaused(game) || game.winnerId) return;

  while (game.pendingPlayerActions?.length) {
    const action = game.pendingPlayerActions.shift();
    const result = executeQueuedAction(game, action);
    if (result?.pending) return;
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  }
}

function executePlayerReplace(game, handCardId, slotIndex) {
  const player = game.players[0];
  if (!canDeployFighter(player)) {
    return { success: false, message: canBossAttack(player) ? 'Boss is fighting alone' : 'Cannot deploy' };
  }
  if (player.replacementsUsed >= player.maxReplacements) {
    return { success: false, message: 'No replacements left' };
  }
  if (slotIndex < 0 || slotIndex > 2) return { success: false };
  const slotCard = player.field[slotIndex];
  if (slotCard?.alive) return { success: false, message: 'Slot is occupied' };

  const handIdx = player.battleHand.findIndex((c) => c.instanceId === handCardId);
  if (handIdx < 0) return { success: false };
  const card = player.battleHand[handIdx];
  if (!card) return { success: false };

  if (slotCard?.instanceId) cancelDeathPipelineForCard(game, slotCard.instanceId);

  card.role = 'field';
  player.field[slotIndex] = card;
  player.battleHand.splice(handIdx, 1);
  player.replacementsUsed += 1;
  markPoisonedIfActive(game, card, player);
  game.pendingReplacement = null;
  pushBattleLog(game, formatDeployLog('You', card, slotIndex, player.replacementsUsed, player.maxReplacements));
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

function getReadyAttackers(player) {
  return getFieldCards(player).filter((c) => canCardAttack(c, player));
}

function findFieldSlot(player, card) {
  if (player.boss?.instanceId === card.instanceId) return 'boss';
  const idx = (player.field || []).findIndex((c) => c?.instanceId === card.instanceId);
  return idx >= 0 ? idx : null;
}

function clearDeadFieldSlot(player, card) {
  if (card.role !== 'field') return;
  const idx = (player.field || []).findIndex((c) => c?.instanceId === card.instanceId);
  if (idx >= 0) player.field[idx] = null;
}

function getActiveFighterDebuffs(card, battleElapsed) {
  return (card.fighterDebuffs || []).filter((debuff) => debuff.expiresAt > battleElapsed);
}

function hasActiveFighterDebuff(card, type, battleElapsed) {
  return getActiveFighterDebuffs(card, battleElapsed).some((debuff) => debuff.type === type);
}

function pruneExpiredFighterDebuffs(card, battleElapsed) {
  if (!card?.fighterDebuffs?.length) return;
  card.fighterDebuffs = card.fighterDebuffs.filter((debuff) => debuff.expiresAt > battleElapsed);
}

function applyFighterSlowEffect(target, doubled) {
  const bonus = doubled
    ? FIGHTER_ABILITY_CONFIG.slow.timerBonus * 2
    : FIGHTER_ABILITY_CONFIG.slow.timerBonus;
  target.cooldown = (target.cooldown || 0) + bonus;
}

function addFighterDebuff(game, target, type, doubled) {
  const battleElapsed = game.battleElapsed || 0;
  if (hasActiveFighterDebuff(target, type, battleElapsed)) return false;

  const debuff = {
    type,
    expiresAt: battleElapsed + FIGHTER_DEBUFF_DURATION,
    tickCounter: 0,
    doubled: !!doubled,
    slowApplied: false,
  };

  if (type === 'slow') {
    applyFighterSlowEffect(target, doubled);
    debuff.slowApplied = true;
  }

  if (!target.fighterDebuffs) target.fighterDebuffs = [];
  target.fighterDebuffs.push(debuff);
  return true;
}

function applyFighterSpecialAbility(game, attacker, defender) {
  if (!attacker?.specialAbility || attacker.role !== 'field') return null;
  if ((attacker.level ?? 0) < FIGHTER_ABILITY_UNLOCK_LEVEL) return null;

  const ability = attacker.specialAbility;
  const doubled = isFighterAbilityDoubled(attacker.level ?? 0);
  const applied = addFighterDebuff(game, defender, ability, doubled);
  if (!applied) return null;

  const label = getFighterAbilityLabel(ability);
  return `${attacker.name}'s ${label} affects ${defender.name} for ${FIGHTER_DEBUFF_DURATION}s`;
}

function getAdjacentFieldCards(player, card) {
  const slotIndex = getFieldSlotIndex(player, card);
  if (slotIndex < 0) return [];
  return getAdjacentFieldSlotIndices(slotIndex)
    .map((idx) => player.field?.[idx])
    .filter((c) => c?.alive);
}

function applyFighterDebuffStatLoss(card, { hpLoss = 0, defenseLoss = 0, attackLoss = 0 }) {
  let killed = false;
  if (hpLoss > 0) {
    killed = applyFlatDamage(card, hpLoss);
  }
  if (defenseLoss > 0) {
    card.defense = Math.max(0, Math.round(card.defense) - defenseLoss);
  }
  if (attackLoss > 0) {
    card.attack = Math.max(0, Math.round(card.attack) - attackLoss);
  }
  return killed;
}

function handleFighterDebuffDeath(game, card, player) {
  pushBattleLog(game, formatKillLog(card));
  if (card.role === 'field') {
    const idx = (player.field || []).findIndex((c) => c?.instanceId === card.instanceId);
    if (idx >= 0) {
      player.field[idx] = null;
      maybeSetPendingReplacement(game, player, idx);
      if (player.id === 'npc') runNpcReplaceAfterSlotClear(game);
    }
  }
  syncPoisonForPlayer(game, player);
}

function tickFighterDebuffs(game) {
  const battleElapsed = game.battleElapsed || 0;
  let anyKilled = false;

  for (const player of game.players) {
    for (const card of getFieldCards(player)) {
      pruneExpiredFighterDebuffs(card, battleElapsed);
      const debuffs = getActiveFighterDebuffs(card, battleElapsed);
      if (!debuffs.length) continue;

      for (const debuff of debuffs) {
        const config = FIGHTER_ABILITY_CONFIG[debuff.type];
        if (!config?.interval) continue;

        debuff.tickCounter = (debuff.tickCounter || 0) + 1;
        if (debuff.tickCounter < config.interval) continue;
        debuff.tickCounter = 0;

        const multiplier = debuff.doubled ? 2 : 1;

        if (debuff.type === 'fire') {
          const adjacent = getAdjacentFieldCards(player, card);
          for (const adjacentCard of adjacent) {
            const hpLoss = multiplier;
            const defenseLoss = multiplier;
            const hpBefore = adjacentCard.hp;
            const killed = applyFighterDebuffStatLoss(adjacentCard, { hpLoss, defenseLoss });
            pushBattleLog(
              game,
              `Fire: ${adjacentCard.name} loses ${defenseLoss} DEF and ${hpLoss} HP (${hpBefore} → ${adjacentCard.hp} HP)`,
            );
            if (killed) {
              handleFighterDebuffDeath(game, adjacentCard, player);
              anyKilled = true;
            }
          }
        } else if (debuff.type === 'poison') {
          const hpLoss = multiplier;
          const hpBefore = card.hp;
          const killed = applyFighterDebuffStatLoss(card, { hpLoss });
          pushBattleLog(
            game,
            `Poison: ${card.name} loses ${hpLoss} HP (${hpBefore} → ${card.hp} HP)`,
          );
          if (killed) {
            handleFighterDebuffDeath(game, card, player);
            anyKilled = true;
          }
        } else if (debuff.type === 'rust') {
          const defenseLoss = multiplier;
          const defBefore = card.defense;
          applyFighterDebuffStatLoss(card, { defenseLoss });
          pushBattleLog(
            game,
            `Rust: ${card.name} loses ${defenseLoss} DEF (${defBefore} → ${card.defense})`,
          );
        } else if (debuff.type === 'blunt') {
          const attackLoss = (config.attackLoss || 3) * multiplier;
          const atkBefore = card.attack;
          applyFighterDebuffStatLoss(card, { attackLoss });
          pushBattleLog(
            game,
            `Blunt: ${card.name} loses ${attackLoss} ATK (${atkBefore} → ${card.attack})`,
          );
        }
      }
    }
  }

  return anyKilled;
}

function sanitizeFighterDebuffs(card, battleElapsed) {
  return getActiveFighterDebuffs(card, battleElapsed).map((debuff) => ({
    type: debuff.type,
    remaining: Math.max(0, debuff.expiresAt - battleElapsed),
    doubled: !!debuff.doubled,
  }));
}

function sanitize(card, revealed, battleElapsed = 0) {
  if (!revealed) return { hidden: true };
  if (!card) return null;
  return {
    instanceId: card.instanceId,
    name: card.name,
    attack: card.attack,
    defense: card.defense,
    hp: card.hp,
    maxHp: card.maxHp,
    cooldown: card.cooldown,
    cooldownElapsed: card.cooldownElapsed,
    role: card.role,
    alive: card.alive,
    type: card.type,
    poisoned: !!card.poisoned,
    level: card.level ?? 0,
    isBase: !!card.isBase,
    specialAbility: card.specialAbility || null,
    fighterDebuffs: sanitizeFighterDebuffs(card, battleElapsed),
    bossLocked: false,
  };
}

function findFieldCard(game, instanceId) {
  for (const player of game.players) {
    if (player.boss?.instanceId === instanceId) return { card: player.boss, player };
    for (const c of player.field || []) {
      if (c?.instanceId === instanceId) return { card: c, player };
    }
  }
  return null;
}

function isBattlePaused(game) {
  return !!(game.userPaused || game.attackAnimation || game.deathAnimation);
}

function areBattleTimersPaused(game) {
  return !!(game.attackAnimation || game.deathAnimation);
}

function resetAttackerCooldowns(attackers) {
  for (const attacker of attackers || []) {
    if (attacker) attacker.cooldownElapsed = 0;
  }
}

function handCardDeployScore(card) {
  return (card.attack || 0) * 3 + (card.defense || 0) + (card.maxHp || 0);
}

function pickBestHandCardForDeploy(hand) {
  if (!hand?.length) return null;
  return hand.reduce(
    (best, card) => (handCardDeployScore(card) > handCardDeployScore(best) ? card : best),
    hand[0],
  );
}

function freezeAnimationTimeouts(game) {
  if (game.attackTimeout && game.attackAnimation) {
    clearTimeout(game.attackTimeout);
    game.attackTimeout = null;
    const elapsed = Date.now() - (game.attackAnimation.startedAt || Date.now());
    game.attackAnimation.remainingMs = Math.max(0, (game.attackAnimation.durationMs || 0) - elapsed);
  }
  if (game.deathTimeout && game.deathAnimation) {
    clearTimeout(game.deathTimeout);
    game.deathTimeout = null;
    const elapsed = Date.now() - (game.deathAnimation.startedAt || Date.now());
    game.deathAnimation.remainingMs = Math.max(0, (game.deathAnimation.durationMs || 0) - elapsed);
  }
}

function resumeAnimationTimeouts(game) {
  if (game.attackAnimation?.remainingMs != null) {
    const remaining = game.attackAnimation.remainingMs;
    game.attackAnimation.startedAt = Date.now();
    game.attackAnimation.durationMs = remaining;
    delete game.attackAnimation.remainingMs;
    game.attackTimeout = setTimeout(() => completeAttackAnimation(game), remaining);
  }
  if (game.deathAnimation?.remainingMs != null) {
    const remaining = game.deathAnimation.remainingMs;
    game.deathAnimation.startedAt = Date.now();
    game.deathAnimation.durationMs = remaining;
    delete game.deathAnimation.remainingMs;
    game.deathTimeout = setTimeout(() => completeDeathAnimation(game), remaining);
  }
}

function rescaleAnimationTimeouts(game, oldSpeed, newSpeed) {
  if (oldSpeed === newSpeed) return;

  if (game.userPaused) {
    if (game.attackAnimation?.remainingMs != null) {
      game.attackAnimation.remainingMs = Math.max(1, Math.round(game.attackAnimation.remainingMs * oldSpeed / newSpeed));
      game.attackAnimation.durationMs = game.attackAnimation.remainingMs;
    }
    if (game.deathAnimation?.remainingMs != null) {
      game.deathAnimation.remainingMs = Math.max(1, Math.round(game.deathAnimation.remainingMs * oldSpeed / newSpeed));
      game.deathAnimation.durationMs = game.deathAnimation.remainingMs;
      if (game.deathAnimation.shakeMs != null) {
        game.deathAnimation.shakeMs = Math.max(1, Math.round(game.deathAnimation.shakeMs * oldSpeed / newSpeed));
      }
    }
    return;
  }

  if (game.attackTimeout && game.attackAnimation) {
    clearTimeout(game.attackTimeout);
    const elapsed = Date.now() - (game.attackAnimation.startedAt || Date.now());
    const remaining = Math.max(1, Math.round((ATTACK_ANIM_MS - elapsed * oldSpeed) / newSpeed));
    game.attackAnimation.durationMs = remaining;
    game.attackAnimation.startedAt = Date.now();
    game.attackTimeout = setTimeout(() => completeAttackAnimation(game), remaining);
  }

  if (game.deathTimeout && game.deathAnimation) {
    clearTimeout(game.deathTimeout);
    const elapsed = Date.now() - (game.deathAnimation.startedAt || Date.now());
    const remaining = Math.max(1, Math.round((DEATH_ANIMATION_MS - elapsed * oldSpeed) / newSpeed));
    game.deathAnimation.durationMs = remaining;
    game.deathAnimation.shakeMs = Math.max(1, Math.round((DEATH_SHAKE_MS - elapsed * oldSpeed) / newSpeed));
    game.deathAnimation.startedAt = Date.now();
    game.deathTimeout = setTimeout(() => completeDeathAnimation(game), remaining);
  }

  if (game.poisonAnimTimeout && game.poisonPhase === 'animating') {
    clearTimeout(game.poisonAnimTimeout);
    const tier = game.poisonAnimTier ?? 1;
    const elapsed = Date.now() - (game.poisonAnimStartedAt || Date.now());
    const remaining = Math.max(1, Math.round((POISON_ANIM_MS - elapsed * oldSpeed) / newSpeed));
    game.poisonAnimStartedAt = Date.now();
    game.poisonAnimTimeout = setTimeout(() => completePoisonAnimation(game, tier), remaining);
  }
}

function clearOrphanedDeadFieldSlots(game, player) {
  for (let i = 0; i < (player?.field || []).length; i++) {
    const card = player.field[i];
    if (card && !card.alive && !isCardInDeathPipeline(game, card.instanceId)) {
      player.field[i] = null;
    }
  }
}

function enqueueDeathAnimation(game, instanceId, role) {
  if (!game.deathQueue) game.deathQueue = [];
  if (game.deathQueue.some((entry) => entry.instanceId === instanceId)) return;
  if (game.deathAnimation?.instanceId === instanceId) return;
  game.deathQueue.push({ instanceId, role });
  if (!game.deathAnimation) startNextDeathAnimation(game);
}

function startNextDeathAnimation(game) {
  if (!game.deathQueue?.length) return;

  const next = game.deathQueue.shift();
  const deathDurationMs = scaleMs(DEATH_ANIMATION_MS, game);
  const deathShakeMs = scaleMs(DEATH_SHAKE_MS, game);
  game.deathAnimation = {
    instanceId: next.instanceId,
    role: next.role,
    durationMs: deathDurationMs,
    shakeMs: deathShakeMs,
    startedAt: Date.now(),
  };
  if (game.deathTimeout) clearTimeout(game.deathTimeout);
  game.deathTimeout = setTimeout(() => completeDeathAnimation(game), deathDurationMs);
}

function completeDeathAnimation(game) {
  const anim = game.deathAnimation;
  if (!anim) {
    if (game.deathQueue?.length) startNextDeathAnimation(game);
    return;
  }

  const ref = findFieldCard(game, anim.instanceId);
  let clearedSlotIndex = null;
  if (ref?.card?.role === 'field') {
    const idx = (ref.player.field || []).findIndex((c) => c?.instanceId === ref.card.instanceId);
    if (idx >= 0) {
      clearedSlotIndex = idx;
      ref.player.field[idx] = null;
    }
  }

  game.deathAnimation = null;
  if (game.deathTimeout) {
    clearTimeout(game.deathTimeout);
    game.deathTimeout = null;
  }

  for (const player of game.players) {
    clearOrphanedDeadFieldSlots(game, player);
    syncPoisonForPlayer(game, player);
  }

  runNpcReplaceAfterSlotClear(game);

  if (clearedSlotIndex !== null && ref?.player?.id === 'player') {
    maybeSetPendingReplacement(game, ref.player, clearedSlotIndex);
  }

  const w = checkWinner(game.players[0], game.players[1]);
  if (w) finishOffline(game, w);
  else {
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
    if (game.deathQueue?.length) {
      startNextDeathAnimation(game);
      return;
    }
    processPendingActions(game);
  }
}

function applyFlatDamage(card, amount) {
  if (!card?.alive || amount <= 0) return false;
  card.hp -= amount;
  if (card.hp <= 0) {
    card.hp = 0;
    card.alive = false;
    return true;
  }
  return false;
}

function getFieldSlotIndex(player, card) {
  if (!player?.field || !card || card.role === 'boss') return -1;
  return player.field.findIndex((c) => c?.instanceId === card.instanceId);
}

function getAdjacentFieldSlotIndices(slotIndex) {
  if (slotIndex === 0) return [1];
  if (slotIndex === 1) return [0, 2];
  if (slotIndex === 2) return [1];
  return [];
}

function pickRandomAlive(cards) {
  const alive = (cards || []).filter((c) => c?.alive);
  if (!alive.length) return null;
  return alive[Math.floor(Math.random() * alive.length)];
}

function completeAttackAnimation(game) {
  const anim = game.attackAnimation;
  if (!anim) return;

  const defenderRef = findFieldCard(game, anim.defenderInstanceId);
  const attackerRefs = anim.isChainAttack
    ? (anim.attackerInstanceIds || [])
      .map((id) => findFieldCard(game, id))
      .filter((ref) => ref?.card?.alive)
    : [findFieldCard(game, anim.attackerInstanceId)].filter((ref) => ref?.card?.alive);

    if (attackerRefs.length && defenderRef?.card) {
    if (anim.damage > 0) {
      defenderRef.card.hp -= anim.damage;
    }
    const killed = anim.damage > 0 && defenderRef.card.hp <= 0;
    if (killed) {
      defenderRef.card.hp = 0;
      defenderRef.card.alive = false;
      pushBattleLog(game, formatKillLog(defenderRef.card));
    }
    resetAttackerCooldowns(attackerRefs.map((ref) => ref.card));

    if (!anim.isChainAttack && attackerRefs.length === 1) {
      const defenderAlive = defenderRef.card.alive && defenderRef.card.hp > 0;
      if (defenderAlive) {
        const abilityMsg = applyFighterSpecialAbility(game, attackerRefs[0].card, defenderRef.card);
        if (abilityMsg) pushBattleLog(game, abilityMsg);
      }
    }

    if (killed) {
      enqueueDeathAnimation(game, defenderRef.card.instanceId, defenderRef.card.role);
    }
  }

  game.attackAnimation = null;
  if (game.attackTimeout) {
    clearTimeout(game.attackTimeout);
    game.attackTimeout = null;
  }

  if (game.deathAnimation) {
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
    return;
  }

  const w = checkWinner(game.players[0], game.players[1]);
  if (w) finishOffline(game, w);
  else {
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
    processPendingActions(game);
  }
}

function beginAttackAnimation(game, attacker, defender, logPrefix) {
  if (isBattlePaused(game)) return { success: false, message: 'Attack in progress' };
  const owner = game.players.find((p) => p.boss?.instanceId === attacker.instanceId || (p.field || []).some((c) => c?.instanceId === attacker.instanceId));
  if (!owner || !canCardAttack(attacker, owner)) return { success: false, message: 'Cannot attack yet' };

  const damage = calculateAttackDamage(attacker, defender);
  const durationMs = getAttackAnimationMs(game);
  pushBattleLog(game, formatSingleAttackLog(logPrefix, attacker, defender, damage));
  resetAttackerCooldowns([attacker]);
  game.attackAnimation = {
    attackerInstanceId: attacker.instanceId,
    defenderInstanceId: defender.instanceId,
    damage,
    durationMs,
    startedAt: Date.now(),
  };

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));

  game.attackTimeout = setTimeout(() => completeAttackAnimation(game), durationMs);
  return { success: true, damage, pending: true };
}

function beginChainAttackAnimation(game, attackers, defender, logPrefix, ownerPlayer = null) {
  if (isBattlePaused(game)) return { success: false, message: 'Attack in progress' };
  if (!attackers?.length || attackers.length < 2) {
    return { success: false, message: 'Need at least 2 ready fighters for a chain attack' };
  }

  const owner = ownerPlayer || game.players.find(
    (p) => p.boss?.instanceId === attackers[0].instanceId
      || (p.field || []).some((c) => c?.instanceId === attackers[0].instanceId),
  ) || game.players[0];
  const readyIds = new Set(getReadyFieldFighters(owner).map((c) => c.instanceId));
  if (!attackers.every((a) => readyIds.has(a.instanceId))) {
    return { success: false, message: 'All fighters must be ready for a chain attack' };
  }

  const damage = calculateChainAttackDamage(attackers, defender);
  const durationMs = getAttackAnimationMs(game);
  game.attackAnimation = {
    attackerInstanceId: attackers[0].instanceId,
    attackerInstanceIds: attackers.map((a) => a.instanceId),
    defenderInstanceId: defender.instanceId,
    damage,
    isChainAttack: true,
    chainCount: attackers.length,
    durationMs,
    startedAt: Date.now(),
  };

  pushBattleLog(game, formatChainAttackLog(logPrefix, attackers, defender, damage));
  resetAttackerCooldowns(attackers);

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));

  game.attackTimeout = setTimeout(() => completeAttackAnimation(game), durationMs);
  return { success: true, damage, pending: true };
}

function checkWinner(p1, p2) {
  if (!p1.boss?.alive) return p2.id;
  if (!p2.boss?.alive) return p1.id;
  return null;
}

function drawCardForPlayer(game, player, logPrefix) {
  if (!canDrawBattleCard(player)) return false;
  const nextIdx = player.deck.findIndex((entry) => getTemplate(entry.templateId));
  if (nextIdx < 0) return false;
  const [next] = player.deck.splice(nextIdx, 1);
  const card = makeBattleCard(next.templateId, next.instanceId);
  if (!card) return false;

  player.battleHand.push(card);
  player.drawTimer = 0;
  pushBattleLog(game, formatDrawLog(logPrefix, card));
  return true;
}

function tryReplaceFromHand(game, player) {
  const deployed = [];
  while (canDeployFighter(player)) {
    const emptySlot = (player.field || []).findIndex((c) => !c || !c.alive);
    if (emptySlot < 0) break;
    const slotCard = player.field[emptySlot];
    const fighter = pickBestHandCardForDeploy(player.battleHand);
    if (!fighter) break;

    if (slotCard?.instanceId) cancelDeathPipelineForCard(game, slotCard.instanceId);

    fighter.role = 'field';
    player.field[emptySlot] = fighter;
    player.battleHand = player.battleHand.filter((c) => c.instanceId !== fighter.instanceId);
    player.replacementsUsed += 1;
    markPoisonedIfActive(game, fighter, player);
    deployed.push({ card: fighter, slotIndex: emptySlot });
  }
  return deployed;
}

function runNpcReplace(game) {
  const npc = game.players[1];
  const deployed = tryReplaceFromHand(game, npc);
  for (const replaced of deployed) {
    pushBattleLog(game, formatDeployLog('CPU', replaced.card, replaced.slotIndex, npc.replacementsUsed, npc.maxReplacements));
  }
  return deployed;
}

function runNpcReplaceAfterSlotClear(game) {
  runNpcReplace(game);
}

function markPoisonedIfActive(game, card, player) {
  if (game.poisonPhase !== 'active') return;
  if (getActiveFieldCards(player).some((c) => c.instanceId === card.instanceId)) {
    card.poisoned = true;
  }
}

function toPrivateState(game, playerId) {
  const me = game.players.find((p) => p.id === playerId);
  const opp = game.players.find((p) => p.id !== playerId);
  const hideSetup = game.phase === 'setup';
  const battleElapsed = game.battleElapsed || 0;
  const bossCanAttack = canBossAttack(me);
  const opponentBossCanAttack = canBossAttack(opp);

  if (!canDeployFighter(me)) game.pendingReplacement = null;

  return {
    id: game.id,
    mode: 'npc',
    phase: game.phase,
    players: game.players.map((p) => ({
      id: p.id,
      username: p.username,
      setupComplete: p.setupComplete,
      boss: p.boss ? sanitize(p.boss, game.phase !== 'setup', battleElapsed) : null,
      field: (p.field || []).map((c) => (c ? sanitize(c, game.phase !== 'setup', battleElapsed) : null)),
      deckRemaining: p.deck.length,
      isWinner: p.isWinner,
      replacementsUsed: p.replacementsUsed,
      maxReplacements: p.maxReplacements,
      drawTimer: p.drawTimer,
      drawTimerMax: p.drawTimerMax,
      drawReady: p.drawTimer >= p.drawTimerMax && canDrawBattleCard(p),
    })),
    log: [...game.log],
    gamePaused: !!game.userPaused,
    gameSpeed: getSpeedMultiplier(game),
    winnerId: game.winnerId,
    battleElapsed: game.battleElapsed || 0,
    poisonPhase: game.poisonPhase || null,
    poisonDamage: getPoisonDamage(game),
    poisonAnimation: game.poisonPhase === 'animating',
    attackAnimation: game.attackAnimation ? { ...game.attackAnimation } : null,
    deathAnimation: game.deathAnimation ? { ...game.deathAnimation } : null,
    pendingPlayerActions: (game.pendingPlayerActions || []).map((action) => ({ ...action })),
    pendingReplacement: game.pendingReplacement ? { ...game.pendingReplacement } : null,
    timersPaused: isBattlePaused(game) && !game.userPaused,
    myHand: me.setupHand.map((c) => ({ ...c })),
    myBattleHand: me.battleHand.map((c) => ({ ...c })),
    oppBattleHand: opp.battleHand.map((c) => ({ ...c })),
    myBoss: me.boss ? { ...me.boss, bossLocked: !bossCanAttack } : null,
    myField: (me.field || []).map((c) => (c ? { ...c } : null)),
    replacementsUsed: me.replacementsUsed,
    maxReplacements: me.maxReplacements,
    drawTimer: me.drawTimer,
    drawTimerMax: me.drawTimerMax,
    drawReady: canDrawBattleCard(me),
    deckRemaining: me.deck.length,
    bossCanAttack,
    opponentBossCanAttack,
    canDeployFighter: canDeployFighter(me),
    battleElapsed: game.battleElapsed || 0,
    bossPhase: isBossPhase(game),
    opponent: {
      id: opp.id,
      username: opp.username,
      setupComplete: opp.setupComplete,
      boss: hideSetup ? null : (opp.boss ? { ...sanitize(opp.boss, true, battleElapsed), bossLocked: !opponentBossCanAttack } : null),
      field: hideSetup ? [] : (opp.field || []).map((c) => (c ? sanitize(c, true, battleElapsed) : null)),
      deckRemaining: opp.deck.length,
      replacementsUsed: opp.replacementsUsed,
      drawTimer: opp.drawTimer,
      drawTimerMax: opp.drawTimerMax,
    },
  };
}

export function createOfflineGame(deckIds) {
  instanceCounter = 0;
  const npcDeckIds = buildNpcDeckFromPlayerDeck(deckIds);
  const game = {
    id: 'offline_' + Date.now(),
    mode: 'npc',
    phase: 'setup',
    players: [
      createPlayer('player', 'You', deckIds),
      createPlayer('npc', 'CPU Opponent', npcDeckIds),
    ],
    log: [],
    winnerId: null,
    attackAnimation: null,
    attackTimeout: null,
    deathAnimation: null,
    deathTimeout: null,
    deathQueue: [],
    pendingReplacement: null,
    pendingPlayerActions: [],
    battleElapsed: 0,
    poisonPhase: null,
    poisonDamage: POISON_DAMAGE,
    poisonTier2Triggered: false,
    poisonTickCounter: 0,
    poisonAnimTimeout: null,
    speedMultiplier: 1,
  };
  return game;
}

export function offlineSetup(game, bossId, fieldIds) {
  const player = game.players[0];
  const hand = [...player.setupHand];
  const boss = hand.find((c) => c.instanceId === bossId);
  const field = fieldIds.map((id) => hand.find((c) => c.instanceId === id)).filter(Boolean);
  if (!boss || field.length !== 3) return { success: false };

  promoteToBoss(boss);
  field.forEach((c) => { c.role = 'field'; });
  player.boss = boss;
  player.field = [field[0], field[1], field[2]];
  const used = new Set([bossId, ...fieldIds]);
  const unused = hand.filter((c) => !used.has(c.instanceId));
  player.deck = [
    ...unused.map((c) => ({ templateId: c.templateId, instanceId: nextInstanceId('player', c.templateId) })),
    ...player.deck,
  ];
  player.setupHand = [];
  player.setupComplete = true;

  autoNpcSetup(game);
  if (game.players.every((p) => p.setupComplete)) {
    game.phase = 'battle';
    pushBattleLog(game, 'Battle begins! Draw timer started (70s).');
    startTicks(game);
  }
  return { success: true };
}

function autoNpcSetup(game) {
  const npc = game.players[1];
  const hand = [...npc.setupHand];
  const boss = hand.reduce((b, c) => (c.maxHp > (b?.maxHp || 0) ? c : b), hand[0]);
  const field = hand.filter((c) => c.instanceId !== boss.instanceId).slice(0, 3);
  promoteToBoss(boss);
  field.forEach((c) => { c.role = 'field'; });
  npc.boss = boss;
  npc.field = [field[0], field[1], field[2]];
  const used = new Set([boss.instanceId, ...field.map((c) => c.instanceId)]);
  const unused = hand.filter((c) => !used.has(c.instanceId));
  npc.deck = [
    ...unused.map((c) => ({ templateId: c.templateId, instanceId: nextInstanceId('npc', c.templateId) })),
    ...npc.deck,
  ];
  npc.setupHand = [];
  npc.setupComplete = true;
}

function startTicks(game) {
  stopTicks();
  tickTimer = setInterval(() => {
    if (game.phase !== 'battle' || game.userPaused) return;

    const timersPaused = areBattleTimersPaused(game);
    let stateChanged = false;

    if (!timersPaused) {
      game.battleElapsed = (game.battleElapsed || 0) + 1;

      for (const p of game.players) {
        for (const c of getFieldCards(p)) {
          if (!isCardReady(c)) c.cooldownElapsed = Math.min(c.cooldown, (c.cooldownElapsed || 0) + 1);
        }
        if (p.deck.length > 0 && p.drawTimer < p.drawTimerMax) p.drawTimer += 1;
      }

      const npc = game.players[1];
      if (npc.drawTimer >= npc.drawTimerMax) {
        if (drawCardForPlayer(game, npc, 'CPU')) stateChanged = true;
      }
      if (runNpcReplace(game).length) stateChanged = true;

      runNpcAI(game);

      if (tickPoison(game)) return;

      if (tickFighterDebuffs(game)) {
        const w = checkWinner(game.players[0], game.players[1]);
        if (w) {
          finishOffline(game, w);
          return;
        }
      }

      const w = checkWinner(game.players[0], game.players[1]);
      if (w) {
        finishOffline(game, w);
        return;
      }
    } else if (runNpcReplace(game).length) {
      stateChanged = true;
      const w = checkWinner(game.players[0], game.players[1]);
      if (w) {
        finishOffline(game, w);
        return;
      }
    }

    if (stateChanged || !timersPaused) {
      if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
    }
  }, getTickIntervalMs(game));
}

function getChainAttackCombos(fighters) {
  const combos = [];
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      combos.push([fighters[i], fighters[j]]);
      for (let k = j + 1; k < fighters.length; k++) {
        combos.push([fighters[i], fighters[j], fighters[k]]);
      }
    }
  }
  return combos;
}

function pickBestNpcAttack(game, npc, human) {
  const readyAll = getReadyAttackers(npc);
  const readyFighters = getReadyFieldFighters(npc);
  const targets = getAttackableTargets(human);
  if (!readyAll.length || !targets.length) return null;

  const defender = targets.reduce((best, t) => (t.hp < best.hp ? t : best), targets[0]);
  let bestSingle = null;
  let bestSingleDamage = -1;
  let bestChain = null;
  let bestChainDamage = -1;

  for (const attacker of readyAll) {
    const damage = calculateAttackDamage(attacker, defender);
    if (damage > bestSingleDamage) {
      bestSingleDamage = damage;
      bestSingle = { type: 'single', attacker, defender };
    }
  }

  if (readyFighters.length >= 2) {
    for (const attackers of getChainAttackCombos(readyFighters)) {
      const damage = calculateChainAttackDamage(attackers, defender);
      if (damage > bestChainDamage) {
        bestChainDamage = damage;
        bestChain = { type: 'chain', attackers, defender };
      }
    }
  }

  if (bestChain && bestChainDamage > 0) {
    const chainIsBest = bestChainDamage >= bestSingleDamage;
    const chainIsCompetitive = bestSingleDamage <= 0 || bestChainDamage >= bestSingleDamage * 0.65;
    const mixInChain = chainIsBest || (chainIsCompetitive && Math.random() < 0.4);
    if (mixInChain) return bestChain;
  }

  return bestSingle;
}

function runNpcAI(game) {
  if (isBattlePaused(game)) return;
  const npc = game.players[1];
  const human = game.players[0];

  if (canDeployFighter(npc)) {
    runNpcReplace(game);
    return;
  }

  const action = pickBestNpcAttack(game, npc, human);
  if (!action) return;

  if (action.type === 'chain') {
    beginChainAttackAnimation(game, action.attackers, action.defender, 'CPU', npc);
    return;
  }

  beginAttackAnimation(game, action.attacker, action.defender, 'CPU');
}

function finishOffline(game, winnerId) {
  game.phase = 'finished';
  game.winnerId = winnerId;
  const w = game.players.find((p) => p.id === winnerId);
  if (w) w.isWinner = true;
  pushBattleLog(game, `${w?.username} wins!`);
  if (game.poisonAnimTimeout) {
    clearTimeout(game.poisonAnimTimeout);
    game.poisonAnimTimeout = null;
  }
  clearBattleAnimations(game);
  stopTicks();
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
}

function clearDeathAnimation(game) {
  if (game?.deathTimeout) {
    clearTimeout(game.deathTimeout);
    game.deathTimeout = null;
  }
  if (game) {
    game.deathAnimation = null;
    game.deathQueue = [];
  }
}

export function clearBattleAnimations(game) {
  clearAttackAnimation(game);
  clearDeathAnimation(game);
  if (game) game.pendingPlayerActions = [];
}

export function offlineDrawCard(game) {
  const player = game.players[0];
  if (!canDrawBattleCard(player)) {
    if (canBossAttack(player)) {
      return { success: false, message: 'Boss is fighting alone' };
    }
    if (player.drawTimer < player.drawTimerMax || !player.deck.length) {
      return { success: false, message: 'Cannot draw yet' };
    }
    if (player.battleHand.length >= MAX_BATTLE_HAND_SIZE) {
      return { success: false, message: 'Hand is full' };
    }
    return { success: false, message: 'Cannot draw yet' };
  }
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'draw' });
  }
  const drew = drawCardForPlayer(game, player, 'You');
  if (!drew) return { success: false, message: 'Cannot draw yet' };
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

export function offlineReplace(game, handCardId, slotIndex) {
  const player = game.players[0];
  if (!canDeployFighter(player)) {
    return { success: false, message: canBossAttack(player) ? 'Boss is fighting alone' : 'Cannot deploy' };
  }
  if (isBattlePaused(game)) {
    if (player.replacementsUsed >= player.maxReplacements) {
      return { success: false, message: 'No replacements left' };
    }
    if (slotIndex < 0 || slotIndex > 2) return { success: false };
    const slotCard = player.field[slotIndex];
    if (slotCard?.alive) return { success: false, message: 'Slot is occupied' };
    if (!player.battleHand.some((c) => c.instanceId === handCardId)) {
      return { success: false };
    }
    return queuePlayerAction(game, { type: 'replace', handCardId, slotIndex });
  }
  return executePlayerReplace(game, handCardId, slotIndex);
}

export function offlineDismissReplacement(game) {
  if (!game?.pendingReplacement) return { success: false };
  game.pendingReplacement = null;
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

export function offlineAttack(game, attackerId, defenderId) {
  const player = game.players[0];
  const opp = game.players[1];
  const attacker = getFieldCards(player).find((c) => c.instanceId === attackerId);
  const defender = getFieldCards(opp).find((c) => c.instanceId === defenderId);
  if (!attacker || !defender?.alive) return { success: false };
  if (!canCardAttack(attacker, player)) return { success: false, message: 'Cannot attack yet' };
  if (!getAttackableTargets(opp).some((c) => c.instanceId === defenderId)) {
    return { success: false, message: 'Boss is protected until all fighters are defeated' };
  }
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'attack', attackerId, defenderId });
  }
  return beginAttackAnimation(game, attacker, defender, 'You');
}

export function offlineChainAttack(game, attackerIds, defenderId) {
  const player = game.players[0];
  const opp = game.players[1];
  const readyFighters = getReadyFieldFighters(player);
  const readyIds = new Set(readyFighters.map((c) => c.instanceId));
  const attackers = (attackerIds || [])
    .map((id) => readyFighters.find((c) => c.instanceId === id))
    .filter(Boolean);

  if (attackers.length < 2) {
    return { success: false, message: 'Need at least 2 ready fighters for a chain attack' };
  }
  if (!attackers.every((a) => readyIds.has(a.instanceId))) {
    return { success: false, message: 'All chain attackers must be ready' };
  }

  const defender = getFieldCards(opp).find((c) => c.instanceId === defenderId);
  if (!defender?.alive) return { success: false };
  if (!getAttackableTargets(opp).some((c) => c.instanceId === defenderId)) {
    return { success: false, message: 'Boss is protected until all fighters are defeated' };
  }

  if (isBattlePaused(game)) {
    return queuePlayerAction(game, {
      type: 'chainAttack',
      attackerIds: attackers.map((a) => a.instanceId),
      defenderId,
    });
  }
  return beginChainAttackAnimation(game, attackers, defender, 'You');
}

export function stopTicks() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
}

export function clearAttackAnimation(game) {
  if (game?.attackTimeout) {
    clearTimeout(game.attackTimeout);
    game.attackTimeout = null;
  }
  if (game) game.attackAnimation = null;
}

export function getOfflineState(game) {
  return toPrivateState(game, 'player');
}

export function toggleOfflinePause(game) {
  if (!game || game.phase !== 'battle' || game.winnerId) {
    return { success: false, paused: !!game?.userPaused };
  }

  game.userPaused = !game.userPaused;
  if (game.userPaused) {
    freezeAnimationTimeouts(game);
  } else {
    resumeAnimationTimeouts(game);
    processPendingActions(game);
  }

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true, paused: game.userPaused };
}

export function toggleGameSpeed(game) {
  if (!game || game.phase !== 'battle' || game.winnerId) {
    return { success: false, speed: getSpeedMultiplier(game) };
  }

  const oldSpeed = getSpeedMultiplier(game);
  game.speedMultiplier = oldSpeed === 3 ? 1 : 3;
  const newSpeed = game.speedMultiplier;

  rescaleAnimationTimeouts(game, oldSpeed, newSpeed);
  startTicks(game);

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true, speed: newSpeed };
}

export { CARD_DATA, CARD_TIMER_MIN, CARD_TIMER_MAX, PLAY_DECK_SIZE, getTimerPreview, CATALOG_VERSION };
