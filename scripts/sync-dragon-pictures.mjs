import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(homedir(), 'Desktop', 'dragon pictures');
const targetDir = join(__dirname, '..', 'client', 'public', 'card-art');
const imageExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const levelMatchers = [
  { level: 0, patterns: [/level[\s_-]*0/i, /^0(?:[\s_.-]|$)/i, /lvl[\s_-]*0/i] },
  { level: 1, patterns: [/level[\s_-]*1/i, /^1(?:[\s_.-]|$)/i, /lvl[\s_-]*1/i] },
];

function matchLevel(filename) {
  const base = filename.replace(extname(filename), '');
  for (const { level, patterns } of levelMatchers) {
    if (patterns.some((pattern) => pattern.test(base) || pattern.test(filename))) {
      return level;
    }
  }
  return null;
}

function syncDragonPictures() {
  if (!existsSync(sourceDir)) {
    console.log(`No source folder found at ${sourceDir}`);
    return;
  }

  mkdirSync(targetDir, { recursive: true });

  const files = readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && imageExt.has(extname(entry.name).toLowerCase()));

  if (!files.length) {
    console.log(`No images found in ${sourceDir}`);
    return;
  }

  let copied = 0;
  for (const file of files) {
    const level = matchLevel(file.name);
    if (level == null) continue;
    const extension = extname(file.name).toLowerCase();
    const targetPath = join(targetDir, `level-${level}${extension}`);
    copyFileSync(join(sourceDir, file.name), targetPath);
    console.log(`Copied ${file.name} -> ${targetPath}`);
    copied += 1;
  }

  if (!copied) {
    console.log('No level 0 or level 1 images matched in dragon pictures folder.');
  }
}

syncDragonPictures();
