import { CARD_DATA, PLAY_DECK_SIZE, getTimerPreview, CATALOG_VERSION } from './offlineEngine';
import { CATALOG_SIZE, MAX_LIBRARY_SIZE } from '../../shared/baseCardStats.js';
import {
  createCombinedCard,
  getCardLevel,
  canCombineCards,
} from './combineEngine';
import { canCombineWithLibrarySize } from '../../shared/combineRules.js';
import { isFighterAbility } from '../../shared/fighterAbilities.js';
import { needsFighterAbilityChoice } from './combineEngine';
import { buildTestLibraryProfile, TEST_LIBRARY_VERSION } from './testLibrary';

export { PLAY_DECK_SIZE };

const LIBRARY_SIZE = MAX_LIBRARY_SIZE;

function buildStarterCollection() {
  return CARD_DATA.unique.map((c) => ({ card_id: c.id, quantity: 1 }));
}

function isCatalogCardId(cardId) {
  return !!CARD_DATA.unique.find((c) => c.id === cardId);
}

function isCombinedCardId(cardId, profile) {
  const isEvolvedId = cardId.startsWith('evo_') || cardId.startsWith('test_l');
  return isEvolvedId && !!profile?.evolvedCards?.find((c) => c.id === cardId);
}

function isPlayableCardId(cardId, profile) {
  return isCatalogCardId(cardId) || isCombinedCardId(cardId, profile);
}

function decrementCollection(collection, cardId) {
  const idx = collection.findIndex((c) => c.card_id === cardId);
  if (idx < 0) return collection;
  const entry = collection[idx];
  if (entry.quantity <= 1) {
    return [...collection.slice(0, idx), ...collection.slice(idx + 1)];
  }
  return collection.map((c, i) => (i === idx ? { ...c, quantity: c.quantity - 1 } : c));
}

function removeOneFromPlayDeck(playDeck, cardId) {
  const deck = [...playDeck];
  const idx = deck.indexOf(cardId);
  if (idx >= 0) deck.splice(idx, 1);
  return deck;
}

function ensureFullCollection(collection) {
  const map = new Map((collection || []).map((c) => [c.card_id, c.quantity]));
  for (const c of CARD_DATA.unique) {
    if (!map.has(c.id)) map.set(c.id, 1);
  }
  return Array.from(map.entries()).map(([card_id, quantity]) => ({ card_id, quantity }));
}

function collectionCardCount(collection) {
  return (collection || []).reduce((sum, entry) => sum + entry.quantity, 0);
}

function trimCollectionToMax(collection, playDeck) {
  let nextCollection = [...(collection || [])];
  let nextPlayDeck = [...(playDeck || [])];
  const basicRemovalOrder = [...CARD_DATA.unique].reverse().map((c) => c.id);

  while (collectionCardCount(nextCollection) > MAX_LIBRARY_SIZE) {
    let removed = false;
    for (const cardId of basicRemovalOrder) {
      const entry = nextCollection.find((c) => c.card_id === cardId);
      if (entry?.quantity > 0) {
        nextCollection = decrementCollection(nextCollection, cardId);
        nextPlayDeck = removeOneFromPlayDeck(nextPlayDeck, cardId);
        removed = true;
        break;
      }
    }
    if (!removed) break;
  }

  return { collection: nextCollection, playDeck: nextPlayDeck };
}

export function saveOfflineProfile(profile) {
  localStorage.setItem('cfb_offline_profile', JSON.stringify(profile));
}

export function getOfflineProfile() {
  const data = localStorage.getItem('cfb_offline_profile');
  return data ? JSON.parse(data) : null;
}

function migrateCombinedCard(card) {
  if (!card) return card;
  const level = getCardLevel(card);
  const timer = getTimerPreview(card.attack);
  const { abilities, ability, ...rest } = card;
  const migrated = { ...rest, level, timer, combined: true };
  if (card.specialAbility) migrated.specialAbility = card.specialAbility;
  return migrated;
}

function migrateProfile(profile) {
  const catalogChanged = profile.catalogVersion !== CATALOG_VERSION;
  const needsTestLibrary = profile.testLibraryVersion !== TEST_LIBRARY_VERSION;

  if (catalogChanged || needsTestLibrary) {
    const next = buildTestLibraryProfile({
      ...profile,
      catalogVersion: CATALOG_VERSION,
    });
    return next;
  }

  const evolvedCards = (profile.evolvedCards || []).map(migrateCombinedCard);
  let collection = (profile.collection || profile.cards || []).filter(
    (c) => isPlayableCardId(c.card_id, { ...profile, evolvedCards }),
  );
  let playDeck = (profile.playDeck || []).filter((id) => isPlayableCardId(id, { ...profile, evolvedCards }));
  ({ collection, playDeck } = trimCollectionToMax(collection, playDeck));
  return {
    ...profile,
    catalogVersion: CATALOG_VERSION,
    collection,
    playDeck,
    evolvedCards,
  };
}

export function getOrCreateOfflineProfile() {
  let profile = getOfflineProfile();
  if (!profile) {
    profile = buildTestLibraryProfile({
      catalogVersion: CATALOG_VERSION,
    });
    saveOfflineProfile(profile);
  }
  profile = migrateProfile(profile);
  if (profile.playDeck?.length > PLAY_DECK_SIZE) {
    profile = { ...profile, playDeck: profile.playDeck.slice(0, PLAY_DECK_SIZE) };
  }
  saveOfflineProfile(profile);
  return profile;
}

export function getPlayDeckIds(profile) {
  return profile.playDeck || [];
}

export function isPlayDeckComplete(profile) {
  return getPlayDeckIds(profile).length === PLAY_DECK_SIZE;
}

export function getCollectionCount(profile, cardId) {
  const entry = profile.collection?.find((c) => c.card_id === cardId);
  return entry?.quantity || 0;
}

export function countInPlayDeck(playDeck, cardId) {
  return playDeck.filter((id) => id === cardId).length;
}

export function togglePlayDeckCard(profile, cardId) {
  if (!isPlayableCardId(cardId, profile)) return profile;
  const playDeck = [...(profile.playDeck || [])];
  const inDeck = playDeck.filter((id) => id === cardId).length;
  const owned = getCollectionCount(profile, cardId);

  if (inDeck > 0) {
    const idx = playDeck.lastIndexOf(cardId);
    playDeck.splice(idx, 1);
  } else if (playDeck.length < PLAY_DECK_SIZE && owned > inDeck) {
    playDeck.push(cardId);
  }

  const next = { ...profile, playDeck };
  saveOfflineProfile(next);
  return next;
}

export function clearPlayDeck(profile) {
  const next = { ...profile, playDeck: [] };
  saveOfflineProfile(next);
  return next;
}

export function getCatalogCard(cardId, profile = null) {
  const evolved = profile?.evolvedCards?.find((c) => c.id === cardId);
  if (evolved) return evolved;
  return CARD_DATA.unique.find((c) => c.id === cardId);
}

export function getLibraryCardCount(profile) {
  return collectionCardCount(profile?.collection);
}

export function combineCards(profile, cardId1, cardId2, options = {}) {
  if (!canCombineWithLibrarySize(collectionCardCount(profile?.collection))) {
    return { profile, error: 'Less than 10 cards not allowed' };
  }
  if (!cardId1 || !cardId2) {
    return { profile, error: 'Select two cards to combine.' };
  }
  if (cardId1 === cardId2 && getCollectionCount(profile, cardId1) < 2) {
    return { profile, error: 'You need two copies of this card to combine it with itself.' };
  }

  const catalog1 = getCatalogCard(cardId1, profile);
  const catalog2 = getCatalogCard(cardId2, profile);
  if (!catalog1 || !catalog2) {
    return { profile, error: 'Invalid cards selected.' };
  }
  if (getCollectionCount(profile, cardId1) < 1 || getCollectionCount(profile, cardId2) < 1) {
    return { profile, error: 'You do not own both selected cards.' };
  }
  if (!canCombineCards(catalog1, catalog2)) {
    return { profile, error: 'Only two cards of the same level can be combined.' };
  }

  if (needsFighterAbilityChoice(catalog1, catalog2) && !isFighterAbility(options.specialAbility)) {
    return { profile, error: 'Choose a special ability for your Level 5 fighter.' };
  }

  const combined = createCombinedCard(catalog1, catalog2, {
    statBoostChoices: options.statBoostChoices,
    specialAbility: options.specialAbility,
  });
  if (!combined) {
    return { profile, error: 'These cards cannot be combined.' };
  }

  let collection = decrementCollection(profile.collection || [], cardId1);
  collection = decrementCollection(collection, cardId2);
  collection.push({ card_id: combined.id, quantity: 1 });

  let playDeck = [...(profile.playDeck || [])];
  playDeck = removeOneFromPlayDeck(playDeck, cardId1);
  playDeck = removeOneFromPlayDeck(playDeck, cardId2);

  const evolvedCards = [...(profile.evolvedCards || []), combined];
  const next = { ...profile, collection, playDeck, evolvedCards };
  saveOfflineProfile(next);
  return { profile: next, combined };
}

export const evolveCards = combineCards;

export { LIBRARY_SIZE, MAX_LIBRARY_SIZE };
