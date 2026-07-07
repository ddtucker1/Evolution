import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getTimerPreview } from '../../shared/baseCardStats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cardData = JSON.parse(readFileSync(join(__dirname, '../data/cards.json'), 'utf-8'));

const CARD_LOOKUP = new Map();
for (const card of [...cardData.standard, ...cardData.unique]) {
  CARD_LOOKUP.set(card.id, { ...card });
}
for (const fusion of cardData.fusions) {
  CARD_LOOKUP.set(fusion.output.id, { ...fusion.output });
}

export function getCardTemplate(id) {
  const template = CARD_LOOKUP.get(id);
  if (!template) return null;
  return { ...template };
}

export function getAllStandardCards() {
  return cardData.standard.map(c => ({ ...c }));
}

export function getAllUniqueCards() {
  return cardData.unique.map(c => ({ ...c }));
}

export function getFusionRecipes() {
  return cardData.fusions.map(f => ({
    inputs: [...f.inputs],
    output: { ...f.output },
  }));
}

export function findFusion(inputIds) {
  const sorted = [...inputIds].sort();
  for (const recipe of cardData.fusions) {
    const recipeSorted = [...recipe.inputs].sort();
    if (
      sorted.length === recipeSorted.length &&
      sorted.every((id, i) => id === recipeSorted[i])
    ) {
      return { ...recipe.output };
    }
  }
  return null;
}

export function createBattleCard(templateId, instanceId) {
  const template = getCardTemplate(templateId);
  if (!template) return null;
  const isUnique = template.type === 'unique';
  const attack = Math.round(template.attack || 0);
  const defense = Math.round(template.defense || 0);
  const maxHp = Math.round(template.hp || 0);
  const cooldown = isUnique
    ? getTimerPreview(attack)
    : Math.round(template.cooldown || 0);
  return {
    instanceId,
    templateId,
    name: template.name,
    type: template.type,
    attack,
    defense,
    maxHp,
    hp: maxHp,
    cooldown,
    cooldownRemaining: cooldown,
    effect: template.effect,
    value: template.value,
    description: template.description,
    role: null,
    alive: true,
    isBase: isUnique && !templateId.startsWith('evo_') && !templateId.startsWith('fus_'),
  };
}

export function createStandardCard(templateId, instanceId) {
  const template = getCardTemplate(templateId);
  if (!template) return null;
  return {
    instanceId,
    templateId,
    name: template.name,
    type: 'standard',
    effect: template.effect,
    value: template.value,
    description: template.description,
    used: false,
  };
}

export function shuffleDeck(cards) {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function buildGameDeck(cardIds, instancePrefix) {
  return cardIds.map((id, i) => ({
    templateId: id,
    instanceId: `${instancePrefix}_${i}`,
  }));
}

export const BATTLE_MODES = {
  NPC: 'npc',
  CASUAL: 'casual',
  COMPETITIVE: 'competitive',
};

export const GAME_PHASES = {
  SETUP: 'setup',
  BATTLEFIELD: 'battlefield',
  BATTLE: 'battle',
  FINISHED: 'finished',
};

export const DEFAULT_DECK_CAP = 50;
export const PREMIUM_DECK_CAP = 60;
export const PREMIUM_COST_CENTS = 100;
export const GAME_DECK_SIZE = 10;
export const SETUP_HAND_SIZE = 4;
export const SUPPORT_HAND_SIZE = 4;

export function applyStandardCard(card, target) {
  if (!card || card.used || !target || !target.alive) return { success: false };

  const result = { success: true, message: '' };

  switch (card.effect) {
    case 'buff_attack':
      target.attack += card.value;
      result.message = `${target.name} gains +${card.value} attack`;
      break;
    case 'buff_defense':
      target.defense += card.value;
      result.message = `${target.name} gains +${card.value} defense`;
      break;
    case 'buff_both':
      target.attack += card.value;
      target.defense += card.value;
      result.message = `${target.name} gains +${card.value} attack and defense`;
      break;
    case 'debuff_attack':
      target.attack = Math.max(0, target.attack - card.value);
      result.message = `${target.name} loses ${card.value} attack`;
      break;
    case 'debuff_defense':
      target.defense = Math.max(0, target.defense - card.value);
      result.message = `${target.name} loses ${card.value} defense`;
      break;
    case 'heal':
      target.hp = Math.min(target.maxHp, target.hp + card.value);
      result.message = `${target.name} heals ${card.value} HP`;
      break;
    case 'damage':
      target.hp -= card.value;
      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        result.message = `${target.name} is destroyed!`;
      } else {
        result.message = `${target.name} takes ${card.value} damage`;
      }
      break;
    case 'reduce_cooldown':
      target.cooldownRemaining = Math.max(0, target.cooldownRemaining - card.value);
      result.message = `${target.name}'s timer reduced by ${card.value}s`;
      break;
    default:
      return { success: false, message: 'Unknown effect' };
  }

  card.used = true;
  return result;
}

export function calculateAttackDamage(attacker, defender) {
  return Math.max(0, Math.round(attacker.attack) - Math.round(defender.defense));
}

export function resolveAttack(attacker, defender) {
  if (!attacker.alive || !defender.alive) {
    return { success: false, message: 'Invalid attack target' };
  }

  const damage = calculateAttackDamage(attacker, defender);
  if (damage > 0) {
    defender.hp -= damage;
  }
  attacker.cooldownRemaining = attacker.cooldown;

  let message = damage > 0
    ? `${attacker.name} attacks ${defender.name} for ${damage} damage`
    : `${attacker.name} attacks ${defender.name} but defense blocks all damage`;

  if (defender.hp <= 0) {
    defender.hp = 0;
    defender.alive = false;
    message += ` — ${defender.name} is destroyed!`;
  }

  return { success: true, damage, message, defenderDestroyed: !defender.alive };
}

export function checkWinner(player1, player2) {
  if (!player1.boss.alive) return player2.id;
  if (!player2.boss.alive) return player1.id;
  return null;
}

export function getPublicBattleState(game) {
  return {
    id: game.id,
    mode: game.mode,
    phase: game.phase,
    players: game.players.map(p => ({
      id: p.id,
      username: p.username,
      setupComplete: p.setupComplete,
      boss: p.boss ? sanitizeFieldCard(p.boss, game.phase !== GAME_PHASES.SETUP) : null,
      field: p.field.map(c => sanitizeFieldCard(c, game.phase !== GAME_PHASES.SETUP)),
      supportHandCount: p.supportHand.length,
      deckRemaining: p.deck.length,
      winner: p.isWinner || false,
    })),
    log: game.log.slice(-20),
    winnerId: game.winnerId,
  };
}

export function getPlayerPrivateState(game, playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (!player) return null;

  const hideOpponentSetup = game.phase === GAME_PHASES.SETUP;

  return {
    ...getPublicBattleState(game),
    myHand: player.setupHand.map(c => ({ ...c })),
    mySupportHand: player.supportHand.map(c => ({ ...c })),
    myBoss: player.boss ? { ...player.boss } : null,
    myField: player.field.map(c => ({ ...c })),
    opponent: game.players
      .filter(p => p.id !== playerId)
      .map(p => ({
        id: p.id,
        username: p.username,
        setupComplete: p.setupComplete,
        boss: hideOpponentSetup ? null : (p.boss ? sanitizeFieldCard(p.boss, true) : null),
        field: hideOpponentSetup ? [] : p.field.map(c => sanitizeFieldCard(c, true)),
        supportHandCount: p.supportHand.length,
      }))[0],
  };
}

function sanitizeFieldCard(card, revealed) {
  if (!revealed) return { hidden: true };
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
    description: card.description,
  };
}

export function createGameState(gameId, mode, players) {
  return {
    id: gameId,
    mode,
    phase: GAME_PHASES.SETUP,
    players: players.map(p => createPlayerState(p)),
    log: [],
    winnerId: null,
    tickInterval: null,
    createdAt: Date.now(),
  };
}

function createPlayerState({ id, username, deckCardIds }) {
  const shuffled = shuffleDeck(buildGameDeck(deckCardIds.slice(0, GAME_DECK_SIZE), id));
  const uniqueCards = shuffled.filter(c => {
    const t = getCardTemplate(c.templateId);
    return t && t.type === 'unique';
  });

  const setupDraw = uniqueCards.splice(0, SETUP_HAND_SIZE);
  const setupHand = setupDraw.map(c => createBattleCard(c.templateId, c.instanceId));

  return {
    id,
    username,
    deck: uniqueCards,
    setupHand,
    supportHand: [],
    boss: null,
    field: [],
    setupComplete: false,
    isWinner: false,
  };
}

export function completeSetup(player, bossInstanceId, fieldInstanceIds) {
  if (player.setupComplete) return { success: false, message: 'Setup already complete' };
  if (fieldInstanceIds.length !== 3) return { success: false, message: 'Select exactly 3 field cards' };

  const hand = [...player.setupHand];
  const bossCard = hand.find(c => c.instanceId === bossInstanceId);
  const fieldCards = fieldInstanceIds.map(id => hand.find(c => c.instanceId === id)).filter(Boolean);

  if (!bossCard || fieldCards.length !== 3) {
    return { success: false, message: 'Invalid card selection' };
  }

  bossCard.role = 'boss';
  fieldCards.forEach(c => { c.role = 'field'; });

  player.boss = bossCard;
  player.field = fieldCards;
  player.setupHand = hand.filter(c => c.instanceId !== bossInstanceId && !fieldInstanceIds.includes(c.instanceId));
  player.setupComplete = true;

  return { success: true };
}

export function drawSupportCards(player) {
  const drawn = [];
  for (let i = 0; i < SUPPORT_HAND_SIZE && player.deck.length > 0; i++) {
    const nextIdx = player.deck.findIndex((entry) => {
      const template = getCardTemplate(entry.templateId);
      return template?.type === 'unique';
    });
    if (nextIdx < 0) break;
    const [next] = player.deck.splice(nextIdx, 1);
    drawn.push(createBattleCard(next.templateId, next.instanceId));
  }
  player.supportHand.push(...drawn);
  return drawn;
}

export function advanceToBattlefield(game) {
  if (game.phase !== GAME_PHASES.SETUP) return false;
  if (!game.players.every(p => p.setupComplete)) return false;

  game.phase = GAME_PHASES.BATTLEFIELD;
  for (const player of game.players) {
    drawSupportCards(player);
  }
  game.log.push('Battlefield revealed! Support cards drawn.');
  return true;
}

export function startBattle(game) {
  if (game.phase !== GAME_PHASES.BATTLEFIELD) return false;
  game.phase = GAME_PHASES.BATTLE;
  game.log.push('Battle begins! Cards are charging...');
  return true;
}

export function tickCooldowns(game) {
  if (game.phase !== GAME_PHASES.BATTLE) return;

  for (const player of game.players) {
    for (const card of [player.boss, ...player.field]) {
      if (card && card.alive && card.cooldownRemaining > 0) {
        card.cooldownRemaining = Math.max(0, card.cooldownRemaining - 1);
      }
    }
  }
}

export function getReadyCards(player) {
  const cards = [];
  for (const card of [player.boss, ...player.field]) {
    if (card && card.alive && card.cooldownRemaining <= 0) {
      cards.push(card);
    }
  }
  return cards;
}

export function getOpponent(playerId, game) {
  return game.players.find(p => p.id !== playerId);
}

export function getAllFieldCards(player) {
  return [player.boss, ...player.field].filter(c => c && c.alive);
}

export function finishGame(game, winnerId) {
  game.phase = GAME_PHASES.FINISHED;
  game.winnerId = winnerId;
  const winner = game.players.find(p => p.id === winnerId);
  if (winner) winner.isWinner = true;
  game.log.push(`${winner?.username || 'Unknown'} wins the battle!`);
}

export function pickRandomCardFromDeck(deckCardIds) {
  if (!deckCardIds.length) return null;
  return deckCardIds[Math.floor(Math.random() * deckCardIds.length)];
}

export { cardData };
