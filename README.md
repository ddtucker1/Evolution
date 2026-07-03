# Card Fusion Battle

An online card battle game playable on desktop and mobile. Fight against CPU opponents offline or challenge other players when connected to the internet.

## Features

- **Online & Offline Play**: Log in via web browser on desktop or smartphone. When offline, play against NPC opponents only.
- **Card Types**:
  - **Standard cards** — buff your cards or debuff opponents
  - **Unique cards** — fuse 2–3 together to create powerful new cards
- **Battle Modes**:
  - **vs CPU** — practice anytime, works offline
  - **Casual PvP** — online matches with no card loss
  - **Competitive** — winner takes a random card from the loser's deck
- **Deck Management**: 50-card cap (60 with $1 premium upgrade)
- **Real-time Combat**: No turns — each card has an attack timer. When ready, choose which enemy card to strike.

## Game Flow

1. Each player shuffles a 20-card deck
2. Draw 4 unique cards — secretly choose 1 Boss (your character) and 3 battlefield fighters
3. Battlefield is revealed; 4 support cards are drawn
4. Cards charge on timers, then attack. Destroy the enemy Boss to win!

## Quick Start

```bash
# Install dependencies
npm run install:all

# Run development servers (API on :3001, client on :5173)
npm run dev

# Production build
npm run build
npm start
```

Open http://localhost:5173 in your browser (or on your phone on the same network).

## Tech Stack

- **Frontend**: React + Vite (responsive, mobile-friendly)
- **Backend**: Node.js, Express, Socket.io (real-time multiplayer)
- **Database**: SQLite (user accounts, collections, match history)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `JWT_SECRET` | dev secret | Auth token secret |
| `VITE_API_URL` | `` | API URL for production client |
