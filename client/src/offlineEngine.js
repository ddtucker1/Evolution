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

const LOOKUP = new Map();
for (const c of [...CARD_DATA.standard, ...CARD_DATA.unique]) LOOKUP.set(c.id, c);

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

function makeBattleCard(templateId, instanceId) {
  const t = getTemplate(templateId);
  if (!t) return null;
  const isUnique = t.type === 'unique';
  const attack = isUnique ? randomStat(10, 25) : (t.attack || 0);
  const maxHp = isUnique ? randomStat(30, 100) : (t.hp || 0);
  const cooldown = isUnique ? randomStat(10, 30) : (t.cooldown || 0);
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

function createPlayer(id, username, deckIds) {
  const shuffled = shuffle(deckIds.slice(0, 20).map((id, i) => ({ templateId: id, instanceId: `${id}_${i}` })));
  const unique = shuffled.filter(c => getTemplate(c.templateId)?.type !== 'standard');
  const standard = shuffled.filter(c => getTemplate(c.templateId)?.type === 'standard');
  const setupDraw = unique.splice(0, 4);
  return {
    id, username,
    deck: [...unique, ...standard],
    setupHand: setupDraw.map(c => makeBattleCard(c.templateId, c.instanceId)),
    supportHand: [], boss: null, field: [],
    setupComplete: false, isWinner: false,
  };
}

function npcDeck() {
  const ids = ['uni_knight','uni_archer','uni_mage','uni_golem','uni_rogue','uni_paladin','uni_berserker','uni_druid'];
  const std = ['std_shield','std_sword','std_poison','std_heal','std_bolt','std_haste','std_curse','std_fortify'];
  const deck = [];
  for (let i = 0; i < 12; i++) deck.push(ids[i % ids.length]);
  for (let i = 0; i < 8; i++) deck.push(std[i % std.length]);
  return deck;
}

function sanitize(card, revealed) {
  if (!revealed) return { hidden: true };
  return {
    instanceId: card.instanceId, name: card.name,
    attack: card.attack, defense: card.defense,
    hp: card.hp, maxHp: card.maxHp,
    cooldown: card.cooldown, cooldownRemaining: card.cooldownRemaining,
    role: card.role, alive: card.alive,
  };
}

function getFieldCards(player) {
  return [player.boss, ...player.field].filter(c => c && c.alive);
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

const ATTACK_ANIMATION_MS = 1800;

function findFieldCard(game, instanceId) {
  for (const player of game.players) {
    const card = getFieldCards(player).find(c => c.instanceId === instanceId);
    if (card) return { card, player };
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

  const damage = Math.max(1, attacker.attack - defender.defense);
  game.attackAnimation = {
    attackerInstanceId: attacker.instanceId,
    defenderInstanceId: defender.instanceId,
    damage,
    logMessage: `${logPrefix} attacks ${defender.name} for ${damage} damage`,
  };

  if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));

  game.attackTimeout = setTimeout(() => completeAttackAnimation(game), ATTACK_ANIMATION_MS);
  return { success: true, damage, pending: true };
}

function checkWinner(p1, p2) {
  if (!p1.boss?.alive) return p2.id;
  if (!p2.boss?.alive) return p1.id;
  return null;
}

function toPrivateState(game, playerId) {
  const me = game.players.find(p => p.id === playerId);
  const opp = game.players.find(p => p.id !== playerId);
  const hideSetup = game.phase === 'setup';

  return {
    id: game.id, mode: 'npc', phase: game.phase,
    players: game.players.map(p => ({
      id: p.id, username: p.username, setupComplete: p.setupComplete,
      boss: p.boss ? sanitize(p.boss, game.phase !== 'setup') : null,
      field: p.field.map(c => sanitize(c, game.phase !== 'setup')),
      supportHandCount: p.supportHand.length,
      deckRemaining: p.deck.length,
      isWinner: p.isWinner,
    })),
    log: game.log.slice(-20),
    winnerId: game.winnerId,
    attackAnimation: game.attackAnimation ? { ...game.attackAnimation } : null,
    timersPaused: !!game.attackAnimation,
    myHand: me.setupHand.map(c => ({ ...c })),
    mySupportHand: me.supportHand.map(c => ({ ...c })),
    myBoss: me.boss ? { ...me.boss } : null,
    myField: me.field.map(c => ({ ...c })),
    opponent: {
      id: opp.id, username: opp.username, setupComplete: opp.setupComplete,
      boss: hideSetup ? null : (opp.boss ? sanitize(opp.boss, true) : null),
      field: hideSetup ? [] : opp.field.map(c => sanitize(c, true)),
      supportHandCount: opp.supportHand.length,
    },
  };
}

let tickTimer = null;
let npcTimer = null;

export function createOfflineGame(deckIds) {
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
  };
  return game;
}

export function offlineSetup(game, bossId, fieldIds) {
  const player = game.players[0];
  const hand = [...player.setupHand];
  const boss = hand.find(c => c.instanceId === bossId);
  const field = fieldIds.map(id => hand.find(c => c.instanceId === id)).filter(Boolean);
  if (!boss || field.length !== 3) return { success: false };

  boss.role = 'boss';
  field.forEach(c => { c.role = 'field'; });
  player.boss = boss;
  player.field = field;
  player.setupHand = hand.filter(c => c.instanceId !== bossId && !fieldIds.includes(c.instanceId));
  player.setupComplete = true;

  autoNpcSetup(game);
  if (game.players.every(p => p.setupComplete)) {
    game.phase = 'battlefield';
    drawSupport(game.players[0]);
    drawSupport(game.players[1]);
    game.log.push('Battlefield revealed! Support cards drawn.');
    game.phase = 'battle';
    game.log.push('Battle begins!');
    startTicks(game);
  }
  return { success: true };
}

function autoNpcSetup(game) {
  const npc = game.players[1];
  const hand = [...npc.setupHand];
  const boss = hand.reduce((b, c) => (c.maxHp > (b?.maxHp || 0) ? c : b), hand[0]);
  const field = hand.filter(c => c.instanceId !== boss.instanceId).slice(0, 3);
  boss.role = 'boss';
  field.forEach(c => { c.role = 'field'; });
  npc.boss = boss;
  npc.field = field;
  npc.setupHand = [];
  npc.setupComplete = true;
}

function drawSupport(player) {
  for (let i = 0; i < 4 && player.deck.length; i++) {
    const next = player.deck.shift();
    const t = getTemplate(next.templateId);
    if (t?.type === 'standard') player.supportHand.push(makeStandardCard(next.templateId, next.instanceId));
    else if (t) player.supportHand.push(makeBattleCard(next.templateId, next.instanceId));
  }
}

function startTicks(game) {
  stopTicks();
  tickTimer = setInterval(() => {
    if (game.phase !== 'battle' || game.attackAnimation) return;
    for (const p of game.players) {
      for (const c of getFieldCards(p)) {
        if (c.cooldownRemaining > 0) c.cooldownRemaining--;
      }
    }
    runNpcAI(game);
    const w = checkWinner(game.players[0], game.players[1]);
    if (w) finishOffline(game, w);
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  }, 1000);

  npcTimer = setInterval(() => {
    if (game.phase !== 'battle') return;
    runNpcSupport(game);
    if (game.onUpdate) game.onUpdate(toPrivateState(game, 'player'));
  }, 2500);
}

function runNpcAI(game) {
  if (game.attackAnimation) return;
  const npc = game.players[1];
  const human = game.players[0];
  const ready = getFieldCards(npc).filter(c => c.cooldownRemaining <= 0);
  if (!ready.length) return;
  const targets = getFieldCards(human);
  if (!targets.length) return;
  const defender = targets.reduce((b, t) => (t.hp < b.hp ? t : b), targets[0]);
  beginAttackAnimation(game, ready[0], defender, 'CPU');
}

function runNpcSupport(game) {
  const npc = game.players[1];
  const human = game.players[0];
  const card = npc.supportHand.find(c => !c.used);
  if (!card) return;
  const isBuff = ['buff_attack','buff_defense','buff_both','heal','reduce_cooldown'].includes(card.effect);
  const target = isBuff
    ? getFieldCards(npc)[0]
    : getFieldCards(human)[0];
  if (target) {
    applyStandard(card, target);
    game.log.push(`CPU uses ${card.name}`);
  }
}

function finishOffline(game, winnerId) {
  game.phase = 'finished';
  game.winnerId = winnerId;
  const w = game.players.find(p => p.id === winnerId);
  if (w) w.isWinner = true;
  game.log.push(`${w?.username} wins!`);
  game.attackAnimation = null;
  if (game.attackTimeout) {
    clearTimeout(game.attackTimeout);
    game.attackTimeout = null;
  }
  stopTicks();
}

export function offlineUseStandard(game, cardId, targetId, targetPlayerId) {
  const player = game.players.find(p => p.id === 'player');
  const card = player.supportHand.find(c => c.instanceId === cardId && !c.used);
  const tp = game.players.find(p => p.id === targetPlayerId);
  const target = getFieldCards(tp).find(c => c.instanceId === targetId);
  const result = applyStandard(card, target);
  if (result.success) game.log.push(`You use ${card.name}`);
  const w = checkWinner(game.players[0], game.players[1]);
  if (w) finishOffline(game, w);
  return result;
}

export function offlineAttack(game, attackerId, defenderId) {
  if (game.attackAnimation) return { success: false, message: 'Attack in progress' };
  const player = game.players[0];
  const opp = game.players[1];
  const attacker = getFieldCards(player).find(c => c.instanceId === attackerId);
  const defender = getFieldCards(opp).find(c => c.instanceId === defenderId);
  if (!attacker || attacker.cooldownRemaining > 0 || !defender?.alive) return { success: false };
  return beginAttackAnimation(game, attacker, defender, 'You');
}

export function stopTicks() {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  if (npcTimer) { clearInterval(npcTimer); npcTimer = null; }
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
