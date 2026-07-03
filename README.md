# Card Fusion Battle — NPC Prototype

Play against CPU opponents on your laptop. No login, no internet required.

## What's in this prototype

- **NPC battles only** — login, multiplayer, and collection are disabled for now
- **Random unique card stats** each time a card enters battle:
  - Attack: 10–25
  - HP: 30–100
  - Attack timer: 10–30 seconds
- **Real-time combat** — cards charge on timers, then you pick targets to attack
- **Standard support cards** — buff, debuff, heal, and direct damage

## Play on your laptop

### 1. Get the code

Clone or download this repository to your laptop:

```bash
git clone <your-repo-url>
cd card-fusion-battle
```

Or download the ZIP from GitHub and extract it.

### 2. Install dependencies (one time)

```bash
npm run install:all
```

### 3. Run the game

**Recommended — built offline version:**

```bash
npm run play:local
```

Then open **http://localhost:4173** in your browser.

**Or for development with hot reload:**

```bash
npm run dev:client
```

Then open **http://localhost:5173**.

The NPC battle engine runs entirely in your browser. You do not need to start the server for this prototype.

### 4. Install as an app (optional)

In Chrome or Edge, open the game URL and use **Install app** or **Add to desktop** from the browser menu. The included web manifest supports standalone window mode.

## How to play

1. Click **Start Battle vs CPU**
2. You receive 4 unique cards — pick **1 Boss** and **3 fighters**
3. The battlefield is revealed and support cards are drawn
4. When a card's timer fills, tap it and choose an enemy to attack
5. Destroy the enemy Boss to win

## Full game (future)

The codebase also includes online login, PvP matchmaking, card fusion, and SQLite persistence. Those features are paused while the NPC prototype is refined.

## Tech stack

- React + Vite (client)
- Node.js + Express + Socket.io (online features, not required for NPC prototype)
