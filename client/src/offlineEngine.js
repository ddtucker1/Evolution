const CARD_DATA = {
  standard: [
    { id: 'std_shield', name: 'Iron Shield', type: 'standard', effect: 'buff_defense', value: 5 },
    { id: 'std_sword', name: 'Sharpening Stone', type: 'standard', effect: 'buff_attack', value: 5 },
    { id: 'std_poison', name: 'Venom Vial', type: 'standard', effect: 'debuff_attack', value: 4 },
    { id: 'std_curse', name: 'Weakening Curse', type: 'standard', effect: 'debuff_defense', value: 4 },
    { id: 'std_heal', name: 'Healing Potion', type: 'standard', effect: 'heal', value: 8 },
    { id: 'std_bolt', name: 'Lightning Bolt', type: 'standard', effect: 'damage', value: 6 },
    { id: 'std_haste', name: 'Haste Charm', type: 'standard', effect: 'reduce_cooldown', value: 2 },
    { id: 'std_fortify', name: 'Fortify', type: 'standard', effect: 'buff_both', value: 3 },
  ],
  unique: [
    { id: 'uni_knight', name: 'Steel Knight', attack: 12, defense: 14, hp: 40, cooldown: 5 },
    { id: 'uni_archer', name: 'Shadow Archer', attack: 16, defense: 8, hp: 30, cooldown: 4 },
    { id: 'uni_mage', name: 'Flame Mage', attack: 18, defense: 6, hp: 28, cooldown: 6 },
    { id: 'uni_golem', name: 'Stone Golem', attack: 10, defense: 18, hp: 50, cooldown: 7 },
    { id: 'uni_rogue', name: 'Night Rogue', attack: 15, defense: 10, hp: 32, cooldown: 3 },
    { id: 'uni_paladin', name: 'Holy Paladin', attack: 13, defense: 15, hp: 42, cooldown: 5 },
    { id: 'uni_berserker', name: 'Blood Berserker', attack: 20, defense: 5, hp: 35, cooldown: 4 },
    { id: 'uni_druid', name: 'Forest Druid', attack: 11, defense: 12, hp: 38, cooldown: 5 },
    { id: 'uni_wraith', name: 'Soul Wraith', attack: 17, defense: 7, hp: 26, cooldown: 4 },
    { id: 'uni_titan', name: 'Storm Titan', attack: 19, defense: 12, hp: 45, cooldown: 6 },
    { id: 'uni_phoenix', name: 'Ember Phoenix', attack: 16, defense: 9, hp: 33, cooldown: 5 },
    { id: 'uni_serpent', name: 'Viper Serpent', attack: 14, defense: 11, hp: 31, cooldown: 3 },
  ],
};

const DRAW_TIMER_MAX = 30;
const MAX_REPLACEMENTS = 3;
const MIN_ATTACK_ANIM_MS = 1000;
const MAX_ATTACK_ANIM_MS = 4000;
const MAX_EXPECTED_DAMAGE = 25;

const LOOKUP = new Map();
for (const c of [...CARD_DATA.standard, ...CARD_DATA.unique]) LOOKUP.set(c.id, c);

let tickTimer = null;
let instanceCounter = 0;

function nextInstanceId(prefix, templateId) {
  instanceCounter += 1;
  return `${templateId}_${prefix}_${instanceCounter}`;
}

function getTemplate(id) { return LOOKUP.get(id); }

function randomStat(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getAttackAnimationMs(damage) {
  const clamped = Math.min(MAX_EXPECTED_DAMAGE, Math.max(1, damage));
  const ratio = (clamped - 1) / (MAX_EXPECTED_DAMAGE - 1);
  return Math.round(MIN_ATTACK_ANIM_MS + ratio * (MAX_ATTACK_ANIM_MS - MIN_ATTACK_ANIM_MS));
}

function makeBattleCard(templateId, instanceId) {
  const t = getTemplate(templateId);
  if (!t) return null;
  const isUnique = t.type === 'unique';
  const attack = isUnique ? randomStat(10, 25) : (t.attack || 0);
  const maxHp = isUnique ? randomStat(30, 100) : (t.hp || 0);
  const cooldown = isUnique ? randomStat(10, 60) : (t.cooldown || 0);
  return {
    instanceId, templateId, name: t.name, type: t.type || 'unique',
    attack, defense: t.defense || 0,
    maxHp, hp: maxHp,
    cooldown, cooldownRemaining: cooldown,
    effect: t.effect, value: t.value, alive: true, role: null,
  };
}

function makeStandardCard(templateId, instanceId) {
  const t = getTemplate(templateId);
  return {
    instanceId, templateId, name: t.name, type: 'standard',
    effect: t.effect, value: t.value, used: false,
  };
}

function deckEntriesFromIds(deckIds, prefix) {
  return deckIds.slice(0, 20).map((templateId) => ({
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

function npcDeck() {
  const ids = ['uni_knight', 'uni_archer', 'uni_mage', 'uni_golem', 'uni_rogue', 'uni_paladin', 'uni_berserker', 'uni_druid'];
  const std = ['std_shield', 'std_sword', 'std_poison', 'std_heal', 'std_bolt', 'std_haste', 'std_curse', 'std_fortify'];
  const deck = [];
  for (let i = 0; i < 12; i++) deck.push(ids[i % ids.length]);
  for (let i = 0; i < 8; i++) deck.push(std[i % std.length]);
  return deck;
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

function canCardAttack(attacker, player) {
  if (!attacker?.alive || attacker.cooldownRemaining > 0) return false;
  if (attacker.role === 'boss') return canBossAttack(player);
  return attacker.role === 'field';
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
    cooldownRemaining: card.cooldownRemaining,
    role: card.role,
    alive: card.alive,
    type: card.type,
    effect: card.effect,
    value: card.value,
    used: card.used,
    bossLocked: false,
  };
}

function applyStandard(card, target) {
  if (!card || card.used || !target?.alive) return { success: false };
  switch (card.effect) {
    case 'buff_attack': target.attack += card.value; break;
    case 'buff_defense': target.defense += card.value; break;
    case 'buff_both': target.attack += card.value; target.defense += card.value; break;
    case 'debuff_attack': target.attack = Math.max(0, target.attack - card.value); break;
    case 'debuff_defense': target.defense = Math.max(0, target.defense - card.value); break;
    case 'heal': target.hp = Math.min(target.maxHp, target.hp + card.value); break;
    case 'damage':
      target.hp -= card.value;
      if (target.hp <= 0) { target.hp = 0; target.alive = false; }
      break;
    case 'reduce_cooldown': target.cooldownRemaining = Math.max(0, target.cooldownRemaining - card.value); break;
    default: return { success: false };
  }
  card.used = true;
  return { success: true };
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

function completeAttackAnimation(game) {
  const anim = game.attackAnimation;
  if (!anim) return;

  const attackerRef = findFieldCard(game, anim.attackerInstanceId);
  const defenderRef = findFieldCard(game, anim.defenderInstanceId);
  if (attackerRef?.card?.alive && defenderRef?.card?.alive) {
    defenderRef.card.hp -= anim.damage;
    if (defenderRef.card.hp <= 0) {
      defenderRef.card.hp = 0;
      defenderRef.card.alive = false;
      clearDeadFieldSlot(defenderRef.player, defenderRef.card);
    }
    attackerRef.card.cooldownRemaining = attackerRef.card.cooldown;
    game.log.push(anim.logMessage);
  }

  game.attackAnimation = null;
  if (game.attackTimeout) {
    clearTimeout(game.attackTimeout);
    game.attackTimeout = null;
  }

  const w = checkWinner(game.players[0], game.players[1]);
  if (w) finishOffline(game, w);
  else if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
}

function beginAttackAnimation(game, attacker, defender, logPrefix) {
  if (game.attackAnimation) return { success: false, message: 'Attack in progress' };
  const owner = game.players.find((p) => p.boss?.instanceId === attacker.instanceId || (p.field || []).some((c) => c?.instanceId === attacker.instanceId));
  if (!owner || !canCardAttack(attacker, owner)) return { success: false, message: 'Cannot attack yet' };

  const damage = Math.max(1, attacker.attack - defender.defense);
  const durationMs = getAttackAnimationMs(damage);
  game.attackAnimation = {
    attackerInstanceId: attacker.instanceId,
    defenderInstanceId: defender.instanceId,
    damage,
    durationMs,
    logMessage: `${logPrefix} attacks ${defender.name} for ${damage} damage`,
  };

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
  const next = player.deck.shift();
  const t = getTemplate(next.templateId);
  let card;
  if (t?.type === 'standard') card = makeStandardCard(next.templateId, next.instanceId);
  else if (t) card = makeBattleCard(next.templateId, next.instanceId);
  else return false;

  player.battleHand.push(card);
  player.drawTimer = 0;
  game.log.push(`${logPrefix} drew ${card.name}`);
  return true;
}

function tryReplaceFromHand(player) {
  if (player.replacementsUsed >= player.maxReplacements) return false;
  const emptySlot = (player.field || []).findIndex((c) => !c || !c.alive);
  if (emptySlot < 0) return false;
  const fighter = player.battleHand.find((c) => c.type === 'unique' && !c.used);
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
    })),
    log: game.log.slice(-20),
    winnerId: game.winnerId,
    attackAnimation: game.attackAnimation ? { ...game.attackAnimation } : null,
    timersPaused: !!game.attackAnimation,
    myHand: me.setupHand.map((c) => ({ ...c })),
    myBattleHand: me.battleHand.map((c) => ({ ...c })),
    myBoss: me.boss ? { ...me.boss, bossLocked: !bossCanAttack } : null,
    myField: (me.field || []).map((c) => (c ? { ...c } : null)),
    replacementsUsed: me.replacementsUsed,
    maxReplacements: me.maxReplacements,
    drawTimer: me.drawTimer,
    drawTimerMax: me.drawTimerMax,
    drawReady: me.drawTimer >= me.drawTimerMax && me.deck.length > 0,
    deckRemaining: me.deck.length,
    bossCanAttack,
    opponent: {
      id: opp.id,
      username: opp.username,
      setupComplete: opp.setupComplete,
      boss: hideSetup ? null : (opp.boss ? sanitize(opp.boss, true) : null),
      field: hideSetup ? [] : (opp.field || []).map((c) => (c ? sanitize(c, true) : null)),
      deckRemaining: opp.deck.length,
      replacementsUsed: opp.replacementsUsed,
      drawTimer: opp.drawTimer,
      drawTimerMax: opp.drawTimerMax,
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
  };
  return game;
}

export function offlineSetup(game, bossId, fieldIds) {
  const player = game.players[0];
  const hand = [...player.setupHand];
  const boss = hand.find((c) => c.instanceId === bossId);
  const field = fieldIds.map((id) => hand.find((c) => c.instanceId === id)).filter(Boolean);
  if (!boss || field.length !== 3) return { success: false };

  boss.role = 'boss';
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
  boss.role = 'boss';
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
    if (game.phase !== 'battle' || game.attackAnimation) return;

    for (const p of game.players) {
      for (const c of getFieldCards(p)) {
        if (c.cooldownRemaining > 0) c.cooldownRemaining -= 1;
      }
      if (p.drawTimer < p.drawTimerMax) p.drawTimer += 1;
    }

    runNpcDrawAndReplace(game);
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

function runNpcAI(game) {
  if (game.attackAnimation) return;
  const npc = game.players[1];
  const human = game.players[0];
  const ready = getReadyAttackers(npc);
  if (!ready.length) return;
  const targets = getFieldCards(human);
  if (!targets.length) return;
  const defender = targets.reduce((b, t) => (t.hp < b.hp ? t : b), targets[0]);
  beginAttackAnimation(game, ready[0], defender, 'CPU');
}

function finishOffline(game, winnerId) {
  game.phase = 'finished';
  game.winnerId = winnerId;
  const w = game.players.find((p) => p.id === winnerId);
  if (w) w.isWinner = true;
  game.log.push(`${w?.username} wins!`);
  clearAttackAnimation(game);
  stopTicks();
}

export function offlineDrawCard(game) {
  if (game.attackAnimation) return { success: false };
  const player = game.players[0];
  const drew = drawCardForPlayer(game, player, 'You');
  if (!drew) return { success: false, message: 'Cannot draw yet' };
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

export function offlineReplace(game, handCardId, slotIndex) {
  if (game.attackAnimation) return { success: false };
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
  if (card.type !== 'unique') return { success: false, message: 'Only fighter cards can replace field slots' };

  card.role = 'field';
  player.field[slotIndex] = card;
  player.battleHand.splice(handIdx, 1);
  player.replacementsUsed += 1;
  game.log.push(`You deployed ${card.name} as a replacement (${player.replacementsUsed}/${player.maxReplacements})`);
  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return { success: true };
}

export function offlineUseStandard(game, cardId, targetId, targetPlayerId) {
  if (game.attackAnimation) return { success: false };
  const player = game.players.find((p) => p.id === 'player');
  const card = player.battleHand.find((c) => c.instanceId === cardId && !c.used);
  const tp = game.players.find((p) => p.id === targetPlayerId);
  const target = getFieldCards(tp).find((c) => c.instanceId === targetId);
  const result = applyStandard(card, target);
  if (result.success) {
    game.log.push(`You use ${card.name}`);
    if (!target.alive && target.role === 'field') clearDeadFieldSlot(tp, target);
    if (card.used) player.battleHand = player.battleHand.filter((c) => c.instanceId !== cardId);
  }
  const w = checkWinner(game.players[0], game.players[1]);
  if (w) finishOffline(game, w);
  else if (result.success && game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  return result;
}

export function offlineAttack(game, attackerId, defenderId) {
  if (game.attackAnimation) return { success: false, message: 'Attack in progress' };
  const player = game.players[0];
  const opp = game.players[1];
  const attacker = getFieldCards(player).find((c) => c.instanceId === attackerId);
  const defender = getFieldCards(opp).find((c) => c.instanceId === defenderId);
  if (!attacker || !defender?.alive) return { success: false };
  if (!canCardAttack(attacker, player)) return { success: false, message: 'Cannot attack yet' };
  return beginAttackAnimation(game, attacker, defender, 'You');
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

export { CARD_DATA };
