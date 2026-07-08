import { COMBINE_MAX_LEVEL } from './combineRules.js';
import { getFighterAbilityHelpLines } from './fighterAbilities.js';

export const DAILY_FREE_POINTS = 20;
export const PURCHASE_LEVEL_0_COST = 1;
export const MIN_LIBRARY_SIZE_FOR_SELL = 15;

export function getSellPoints(level) {
  if (level < 0 || level > COMBINE_MAX_LEVEL) return 0;
  return 2 ** level;
}

export function getUpgradeCost(level) {
  if (level < 0 || level >= COMBINE_MAX_LEVEL) return null;
  return 2 ** level;
}

export function canSellWithLibrarySize(libraryCardCount) {
  return libraryCardCount >= MIN_LIBRARY_SIZE_FOR_SELL;
}

export function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export function getUpgradeHelpLines() {
  const lines = [
    'Enter Upgrade mode in the Library to sell cards for points and spend points to upgrade or purchase cards.',
    `You receive ${DAILY_FREE_POINTS} free points each day.`,
    'Sell values: Level 0 = 1 pt, Level 1 = 2 pts, Level 2 = 4 pts, and so on (doubling each level up to 512 pts at Level 9).',
    'Upgrade costs: Level 0 → 1 costs 1 pt, Level 1 → 2 costs 2 pts, and so on (doubling each level up to 256 pts for Level 8 → 9).',
    `Purchase a new Level 0 card for ${PURCHASE_LEVEL_0_COST} point and choose its stats (attack and HP at least 6, sum of squares at most 900).`,
    'When upgrading a card, assign 4 stat points across Attack, Defense, and HP (+1 per point).',
    `You cannot sell cards if you have fewer than ${MIN_LIBRARY_SIZE_FOR_SELL} cards in your library.`,
    `Max card level is ${COMBINE_MAX_LEVEL}.`,
  ];
  lines.push(...getFighterAbilityHelpLines());
  return lines;
}
