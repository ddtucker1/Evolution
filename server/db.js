import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { DEFAULT_DECK_CAP, PREMIUM_DECK_CAP } from './game/CardEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = join(__dirname, 'data', 'game.db');

let db;

export function initDatabase() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      deck_cap INTEGER DEFAULT ${DEFAULT_DECK_CAP},
      premium INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      card_id TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, card_id)
    );

    CREATE TABLE IF NOT EXISTS match_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      winner_id TEXT,
      loser_id TEXT,
      mode TEXT,
      transferred_card TEXT,
      played_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export function getDb() {
  return db;
}

const STARTER_CARDS = [
  'uni_knight', 'uni_archer', 'uni_mage', 'uni_rogue',
  'uni_paladin', 'uni_druid', 'uni_serpent', 'uni_wraith',
  'std_shield', 'std_sword', 'std_poison', 'std_heal',
  'std_bolt', 'std_haste', 'std_curse', 'std_fortify',
  'uni_berserker', 'uni_golem', 'uni_phoenix', 'std_shield',
];

export function createUser(id, username, password) {
  const passwordHash = bcrypt.hashSync(password, 10);
  const insert = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
  insert.run(id, username, passwordHash);

  const counts = {};
  for (const cardId of STARTER_CARDS) {
    counts[cardId] = (counts[cardId] || 0) + 1;
  }

  const cardInsert = db.prepare(
    'INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, ?)'
  );
  for (const [cardId, quantity] of Object.entries(counts)) {
    cardInsert.run(id, cardId, quantity);
  }

  return getUserById(id);
}

export function getUserByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function verifyPassword(user, password) {
  return bcrypt.compareSync(password, user.password_hash);
}

export function getUserCards(userId) {
  return db.prepare('SELECT card_id, quantity FROM user_cards WHERE user_id = ?').all(userId);
}

export function getUserDeckCardIds(userId) {
  const cards = getUserCards(userId);
  const deck = [];
  for (const { card_id, quantity } of cards) {
    for (let i = 0; i < quantity; i++) deck.push(card_id);
  }
  return deck;
}

export function getDeckCount(userId) {
  const result = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM user_cards WHERE user_id = ?').get(userId);
  return result.total;
}

export function canAddCard(userId) {
  const user = getUserById(userId);
  const count = getDeckCount(userId);
  return count < user.deck_cap;
}

export function addCardToUser(userId, cardId) {
  const existing = db.prepare('SELECT quantity FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId);
  if (existing) {
    db.prepare('UPDATE user_cards SET quantity = quantity + 1 WHERE user_id = ? AND card_id = ?').run(userId, cardId);
  } else {
    db.prepare('INSERT INTO user_cards (user_id, card_id, quantity) VALUES (?, ?, 1)').run(userId, cardId);
  }
}

export function removeCardFromUser(userId, cardId) {
  const existing = db.prepare('SELECT quantity FROM user_cards WHERE user_id = ? AND card_id = ?').get(userId, cardId);
  if (!existing) return false;
  if (existing.quantity <= 1) {
    db.prepare('DELETE FROM user_cards WHERE user_id = ? AND card_id = ?').run(userId, cardId);
  } else {
    db.prepare('UPDATE user_cards SET quantity = quantity - 1 WHERE user_id = ? AND card_id = ?').run(userId, cardId);
  }
  return true;
}

export function upgradeDeckCap(userId) {
  const user = getUserById(userId);
  if (user.premium) return { success: false, message: 'Already upgraded' };
  db.prepare('UPDATE users SET deck_cap = ?, premium = 1 WHERE id = ?').run(PREMIUM_DECK_CAP, userId);
  return { success: true, newCap: PREMIUM_DECK_CAP };
}

export function recordMatch(winnerId, loserId, mode, transferredCard = null) {
  db.prepare('INSERT INTO match_history (winner_id, loser_id, mode, transferred_card) VALUES (?, ?, ?, ?)')
    .run(winnerId, loserId, mode, transferredCard);
}

export function transferCompetitiveCard(winnerId, loserId) {
  const loserCards = getUserCards(loserId);
  if (!loserCards.length) return null;

  const allIds = [];
  for (const { card_id, quantity } of loserCards) {
    for (let i = 0; i < quantity; i++) allIds.push(card_id);
  }

  const cardId = allIds[Math.floor(Math.random() * allIds.length)];
  removeCardFromUser(loserId, cardId);

  if (canAddCard(winnerId)) {
    addCardToUser(winnerId, cardId);
  }

  recordMatch(winnerId, loserId, 'competitive', cardId);
  return cardId;
}

export function getPublicProfile(userId) {
  const user = getUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    deckCap: user.deck_cap,
    premium: !!user.premium,
    deckCount: getDeckCount(userId),
    cards: getUserCards(userId),
  };
}
