const CARD_ART_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const CARD_ART_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];

export function getCardArtCandidates(level) {
  if (level == null || !CARD_ART_LEVELS.includes(level)) return [];
  return CARD_ART_EXTENSIONS.map((ext) => `/card-art/level-${level}${ext}`);
}
