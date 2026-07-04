import { CARD_DATA, PLAY_DECK_SIZE } from './offlineEngine';

export { PLAY_DECK_SIZE };

function buildStarterCollection() {
  return CARD_DATA.unique.map((c) => ({ card_id: c.id, quantity: 2 }));
}

function isUniqueCardId(cardId) {
  return !!CARD_DATA.unique.find((c) => c.id === cardId);
}

export function saveOfflineProfile(profile) {
  localStorage.setItem('cfb_offline_profile', JSON.stringify(profile));
}

export function getOfflineProfile() {
  const data = localStorage.getItem('cfb_offline_profile');
  return data ? JSON.parse(data) : null;
}

function migrateProfile(profile) {
  if (profile.collection) {
    const collection = (profile.collection || []).filter((c) => isUniqueCardId(c.card_id));
    const playDeck = (profile.playDeck || []).filter((id) => isUniqueCardId(id));
    return { ...profile, collection, playDeck };
  }
  const collection = profile.cards || buildStarterCollection();
  return {
    id: profile.id || 'offline_user',
    username: profile.username || 'Player',
    collection: collection.filter((c) => isUniqueCardId(c.card_id)),
    playDeck: (profile.playDeck || []).filter((id) => isUniqueCardId(id)),
  };
}

export function getOrCreateOfflineProfile() {
  let profile = getOfflineProfile();
  if (!profile) {
    profile = {
      id: 'offline_user',
      username: 'Player',
      collection: buildStarterCollection(),
      playDeck: [],
    };
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
  if (!isUniqueCardId(cardId)) return profile;
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

export function getCatalogCard(cardId) {
  return CARD_DATA.unique.find((c) => c.id === cardId);
}
