# Scorched Earth Clone

A small browser game project for building a Scorched Earth-style tank duel with Daniel.

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

## Controls

- `ArrowUp` / `ArrowDown`: rotate the current tank cannon
- `ArrowLeft` / `ArrowRight`: lower or raise shot power
- `Space`: fire
- `R`: reset the round

## Project Shape

- `src/main.js`: starts the game
- `src/game/ScorchedGame.js`: game loop, turns, drawing, and input
- `src/math/aiming.js`: cannon angle math, intentionally Daniel-friendly
- `src/physics/projectile.js`: projectile movement, wind, and hit detection
- `docs/`: design notes, architecture, and Daniel task ideas
- `tools/dev-server.mjs`: tiny local web server

## First Milestone

Two local players take turns firing basic projectiles. The tank cannon moves in real time when an arrow key is held, and the projectile flies with gravity and wind.
