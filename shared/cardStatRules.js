export const PURCHASE_MAX_SUM_SQUARES = 900;
export const PURCHASE_MIN_ATTACK = 6;
export const PURCHASE_MIN_HP = 6;
export const PURCHASE_MIN_DEFENSE = 1;
export const UPGRADE_STAT_POINTS = 4;

export const STAT_KEYS = ['attack', 'defense', 'hp'];

export function getStatSumOfSquares(stats) {
  const attack = stats.attack ?? 0;
  const defense = stats.defense ?? 0;
  const hp = stats.hp ?? 0;
  return attack ** 2 + defense ** 2 + hp ** 2;
}

export function isValidPurchaseStats(stats) {
  if (!stats) return false;
  const attack = stats.attack;
  const defense = stats.defense;
  const hp = stats.hp;
  if (!Number.isInteger(attack) || !Number.isInteger(defense) || !Number.isInteger(hp)) {
    return false;
  }
  if (attack < PURCHASE_MIN_ATTACK || hp < PURCHASE_MIN_HP) return false;
  if (defense < PURCHASE_MIN_DEFENSE) return false;
  return getStatSumOfSquares({ attack, defense, hp }) <= PURCHASE_MAX_SUM_SQUARES;
}

export function getDefaultPurchaseStats() {
  return {
    attack: PURCHASE_MIN_ATTACK,
    defense: PURCHASE_MIN_ATTACK,
    hp: PURCHASE_MIN_HP,
  };
}

export function createEmptyStatAllocations() {
  return { attack: 0, defense: 0, hp: 0 };
}

export function getRemainingStatPoints(allocations) {
  const used = STAT_KEYS.reduce((sum, key) => sum + (allocations[key] ?? 0), 0);
  return UPGRADE_STAT_POINTS - used;
}

export function isValidStatPointAllocations(allocations) {
  if (!allocations) return false;
  let sum = 0;
  for (const key of STAT_KEYS) {
    const value = allocations[key] ?? 0;
    if (!Number.isInteger(value) || value < 0) return false;
    sum += value;
  }
  return sum === UPGRADE_STAT_POINTS;
}

export function applyStatPointAllocations(stats, allocations) {
  if (!isValidStatPointAllocations(allocations)) {
    return { stats, statBonus: null };
  }
  const next = { ...stats };
  const applied = {};
  for (const key of STAT_KEYS) {
    const amount = allocations[key];
    if (amount > 0) {
      next[key] = (next[key] ?? 0) + amount;
      applied[key] = amount;
    }
  }
  const label = STAT_KEYS
    .filter((key) => applied[key])
    .map((key) => {
      const name = key === 'hp' ? 'HP' : key.charAt(0).toUpperCase() + key.slice(1);
      return `${name} +${applied[key]}`;
    })
    .join(', ');
  return {
    stats: next,
    statBonus: {
      allocations: applied,
      label,
    },
  };
}
