import { getTimerPreview } from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import {
  COMBINE_STAT_BONUS,
  COMBINE_MAX_LEVEL,
  getLevelRule,
} from '../../shared/combineRules.js';

function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed, salt = 0) {
  const h = hashSeed(`${seed}:${salt}`);
  return (h % 10000) / 10000;
}

function seededPick(arr, seed, salt = 0) {
  if (!arr.length) return null;
  const idx = Math.floor(seededRandom(seed, salt) * arr.length);
  return arr[idx];
}

function randomPick(arr) {
  if (!arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function averageStat(a, b) {
  return Math.round((a + b) / 2);
}

export function getCardLevel(card) {
  if (!card) return 0;
  if (card.level != null) return card.level;
  if (card.combined || card.id?.startsWith('evo_')) return 1;
  return 0;
}

function getCardTimer(card) {
  if (card.timer != null) return Math.round(card.timer);
  return getTimerPreview(card.attack);
}

function computeOutputLevel(card1, card2) {
  const level1 = getCardLevel(card1);
  const level2 = getCardLevel(card2);
  if (level1 !== level2) return null;
  const rule = getLevelRule(level1);
  if (!rule) return null;
  return Math.min(rule.outputLevel, COMBINE_MAX_LEVEL);
}

export function canCombineCards(card1, card2) {
  if (!card1 || !card2) return false;
  return getCardLevel(card1) === getCardLevel(card2) && computeOutputLevel(card1, card2) != null;
}

function buildCombinedCard(card1, card2, { deterministic = false } = {}) {
  const seed = [card1.id, card2.id].sort().join('|');
  const level = computeOutputLevel(card1, card2);
  if (level == null) return null;

  let attack = averageStat(card1.attack, card2.attack);
  let defense = averageStat(card1.defense, card2.defense);
  let hp = averageStat(card1.hp, card2.hp);
  let timer = averageStat(getCardTimer(card1), getCardTimer(card2));

  const bonus = applyStatBonus({ attack, defense, hp }, seed, deterministic);
  attack = bonus.stats.attack;
  defense = bonus.stats.defense;
  hp = bonus.stats.hp;

  const name = generateCardName({ attack, defense, hp, timer }, seed);

  return {
    attack,
    defense,
    hp,
    timer,
    level,
    statBonus: bonus.statBonus,
    name,
    parents: [card1.id, card2.id],
  };
}

function applyStatBonus(stats, seed, deterministic) {
  const options = COMBINE_STAT_BONUS.stats;
  const choice = deterministic
    ? seededPick(options, seed, 300)
    : randomPick(options);
  if (!choice) return { stats, statBonus: null };

  const amount = COMBINE_STAT_BONUS.amount;
  const next = { ...stats };
  next[choice] = next[choice] + amount;
  const label = choice === 'hp'
    ? `HP +${amount}`
    : `${choice.charAt(0).toUpperCase() + choice.slice(1)} +${amount}`;
  return { stats: next, statBonus: { stat: choice, label } };
}

export function previewCombine(card1, card2) {
  if (!canCombineCards(card1, card2)) return null;
  return buildCombinedCard(card1, card2, { deterministic: true });
}

export function createCombinedCard(card1, card2, options = {}) {
  const { deterministic = false } = options;
  const preview = buildCombinedCard(card1, card2, { deterministic });
  if (!preview) return null;
  const suffix = deterministic
    ? hashSeed([card1.id, card2.id].sort().join('|')).toString(36)
    : Math.random().toString(36).slice(2, 8);
  return {
    id: `evo_${Date.now()}_${suffix}`,
    name: preview.name,
    type: 'unique',
    attack: preview.attack,
    defense: preview.defense,
    hp: preview.hp,
    timer: preview.timer,
    level: preview.level,
    statBonus: preview.statBonus,
    parents: preview.parents,
    combined: true,
  };
}

export function getLevelDigit(card) {
  return String(getCardLevel(card));
}

export function getLevelLabel(level) {
  if (level == null || level < 0 || level > COMBINE_MAX_LEVEL) return null;
  return `Level ${level}`;
}

// Backward-compatible aliases
export const previewEvolve = previewCombine;
export const createEvolvedCard = createCombinedCard;
