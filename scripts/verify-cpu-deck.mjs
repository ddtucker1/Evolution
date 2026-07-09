/**
 * Node verification for CPU deck level-sum generation.
 * Mocks browser localStorage so offlineEngine can load a catalog.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

globalThis.localStorage = {
  _data: new Map(),
  getItem(key) {
    return this._data.has(key) ? this._data.get(key) : null;
  },
  setItem(key, value) {
    this._data.set(key, String(value));
  },
  removeItem(key) {
    this._data.delete(key);
  },
};

const {
  computeCpuTargetLevelSum,
  partitionLevelSum,
  generateCpuDeck,
  getDeckLevelSum,
  createCpuCardAtLevel,
  CPU_DECK_SIZE,
  CPU_MAX_LEVEL_SUM,
} = await import(pathToFileURL(path.join(root, 'client/src/cpuDeckGenerator.js')).href);

const { CARD_DATA, createOfflineGame, registerEvolvedCards } = await import(
  pathToFileURL(path.join(root, 'client/src/offlineEngine.js')).href
);
const { getCardLevel } = await import(
  pathToFileURL(path.join(root, 'client/src/combineEngine.js')).href
);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sum(arr) {
  return arr.reduce((a, b) => a + b, 0);
}

// Target sum mapping
assert(computeCpuTargetLevelSum(0) === 10, '0 → 10');
assert(computeCpuTargetLevelSum(26) === 36, '26 → 36');
assert(computeCpuTargetLevelSum(80) === 90, '80 → 90');
assert(computeCpuTargetLevelSum(81) === 90, '81 → 90');
assert(computeCpuTargetLevelSum(90) === 90, '90 → 90');
assert(computeCpuTargetLevelSum(100) === 90, '100 clamps to 90 then stays 90');
assert(computeCpuTargetLevelSum(-5) === 10, 'negative clamps to 0 then +10');

// Partition always sums correctly and respects bounds
for (const target of [0, 1, 10, 36, 45, 80, 90]) {
  for (let n = 0; n < 20; n += 1) {
    const levels = partitionLevelSum(target);
    assert(levels.length === CPU_DECK_SIZE, `partition length for ${target}`);
    assert(sum(levels) === target, `partition sum ${sum(levels)} !== ${target}`);
    assert(levels.every((l) => l >= 0 && l <= 9), `level out of range for ${target}`);
  }
}

// Card generation at each level
for (let level = 0; level <= 9; level += 1) {
  const card = createCpuCardAtLevel(level, CARD_DATA.unique, `verify_l${level}`);
  assert(card, `failed to create level ${level}`);
  assert(getCardLevel(card) === level, `card level ${getCardLevel(card)} !== ${level}`);
  if (level >= 5) {
    assert(card.specialAbility, `level ${level} missing special ability`);
  }
}

// Full deck generation matches target sum
for (const target of [10, 36, 50, 90]) {
  const deck = generateCpuDeck(target, { catalog: CARD_DATA.unique });
  assert(deck.ids.length === CPU_DECK_SIZE, 'deck size');
  assert(deck.cards.length === CPU_DECK_SIZE, 'cards size');
  assert(sum(deck.levels) === target, `generated levels sum ${sum(deck.levels)} !== ${target}`);
  const resolvedSum = deck.cards.reduce((s, c) => s + getCardLevel(c), 0);
  assert(resolvedSum === target, `resolved card levels sum ${resolvedSum} !== ${target}`);
}

// End-to-end offline game uses CPU target sum
const playerDeckIds = CARD_DATA.unique.slice(0, 10).map((c) => c.id);
const playerSum = getDeckLevelSum(playerDeckIds, (id) => CARD_DATA.unique.find((c) => c.id === id));
assert(playerSum === 0, 'base catalog cards should be level 0');
const expectedCpuSum = computeCpuTargetLevelSum(playerSum);
assert(expectedCpuSum === 10, 'expected CPU sum 10 for all-L0 player deck');

registerEvolvedCards([]);
const game = createOfflineGame(playerDeckIds);
const npc = game.players[1];
const npcCards = [
  ...npc.setupHand,
  ...npc.deck.map((entry) => {
    // deck entries are {templateId, instanceId}; resolve via setup-like make through game state
    return entry;
  }),
];

const npcTemplateIds = [
  ...npc.setupHand.map((c) => c.templateId),
  ...npc.deck.map((e) => e.templateId),
];
assert(npcTemplateIds.length === CPU_DECK_SIZE, 'npc deck should have 10 cards');
assert(npcTemplateIds.every((id) => id.startsWith('npc_')), 'npc cards should use npc_ ids');

const npcLevelSum = npc.setupHand.reduce((s, c) => s + (c.level || 0), 0)
  + npc.deck.reduce((s, e) => {
    // Look up remaining deck cards from LOOKUP via createOfflineGame registration —
    // levels are on battle cards in setupHand; for deck pile use template ids pattern npc_lN_
    const match = String(e.templateId).match(/^npc_l(\d+)_/);
    return s + (match ? Number(match[1]) : 0);
  }, 0);
assert(npcLevelSum === expectedCpuSum, `npc level sum ${npcLevelSum} !== ${expectedCpuSum}`);

// Player cards remain the original deck (not npc copies)
assert(game.players[0].setupHand.every((c) => !String(c.templateId).startsWith('npc_')), 'player should not get npc cards');

console.log('All CPU deck generator checks passed.');
console.log(JSON.stringify({
  playerSum,
  expectedCpuSum,
  npcLevelSum,
  npcTemplateIds,
  setupLevels: npc.setupHand.map((c) => c.level),
}, null, 2));
