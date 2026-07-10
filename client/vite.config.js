import fs from 'fs';
import path from 'path';
import os from 'os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp']);
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v', '.ogv'];

function resolveDesktopDir(folderName) {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Desktop', folderName),
    path.join(home, 'desktop', folderName),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
}

function listDesktopDirs() {
  const home = os.homedir();
  return [
    path.join(home, 'Desktop'),
    path.join(home, 'desktop'),
    path.join(home, 'Desktop', 'Game'),
    path.join(home, 'desktop', 'Game'),
  ];
}

function listAudioFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => AUDIO_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
    '.flac': 'audio/flac',
    '.webm': 'audio/webm',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.m4v': 'video/mp4',
    '.ogv': 'video/ogg',
  };
  return types[ext] || 'application/octet-stream';
}

function resolveDesktopImagePath() {
  const desktopDirs = listDesktopDirs().filter((dir) => !dir.endsWith(`${path.sep}Game`));
  for (const dir of desktopDirs) {
    if (!fs.existsSync(dir)) continue;
    const exact = path.join(dir, 'image');
    if (fs.existsSync(exact) && fs.statSync(exact).isFile()) return exact;
    for (const ext of IMAGE_EXTENSIONS) {
      const filePath = path.join(dir, `image${ext}`);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
    }
  }
  return null;
}

function normalizeAssetBaseName(name) {
  return name.replace(path.extname(name), '').replace(/[\s_-]+/g, '').toLowerCase();
}

function resolveDesktopVideoPath(baseName) {
  const wanted = normalizeAssetBaseName(baseName);
  for (const dir of listDesktopDirs()) {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;

    for (const ext of VIDEO_EXTENSIONS) {
      for (const candidate of [`${baseName}${ext}`, `${baseName.replace(/\s+/g, '-')}${ext}`, `${baseName.replace(/\s+/g, '_')}${ext}`]) {
        const filePath = path.join(dir, candidate);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) return filePath;
      }
    }

    const match = fs.readdirSync(dir).find((name) => {
      const ext = path.extname(name).toLowerCase();
      if (!VIDEO_EXTENSIONS.includes(ext)) return false;
      return normalizeAssetBaseName(name) === wanted;
    });
    if (match) {
      const filePath = path.join(dir, match);
      if (fs.statSync(filePath).isFile()) return filePath;
    }
  }
  return null;
}

function desktopAssetsPlugin() {
  return {
    name: 'desktop-assets',
    configureServer(server) {
      attachDesktopMusicMiddleware(server.middlewares);
      attachDesktopImageMiddleware(server.middlewares);
      attachDesktopVideoMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachDesktopMusicMiddleware(server.middlewares);
      attachDesktopImageMiddleware(server.middlewares);
      attachDesktopVideoMiddleware(server.middlewares);
    },
  };
}

function attachDesktopMusicMiddleware(middlewares) {
  const folders = {
    gameplay: resolveDesktopDir('gameplay'),
    'gameplay-boss': resolveDesktopDir('gameplay boss'),
  };

  middlewares.use('/desktop-music', (req, res) => {
        const url = (req.url || '').split('?')[0];
        const parts = url.split('/').filter(Boolean);
        if (parts.length < 1) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        const folderKey = parts[0];
        const dir = folders[folderKey];
        if (!dir) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        if (parts.length === 1 || (parts.length === 2 && parts[1] === 'list')) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(listAudioFiles(dir)));
          return;
        }

        const fileName = decodeURIComponent(parts.slice(1).join('/'));
        const filePath = path.resolve(dir, fileName);
        if (!filePath.startsWith(path.resolve(dir)) || !fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        res.setHeader('Content-Type', contentTypeFor(filePath));
        fs.createReadStream(filePath).pipe(res);
  });
}

function attachDesktopImageMiddleware(middlewares) {
  middlewares.use('/desktop-image/image', (req, res) => {
    const filePath = resolveDesktopImagePath();
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.setHeader('Content-Type', contentTypeFor(filePath));
    fs.createReadStream(filePath).pipe(res);
  });
}

function attachDesktopVideoMiddleware(middlewares) {
  middlewares.use('/desktop-video', (req, res) => {
    const url = (req.url || '').split('?')[0];
    const parts = url.split('/').filter(Boolean);
    if (parts.length < 1) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const baseName = decodeURIComponent(parts.join(' ')).replace(/[-_]+/g, ' ').trim();
    const aliases = {
      'attack sparks': 'attack sparks',
      attacksparks: 'attack sparks',
    };
    const resolvedName = aliases[normalizeAssetBaseName(baseName)] || baseName;
    const filePath = resolveDesktopVideoPath(resolvedName);
    if (!filePath) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const videoTypes = {
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.m4v': 'video/mp4',
      '.ogv': 'video/ogg',
    };
    res.setHeader('Content-Type', videoTypes[ext] || contentTypeFor(filePath));
    res.setHeader('Cache-Control', 'no-cache');
    if (req.method === 'HEAD') {
      try {
        res.setHeader('Content-Length', fs.statSync(filePath).size);
      } catch {
        // ignore missing size
      }
      res.statusCode = 200;
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

export default defineConfig({
  plugins: [react(), desktopAssetsPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
