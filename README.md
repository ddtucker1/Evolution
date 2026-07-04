# Card Fusion Battle — Single Player

Play against the CPU on your laptop. No login, no internet required.

## What's in this build

- **Main Menu** — Library and Battle only (no multiplayer)
- **Library** — view your full card collection and pick **10 cards** for your play deck
- **Battle** — fight the CPU with your play deck
- **Random card stats** each battle: Attack 10–25, HP 30–100, Timer 10–60 seconds
- **Boss rule** — your Boss can only attack after all 3 fighters are defeated
- **Replacements** — deploy a fighter from your hand when a field slot opens (3 per match)
- **Draw timer** — every 30 seconds, click your play deck to draw a card into your hand
- **Attack animations** — 1 second for low damage, up to 4 seconds for heavy hits (timers pause during attacks)

## Play on your laptop

### 1. Get the code

Clone or download this repository, then open a terminal in the project folder.

### 2. Install dependencies (one time)

```bash
cd client
npm install
cd ..
```

### 3. Run the game

```bash
npm run dev:client
```

Open **http://localhost:5173** in your browser.

For a production build:

```bash
npm run play:local
```

Then open **http://localhost:4173**.

> You do **not** need the server for single-player. Only install the `client` folder.

## How to play

1. Open the game → **Library**
2. Tap cards to add/remove them until your **play deck has 10 cards**
3. Click **Main Menu** → **Battle**
4. Deploy 1 Boss + 3 fighters from your opening draw
5. When card timers are ready, attack. Boss attacks only after all fighters fall
6. When the **play deck timer** fills (30s), click it to draw a card
7. If a fighter dies, tap a fighter in your hand, then tap an empty field slot (max 3 replacements)
8. Destroy the enemy Boss to win

## Tech stack

- React + Vite (client)
- Node.js server code remains in the repo for future online features but is not required to play
