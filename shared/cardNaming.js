const HIGH_DEFENSE_WORDS = ['Granite', 'Steel', 'Iron', 'Stone', 'Adamant', 'Obsidian', 'Hard'];
const LOW_DEFENSE_WORDS = ['Bare', 'Leather', 'Cotton', 'Linen', 'Silk', 'Cloth'];
const LOW_ATTACK_WORDS = ['Weak', 'Soft', 'Thin', 'Frail', 'Gentle'];
const HIGH_ATTACK_WORDS = ['Razor', 'Fierce', 'Deadly', 'Savage', 'Brutal'];
const HIGH_HP_WORDS = ['Prime', 'Strong', 'Alpha', 'Robust', 'Mighty'];
const LOW_HP_WORDS = ['Faint', 'Worn', 'Pale'];
const FAST_TIMER_WORDS = ['Fast', 'Speedy', 'Quick', 'Swift', 'Brisk'];
const SLOW_TIMER_WORDS = ['Slow', 'Cold', 'Sluggish', 'Frozen', 'Drowsy'];
const NEUTRAL_WORDS = ['Battle', 'War', 'Field', 'Arena'];
const CREATURE_NOUNS = ['Fighter', 'Guardian', 'Warrior', 'Champion', 'Striker', 'Defender'];

const DEFENSE_HIGH = 13;
const DEFENSE_LOW = 8;
const ATTACK_HIGH = 16;
const ATTACK_LOW = 12;
const HP_HIGH = 38;
const HP_LOW = 32;
const TIMER_FAST = 17;
const TIMER_SLOW = 24;

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

export function generateCardName(stats, seed = '') {
  const { attack, defense, hp, timer } = stats;
  const words = [];
  let salt = 0;

  if (defense >= DEFENSE_HIGH) {
    words.push(seededPick(HIGH_DEFENSE_WORDS, seed, salt++));
  } else if (defense <= DEFENSE_LOW) {
    words.push(seededPick(LOW_DEFENSE_WORDS, seed, salt++));
  }

  if (attack <= ATTACK_LOW) {
    words.push(seededPick(LOW_ATTACK_WORDS, seed, salt++));
  } else if (attack >= ATTACK_HIGH) {
    words.push(seededPick(HIGH_ATTACK_WORDS, seed, salt++));
  }

  if (hp >= HP_HIGH) {
    words.push(seededPick(HIGH_HP_WORDS, seed, salt++));
  } else if (hp <= HP_LOW) {
    words.push(seededPick(LOW_HP_WORDS, seed, salt++));
  }

  if (timer <= TIMER_FAST) {
    words.push(seededPick(FAST_TIMER_WORDS, seed, salt++));
  } else if (timer >= TIMER_SLOW) {
    words.push(seededPick(SLOW_TIMER_WORDS, seed, salt++));
  }

  if (words.length === 0) {
    words.push(seededPick(NEUTRAL_WORDS, seed, salt++));
  }

  words.push(seededPick(CREATURE_NOUNS, seed, salt++));
  return words.join(' ');
}
