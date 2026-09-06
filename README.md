# Keer op Keer — remote play companion app

A small real-time web app so you and up to 6 friends can play the *Keer op
Keer* dice game together remotely: one shared, synchronized dice roller with
turn rotation, plus a private digital scoreboard for each player that mirrors
the physical scorecard.

This app is a **dice roller + digital scoresheet**, not a rules engine — it
doesn't validate which cells you're "allowed" to mark. Just like the paper
version, that's up to the players.

## Running it

```
npm install
npm start
```

Then open `http://localhost:3000` in a browser. Anyone on your network/the
internet who can reach that address can join with the room code shown in the
lobby (to play with friends elsewhere, deploy it — see below — rather than
just running it on your own machine).

Game state lives in memory on the server; it resets if the server restarts.
That's fine for a casual game with friends, but don't expect games to survive
a server redeploy.

## How to play

1. One person clicks **Create Game** — they become the Admin and get a 4
   character room code.
2. Everyone else clicks **Join Game** and enters that code plus their name
   (up to 6 players total).
3. The Admin clicks **Start Game** once everyone's in.
4. Rolling rotates through players in the order they joined. Only the
   current roller can click **Roll Dice** (server generates the roll, so
   it's genuinely random for everyone).
   - **Rolls 1–3:** all 6 dice (3 number dice: `1,2,3,4,5,?`; 3 colour dice:
     orange/pink/blue/yellow/green/black) are open for everyone to use.
   - **Roll 4 onward:** the roller must first click one number die + one
     colour die and confirm **Set Aside Selected** — those two are reserved
     for them alone. The other 4 dice are then available to everyone else.
   - The roller clicks **Next Roll** to pass the turn along once everyone's
     marked their board.
5. Each player marks their own scoreboard by clicking on it — colour cells,
   the two number rows, the `!` row, and the colour side-columns all update
   live and are saved to that player's board only. The score boxes (BONUS,
   A-O, `!`, `★`, TOTAAL) are plain number fields (0–50) you fill in
   yourself, same as on paper.
   - The tab strip above the board lets you peek at any other player's board
     (read-only) — handy for seeing how everyone's doing.
6. The Admin can **Stop Game** at any time to end it and show a final
   leaderboard sorted by everyone's typed-in TOTAAL.
   - There's also a small **Skip stuck turn** admin button, for when
     whoever's turn it is has gone AFK.

If your browser tab reloads or you get disconnected mid-game, rejoining the
same URL automatically reconnects you to your same seat and board (your
session is remembered in the browser via `localStorage`).

## About the scoreboard layout

The two number rows (`5 3 3 3 2 2 2 1 2 2 2 3 3 3 5` / `3 2 2 2 1 1 1 0 1 1 1
2 2 2 3`) and the five colour side-columns were read directly off the photo
of the physical card and should be accurate.

The big 7×15 colour grid is also transcribed from the photo, cell by cell
(`MAIN_GRID_CODES` in `server/boardLayout.js`) — one shared array, so every
player always sees the exact same pattern, which is what actually matters
for play (the on-screen colours don't need to match the card's exact shade,
just be clearly one of the five colours in the same square). If you spot a
cell that doesn't match your card:

- Open `server/boardLayout.js` and find `MAIN_GRID_CODES`.
- Each row is 15 entries (columns A–O) using `g`/`y`/`b`/`p`/`o` for
  green/yellow/blue/pink/orange, with a trailing `*` for a star cell
  (e.g. `'g*'`).
- Fix the cell(s) at the row/column you spotted, save, and restart the
  server — the correction applies to every player immediately.

Happy to redo the whole transcription together if you want to read me the
grid row-by-row, or send a clearer/cropped photo.

## Deploying so friends elsewhere can join

This is a plain Node.js + Express + Socket.IO app — no database, no build
step. It'll run as-is on most Node hosts (Render, Railway, Fly.io, a small
VPS, etc.): push the repo, set the start command to `npm start`, and make
sure the platform exposes the `PORT` environment variable (the app already
reads `process.env.PORT`).

## Project layout

```
server/
  index.js        Express + Socket.IO wiring, event handlers
  games.js        In-memory game store: lobby, turns, dice, reservation rules
  dice.js         Dice faces + server-side random rolls
  board.js         Per-player scoreboard state + click/edit handling
  boardLayout.js   Shared, static board layout (colours, numbers, star cells)
public/
  index.html, styles.css, app.js   Front end (vanilla JS, no build step)
```
