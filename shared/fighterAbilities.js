export const FIGHTER_ABILITY_UNLOCK_LEVEL = 5;
export const FIGHTER_ABILITY_DOUBLE_LEVEL = 9;
export const FIGHTER_DEBUFF_DURATION = 121;

export const FIGHTER_ABILITIES = ['fire', 'poison', 'rust', 'blunt', 'slow'];

export const FIGHTER_ABILITY_CONFIG = {
  fire: {
    label: 'Fire',
    interval: 12,
    description: 'Adjacent fighters lose 1 DEF and 1 HP every 12 seconds.',
    doubledDescription: 'Adjacent fighters lose 2 DEF and 2 HP every 12 seconds.',
  },
  poison: {
    label: 'Poison',
    interval: 8,
    description: 'Target loses 1 HP every 8 seconds.',
    doubledDescription: 'Target loses 2 HP every 8 seconds.',
  },
  rust: {
    label: 'Rust',
    interval: 6,
    description: 'Target loses 1 DEF every 6 seconds.',
    doubledDescription: 'Target loses 2 DEF every 6 seconds.',
  },
  blunt: {
    label: 'Blunt',
    interval: 20,
    hpLoss: 0,
    attackLoss: 3,
    description: 'Target loses 3 ATK every 20 seconds.',
    doubledDescription: 'Target loses 6 ATK every 20 seconds.',
  },
  slow: {
    label: 'Slow',
    timerBonus: 20,
    description: 'Adds 20 seconds to the target attack timer.',
    doubledDescription: 'Adds 40 seconds to the target attack timer.',
  },
};

export function isFighterAbility(value) {
  return FIGHTER_ABILITIES.includes(value);
}

export function getFighterAbilityLabel(ability) {
  return FIGHTER_ABILITY_CONFIG[ability]?.label || ability;
}

export function getFighterAbilityDescription(ability, doubled = false) {
  const config = FIGHTER_ABILITY_CONFIG[ability];
  if (!config) return '';
  return doubled ? config.doubledDescription : config.description;
}

export function getFighterAbilityHelpLines() {
  return [
    `At Level ${FIGHTER_ABILITY_UNLOCK_LEVEL}, fighter cards gain a special ability chosen when combining.`,
    'Special abilities only trigger on solo attacks, not chain attacks.',
    `The ability persists as the card levels up. At Level ${FIGHTER_ABILITY_DOUBLE_LEVEL}, the effect is doubled.`,
    `Debuffs last ${FIGHTER_DEBUFF_DURATION} seconds. A card can have multiple different debuffs, but not the same one twice until it expires.`,
    ...FIGHTER_ABILITIES.map((ability) => {
      const config = FIGHTER_ABILITY_CONFIG[ability];
      return `${config.label}: ${config.description}`;
    }),
  ];
}

export function resolveInheritedFighterAbility(card1, card2, outputLevel, chosenAbility) {
  if (outputLevel === FIGHTER_ABILITY_UNLOCK_LEVEL) {
    return isFighterAbility(chosenAbility) ? chosenAbility : null;
  }
  if (outputLevel > FIGHTER_ABILITY_UNLOCK_LEVEL) {
    return card1.specialAbility || card2.specialAbility || null;
  }
  return null;
}

export function isFighterAbilityDoubled(cardLevel) {
  return cardLevel >= FIGHTER_ABILITY_DOUBLE_LEVEL;
}
