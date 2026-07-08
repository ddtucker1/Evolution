export const BASE_STAT_SUM_OF_SQUARES = 1000;
export const MIN_STAT_VALUE = 3;
export const MAX_LIBRARY_SIZE = 50;
export const CATALOG_SIZE = Math.min(40, MAX_LIBRARY_SIZE);

const WEIGHT_MAX = 40;

export function computeBaseStats(attackWeight, defenseWeight, healthWeight) {
  const sumSqWeights = attackWeight ** 2 + defenseWeight ** 2 + healthWeight ** 2;
  const scale = Math.sqrt(BASE_STAT_SUM_OF_SQUARES / sumSqWeights);
  return {
    attack: Math.round(attackWeight * scale),
    defense: Math.round(defenseWeight * scale),
    hp: Math.round(healthWeight * scale),
  };
}

export function getTimerPreview(attack) {
  return Math.round(attack * 1.5);
}

export function normalizeCardTimer(card) {
  if (!card) return card;
  return { ...card, timer: getTimerPreview(card.attack ?? 0) };
}

export function isBaseCardId(id) {
  return !!id && !id.startsWith('evo_') && !id.startsWith('fus_');
}

function randomWeight() {
  return MIN_STAT_VALUE + Math.floor(Math.random() * (WEIGHT_MAX - MIN_STAT_VALUE + 1));
}

export function generateRandomBaseStats() {
  for (let attempt = 0; attempt < 500; attempt++) {
    const stats = computeBaseStats(randomWeight(), randomWeight(), randomWeight());
    if (stats.attack >= MIN_STAT_VALUE && stats.defense >= MIN_STAT_VALUE && stats.hp >= MIN_STAT_VALUE) {
      return stats;
    }
  }
  return computeBaseStats(12, 14, 24);
}

export function statTripleKey(stats) {
  return `${stats.attack},${stats.defense},${stats.hp}`;
}
