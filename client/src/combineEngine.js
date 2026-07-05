import { getTimerPreview } from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import {
  COMBINE_STAT_BONUS,
  COMBINE_MAX_LEVEL,
  getLevelRule,
  getAbilityPoolForTier,
  buildAbilityEntry,
  getAbilityDisplayName,
} from '../../shared/combineRules.js';

export { getAbilityDisplayName };

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

export function getCardAbilities(card) {
  if (!card) return [];
  let abilities = [];
  if (Array.isArray(card.abilities) && card.abilities.length) {
    abilities = card.abilities;
  } else if (card.ability?.id || card.ability?.type) {
    const legacyId = card.ability.id || card.ability.type;
    const entry = buildAbilityEntry(legacyId);
    if (entry) abilities = [entry];
  }
  return abilities.slice(0, 1);
}

function getPrimaryAbility(card) {
  return getCardAbilities(card)[0] || null;
}

function pickParentAbility(card1, card2, seed, deterministic) {
  const candidates = [getPrimaryAbility(card1), getPrimaryAbility(card2)].filter(Boolean);
  if (!candidates.length) return null;
  return deterministic
    ? seededPick(candidates, seed, 500)
    : randomPick(candidates);
}

export function upgradeAbility(ability) {
  if (!ability) return null;
  const displayName = ability.name || getAbilityDisplayName(ability);
  return {
    ...ability,
    name: `${displayName}2`,
    strength: (ability.strength || 1) * 2,
    upgraded: true,
  };
}

function getNewAbilityTier(inputLevel) {
  const rule = getLevelRule(inputLevel);
  if (rule?.newAbilityTier != null) return rule.newAbilityTier;
  return Math.min(inputLevel, 2);
}

function pickRandomAbilityFromTier(tier, seed, deterministic, salt = 400) {
  const pool = getAbilityPoolForTier(tier)
    .map((def) => buildAbilityEntry(def.id))
    .filter(Boolean);
  return deterministic
    ? seededPick(pool, seed, salt)
    : randomPick(pool);
}

function resolveSingleAbility(card1, card2, seed, deterministic, abilityChoice) {
  const inputLevel = getCardLevel(card1);
  const rule = getLevelRule(inputLevel);

  if (!rule) return [];

  if (inputLevel === 0) {
    const choice = pickRandomAbilityFromTier(0, seed, deterministic);
    return choice ? [choice] : [];
  }

  if (abilityChoice === 'upgrade') {
    const parent = pickParentAbility(card1, card2, seed, deterministic);
    const upgraded = parent ? upgradeAbility(parent) : null;
    if (upgraded) return [upgraded];
  }

  const tier = getNewAbilityTier(inputLevel);
  const choice = pickRandomAbilityFromTier(tier, seed, deterministic, 401);
  return choice ? [choice] : [];
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

export function needsAbilityChoice(card1, card2) {
  if (!canCombineCards(card1, card2)) return false;
  const rule = getLevelRule(getCardLevel(card1));
  return Boolean(rule?.requiresAbilityChoice);
}

export function getCombineAbilityChoiceContext(card1, card2) {
  if (!needsAbilityChoice(card1, card2)) return null;
  const seed = [card1.id, card2.id].sort().join('|');
  const inputLevel = getCardLevel(card1);
  const upgradeSource = pickParentAbility(card1, card2, seed, true);
  const upgradedPreview = upgradeSource ? upgradeAbility(upgradeSource) : null;
  const newTier = getNewAbilityTier(inputLevel);
  const newPool = getAbilityPoolForTier(newTier)
    .map((def) => buildAbilityEntry(def.id))
    .filter(Boolean);

  return {
    inputLevel,
    outputLevel: computeOutputLevel(card1, card2),
    upgradeSource,
    upgradedPreview,
    newAbilityTier: newTier,
    newAbilityOptions: newPool.map((a) => a.name),
  };
}

function buildCombinedCard(card1, card2, { deterministic = false, abilityChoice } = {}) {
  const seed = [card1.id, card2.id].sort().join('|');
  const inputLevel = getCardLevel(card1);
  const level = computeOutputLevel(card1, card2);
  if (level == null) return null;

  const rule = getLevelRule(inputLevel);
  if (!rule) return null;

  if (rule.requiresAbilityChoice && !abilityChoice) return null;

  let attack = averageStat(card1.attack, card2.attack);
  let defense = averageStat(card1.defense, card2.defense);
  let hp = averageStat(card1.hp, card2.hp);
  let timer = averageStat(getCardTimer(card1), getCardTimer(card2));

  const bonus = applyStatBonus({ attack, defense, hp }, seed, deterministic);
  attack = bonus.stats.attack;
  defense = bonus.stats.defense;
  hp = bonus.stats.hp;

  const abilities = resolveSingleAbility(card1, card2, seed, deterministic, abilityChoice);
  const name = generateCardName({ attack, defense, hp, timer }, seed);

  return {
    attack,
    defense,
    hp,
    timer,
    level,
    statBonus: bonus.statBonus,
    abilities,
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

export function previewCombine(card1, card2, options = {}) {
  if (!canCombineCards(card1, card2)) return null;
  const abilityChoice = options.abilityChoice
    ?? (needsAbilityChoice(card1, card2) ? 'new' : undefined);
  return buildCombinedCard(card1, card2, { deterministic: true, abilityChoice });
}

export function createCombinedCard(card1, card2, options = {}) {
  const { abilityChoice, deterministic = false } = options;
  const preview = buildCombinedCard(card1, card2, { deterministic, abilityChoice });
  if (!preview) return null;
  const suffix = deterministic
    ? hashSeed([card1.id, card2.id, abilityChoice || 'auto'].sort().join('|')).toString(36)
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
    abilities: preview.abilities,
    parents: preview.parents,
    combined: true,
  };
}

export function getAbilityLabels(card) {
  return getCardAbilities(card).map((a) => getAbilityDisplayName(a)).filter(Boolean);
}

export function getPrimaryAbilityLabel(card) {
  const labels = getAbilityLabels(card);
  return labels[0] || '';
}

export function getLevelLabel(level) {
  if (level === 0) return 'Level 0';
  if (level === 1) return 'Level 1';
  if (level === 2) return 'Level 2';
  if (level === 3) return 'Level 3';
  return null;
}

export function getLevelDigit(card) {
  return String(getCardLevel(card));
}

export function getAbilityStrength(ability) {
  return ability?.strength || 1;
}

// Backward-compatible aliases
export const previewEvolve = previewCombine;
export const createEvolvedCard = createCombinedCard;
