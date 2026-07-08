import { CARD_DATA, PLAY_DECK_SIZE } from './offlineEngine';
import { createCombinedCard } from './combineEngine';
import { FIGHTER_ABILITIES } from '../../shared/fighterAbilities.js';
import { normalizeCardTimer } from '../../shared/baseCardStats.js';

export const TEST_LIBRARY_VERSION = 1;

function pickBase(index) {
  const catalog = CARD_DATA.unique;
  return catalog[index % catalog.length];
}

function combinePair(card1, card2, options = {}) {
  return createCombinedCard(card1, card2, { deterministic: true, ...options });
}

function buildLevel2Card(seed) {
  const l1a = combinePair(pickBase(seed * 4), pickBase(seed * 4 + 1));
  const l1b = combinePair(pickBase(seed * 4 + 2), pickBase(seed * 4 + 3));
  if (!l1a || !l1b) return null;
  const card = combinePair(
    { ...l1a, id: `test_tmp_l1a_${seed}` },
    { ...l1b, id: `test_tmp_l1b_${seed}` },
  );
  if (!card) return null;
  return { ...card, id: `test_l2_${seed}` };
}

function buildLevel5Card(seed) {
  function evolveToLevel(level, s, ability) {
    if (level === 0) {
      return pickBase(s * 2);
    }
    const left = evolveToLevel(level - 1, s * 2, ability);
    const right = evolveToLevel(level - 1, s * 2 + 1, ability);
    if (!left || !right) return null;
    const opts = level === 5 ? { specialAbility: ability } : {};
    const combined = combinePair(left, right, opts);
    if (!combined) return null;
    if (level < 5) return { ...combined, id: `test_tmp_l${level}_${s}` };
    return { ...combined, id: `test_l5_${seed}`, specialAbility: ability };
  }

  const ability = FIGHTER_ABILITIES[Math.floor(Math.random() * FIGHTER_ABILITIES.length)];
  return evolveToLevel(5, seed + 100, ability);
}

export function buildTestLibraryCards() {
  const baseCards = CARD_DATA.unique.slice(0, 10);
  const level2Cards = [];
  const level5Cards = [];

  for (let i = 0; i < 10; i += 1) {
    const l2 = buildLevel2Card(i);
    if (l2) level2Cards.push(l2);
  }

  for (let i = 0; i < 10; i += 1) {
    const l5 = buildLevel5Card(i);
    if (l5) level5Cards.push(l5);
  }

  return { baseCards, level2Cards, level5Cards };
}

function buildTestPlayDeck(baseCards, level2Cards, level5Cards) {
  return [
    ...baseCards.slice(0, 3).map((c) => c.id),
    ...level2Cards.slice(0, 3).map((c) => c.id),
    ...level5Cards.slice(0, 4).map((c) => c.id),
  ].slice(0, PLAY_DECK_SIZE);
}

function normalizeEvolvedCard(card) {
  return normalizeCardTimer(card);
}

export function buildTestLibraryProfile(existingProfile = null) {
  const { baseCards, level2Cards, level5Cards } = buildTestLibraryCards();
  const evolvedCards = [...level2Cards, ...level5Cards].map(normalizeEvolvedCard);
  const collection = [
    ...baseCards.map((c) => ({ card_id: c.id, quantity: 1 })),
    ...level2Cards.map((c) => ({ card_id: c.id, quantity: 1 })),
    ...level5Cards.map((c) => ({ card_id: c.id, quantity: 1 })),
  ];

  return {
    ...(existingProfile || {}),
    id: existingProfile?.id || 'offline_user',
    username: existingProfile?.username || 'Player',
    catalogVersion: existingProfile?.catalogVersion,
    testLibraryVersion: TEST_LIBRARY_VERSION,
    collection,
    playDeck: buildTestPlayDeck(baseCards, level2Cards, level5Cards),
    evolvedCards,
    libraryBatchId: Date.now(),
  };
}
