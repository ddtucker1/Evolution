# Card Fusion Battle

React + Vite client with a Node.js + Express + Socket.io server. The current focus is the **offline NPC prototype**, which runs entirely in the browser (`client/src/offlineEngine.js`); the server is only needed for the paused online features (auth, PvP, SQLite persistence).

See `README.md` for gameplay and the standard run commands.

## Cursor Cloud specific instructions

- Node 22 and npm are preinstalled. Dependencies are installed by the update script (`npm run install:all`), which installs root, `server/`, and `client/` packages. The server depends on the native module `better-sqlite3`, which compiles from source during install.
- There is **no lint script** and there are **no automated tests** in this repo.
- Services (run from repo root):
  - Client dev (Vite, hot reload): `npm run dev:client` → http://localhost:5173
  - Backend server (Socket.io + Express): `npm run dev:server` → http://localhost:3001 (health check: `GET /api/health`)
  - Both together: `npm run dev`
  - Built preview: `npm run play:local` → http://localhost:4173
- The NPC prototype does **not** require the backend server. Just run `npm run dev:client` and click "Start Battle vs CPU" to play. The server is only required for online/PvP/auth features.
- The backend creates a SQLite database under `server/data/` at runtime (gitignored).
