import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceCandidates = [
  process.env.DRAGON_PICTURES_DIR,
  join(homedir(), 'Desktop', 'Game', 'dragon pictures'),
  join(homedir(), 'Desktop', 'dragon pictures'),
].filter(Boolean);
const targetDir = join(__dirname, '..', 'client', 'public', 'card-art');
const imageExt = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

const levelMatchers = Array.from({ length: 10 }, (_, level) => ({
  level,
  patterns: [
    new RegExp(`level[\\s_-]*${level}(?:[\\s_.-]|$)`, 'i'),
    new RegExp(`^${level}(?:[\\s_.-]|$)`, 'i'),
    new RegExp(`lvl[\\s_-]*${level}(?:[\\s_.-]|$)`, 'i'),
  ],
}));

function matchLevel(filename) {
  const base = filename.replace(extname(filename), '');
  for (const { level, patterns } of levelMatchers) {
    if (patterns.some((pattern) => pattern.test(base) || pattern.test(filename))) {
      return level;
    }
  }
  return null;
}

function resolveSourceDir() {
  for (const candidate of sourceCandidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function syncDragonPictures() {
  const sourceDir = resolveSourceDir();
  if (!sourceDir) {
    console.log('No source folder found. Checked:');
    for (const candidate of sourceCandidates) {
      console.log(`  - ${candidate}`);
    }
    return;
  }

  console.log(`Using source folder: ${sourceDir}`);
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
    console.log('No level 0–9 images matched in dragon pictures folder.');
    console.log('Expected names like level0.png, level1.jpg, level-2.png, etc.');
  } else {
    console.log(`Synced ${copied} card art image(s) for levels 0–9.`);
  }
}

syncDragonPictures();
