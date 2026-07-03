# Card Fusion Battle

Online/offline card battle game. Monorepo with two workspaces:

- `server/` — Node.js + Express + Socket.io API, SQLite (`better-sqlite3`). Auth, collections, matchmaking, and real-time battles.
- `client/` — React 19 + Vite frontend (also supports offline NPC play with no backend).

Standard commands live in the root `README.md` and `package.json` scripts (`install:all`, `dev`, `build`, `start`).

## Cursor Cloud specific instructions

- Dependencies are installed by the update script (`npm run install:all`), which installs in the root, `server/`, and `client/` workspaces.
- Run both dev services with `npm run dev` from the repo root: it uses `concurrently` to start the API (`node --watch`) on port `3001` and the Vite client on port `5173`. Open the client at `http://localhost:5173`; Vite proxies `/api` and `/socket.io` to the API on `3001`.
- There are no `lint` or `test` scripts in this repo. "Verification" = build (`npm run build`, builds the client) and running the app.
- SQLite data lives at `server/data/*.db` and is git-ignored; it is created automatically on first server start via `initDatabase()`. Delete these files to reset accounts/collections.
- Online multiplayer requires the API + a socket connection; `vs CPU` battles also run fully client-side (offline mode) via `client/src/offlineEngine.js`, so the game is playable even if the backend is down.
- `better-sqlite3` is a native module installed via prebuilt binaries; if it fails to load after a Node version change, reinstall in `server/` to rebuild.
