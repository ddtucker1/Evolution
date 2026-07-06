import rules from './combineRules.json';

export const COMBINE_RULES_VERSION = rules.version;
export const COMBINE_STAT_BONUS = rules.statBonus;
export const COMBINE_REQUIRE_SAME_LEVEL = rules.requireSameLevel;
export const COMBINE_MAX_LEVEL = rules.maxLevel;
export const MIN_LIBRARY_SIZE_FOR_COMBINE = 11;

export function getCombineRules() {
  return rules;
}

export function getLevelRule(inputLevel) {
  if (inputLevel < 0 || inputLevel >= COMBINE_MAX_LEVEL) return null;
  return {
    inputLevel,
    outputLevel: inputLevel + 1,
    description: `Two Level ${inputLevel} cards combine into Level ${inputLevel + 1}.`,
  };
}

export function canCombineWithLibrarySize(libraryCardCount) {
  return libraryCardCount >= MIN_LIBRARY_SIZE_FOR_COMBINE;
}

export function getCombineHelpLines() {
  const lines = [];
  for (let level = 0; level < COMBINE_MAX_LEVEL; level += 1) {
    const rule = getLevelRule(level);
    if (rule) lines.push(`Level ${rule.inputLevel} + Level ${rule.inputLevel} → Level ${rule.outputLevel}`);
  }
  lines.push(`Max card level is ${COMBINE_MAX_LEVEL}. Level ${COMBINE_MAX_LEVEL} cards cannot be combined further.`);
  return lines;
}
