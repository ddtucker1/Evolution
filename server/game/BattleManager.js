import { v4 as uuidv4 } from 'uuid';
import {
  createGameState,
  completeSetup,
  advanceToBattlefield,
  startBattle,
  tickCooldowns,
  applyStandardCard,
  resolveAttack,
  checkWinner,
  getPlayerPrivateState,
  getReadyCards,
  getOpponent,
  getAllFieldCards,
  finishGame,
  pickRandomCardFromDeck,
  BATTLE_MODES,
  GAME_PHASES,
} from './CardEngine.js';

const activeGames = new Map();
const playerGameMap = new Map();

export function getGame(gameId) {
  return activeGames.get(gameId);
}

export function getPlayerGame(playerId) {
  return playerGameMap.get(playerId);
}

export function createNPCGame(playerId, username, deckCardIds) {
  const gameId = uuidv4();
  const npcId = `npc_${uuidv4().slice(0, 8)}`;
  const npcDeck = generateNPCDeck(deckCardIds);

  const game = createGameState(gameId, BATTLE_MODES.NPC, [
    { id: playerId, username, deckCardIds },
    { id: npcId, username: 'CPU Opponent', deckCardIds: npcDeck },
  ]);

  game.isNPC = true;
  game.npcId = npcId;

  activeGames.set(gameId, game);
  playerGameMap.set(playerId, gameId);

  autoNPCSetup(game);
  return game;
}

export function createPvPGame(mode, player1, player2) {
  const gameId = uuidv4();
  const game = createGameState(gameId, mode, [
    { id: player1.id, username: player1.username, deckCardIds: player1.deckCardIds },
    { id: player2.id, username: player2.username, deckCardIds: player2.deckCardIds },
  ]);

  activeGames.set(gameId, game);
  playerGameMap.set(player1.id, gameId);
  playerGameMap.set(player2.id, gameId);

  return game;
}

function generateNPCDeck(playerDeck) {
  const uniqueIds = [
    'uni_knight', 'uni_archer', 'uni_mage', 'uni_golem',
    'uni_rogue', 'uni_paladin', 'uni_berserker', 'uni_druid',
  ];
  const standardIds = [
    'std_shield', 'std_sword', 'std_poison', 'std_heal',
    'std_bolt', 'std_haste', 'std_curse', 'std_fortify',
  ];

  const deck = [];
  for (let i = 0; i < 12; i++) deck.push(uniqueIds[i % uniqueIds.length]);
  for (let i = 0; i < 8; i++) deck.push(standardIds[i % standardIds.length]);
  return deck;
}

function autoNPCSetup(game) {
  const npc = game.players.find(p => p.id === game.npcId);
  if (!npc || !npc.setupHand.length) return;

  const hand = [...npc.setupHand];
  const boss = hand.reduce((best, c) => (c.maxHp > (best?.maxHp || 0) ? c : best), hand[0]);
  const field = hand.filter(c => c.instanceId !== boss.instanceId).slice(0, 3);
  completeSetup(npc, boss.instanceId, field.map(c => c.instanceId));
}

export function handlePlayerSetup(gameId, playerId, bossInstanceId, fieldInstanceIds) {
  const game = activeGames.get(gameId);
  if (!game) return { success: false, message: 'Game not found' };

  const player = game.players.find(p => p.id === playerId);
  const result = completeSetup(player, bossInstanceId, fieldInstanceIds);
  if (!result.success) return result;

  if (game.players.every(p => p.setupComplete)) {
    advanceToBattlefield(game);
    startBattle(game);
    startGameTick(game);
    if (game.isNPC) scheduleNPCActions(game);
  }

  return { success: true, game };
}

export function handleUseStandardCard(gameId, playerId, cardInstanceId, targetInstanceId, targetPlayerId) {
  const game = activeGames.get(gameId);
  if (!game || game.phase !== GAME_PHASES.BATTLE) {
    return { success: false, message: 'Cannot use card now' };
  }

  const player = game.players.find(p => p.id === playerId);
  const card = player.supportHand.find(c => c.instanceId === cardInstanceId && !c.used);
  if (!card) return { success: false, message: 'Card not found' };

  const targetPlayer = game.players.find(p => p.id === targetPlayerId);
  if (!targetPlayer) return { success: false, message: 'Target player not found' };

  const target = getAllFieldCards(targetPlayer).find(c => c.instanceId === targetInstanceId);
  const result = applyStandardCard(card, target);
  if (result.success) {
    game.log.push(`${player.username}: ${result.message}`);
    checkAndFinish(game);
  }
  return { ...result, game };
}

export function handleAttack(gameId, playerId, attackerInstanceId, defenderInstanceId) {
  const game = activeGames.get(gameId);
  if (!game || game.phase !== GAME_PHASES.BATTLE) {
    return { success: false, message: 'Cannot attack now' };
  }

  const player = game.players.find(p => p.id === playerId);
  const opponent = getOpponent(playerId, game);

  const attacker = getAllFieldCards(player).find(c => c.instanceId === attackerInstanceId);
  const defender = getAllFieldCards(opponent).find(c => c.instanceId === defenderInstanceId);

  if (!attacker || attacker.cooldownRemaining > 0) {
    return { success: false, message: 'Attacker not ready' };
  }
  if (!defender) return { success: false, message: 'Invalid defender' };

  const result = resolveAttack(attacker, defender);
  if (result.success) {
    game.log.push(result.message);
    checkAndFinish(game);
  }
  return { ...result, game };
}

function checkAndFinish(game) {
  const [p1, p2] = game.players;
  const winnerId = checkWinner(p1, p2);
  if (winnerId) {
    stopGameTick(game);
    finishGame(game, winnerId);
  }
}

function startGameTick(game) {
  if (game.tickInterval) return;
  game.tickInterval = setInterval(() => {
    tickCooldowns(game);
    if (game.isNPC) runNPCBattleAI(game);
    checkAndFinish(game);
    broadcastGameState(game);
  }, 1000);
}

function stopGameTick(game) {
  if (game.tickInterval) {
    clearInterval(game.tickInterval);
    game.tickInterval = null;
  }
}

function broadcastGameState(game) {
  if (game.onUpdate) game.onUpdate(game);
}

export function setGameUpdateHandler(gameId, handler) {
  const game = activeGames.get(gameId);
  if (game) game.onUpdate = handler;
}

export function getGameStateForPlayer(gameId, playerId) {
  const game = activeGames.get(gameId);
  if (!game) return null;
  return getPlayerPrivateState(game, playerId);
}

function scheduleNPCActions(game) {
  game.npcInterval = setInterval(() => {
    if (game.phase === GAME_PHASES.FINISHED) {
      clearInterval(game.npcInterval);
      return;
    }
    runNPCBattleAI(game);
    runNPCSupportAI(game);
  }, 2000);
}

function runNPCSupportAI(game) {
  const npc = game.players.find(p => p.id === game.npcId);
  const human = game.players.find(p => p.id !== game.npcId);
  if (!npc || game.phase !== GAME_PHASES.BATTLE) return;

  const unused = npc.supportHand.filter(c => !c.used);
  if (!unused.length) return;

  const card = unused[0];
  const isBuff = ['buff_attack', 'buff_defense', 'buff_both', 'heal', 'reduce_cooldown'].includes(card.effect);

  let target;
  if (isBuff) {
    const targets = getAllFieldCards(npc);
    target = targets.find(c => c.hp < c.maxHp) || targets[0];
    if (target) {
      const result = applyStandardCard(card, target);
      if (result.success) game.log.push(`CPU: ${result.message}`);
    }
  } else {
    const targets = getAllFieldCards(human);
    target = targets[0];
    if (target) {
      const result = applyStandardCard(card, target);
      if (result.success) game.log.push(`CPU: ${result.message}`);
    }
  }
  checkAndFinish(game);
}

function runNPCBattleAI(game) {
  const npc = game.players.find(p => p.id === game.npcId);
  const human = game.players.find(p => p.id !== game.npcId);
  if (!npc || game.phase !== GAME_PHASES.BATTLE) return;

  const ready = getReadyCards(npc);
  if (!ready.length) return;

  const attacker = ready[0];
  const targets = getAllFieldCards(human);
  if (!targets.length) return;

  const defender = targets.reduce((best, t) => (t.hp < best.hp ? t : best), targets[0]);
  const result = resolveAttack(attacker, defender);
  if (result.success) game.log.push(`CPU: ${result.message}`);
  checkAndFinish(game);
}

export function cleanupGame(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;

  stopGameTick(game);
  if (game.npcInterval) clearInterval(game.npcInterval);

  for (const player of game.players) {
    if (!player.id.startsWith('npc_')) {
      playerGameMap.delete(player.id);
    }
  }
  activeGames.delete(gameId);
}

export function getCompetitiveTransfer(loserDeckCardIds) {
  return pickRandomCardFromDeck(loserDeckCardIds);
}

export { BATTLE_MODES, GAME_PHASES };
