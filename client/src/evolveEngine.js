import { CARD_TIMER_MIN, CARD_TIMER_MAX, getTimerPreview } from './offlineEngine';
import { generateCardName } from '../../shared/cardNaming.js';

const ABILITY_POOL = [
  {
    type: 'piercing_aoe',
    value: 3,
    label: 'On attack: deal 3 piercing damage to the other two enemy defenders',
    weight: (avg) => avg.attack,
  },
  {
    type: 'heal_companions',
    value: 4,
    label: 'On attack: heal your two companion fighters by 4 HP each',
    weight: (avg) => avg.defense + avg.hp * 0.2,
  },
  {
    type: 'lifesteal',
    value: 3,
    label: 'On attack: restore 3 HP to self',
    weight: (avg) => avg.attack * 0.5 + avg.hp * 0.1,
  },
  {
    type: 'armor_break',
    value: 2,
    label: 'On attack: reduce target defense by 2',
    weight: (avg) => avg.attack * 0.7,
  },
];

function hashSeed(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed, salt = 0) {
  const h = hashSeed(`${seed}:${salt}`);
  return (h % 10000) / 10000;
}

function seededPick(arr, seed, salt = 0) {
  const idx = Math.floor(seededRandom(seed, salt) * arr.length);
  return arr[idx];
}

function averageStat(a, b) {
  return Math.round((a + b) / 2);
}

export function getCardLevel(card) {
  if (!card) return 0;
  if (card.level != null) return card.level;
  if (card.evolved || card.id?.startsWith('evo_')) return 1;
  return 0;
}

function getCardTimer(card) {
  if (card.timer != null) return Math.round(card.timer);
  return getTimerPreview(card.attack);
}

const POISON_ABILITY = {
  type: 'poison',
  value: 1,
  label: 'On attack: poison enemy — drains 1 HP every 5 seconds',
};

function computeOutputLevel(card1, card2) {
  const level1 = getCardLevel(card1);
  const level2 = getCardLevel(card2);
  if (level1 === 2 && level2 === 2) return 3;
  if (level1 === 1 && level2 === 1) return 2;
  return 1;
}

function pickAbility(avgStats, seed = '') {
  const scored = ABILITY_POOL.map((ability, index) => {
    let noise = Math.random() * 3;
    if (seed) {
      noise = seededRandom(seed, index + 100) * 3;
    }
    return { ability, score: ability.weight(avgStats) + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].ability;
  return { type: chosen.type, value: chosen.value, label: chosen.label };
}

function applyLevel2Bonus(stats, timer, seed) {
  const options = ['attack', 'defense', 'hp', 'timer'];
  const choice = seededPick(options, seed, 200);
  if (choice === 'timer') {
    return {
      attack: stats.attack,
      defense: stats.defense,
      hp: stats.hp,
      timer: Math.max(CARD_TIMER_MIN, timer - 2),
      level2Bonus: { stat: 'timer', label: 'Timer reduced by 2 seconds' },
    };
  }
  return {
    attack: choice === 'attack' ? stats.attack + 2 : stats.attack,
    defense: choice === 'defense' ? stats.defense + 2 : stats.defense,
    hp: choice === 'hp' ? stats.hp + 2 : stats.hp,
    timer,
    level2Bonus: {
      stat: choice,
      label: `${choice === 'hp' ? 'HP' : choice.charAt(0).toUpperCase() + choice.slice(1)} +2`,
    },
  };
}

function buildEvolvedCard(card1, card2, { deterministic = false } = {}) {
  const seed = [card1.id, card2.id].sort().join('|');
  const level = computeOutputLevel(card1, card2);

  let attack = averageStat(card1.attack, card2.attack);
  let defense = averageStat(card1.defense, card2.defense);
  let hp = averageStat(card1.hp, card2.hp);
  let timer = averageStat(getCardTimer(card1), getCardTimer(card2));
  let level2Bonus = null;

  if (level === 2) {
    const boosted = applyLevel2Bonus({ attack, defense, hp }, timer, seed);
    attack = boosted.attack;
    defense = boosted.defense;
    hp = boosted.hp;
    timer = boosted.timer;
    level2Bonus = boosted.level2Bonus;
  }

  const ability = level === 3
    ? { ...POISON_ABILITY }
    : pickAbility({ attack, defense, hp }, deterministic ? seed : '');
  const name = generateCardName({ attack, defense, hp, timer }, seed);

  return {
    attack,
    defense,
    hp,
    timer,
    level,
    level2Bonus,
    name,
    ability,
    parents: [card1.id, card2.id],
  };
}

export function previewEvolve(card1, card2) {
  if (!card1 || !card2) return null;
  return buildEvolvedCard(card1, card2, { deterministic: true });
}

export function createEvolvedCard(card1, card2) {
  const preview = buildEvolvedCard(card1, card2);
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `evo_${Date.now()}_${suffix}`,
    name: preview.name,
    type: 'unique',
    attack: preview.attack,
    defense: preview.defense,
    hp: preview.hp,
    timer: preview.timer,
    level: preview.level,
    level2Bonus: preview.level2Bonus,
    ability: preview.ability,
    parents: preview.parents,
    evolved: true,
  };
}

export function getAbilityLabel(ability) {
  return ability?.label || '';
}

export function getLevelLabel(level) {
  if (level === 1) return 'Level 1';
  if (level === 2) return 'Level 2';
  if (level === 3) return 'Level 3';
  return null;
}
