# Architecture

## Choice: Plain JavaScript Modules and a Tiny Node Server

This project starts with plain browser JavaScript instead of a framework. That keeps the feedback loop short:

1. Edit a file.
2. Refresh the browser.
3. See the result.

The local server is `tools/dev-server.mjs`. It exists because browsers are stricter with JavaScript modules when files are opened directly from disk.

## Main Pieces

- `ScorchedGame`: owns the game loop, input, turns, drawing, and high-level state.
- `main.js`: owns browser UI wiring, modals, Designer tabs, saved setup, and mapping Designer data into game data.
- `tankModels.js`: owns starter tank and turret polygon data.
- `itemTypes.js`: owns starter ammo and inventory data.
- `aiming.js`: owns cannon angle math.
- `projectile.js`: owns projectile motion and simple collision checks.

## Teaching Boundary

The project should keep the engine and browser details mostly separate from Daniel's math tasks, but that boundary can move one function at a time.

Good Daniel files:

- `src/game/tankModels.js`
- `src/math/aiming.js`
- `src/physics/projectile.js`
- small mapping helpers in `src/main.js`
- small named logic helpers in `src/game/ScorchedGame.js`

Good grown-up files:

- modal layout and event wiring in `src/main.js`
- big canvas drawing changes
- persistence with `localStorage`
- game-loop lifecycle and performance safety
- future networking

Current Daniel-friendly bridge:

- The Tank Designer maps UI fields into game tank models.
- The Ammo Designer maps UI fields into game item data.
- Two ammo mappings are intentionally left as Daniel tasks: `explosionSize -> blastRadius` and `divotSize -> terrainDamage`.
