import rules from './combineRules.json';

export const COMBINE_RULES_VERSION = rules.version;
export const COMBINE_TICK_INTERVAL = rules.tickIntervalSeconds;
export const COMBINE_STAT_BONUS = rules.statBonus;
export const COMBINE_REQUIRE_SAME_LEVEL = rules.requireSameLevel;
export const COMBINE_MAX_LEVEL = rules.maxLevel;

const abilityById = new Map(rules.abilities.map((a) => [a.id, a]));

export function getCombineRules() {
  return rules;
}

export function getLevelRule(inputLevel) {
  return rules.levelRules.find((r) => r.inputLevel === inputLevel) || null;
}

export function getAbilityDefinition(abilityId) {
  return abilityById.get(abilityId) || null;
}

export function getAbilityPoolForTier(tier) {
  const pool = rules.abilityPools[String(tier)] || [];
  return pool.map((id) => abilityById.get(id)).filter(Boolean);
}

export function buildAbilityEntry(abilityId) {
  const def = getAbilityDefinition(abilityId);
  if (!def) return null;
  return {
    id: def.id,
    tier: def.tier,
    label: def.label,
    effect: def.effect,
  };
}

export function getCombineHelpLines() {
  return rules.levelRules.map((r) => `Level ${r.inputLevel} + Level ${r.inputLevel} → Level ${r.outputLevel}: ${r.description}`);
}
