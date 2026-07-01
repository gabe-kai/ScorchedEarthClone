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

- `Tab`: switch between Aim mode and Move mode
- Aim mode: `ArrowLeft` / `ArrowRight` or `A` / `D` rotate the current tank cannon
- Aim mode: `ArrowUp` / `ArrowDown` or `W` / `S` raise or lower shot power
- Move mode: `ArrowLeft` / `ArrowRight` or `A` / `D` drive the current tank
- `Space`: fire
- `I`: open inventory
- `1` through `0`: select quickbar slots

## Project Shape

- `src/main.js`: starts the game
- `src/game/ScorchedGame.js`: game loop, turns, drawing, and input
- `src/game/tankModels.js`: graph-paper tank shapes for Player 1 and Player 2
- `src/game/itemTypes.js`: inventory item data, including ammo and future tools
- `src/math/aiming.js`: cannon angle math, intentionally Daniel-friendly
- `src/physics/projectile.js`: projectile movement, wind, and hit detection
- `docs/`: design notes, architecture, and Daniel task ideas
- `tools/dev-server.mjs`: tiny local web server

## Current Milestone

Two local players take turns moving, aiming, buying ammo, choosing quickbar items, and firing across generated landscapes with wind, craters, water, fuel, health, and scorekeeping.

## Current Daniel Task

Daniel can design one custom tank on graph paper, add it by hand to [src/game/tankModels.js](src/game/tankModels.js), then choose it in the New Game window. See [TODO.md](TODO.md).
