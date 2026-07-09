import {
  getTimerPreview,
  generateRandomBaseStats,
  statTripleKey,
} from '../../shared/baseCardStats.js';
import { generateCardName } from '../../shared/cardNaming.js';
import { COMBINE_MAX_LEVEL } from '../../shared/combineRules.js';
import { FIGHTER_ABILITIES, FIGHTER_ABILITY_UNLOCK_LEVEL } from '../../shared/fighterAbilities.js';
import { createCombinedCard, getCardLevel } from './combineEngine.js';

export const CPU_DECK_SIZE = 10;
export const CPU_MAX_LEVEL_SUM = COMBINE_MAX_LEVEL * CPU_DECK_SIZE;
export const CPU_LEVEL_SUM_BOOST = 10;
export const CPU_LEVEL_SUM_BOOST_CAP = 80;

/**
 * Player deck level sum is expected in [0, 90].
 * 0–80 → add 10; 81–90 → clamp to 90.
 */
export function computeCpuTargetLevelSum(playerLevelSum) {
  const clamped = Math.max(0, Math.min(CPU_MAX_LEVEL_SUM, Math.round(playerLevelSum) || 0));
  if (clamped <= CPU_LEVEL_SUM_BOOST_CAP) {
    return Math.min(CPU_MAX_LEVEL_SUM, clamped + CPU_LEVEL_SUM_BOOST);
  }
  return CPU_MAX_LEVEL_SUM;
}

export function getDeckLevelSum(deckIds, resolveCard) {
  if (!Array.isArray(deckIds) || typeof resolveCard !== 'function') return 0;
  return deckIds.reduce((sum, id) => {
    const card = resolveCard(id);
    return sum + getCardLevel(card);
  }, 0);
}

/**
 * Randomly partition `targetSum` into `count` integers in [0, maxLevel].
 */
export function partitionLevelSum(targetSum, count = CPU_DECK_SIZE, maxLevel = COMBINE_MAX_LEVEL) {
  const maxTotal = count * maxLevel;
  let remaining = Math.max(0, Math.min(maxTotal, Math.round(targetSum) || 0));
  const levels = Array.from({ length: count }, () => 0);

  while (remaining > 0) {
    const candidates = [];
    for (let i = 0; i < count; i += 1) {
      if (levels[i] < maxLevel) candidates.push(i);
    }
    if (!candidates.length) break;
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    levels[idx] += 1;
    remaining -= 1;
  }

  return levels;
}

function pickCatalogBase(catalog, salt) {
  if (!catalog?.length) return null;
  return catalog[Math.floor(Math.random() * catalog.length)];
}

function createLevel0NpcCard(id) {
  const stats = generateRandomBaseStats();
  const timer = getTimerPreview(stats.attack);
  const key = statTripleKey(stats);
  return {
    id,
    name: generateCardName({ ...stats, timer }, `${id}|${key}`),
    type: 'unique',
    attack: stats.attack,
    defense: stats.defense,
    hp: stats.hp,
    timer,
    level: 0,
    isBase: true,
    combined: false,
    specialAbility: null,
  };
}

function combinePair(card1, card2, options = {}) {
  return createCombinedCard(card1, card2, { deterministic: true, ...options });
}

/**
 * Build a card at the requested level by recursively combining same-level parents.
 * Level 5+ cards receive a fighter ability (chosen at the level-5 combine step).
 */
export function createCpuCardAtLevel(level, catalog, id) {
  const targetLevel = Math.max(0, Math.min(COMBINE_MAX_LEVEL, Math.round(level) || 0));

  if (targetLevel === 0) {
    return createLevel0NpcCard(id);
  }

  const ability = FIGHTER_ABILITIES[Math.floor(Math.random() * FIGHTER_ABILITIES.length)];

  function evolveToLevel(currentLevel, salt) {
    if (currentLevel === 0) {
      const base = pickCatalogBase(catalog, salt);
      if (!base) return null;
      // Give each leaf a unique id so combine seeds differ.
      return {
        ...base,
        id: `${id}_base_${salt}`,
        level: 0,
        isBase: true,
      };
    }

    const left = evolveToLevel(currentLevel - 1, salt * 2);
    const right = evolveToLevel(currentLevel - 1, salt * 2 + 1);
    if (!left || !right) return null;

    const opts = currentLevel === FIGHTER_ABILITY_UNLOCK_LEVEL
      ? { specialAbility: ability }
      : {};
    const combined = combinePair(left, right, opts);
    if (!combined) return null;

    return {
      ...combined,
      id: currentLevel === targetLevel ? id : `${id}_tmp_l${currentLevel}_${salt}`,
      isBase: false,
    };
  }

  return evolveToLevel(targetLevel, 1);
}

/**
 * Generate a full CPU deck whose card levels sum to `targetSum`.
 * Returns { ids, cards, levels, targetSum }.
 */
export function generateCpuDeck(targetSum, { catalog, deckSize = CPU_DECK_SIZE } = {}) {
  const sum = Math.max(0, Math.min(CPU_MAX_LEVEL_SUM, Math.round(targetSum) || 0));
  const levels = partitionLevelSum(sum, deckSize, COMBINE_MAX_LEVEL);
  const stamp = Date.now().toString(36);
  const cards = [];
  const ids = [];

  for (let i = 0; i < levels.length; i += 1) {
    const level = levels[i];
    const id = `npc_l${level}_${stamp}_${i}`;
    const card = createCpuCardAtLevel(level, catalog, id);
    if (!card) {
      // Fallback to a level-0 card if generation somehow fails.
      const fallback = createLevel0NpcCard(`npc_l0_${stamp}_fb_${i}`);
      cards.push(fallback);
      ids.push(fallback.id);
      continue;
    }
    cards.push(card);
    ids.push(card.id);
  }

  // Shuffle deck order without changing the level multiset.
  const order = Array.from({ length: ids.length }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return {
    targetSum: sum,
    levels: order.map((i) => levels[i]),
    ids: order.map((i) => ids[i]),
    cards: order.map((i) => cards[i]),
  };
}
