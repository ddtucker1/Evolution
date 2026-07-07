import { getTimerPreview } from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import {
  COMBINE_STAT_BONUS,
  COMBINE_STAT_BOOST_COUNT,
  COMBINE_MAX_LEVEL,
  getLevelRule,
} from '../../shared/combineRules.js';
import {
  FIGHTER_ABILITY_UNLOCK_LEVEL,
  isFighterAbility,
  resolveInheritedFighterAbility,
} from '../../shared/fighterAbilities.js';

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

export function getCardLevel(card) {
  if (!card) return 0;
  if (card.level != null) return card.level;
  if (card.combined || card.id?.startsWith('evo_')) return 1;
  return 0;
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

function getBaseStats(card) {
  return {
    attack: card.attack,
    defense: card.defense,
    hp: card.hp,
  };
}

function formatStatLabel(stat) {
  if (stat === 'hp') return 'HP';
  return stat.charAt(0).toUpperCase() + stat.slice(1);
}

export function formatStatBoostLabel(allocations) {
  return Object.entries(allocations)
    .map(([stat, amount]) => `${formatStatLabel(stat)} +${amount}`)
    .join(', ');
}

export function isValidStatBoostChoices(choices) {
  if (!Array.isArray(choices) || choices.length !== COMBINE_STAT_BOOST_COUNT) return false;
  const validStats = new Set(COMBINE_STAT_BONUS.stats);
  return choices.every((stat) => validStats.has(stat));
}

function generateAutomaticBoostChoices(seed, deterministic) {
  const options = COMBINE_STAT_BONUS.stats;
  const choices = [];
  for (let i = 0; i < COMBINE_STAT_BOOST_COUNT; i += 1) {
    const choice = deterministic
      ? seededPick(options, seed, 300 + i)
      : randomPick(options);
    if (!choice) return null;
    choices.push(choice);
  }
  return choices;
}

export function applyStatBoostChoices(stats, choices, { allowPartial = false } = {}) {
  const validStats = new Set(COMBINE_STAT_BONUS.stats);
  if (!Array.isArray(choices)) {
    return { stats, statBonus: null };
  }
  if (choices.some((stat) => !validStats.has(stat))) {
    return { stats, statBonus: null };
  }
  if (!allowPartial && !isValidStatBoostChoices(choices)) {
    return { stats, statBonus: null };
  }
  if (allowPartial && choices.length > COMBINE_STAT_BOOST_COUNT) {
    return { stats, statBonus: null };
  }
  if (!choices.length) {
    return { stats, statBonus: null };
  }

  const amount = COMBINE_STAT_BONUS.amount;
  const next = { ...stats };
  const allocations = {};

  for (const stat of choices) {
    next[stat] = (next[stat] ?? 0) + amount;
    allocations[stat] = (allocations[stat] ?? 0) + amount;
  }

  return {
    stats: next,
    statBonus: {
      allocations,
      choices: [...choices],
      label: formatStatBoostLabel(allocations),
    },
  };
}

function buildCombinedCard(card1, card2, { deterministic = false, statBoostChoices, allowPartialBoosts = false, specialAbility } = {}) {
  const seed = [card1.id, card2.id].sort().join('|');
  const level = computeOutputLevel(card1, card2);
  if (level == null) return null;

  const base = getBaseStats(card1);
  let { attack, defense, hp } = base;

  let bonus;
  if (statBoostChoices != null) {
    bonus = applyStatBoostChoices(
      { attack, defense, hp },
      statBoostChoices,
      { allowPartial: allowPartialBoosts },
    );
  } else {
    const choices = generateAutomaticBoostChoices(seed, deterministic);
    if (!choices) return null;
    bonus = applyStatBoostChoices({ attack, defense, hp }, choices);
  }

  if (!bonus.statBonus && statBoostChoices == null) return null;

  attack = bonus.stats.attack;
  defense = bonus.stats.defense;
  hp = bonus.stats.hp;
  const timer = getTimerPreview(attack);

  const name = generateCardName({ attack, defense, hp, timer }, seed);
  const resolvedAbility = resolveInheritedFighterAbility(card1, card2, level, specialAbility);

  return {
    attack,
    defense,
    hp,
    timer,
    level,
    statBonus: bonus.statBonus,
    name,
    parents: [card1.id, card2.id],
    specialAbility: resolvedAbility,
    needsAbilityChoice: level === FIGHTER_ABILITY_UNLOCK_LEVEL && !resolvedAbility,
  };
}

export function previewCombine(card1, card2, options = {}) {
  if (!canCombineCards(card1, card2)) return null;
  return buildCombinedCard(card1, card2, {
    deterministic: true,
    allowPartialBoosts: true,
    ...options,
  });
}

export function createCombinedCard(card1, card2, options = {}) {
  const { deterministic = false, statBoostChoices, specialAbility } = options;
  if (statBoostChoices != null && !isValidStatBoostChoices(statBoostChoices)) return null;
  const outputLevel = computeOutputLevel(card1, card2);
  if (outputLevel === FIGHTER_ABILITY_UNLOCK_LEVEL && !isFighterAbility(specialAbility)) return null;
  const preview = buildCombinedCard(card1, card2, { deterministic, statBoostChoices, specialAbility });
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
    specialAbility: preview.specialAbility || null,
  };
}

export function getLevelDigit(card) {
  return String(getCardLevel(card));
}

export function getLevelLabel(level) {
  if (level == null || level < 0 || level > COMBINE_MAX_LEVEL) return null;
  return `Level ${level}`;
}

export function needsFighterAbilityChoice(card1, card2) {
  return computeOutputLevel(card1, card2) === FIGHTER_ABILITY_UNLOCK_LEVEL;
}

export function getInheritedFighterAbilityPreview(card1, card2) {
  const outputLevel = computeOutputLevel(card1, card2);
  if (outputLevel == null) return null;
  return resolveInheritedFighterAbility(card1, card2, outputLevel, null);
}
