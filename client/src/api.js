const API_BASE = import.meta.env.VITE_API_URL || '';

export function getToken() {
  return localStorage.getItem('cfb_token');
}

export function setToken(token) {
  localStorage.setItem('cfb_token', token);
}

export function clearToken() {
  localStorage.removeItem('cfb_token');
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
}

export async function checkOnline() {
  if (!navigator.onLine) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function saveOfflineProfile(profile) {
  localStorage.setItem('cfb_offline_profile', JSON.stringify(profile));
}

export function getOfflineProfile() {
  const data = localStorage.getItem('cfb_offline_profile');
  return data ? JSON.parse(data) : null;
}

const OFFLINE_STARTER = {
  id: 'offline_user',
  username: 'Offline Player',
  deckCap: 50,
  premium: false,
  deckCount: 20,
  cards: [
    { card_id: 'uni_knight', quantity: 2 },
    { card_id: 'uni_archer', quantity: 2 },
    { card_id: 'uni_mage', quantity: 2 },
    { card_id: 'uni_rogue', quantity: 1 },
    { card_id: 'uni_paladin', quantity: 1 },
    { card_id: 'uni_druid', quantity: 1 },
    { card_id: 'uni_serpent', quantity: 1 },
    { card_id: 'uni_wraith', quantity: 1 },
    { card_id: 'uni_berserker', quantity: 1 },
    { card_id: 'uni_golem', quantity: 1 },
    { card_id: 'std_shield', quantity: 2 },
    { card_id: 'std_sword', quantity: 2 },
    { card_id: 'std_poison', quantity: 1 },
    { card_id: 'std_heal', quantity: 1 },
    { card_id: 'std_bolt', quantity: 1 },
  ],
};

export function getOrCreateOfflineProfile() {
  let profile = getOfflineProfile();
  if (!profile) {
    profile = { ...OFFLINE_STARTER };
    saveOfflineProfile(profile);
  }
  return profile;
}

export function getDeckCardIds(profile) {
  const ids = [];
  for (const { card_id, quantity } of profile.cards) {
    for (let i = 0; i < quantity; i++) ids.push(card_id);
  }
  return ids;
}
