# Tanks!

A small browser game project for building a turn-based tank duel with Daniel.

The goal is not just to make the game. The goal is to set up a project where the grown-up can build the tricky engine pieces, then Daniel can program meaningful parts that use angle, direction, velocity, collision, turns, and game logic.

## Run It

On Windows PowerShell, use:

```powershell
npm.cmd run dev
```

Then open:

```text
http://localhost:5173
```

No install step is needed right now. The dev server uses only Node's built-in modules.

If PowerShell still has trouble with npm, run the server directly:

```powershell
node tools/dev-server.mjs
```

When you are done for the day, stop the dev server with `Ctrl+C` in the terminal. The game also pauses its animation loop when the browser tab is hidden, which helps keep long dev sessions lighter.

## Controls

- `ArrowLeft` / `ArrowRight`: rotate the current tank cannon
- `A` / `D`: rotate the current tank cannon
- `ArrowUp` / `ArrowDown`: raise or lower shot power
- `W` / `S`: raise or lower shot power
- `Space`: fire
- `R`: reset the round

## Project Shape

- `src/main.js`: starts the game
- `src/game/ScorchedGame.js`: game loop, turns, drawing, and input
- `src/game/tankModels.js`: graph-paper tank shapes for Player 1 and Player 2
- `src/game/itemTypes.js`: inventory item data, including ammo and future tools
- `src/math/aiming.js`: cannon angle math, intentionally Daniel-friendly
- `src/physics/projectile.js`: projectile movement, wind, and hit detection
- `docs/`: design notes, architecture, and Daniel task ideas
- `tools/dev-server.mjs`: tiny local web server

## First Milestone

Two local players take turns firing basic projectiles. The tank cannon moves in real time when an arrow key is held, and the projectile flies with gravity and wind.

## Current Daniel Task

Daniel can design two custom tanks on graph paper, then put their polygon points into [TODO.md](TODO.md)'s tank-model instructions.
