export const BASE_STAT_SUM_OF_SQUARES = 1000;

const TIMER_OFFSETS = [-2, -1, 0, 1, 2];

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
