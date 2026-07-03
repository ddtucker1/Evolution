import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import {
  initDatabase,
  createUser,
  getUserByUsername,
  getUserById,
  verifyPassword,
  getPublicProfile,
  fuseCards,
  upgradeDeckCap,
  transferCompetitiveCard,
  getUserDeckCardIds,
} from './db.js';

import {
  createNPCGame,
  createPvPGame,
  handlePlayerSetup,
  handleUseStandardCard,
  handleAttack,
  getGameStateForPlayer,
  setGameUpdateHandler,
  cleanupGame,
  getPlayerGame,
  getGame,
  BATTLE_MODES,
} from './game/BattleManager.js';

import { getAllStandardCards, getAllUniqueCards, getFusionRecipes } from './game/CardEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'card-fusion-battle-secret-dev';
const PORT = process.env.PORT || 3001;

initDatabase();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

const matchmakingQueues = {
  [BATTLE_MODES.CASUAL]: [],
  [BATTLE_MODES.COMPETITIVE]: [],
};

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', online: true });
});

app.get('/api/cards', (_req, res) => {
  res.json({
    standard: getAllStandardCards(),
    unique: getAllUniqueCards(),
    fusions: getFusionRecipes(),
  });
});

app.post('/api/auth/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password || password.length < 4) {
    return res.status(400).json({ error: 'Username and password (4+ chars) required' });
  }
  if (getUserByUsername(username)) {
    return res.status(409).json({ error: 'Username taken' });
  }
  const user = createUser(uuidv4(), username, password);
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: getPublicProfile(user.id) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = getUserByUsername(username);
  if (!user || !verifyPassword(user, password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: getPublicProfile(user.id) });
});

app.get('/api/profile', authMiddleware, (req, res) => {
  res.json(getPublicProfile(req.user.id));
});

app.post('/api/fuse', authMiddleware, (req, res) => {
  const { cardIds } = req.body;
  if (!Array.isArray(cardIds) || cardIds.length < 2 || cardIds.length > 3) {
    return res.status(400).json({ error: 'Select 2 or 3 cards to fuse' });
  }
  const result = fuseCards(req.user.id, cardIds);
  if (!result.success) return res.status(400).json(result);
  res.json({ ...result, user: getPublicProfile(req.user.id) });
});

app.post('/api/upgrade-deck', authMiddleware, (req, res) => {
  const result = upgradeDeckCap(req.user.id);
  if (!result.success) return res.status(400).json(result);
  res.json({ ...result, user: getPublicProfile(req.user.id), message: 'Deck cap upgraded to 60!' });
});

const clientDist = join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) return next();
  res.sendFile(join(clientDist, 'index.html'), err => {
    if (err) res.status(404).json({ error: 'Client not built' });
  });
});

const socketUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.user.id;
  socketUsers.set(userId, socket.id);
  socket.join(`user:${userId}`);

  socket.on('start_npc_battle', () => {
    if (getPlayerGame(userId)) {
      return socket.emit('error', { message: 'Already in a game' });
    }
    const deck = getUserDeckCardIds(userId);
    const game = createNPCGame(userId, socket.user.username, deck);
    setupGameHandlers(game.id, io);
    socket.emit('game_state', getGameStateForPlayer(game.id, userId));
  });

  socket.on('find_match', ({ mode }) => {
    if (![BATTLE_MODES.CASUAL, BATTLE_MODES.COMPETITIVE].includes(mode)) {
      return socket.emit('error', { message: 'Invalid mode' });
    }
    if (getPlayerGame(userId)) {
      return socket.emit('error', { message: 'Already in a game' });
    }

    const queue = matchmakingQueues[mode];
    const waiting = queue.find(p => p.userId !== userId);

    if (waiting) {
      queue.splice(queue.indexOf(waiting), 1);
      const player1 = { id: waiting.userId, username: waiting.username, deckCardIds: getUserDeckCardIds(waiting.userId) };
      const player2 = { id: userId, username: socket.user.username, deckCardIds: getUserDeckCardIds(userId) };
      const game = createPvPGame(mode, player1, player2);
      setupGameHandlers(game.id, io);

      io.to(`user:${player1.id}`).emit('match_found', { gameId: game.id, mode });
      io.to(`user:${player2.id}`).emit('match_found', { gameId: game.id, mode });
      io.to(`user:${player1.id}`).emit('game_state', getGameStateForPlayer(game.id, player1.id));
      io.to(`user:${player2.id}`).emit('game_state', getGameStateForPlayer(game.id, player2.id));
    } else {
      queue.push({ userId, username: socket.user.username, socketId: socket.id });
      socket.emit('matchmaking', { mode, message: 'Searching for opponent...' });
    }
  });

  socket.on('cancel_matchmaking', ({ mode }) => {
    const queue = matchmakingQueues[mode];
    if (!queue) return;
    const idx = queue.findIndex(p => p.userId === userId);
    if (idx >= 0) queue.splice(idx, 1);
    socket.emit('matchmaking_cancelled');
  });

  socket.on('setup', ({ bossInstanceId, fieldInstanceIds }) => {
    const gameId = getPlayerGame(userId);
    if (!gameId) return socket.emit('error', { message: 'No active game' });
    const result = handlePlayerSetup(gameId, userId, bossInstanceId, fieldInstanceIds);
    if (!result.success) return socket.emit('error', { message: result.message });
    broadcastGameState(gameId, io);
  });

  socket.on('use_standard_card', ({ cardInstanceId, targetInstanceId, targetPlayerId }) => {
    const gameId = getPlayerGame(userId);
    if (!gameId) return;
    const result = handleUseStandardCard(gameId, userId, cardInstanceId, targetInstanceId, targetPlayerId);
    if (!result.success) return socket.emit('error', { message: result.message });
    broadcastGameState(gameId, io);
  });

  socket.on('attack', ({ attackerInstanceId, defenderInstanceId }) => {
    const gameId = getPlayerGame(userId);
    if (!gameId) return;
    const result = handleAttack(gameId, userId, attackerInstanceId, defenderInstanceId);
    if (!result.success) return socket.emit('error', { message: result.message });
    broadcastGameState(gameId, io);
  });

  socket.on('leave_game', () => {
    const gameId = getPlayerGame(userId);
    if (gameId) {
      cleanupGame(gameId);
      socket.emit('game_left');
    }
  });

  socket.on('disconnect', () => {
    socketUsers.delete(userId);
    for (const mode of Object.keys(matchmakingQueues)) {
      const queue = matchmakingQueues[mode];
      const idx = queue.findIndex(p => p.userId === userId);
      if (idx >= 0) queue.splice(idx, 1);
    }
  });
});

function setupGameHandlers(gameId, io) {
  setGameUpdateHandler(gameId, (game) => {
    broadcastGameState(gameId, io);
    if (game.winnerId && game.mode === BATTLE_MODES.COMPETITIVE) {
      const loser = game.players.find(p => p.id !== game.winnerId && !p.id.startsWith('npc_'));
      const winner = game.players.find(p => p.id === game.winnerId);
      if (loser && winner && !loser.id.startsWith('npc_')) {
        const transferred = transferCompetitiveCard(winner.id, loser.id);
        io.to(`user:${winner.id}`).emit('card_won', { cardId: transferred });
        io.to(`user:${loser.id}`).emit('card_lost', { cardId: transferred });
      }
    }
  });
}

function broadcastGameState(gameId, io) {
  const game = getGame(gameId);
  if (!game) return;

  for (const player of game.players) {
    if (player.id.startsWith('npc_')) continue;
    const state = getGameStateForPlayer(gameId, player.id);
    io.to(`user:${player.id}`).emit('game_state', state);
  }
}

httpServer.listen(PORT, () => {
  console.log(`Card Fusion Battle server running on port ${PORT}`);
});
