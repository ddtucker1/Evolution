export const BASE_STAT_SUM_OF_SQUARES = 1000;
export const MIN_STAT_VALUE = 3;
export const CATALOG_SIZE = 40;

const TIMER_OFFSETS = [-2, -1, 0, 1, 2];
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
  return Math.round(attack) * 2;
}

export function calculateBattleTimer(attack) {
  const base = getTimerPreview(attack);
  const offset = TIMER_OFFSETS[Math.floor(Math.random() * TIMER_OFFSETS.length)];
  return Math.max(1, base + offset);
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
