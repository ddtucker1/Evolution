const CARD_NAME_FONT = '12px Cinzel, serif';
const CARD_NAME_LINE_HEIGHT = 1.2;
const CARD_NAME_MAX_LINES = 2;
const CARD_NAME_MAX_WIDTH = 118;

let measureCanvas;

function getMeasureContext() {
  if (!measureCanvas && typeof document !== 'undefined') {
    measureCanvas = document.createElement('canvas');
  }
  return measureCanvas?.getContext('2d') || null;
}

function fitsWithinLines(name, maxWidth) {
  const ctx = getMeasureContext();
  if (!ctx) return name.length <= 24;
  ctx.font = CARD_NAME_FONT;
  const words = name.split(/\s+/).filter(Boolean);
  if (!words.length) return true;

  let line = '';
  let lines = 1;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (!line) {
      let trimmed = word;
      while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
        trimmed = trimmed.slice(0, -1);
      }
      line = `${trimmed}…`;
      lines += 1;
      if (lines > CARD_NAME_MAX_LINES) return false;
      line = '';
      continue;
    }
    lines += 1;
    if (lines > CARD_NAME_MAX_LINES) return false;
    line = word;
  }
  return lines <= CARD_NAME_MAX_LINES;
}

export function truncateCardName(name, maxWidth = CARD_NAME_MAX_WIDTH) {
  const source = (name || '').trim();
  if (!source) return '';
  if (fitsWithinLines(source, maxWidth)) return source;

  let truncated = source;
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1).trimEnd();
    const candidate = `${truncated}…`;
    if (fitsWithinLines(candidate, maxWidth)) return candidate;
  }
  return '…';
}

export const CARD_NAME_AREA_HEIGHT = `${CARD_NAME_MAX_LINES * 12 * CARD_NAME_LINE_HEIGHT}px`;
