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

function blendNames(name1, name2) {
  const words1 = name1.split(' ');
  const words2 = name2.split(' ');
  return `${words1[0]} ${words2[words2.length - 1]}`;
}

function averageStat(a, b) {
  return Math.round((a + b) / 2);
}

function pickAbility(avgStats, seed = '') {
  const scored = ABILITY_POOL.map((ability, index) => {
    let noise = Math.random() * 3;
    if (seed) {
      let hash = 0;
      const key = `${seed}:${index}`;
      for (let i = 0; i < key.length; i++) {
        hash = ((hash << 5) - hash) + key.charCodeAt(i);
        hash |= 0;
      }
      noise = Math.abs(hash % 300) / 100;
    }
    return { ability, score: ability.weight(avgStats) + noise };
  });
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored[0].ability;
  return { type: chosen.type, value: chosen.value, label: chosen.label };
}

export function previewEvolve(card1, card2) {
  if (!card1 || !card2) return null;
  const attack = averageStat(card1.attack, card2.attack);
  const defense = averageStat(card1.defense, card2.defense);
  const hp = averageStat(card1.hp, card2.hp);
  const seed = [card1.id, card2.id].sort().join('|');
  const ability = pickAbility({ attack, defense, hp }, seed);
  return {
    name: blendNames(card1.name, card2.name),
    attack,
    defense,
    hp,
    ability,
    parents: [card1.id, card2.id],
  };
}

export function createEvolvedCard(card1, card2) {
  const attack = averageStat(card1.attack, card2.attack);
  const defense = averageStat(card1.defense, card2.defense);
  const hp = averageStat(card1.hp, card2.hp);
  const ability = pickAbility({ attack, defense, hp });
  const suffix = Math.random().toString(36).slice(2, 8);
  return {
    id: `evo_${Date.now()}_${suffix}`,
    name: blendNames(card1.name, card2.name),
    type: 'unique',
    attack,
    defense,
    hp,
    ability,
    parents: [card1.id, card2.id],
    evolved: true,
  };
}

export function getAbilityLabel(ability) {
  return ability?.label || '';
}
