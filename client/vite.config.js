import fs from 'fs';
import path from 'path';
import os from 'os';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const AUDIO_EXTENSIONS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.webm']);

function resolveDesktopDir(folderName) {
  const home = os.homedir();
  const candidates = [
    path.join(home, 'Desktop', folderName),
    path.join(home, 'desktop', folderName),
  ];
  return candidates.find((dir) => fs.existsSync(dir)) || candidates[0];
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
  };
  return types[ext] || 'application/octet-stream';
}

function desktopMusicPlugin() {
  return {
    name: 'desktop-music',
    configureServer(server) {
      attachDesktopMusicMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachDesktopMusicMiddleware(server.middlewares);
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

export default defineConfig({
  plugins: [react(), desktopMusicPlugin()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': { target: 'http://localhost:3001', ws: true },
    },
  },
});
