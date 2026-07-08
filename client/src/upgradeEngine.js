import { getTimerPreview } from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import {
  COMBINE_STAT_BONUS,
  COMBINE_STAT_BOOST_COUNT,
  COMBINE_MAX_LEVEL,
} from '../../shared/combineRules.js';
import {
  FIGHTER_ABILITY_UNLOCK_LEVEL,
  isFighterAbility,
  resolveInheritedFighterAbility,
} from '../../shared/fighterAbilities.js';
import {
  getCardLevel,
  applyStatBoostChoices,
  isValidStatBoostChoices,
} from './combineEngine.js';

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

function getBaseStats(card) {
  return {
    attack: card.attack,
    defense: card.defense,
    hp: card.hp,
  };
}

function generateAutomaticBoostChoices(seed) {
  const options = COMBINE_STAT_BONUS.stats;
  const choices = [];
  for (let i = 0; i < COMBINE_STAT_BOOST_COUNT; i += 1) {
    const choice = seededPick(options, seed, 300 + i);
    if (!choice) return null;
    choices.push(choice);
  }
  return choices;
}

function buildUpgradedCard(card, { statBoostChoices, specialAbility } = {}) {
  const currentLevel = getCardLevel(card);
  if (currentLevel >= COMBINE_MAX_LEVEL) return null;
  const nextLevel = currentLevel + 1;
  const seed = `${card.id}|upgrade`;

  const base = getBaseStats(card);
  let { attack, defense, hp } = base;

  let bonus;
  if (statBoostChoices != null) {
    bonus = applyStatBoostChoices({ attack, defense, hp }, statBoostChoices);
  } else {
    const choices = generateAutomaticBoostChoices(seed);
    if (!choices) return null;
    bonus = applyStatBoostChoices({ attack, defense, hp }, choices);
  }

  if (!bonus.statBonus) return null;

  attack = bonus.stats.attack;
  defense = bonus.stats.defense;
  hp = bonus.stats.hp;
  const timer = getTimerPreview(attack);
  const name = generateCardName({ attack, defense, hp, timer }, seed);
  const resolvedAbility = resolveInheritedFighterAbility(card, card, nextLevel, specialAbility);

  return {
    attack,
    defense,
    hp,
    timer,
    level: nextLevel,
    statBonus: bonus.statBonus,
    name,
    parents: [card.id],
    specialAbility: resolvedAbility,
    needsAbilityChoice: nextLevel === FIGHTER_ABILITY_UNLOCK_LEVEL && !resolvedAbility,
  };
}

export function previewUpgrade(card, options = {}) {
  return buildUpgradedCard(card, options);
}

export function needsUpgradeAbilityChoice(card) {
  return getCardLevel(card) === FIGHTER_ABILITY_UNLOCK_LEVEL - 1;
}

export function createUpgradedCard(card, options = {}) {
  const { statBoostChoices, specialAbility } = options;
  if (statBoostChoices != null && !isValidStatBoostChoices(statBoostChoices)) return null;
  const currentLevel = getCardLevel(card);
  const nextLevel = currentLevel + 1;
  if (nextLevel === FIGHTER_ABILITY_UNLOCK_LEVEL && !isFighterAbility(specialAbility)) return null;

  const preview = buildUpgradedCard(card, { statBoostChoices, specialAbility });
  if (!preview) return null;

  const suffix = hashSeed(`${card.id}|upgrade`).toString(36);
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
