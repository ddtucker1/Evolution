import { getTimerPreview } from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import { COMBINE_MAX_LEVEL } from '../../shared/combineRules.js';
import {
  FIGHTER_ABILITY_UNLOCK_LEVEL,
  isFighterAbility,
  resolveInheritedFighterAbility,
} from '../../shared/fighterAbilities.js';
import {
  applyStatPointAllocations,
  isValidStatPointAllocations,
  STAT_KEYS,
} from '../../shared/cardStatRules.js';
import { getCardLevel } from './combineEngine.js';

function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getBaseStats(card) {
  return {
    attack: card.attack,
    defense: card.defense,
    hp: card.hp,
  };
}

function buildUpgradedCard(card, { statAllocations, specialAbility } = {}) {
  const currentLevel = getCardLevel(card);
  if (currentLevel >= COMBINE_MAX_LEVEL) return null;
  const nextLevel = currentLevel + 1;
  const seed = `${card.id}|upgrade`;

  const base = getBaseStats(card);
  const bonus = applyStatPointAllocations(base, statAllocations);
  if (!bonus.statBonus) return null;

  const { attack, defense, hp } = bonus.stats;
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

export function previewUpgradeAllocation(card, statAllocations) {
  if (!card || !statAllocations) return null;
  const base = getBaseStats(card);
  const next = { ...base };
  for (const key of STAT_KEYS) {
    const amount = statAllocations[key] ?? 0;
    if (amount > 0) next[key] = (next[key] ?? 0) + amount;
  }
  return next;
}

export function needsUpgradeAbilityChoice(card) {
  return getCardLevel(card) === FIGHTER_ABILITY_UNLOCK_LEVEL - 1;
}

export function createUpgradedCard(card, options = {}) {
  const { statAllocations, specialAbility } = options;
  if (!isValidStatPointAllocations(statAllocations)) return null;
  const currentLevel = getCardLevel(card);
  const nextLevel = currentLevel + 1;
  if (nextLevel === FIGHTER_ABILITY_UNLOCK_LEVEL && !isFighterAbility(specialAbility)) return null;

  const preview = buildUpgradedCard(card, { statAllocations, specialAbility });
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

export function createPurchasedCard(stats) {
  const timer = getTimerPreview(stats.attack);
  const seed = `${stats.attack},${stats.defense},${stats.hp}`;
  const name = generateCardName({ ...stats, timer }, seed);
  const suffix = hashSeed(seed).toString(36);
  return {
    id: `pur_${Date.now()}_${suffix}`,
    name,
    type: 'unique',
    attack: stats.attack,
    defense: stats.defense,
    hp: stats.hp,
    timer,
    level: 0,
    purchased: true,
  };
}
