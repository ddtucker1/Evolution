import {
  calculateBattleTimer,
  getTimerPreview,
  isBaseCardId,
  generateRandomBaseStats,
  statTripleKey,
  CATALOG_SIZE,
  MAX_LIBRARY_SIZE,
} from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import { previewCombine, getCardAbilities } from './combineEngine.js';
import { COMBINE_TICK_INTERVAL, getAbilityDisplayName } from '../../shared/combineRules.js';

const CATALOG_VERSION = 3;
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
const CARD_TIMER_MIN = Math.min(...baseAttacks) * 2 - 2;
const CARD_TIMER_MAX = Math.max(...baseAttacks) * 2 + 2;

const DRAW_TIMER_MAX = 70;
const DEATH_ANIMATION_MS = 6000;
const DEATH_SHAKE_MS = 3000;
const PLAY_DECK_SIZE = 10;
const MAX_REPLACEMENTS = 3;
const ATTACK_ANIM_MS = 4000;
const EFFECT_DURATION_MS = 2 * 60 * 1000;
const BOSS_PHASE2_TIME = 4 * 60;
const BOSS_POISON_DURATION_MS = 60 * 1000;

const LOOKUP = new Map();
for (const c of CARD_DATA.unique) LOOKUP.set(c.id, c);

let tickTimer = null;
let instanceCounter = 0;

function nextInstanceId(prefix, templateId) {
  instanceCounter += 1;
  return `${templateId}_${prefix}_${instanceCounter}`;
}

function getTemplate(id) { return LOOKUP.get(id); }

export function registerEvolvedCards(cards) {
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

function getAttackAnimationMs() {
  return ATTACK_ANIM_MS;
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

function makeBattleCard(templateId, instanceId) {
  const t = getTemplate(templateId);
  if (!t) return null;
  const isEvolved = templateId.startsWith('evo_');
  const attack = Math.round(t.attack);
  const defense = Math.round(t.defense);
  const maxHp = Math.round(t.hp);
  const cooldown = isEvolved && t.timer != null
    ? Math.round(t.timer)
    : calculateBattleTimer(attack);
  return {
    instanceId, templateId, name: t.name, type: 'unique',
    attack, defense,
    maxHp, hp: maxHp,
    cooldown, cooldownElapsed: 0,
    alive: true, role: null,
    abilities: getCardAbilities(t),
    periodicElapsed: 0,
    carriedEffects: [],
    isBase: isBaseCardId(templateId),
    level: t.level ?? (isEvolved ? 1 : 0),
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
    bossAbilitiesUsed: {
      slow: false, heal: false, haste: false,
      attack2x: false, defenseHalved: false, poisonAll: false,
    },
  };
}

let npcEvolvedPool = null;

function createNpcCombinedCard(card1, card2, id) {
  const preview = previewCombine(card1, card2);
  if (!preview) return null;
  const card = {
    id,
    name: preview.name,
    type: 'unique',
    attack: preview.attack,
    defense: preview.defense,
    hp: preview.hp,
    timer: preview.timer,
    level: preview.level,
    statBonus: preview.statBonus,
    abilities: preview.abilities,
    parents: preview.parents,
    combined: true,
  };
  LOOKUP.set(id, card);
  return card;
}

function getNpcEvolvedPool() {
  if (npcEvolvedPool) return npcEvolvedPool;

  const base = CARD_DATA.unique;
  const level1 = [];
  for (let i = 0; i < 3; i++) {
    const c1 = base[(i * 2) % base.length];
    const c2 = base[(i * 2 + 1) % base.length];
    const card = createNpcCombinedCard(c1, c2, `npc_evo_l1_${i}`);
    if (card) level1.push(card);
  }

  const level2 = [];
  for (let i = 0; i < 3; i++) {
    const c1 = level1[i % level1.length];
    const c2 = level1[(i + 1) % level1.length];
    const card = createNpcCombinedCard(c1, c2, `npc_evo_l2_${i}`);
    if (card) level2.push(card);
  }

  const level3 = [];
  for (let i = 0; i < 4; i++) {
    const c1 = level2[i % level2.length];
    const c2 = level2[(i + 1) % level2.length];
    const card = createNpcCombinedCard(c1, c2, `npc_evo_l3_${i}`);
    if (card) level3.push(card);
  }

  npcEvolvedPool = [...level1, ...level2, ...level3];
  return npcEvolvedPool;
}

function npcDeck() {
  const pool = getNpcEvolvedPool();
  const byLevel = {
    1: pool.filter((c) => c.level === 1),
    2: pool.filter((c) => c.level === 2),
    3: pool.filter((c) => c.level === 3),
  };
  const deck = [];
  const pattern = [1, 2, 3, 1, 2, 3, 2, 3, 1, 3];
  for (let i = 0; i < PLAY_DECK_SIZE; i++) {
    const level = pattern[i % pattern.length];
    const group = byLevel[level];
    deck.push(group[i % group.length].id);
  }
  return shuffle(deck);
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

function isBossOnlyPhase(player) {
  return player.boss?.alive && getAliveFieldFighters(player).length === 0;
}

function isBossPhase(game) {
  return game.players.some((p) => isBossOnlyPhase(p));
}

function canBossBeTargeted(player) {
  return canBossAttack(player);
}

function defaultBossAbilitiesUsed() {
  return {
    slow: false, heal: false, haste: false,
    attack2x: false, defenseHalved: false, poisonAll: false,
  };
}

function getBossMagicPhase(game) {
  return (game.battleElapsed || 0) >= BOSS_PHASE2_TIME ? 2 : 1;
}

function hasUsedBossAbilityPhase1(player) {
  const used = player.bossAbilitiesUsed;
  return !!(used?.slow || used?.heal || used?.haste);
}

function hasUsedBossAbilityPhase2(player) {
  const used = player.bossAbilitiesUsed;
  return !!(used?.attack2x || used?.defenseHalved || used?.poisonAll);
}

function hasUsedBossAbility(player, game) {
  return getBossMagicPhase(game) === 2
    ? hasUsedBossAbilityPhase2(player)
    : hasUsedBossAbilityPhase1(player);
}

function canUseBossAbility(player, game) {
  return player.boss?.alive && !hasUsedBossAbility(player, game);
}

function markBossAbilityUsed(game, player, abilityName, targetName = '') {
  if (!player.bossAbilitiesUsed) {
    player.bossAbilitiesUsed = defaultBossAbilitiesUsed();
  }
  player.bossAbilitiesUsed.slow = true;
  player.bossAbilitiesUsed.heal = true;
  player.bossAbilitiesUsed.haste = true;
  game.bossAbilityEvent = {
    playerId: player.id,
    username: player.username,
    ability: abilityName,
    targetName,
    at: Date.now(),
  };
}

function markBossAbilityUsedPhase2(player) {
  if (!player.bossAbilitiesUsed) {
    player.bossAbilitiesUsed = defaultBossAbilitiesUsed();
  }
  player.bossAbilitiesUsed.attack2x = true;
  player.bossAbilitiesUsed.defenseHalved = true;
  player.bossAbilitiesUsed.poisonAll = true;
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
    case 'bossSlow':
      return resolveBossAbility(game, game.players[0], 'slow', action.targetInstanceId);
    case 'bossHeal':
      return resolveBossAbility(game, game.players[0], 'heal');
    case 'bossHaste':
      return resolveBossAbility(game, game.players[0], 'haste', action.targetInstanceId);
    case 'bossAttack2x':
      return resolveBossAbilityPhase2(game, game.players[0], 'attack2x', action.targetInstanceId);
    case 'bossDefenseHalved':
      return resolveBossAbilityPhase2(game, game.players[0], 'defenseHalved', action.targetInstanceId);
    case 'bossPoisonAll':
      return resolveBossAbilityPhase2(game, game.players[0], 'poisonAll');
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

  card.role = 'field';
  player.field[slotIndex] = card;
  player.battleHand.splice(handIdx, 1);
  player.replacementsUsed += 1;
  game.pendingReplacement = null;
  game.log.push(`You deployed ${card.name} as a replacement (${player.replacementsUsed}/${player.maxReplacements})`);
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

function sanitize(card, revealed) {
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
    ability: card.ability || null,
    abilities: card.abilities || getCardAbilities(card),
    slowed: !!card.slowed,
    hasted: !!card.hasted,
    poisoned: !!card.poisoned,
    attackDoubled: !!card.attackDoubled,
    defenseHalved: !!card.defenseHalved,
    carriedEffects: card.carriedEffects || [],
    level: card.level ?? 0,
    isBase: !!card.isBase,
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
  return !!(game.attackAnimation || game.deathAnimation);
}

function completeDeathAnimation(game) {
  const anim = game.deathAnimation;
  if (!anim) return;

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

  if (
    clearedSlotIndex !== null
    && ref?.player?.id === 'player'
    && ref.player.battleHand.length > 0
    && ref.player.replacementsUsed < ref.player.maxReplacements
  ) {
    game.pendingReplacement = { slotIndex: clearedSlotIndex };
  }

  const w = checkWinner(game.players[0], game.players[1]);
  if (w) finishOffline(game, w);
  else {
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
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

function applyPoison(target) {
  if (!target?.alive) return;
  target.poisoned = true;
  target.poisonTicks = 0;
  target.poisonExpiresAt = Date.now() + EFFECT_DURATION_MS;
}

function clearPoisonEffect(card) {
  if (!card) return;
  card.poisoned = false;
  card.poisonTicks = 0;
  card.poisonExpiresAt = null;
}

function processEffectExpiry(game) {
  if (isBattlePaused(game)) return;

  const now = Date.now();
  for (const p of game.players) {
    for (const c of getFieldCards(p)) {
      if (!c?.alive || !c.poisoned || !c.poisonExpiresAt) continue;
      if (now >= c.poisonExpiresAt) {
        clearPoisonEffect(c);
        game.log.push(`${c.name}'s poison wore off`);
      }
    }
  }
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

function inflictCarriedEffects(target, abilities) {
  if (!target?.alive || !abilities?.length) return;
  if (!target.carriedEffects) target.carriedEffects = [];
  const existing = new Set(target.carriedEffects.map((e) => e.id));
  for (const ability of abilities) {
    if (ability.effect === 'dazed_solo_attack') continue;
    if (!ability.id || existing.has(ability.id)) continue;
    target.carriedEffects.push({
      id: ability.id,
      name: getAbilityDisplayName(ability),
    });
    existing.add(ability.id);
  }
}

function applyHealthDrain(card, amount = 1) {
  if (!card?.alive || amount <= 0) return false;
  card.hp -= amount;
  if (card.hp <= 0) {
    card.hp = 0;
    card.alive = false;
    return true;
  }
  return false;
}

function applyPeriodicAbility(game, owner, opponent, sourceCard, ability) {
  switch (ability.effect) {
    case 'health_drain_enemy': {
      const target = pickRandomAlive(getAliveFieldFighters(opponent));
      if (!target) return false;
      inflictCarriedEffects(target, [ability]);
      const killed = applyHealthDrain(target, 1);
      if (killed) game.log.push(`${sourceCard.name}'s ${ability.id} defeated ${target.name}`);
      return killed ? target : false;
    }
    case 'defense_drain_enemy': {
      const target = pickRandomAlive(getAliveFieldFighters(opponent));
      if (!target) return false;
      inflictCarriedEffects(target, [ability]);
      target.defense = Math.max(0, target.defense - 1);
      return false;
    }
    case 'fire_adjacent_enemies': {
      const slot = getFieldSlotIndex(owner, sourceCard);
      if (slot < 0) return false;
      let killedCard = null;
      for (const adj of getAdjacentFieldSlotIndices(slot)) {
        const target = opponent.field?.[adj];
        if (target?.alive) {
          inflictCarriedEffects(target, [ability]);
          if (applyHealthDrain(target, 1)) killedCard = target;
        }
      }
      if (killedCard) {
        game.log.push(`${sourceCard.name}'s Fire defeated ${killedCard.name}`);
        return killedCard;
      }
      return false;
    }
    case 'timer_increase_enemy': {
      const target = pickRandomAlive(getFieldCards(opponent));
      if (!target) return false;
      inflictCarriedEffects(target, [ability]);
      target.cooldown = (target.cooldown || 0) + 1;
      return false;
    }
    case 'vamp_steal': {
      const victim = pickRandomAlive(getAliveFieldFighters(opponent));
      if (!victim) return false;
      inflictCarriedEffects(victim, [ability]);
      const killed = applyHealthDrain(victim, 1);
      const needy = getAliveFieldFighters(owner).filter((c) => c.hp < c.maxHp);
      const healTarget = pickRandomAlive(needy);
      if (healTarget) {
        healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + 1);
      }
      if (killed) game.log.push(`${sourceCard.name}'s Vamp defeated ${victim.name}`);
      return killed ? victim : false;
    }
    default:
      return false;
  }
}

function processPeriodicAbilities(game) {
  if (isBattlePaused(game)) return false;

  for (const owner of game.players) {
    const opponent = game.players.find((p) => p.id !== owner.id);
    for (const card of getFieldCards(owner)) {
      if (!card?.alive) continue;
      card.periodicElapsed = (card.periodicElapsed || 0) + 1;
      if (card.periodicElapsed < COMBINE_TICK_INTERVAL) continue;
      card.periodicElapsed = 0;

      for (const ability of getCardAbilities(card)) {
        if (ability.effect === 'dazed_solo_attack') continue;
        const killedCard = applyPeriodicAbility(game, owner, opponent, card, ability);
        if (killedCard) return triggerPoisonDeath(game, killedCard);
      }
    }
  }
  return false;
}

function resolveDazedTarget(game, attacker, owner, defender, defenderOwner) {
  const hasDazed = getCardAbilities(attacker).some((a) => a.effect === 'dazed_solo_attack');
  if (!hasDazed || Math.random() >= 0.2) {
    return { defender, defenderOwner };
  }
  const allies = getAliveFieldFighters(owner).filter((c) => c.instanceId !== attacker.instanceId);
  if (!allies.length) return { defender, defenderOwner };
  const ally = allies[Math.floor(Math.random() * allies.length)];
  game.log.push(`${attacker.name} is dazed and strikes ${ally.name}!`);
  return { defender: ally, defenderOwner: owner };
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
    }
    for (const attackerRef of attackerRefs) {
      attackerRef.card.cooldownElapsed = 0;
      inflictCarriedEffects(defenderRef.card, getCardAbilities(attackerRef.card));
    }

    if (killed) {
      game.deathAnimation = {
        instanceId: defenderRef.card.instanceId,
        durationMs: DEATH_ANIMATION_MS,
        shakeMs: DEATH_SHAKE_MS,
      };
    }
  }

  game.attackAnimation = null;
  if (game.attackTimeout) {
    clearTimeout(game.attackTimeout);
    game.attackTimeout = null;
  }

  if (game.deathAnimation) {
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
    game.deathTimeout = setTimeout(() => completeDeathAnimation(game), DEATH_ANIMATION_MS);
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

  const defenderOwner = game.players.find((p) => p.boss?.instanceId === defender.instanceId || (p.field || []).some((c) => c?.instanceId === defender.instanceId));
  const resolved = resolveDazedTarget(game, attacker, owner, defender, defenderOwner);
  defender = resolved.defender;

  const damage = calculateAttackDamage(attacker, defender);
  const durationMs = getAttackAnimationMs();
  game.attackAnimation = {
    attackerInstanceId: attacker.instanceId,
    defenderInstanceId: defender.instanceId,
    damage,
    durationMs,
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
  const durationMs = getAttackAnimationMs();
  game.attackAnimation = {
    attackerInstanceId: attackers[0].instanceId,
    attackerInstanceIds: attackers.map((a) => a.instanceId),
    defenderInstanceId: defender.instanceId,
    damage,
    isChainAttack: true,
    chainCount: attackers.length,
    durationMs,
  };

  const bonusPct = attackers.length >= 3 ? 20 : 10;
  game.log.push(
    `${logPrefix} chain attack (${attackers.length} cards, +${bonusPct}%) → ${defender.name} for ${damage} damage`,
  );

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
  if (player.drawTimer < player.drawTimerMax || !player.deck.length) return false;
  const nextIdx = player.deck.findIndex((entry) => getTemplate(entry.templateId));
  if (nextIdx < 0) return false;
  const [next] = player.deck.splice(nextIdx, 1);
  const card = makeBattleCard(next.templateId, next.instanceId);
  if (!card) return false;

  player.battleHand.push(card);
  player.drawTimer = 0;
  game.log.push(`${logPrefix} drew ${card.name}`);
  return true;
}

function tryReplaceFromHand(player) {
  if (player.replacementsUsed >= player.maxReplacements) return false;
  const emptySlot = (player.field || []).findIndex((c) => !c || !c.alive);
  if (emptySlot < 0) return false;
  const fighter = player.battleHand[0];
  if (!fighter) return false;

  fighter.role = 'field';
  player.field[emptySlot] = fighter;
  player.battleHand = player.battleHand.filter((c) => c.instanceId !== fighter.instanceId);
  player.replacementsUsed += 1;
  return true;
}

function toPrivateState(game, playerId) {
  const me = game.players.find((p) => p.id === playerId);
  const opp = game.players.find((p) => p.id !== playerId);
  const hideSetup = game.phase === 'setup';
  const bossCanAttack = canBossAttack(me);
  const opponentBossCanAttack = canBossAttack(opp);

  return {
    id: game.id,
    mode: 'npc',
    phase: game.phase,
    players: game.players.map((p) => ({
      id: p.id,
      username: p.username,
      setupComplete: p.setupComplete,
      boss: p.boss ? sanitize(p.boss, game.phase !== 'setup') : null,
      field: (p.field || []).map((c) => (c ? sanitize(c, game.phase !== 'setup') : null)),
      deckRemaining: p.deck.length,
      isWinner: p.isWinner,
      replacementsUsed: p.replacementsUsed,
      maxReplacements: p.maxReplacements,
      drawTimer: p.drawTimer,
      drawTimerMax: p.drawTimerMax,
      drawReady: p.drawTimer >= p.drawTimerMax && p.deck.length > 0,
      bossAbilitiesUsed: { ...(p.bossAbilitiesUsed || defaultBossAbilitiesUsed()) },
    })),
    log: game.log.slice(-20),
    winnerId: game.winnerId,
    battleElapsed: game.battleElapsed || 0,
    bossMagicPhase: getBossMagicPhase(game),
    attackAnimation: game.attackAnimation ? { ...game.attackAnimation } : null,
    deathAnimation: game.deathAnimation ? { ...game.deathAnimation } : null,
    pendingPlayerActions: (game.pendingPlayerActions || []).map((action) => ({ ...action })),
    pendingReplacement: game.pendingReplacement ? { ...game.pendingReplacement } : null,
    timersPaused: isBattlePaused(game),
    myHand: me.setupHand.map((c) => ({ ...c })),
    myBattleHand: me.battleHand.map((c) => ({ ...c })),
    oppBattleHand: opp.battleHand.map((c) => ({ ...c })),
    myBoss: me.boss ? { ...me.boss, bossLocked: !bossCanAttack } : null,
    myField: (me.field || []).map((c) => (c ? { ...c } : null)),
    replacementsUsed: me.replacementsUsed,
    maxReplacements: me.maxReplacements,
    drawTimer: me.drawTimer,
    drawTimerMax: me.drawTimerMax,
    drawReady: me.drawTimer >= me.drawTimerMax && me.deck.length > 0,
    deckRemaining: me.deck.length,
    bossCanAttack,
    opponentBossCanAttack,
    bossAbilitiesUsed: { ...(me.bossAbilitiesUsed || defaultBossAbilitiesUsed()) },
    bossAbilityEvent: game.bossAbilityEvent ? { ...game.bossAbilityEvent } : null,
    bossMagicPhase: getBossMagicPhase(game),
    battleElapsed: game.battleElapsed || 0,
    bossPhase: isBossPhase(game),
    opponent: {
      id: opp.id,
      username: opp.username,
      setupComplete: opp.setupComplete,
      boss: hideSetup ? null : (opp.boss ? { ...sanitize(opp.boss, true), bossLocked: !opponentBossCanAttack } : null),
      field: hideSetup ? [] : (opp.field || []).map((c) => (c ? sanitize(c, true) : null)),
      deckRemaining: opp.deck.length,
      replacementsUsed: opp.replacementsUsed,
      drawTimer: opp.drawTimer,
      drawTimerMax: opp.drawTimerMax,
      bossAbilitiesUsed: { ...(opp.bossAbilitiesUsed || defaultBossAbilitiesUsed()) },
    },
  };
}

export function createOfflineGame(deckIds) {
  instanceCounter = 0;
  const game = {
    id: 'offline_' + Date.now(),
    mode: 'npc',
    phase: 'setup',
    players: [
      createPlayer('player', 'You', deckIds),
      createPlayer('npc', 'CPU Opponent', npcDeck()),
    ],
    log: [],
    winnerId: null,
    attackAnimation: null,
    attackTimeout: null,
    deathAnimation: null,
    deathTimeout: null,
    pendingReplacement: null,
    pendingPlayerActions: [],
    battleElapsed: 0,
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
    game.log.push('Battle begins! Draw timer started.');
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

function triggerPoisonDeath(game, card) {
  if (!card || game.deathAnimation || game.attackAnimation) return false;
  card.hp = 0;
  card.alive = false;
  game.deathAnimation = {
    instanceId: card.instanceId,
    durationMs: DEATH_ANIMATION_MS,
    shakeMs: DEATH_SHAKE_MS,
  };
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  game.deathTimeout = setTimeout(() => completeDeathAnimation(game), DEATH_ANIMATION_MS);
  return true;
}

function processPoisonTicks(game) {
  if (isBattlePaused(game)) return false;

  for (const p of game.players) {
    for (const c of getFieldCards(p)) {
      if (!c?.alive || !c.poisoned) continue;
      c.poisonTicks = (c.poisonTicks || 0) + 1;
      if (c.poisonTicks < 5) continue;

      c.poisonTicks = 0;
      c.hp -= 1;
      if (c.hp <= 0) {
        game.log.push(`${c.name} succumbed to poison`);
        return triggerPoisonDeath(game, c);
      }
    }
  }
  return false;
}

function startTicks(game) {
  stopTicks();
  tickTimer = setInterval(() => {
    if (game.phase !== 'battle' || isBattlePaused(game)) return;

    processEffectExpiry(game);

    if (processPeriodicAbilities(game)) {
      const w = checkWinner(game.players[0], game.players[1]);
      if (w) finishOffline(game, w);
      return;
    }

    if (processPoisonTicks(game)) {
      const w = checkWinner(game.players[0], game.players[1]);
      if (w) finishOffline(game, w);
      return;
    }

    game.battleElapsed = (game.battleElapsed || 0) + 1;

    for (const p of game.players) {
      for (const c of getFieldCards(p)) {
        if (!isCardReady(c)) c.cooldownElapsed = Math.min(c.cooldown, (c.cooldownElapsed || 0) + 1);
      }
      if (p.drawTimer < p.drawTimerMax) p.drawTimer += 1;
    }

    runNpcDrawAndReplace(game);
    runNpcBossMagic(game);
    runNpcAI(game);

    const w = checkWinner(game.players[0], game.players[1]);
    if (w) finishOffline(game, w);
    else if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  }, 1000);
}

function runNpcDrawAndReplace(game) {
  const npc = game.players[1];
  if (npc.drawTimer >= npc.drawTimerMax) drawCardForPlayer(game, npc, 'CPU');
  if (tryReplaceFromHand(npc)) game.log.push('CPU deployed a replacement fighter');
}

function runNpcBossMagic(game) {
  if (isBattlePaused(game) || game.winnerId) return;
  const npc = game.players[1];
  const human = game.players[0];

  if (getBossMagicPhase(game) === 2) {
    runNpcBossMagicPhase2(game, npc, human);
    return;
  }

  const fighters = getAliveFieldFighters(npc);
  const needsHeal = fighters.some((c) => c.hp < c.maxHp)
    || (isBossOnlyPhase(npc) && npc.boss.hp < npc.boss.maxHp);
  if (canUseBossAbility(npc, game) && needsHeal) {
    applyBossHeal(game, npc);
    game.log.push(`CPU boss healed ${fighters.length ? 'all fighters' : npc.boss.name}`);
    return;
  }

  const playerCards = getFieldCards(human).filter((c) => c.alive);
  const slowTarget = playerCards.length
    ? playerCards.reduce((a, b) => (getCooldownRemaining(a) < getCooldownRemaining(b) ? a : b))
    : null;
  if (
    canUseBossAbility(npc, game)
    && slowTarget
    && getCooldownRemaining(slowTarget) <= slowTarget.cooldown * 0.6
  ) {
    applyBossSlow(game, npc, slowTarget);
    game.log.push(`CPU boss slowed ${slowTarget.name}`);
    return;
  }

  const hasteCandidates = getFieldCards(npc).filter((c) => c.alive && getCooldownRemaining(c) > 2);
  if (canUseBossAbility(npc, game) && hasteCandidates.length) {
    const target = hasteCandidates.reduce((a, b) => (
      getCooldownRemaining(a) > getCooldownRemaining(b) ? a : b
    ));
    applyBossHaste(game, npc, target);
    game.log.push(`CPU boss hastened ${target.name}`);
    return;
  }

  if (canUseBossAbility(npc, game) && slowTarget) {
    applyBossSlow(game, npc, slowTarget);
    game.log.push(`CPU boss slowed ${slowTarget.name}`);
  }
}

function runNpcBossMagicPhase2(game, npc, human) {
  if (!canUseBossAbility(npc, game)) return;

  const enemyFighters = getAliveFieldFighters(human);
  if (enemyFighters.length >= 2) {
    applyBossPoisonAll(game, npc, human);
    game.log.push('CPU boss poisoned all enemy fighters');
    return;
  }

  const enemyCards = getFieldCards(human).filter((c) => c.alive);
  const defenseTarget = enemyCards.length
    ? enemyCards.reduce((a, b) => (b.defense > a.defense ? b : a))
    : null;
  if (defenseTarget && defenseTarget.defense > 0) {
    applyBossDefenseHalved(game, npc, defenseTarget);
    game.log.push(`CPU boss halved ${defenseTarget.name}'s defense`);
    return;
  }

  const allyCards = getFieldCards(npc).filter((c) => c.alive && !c.attackDoubled);
  const attackTarget = allyCards.length
    ? allyCards.reduce((a, b) => (b.attack > a.attack ? b : a))
    : null;
  if (attackTarget) {
    applyBossAttack2x(game, npc, attackTarget);
    game.log.push(`CPU boss doubled ${attackTarget.name}'s attack`);
    return;
  }

  if (enemyFighters.length) {
    applyBossPoisonAll(game, npc, human);
    game.log.push('CPU boss poisoned all enemy fighters');
  }
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
  let bestAction = null;
  let bestDamage = -1;

  for (const attacker of readyAll) {
    const damage = calculateAttackDamage(attacker, defender);
    if (damage > bestDamage) {
      bestDamage = damage;
      bestAction = { type: 'single', attacker, defender };
    }
  }

  if (readyFighters.length >= 2) {
    for (const attackers of getChainAttackCombos(readyFighters)) {
      const damage = calculateChainAttackDamage(attackers, defender);
      if (damage > bestDamage) {
        bestDamage = damage;
        bestAction = { type: 'chain', attackers, defender };
      }
    }
  }

  return bestAction;
}

function runNpcAI(game) {
  if (isBattlePaused(game)) return;
  const npc = game.players[1];
  const human = game.players[0];
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
  game.log.push(`${w?.username} wins!`);
  clearBattleAnimations(game);
  stopTicks();
}

function clearDeathAnimation(game) {
  if (game?.deathTimeout) {
    clearTimeout(game.deathTimeout);
    game.deathTimeout = null;
  }
  if (game) game.deathAnimation = null;
}

export function clearBattleAnimations(game) {
  clearAttackAnimation(game);
  clearDeathAnimation(game);
  if (game) game.pendingPlayerActions = [];
}

export function offlineDrawCard(game) {
  const player = game.players[0];
  if (player.drawTimer < player.drawTimerMax || !player.deck.length) {
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
  if (isBattlePaused(game)) {
    const player = game.players[0];
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

function applyBossSlow(game, owner, target) {
  const remaining = getCooldownRemaining(target);
  if (!target.slowed) {
    target.slowed = true;
    target.bossSlowed = true;
    target.cooldown *= 2;
  }
  const newRemaining = Math.min(
    target.cooldown,
    Math.max(remaining, 1) * 2,
  );
  target.cooldownElapsed = target.cooldown - newRemaining;
  markBossAbilityUsed(game, owner, 'slow', target.name);
}

function applyBossHeal(game, owner) {
  const fighters = getAliveFieldFighters(owner);
  if (fighters.length) {
    for (const fighter of fighters) {
      fighter.hp = fighter.maxHp;
    }
    markBossAbilityUsed(game, owner, 'heal', 'all fighters');
    return;
  }
  if (owner.boss?.alive) {
    owner.boss.hp = owner.boss.maxHp;
    markBossAbilityUsed(game, owner, 'heal', owner.boss.name);
  }
}

function applyBossHaste(game, owner, target) {
  const remaining = getCooldownRemaining(target);
  if (!target.hasted) {
    target.hasted = true;
    target.bossHasted = true;
    target.cooldown = Math.max(1, Math.floor(target.cooldown / 2));
  }
  const newRemaining = Math.max(0, Math.floor(remaining / 2));
  target.cooldownElapsed = target.cooldown - newRemaining;
  markBossAbilityUsed(game, owner, 'haste', target.name);
}

function applyBossAttack2x(game, owner, target) {
  if (!target.attackDoubled) {
    target.attackDoubled = true;
    target.attack = Math.floor(target.attack * 2);
  }
  markBossAbilityUsedPhase2(owner);
}

function applyBossDefenseHalved(game, owner, target) {
  if (!target.defenseHalved) {
    target.defenseHalved = true;
    target.defense = Math.max(0, Math.floor(target.defense / 2));
  }
  markBossAbilityUsedPhase2(owner);
}

function applyBossPoisonAll(game, owner, opponent) {
  const fighters = getAliveFieldFighters(opponent);
  const expiresAt = Date.now() + BOSS_POISON_DURATION_MS;
  for (const fighter of fighters) {
    fighter.poisoned = true;
    fighter.poisonTicks = 0;
    fighter.poisonExpiresAt = expiresAt;
  }
  markBossAbilityUsedPhase2(owner);
}

function resolveBossAbility(game, owner, ability, targetInstanceId) {
  if (game.phase !== 'battle' || game.winnerId) {
    return { success: false };
  }
  if (!canUseBossAbility(owner, game)) {
    return { success: false, message: 'Boss abilities already used this battle' };
  }
  if (getBossMagicPhase(game) !== 1) {
    return { success: false, message: 'Phase 1 abilities no longer available' };
  }

  if (ability === 'slow') {
    const opp = game.players.find((p) => p.id !== owner.id);
    const target = getFieldCards(opp).find((c) => c.instanceId === targetInstanceId);
    if (!target?.alive) return { success: false, message: 'Invalid target' };
    if (target.role === 'boss' && !canBossBeTargeted(opp)) {
      return { success: false, message: 'Boss is protected until all fighters are defeated' };
    }
    applyBossSlow(game, owner, target);
    game.log.push(`${owner.username} boss slowed ${target.name}`);
  } else if (ability === 'heal') {
    const fighters = getAliveFieldFighters(owner);
    const canHealBoss = isBossOnlyPhase(owner) && owner.boss?.alive;
    if (!fighters.length && !canHealBoss) {
      return { success: false, message: 'Nothing to heal' };
    }
    applyBossHeal(game, owner);
    game.log.push(`${owner.username} boss healed ${fighters.length ? 'all fighters' : owner.boss.name}`);
  } else if (ability === 'haste') {
    const target = getFieldCards(owner).find((c) => c.instanceId === targetInstanceId);
    if (!target?.alive) return { success: false, message: 'Invalid target' };
    applyBossHaste(game, owner, target);
    game.log.push(`${owner.username} boss hastened ${target.name}`);
  } else {
    return { success: false };
  }

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

function resolveBossAbilityPhase2(game, owner, ability, targetInstanceId) {
  if (game.phase !== 'battle' || game.winnerId) {
    return { success: false };
  }
  if (getBossMagicPhase(game) !== 2) {
    return { success: false, message: 'Phase 2 abilities not yet available' };
  }
  if (!canUseBossAbility(owner, game)) {
    return { success: false, message: 'Boss abilities already used this phase' };
  }

  if (ability === 'attack2x') {
    const target = getFieldCards(owner).find((c) => c.instanceId === targetInstanceId);
    if (!target?.alive) return { success: false, message: 'Invalid target' };
    if (target.attackDoubled) return { success: false, message: 'Attack already doubled' };
    applyBossAttack2x(game, owner, target);
    game.log.push(`${owner.username} boss doubled ${target.name}'s attack`);
  } else if (ability === 'defenseHalved') {
    const opp = game.players.find((p) => p.id !== owner.id);
    const target = getFieldCards(opp).find((c) => c.instanceId === targetInstanceId);
    if (!target?.alive) return { success: false, message: 'Invalid target' };
    if (target.role === 'boss' && !canBossBeTargeted(opp)) {
      return { success: false, message: 'Boss is protected until all fighters are defeated' };
    }
    if (target.defenseHalved) return { success: false, message: 'Defense already halved' };
    applyBossDefenseHalved(game, owner, target);
    game.log.push(`${owner.username} boss halved ${target.name}'s defense`);
  } else if (ability === 'poisonAll') {
    const opp = game.players.find((p) => p.id !== owner.id);
    const fighters = getAliveFieldFighters(opp);
    if (!fighters.length) return { success: false, message: 'No enemy fighters to poison' };
    applyBossPoisonAll(game, owner, opp);
    game.log.push(`${owner.username} boss poisoned all enemy fighters`);
  } else {
    return { success: false };
  }

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

export function offlineBossSlow(game, targetInstanceId) {
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'bossSlow', targetInstanceId });
  }
  return resolveBossAbility(game, game.players[0], 'slow', targetInstanceId);
}

export function offlineBossHeal(game) {
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'bossHeal' });
  }
  return resolveBossAbility(game, game.players[0], 'heal');
}

export function offlineBossHaste(game, targetInstanceId) {
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'bossHaste', targetInstanceId });
  }
  return resolveBossAbility(game, game.players[0], 'haste', targetInstanceId);
}

export function offlineBossAttack2x(game, targetInstanceId) {
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'bossAttack2x', targetInstanceId });
  }
  return resolveBossAbilityPhase2(game, game.players[0], 'attack2x', targetInstanceId);
}

export function offlineBossDefenseHalved(game, targetInstanceId) {
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'bossDefenseHalved', targetInstanceId });
  }
  return resolveBossAbilityPhase2(game, game.players[0], 'defenseHalved', targetInstanceId);
}

export function offlineBossPoisonAll(game) {
  if (isBattlePaused(game)) {
    return queuePlayerAction(game, { type: 'bossPoisonAll' });
  }
  return resolveBossAbilityPhase2(game, game.players[0], 'poisonAll');
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

export { CARD_DATA, CARD_TIMER_MIN, CARD_TIMER_MAX, PLAY_DECK_SIZE, getTimerPreview, CATALOG_VERSION };
