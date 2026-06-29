# Architecture

## Choice: Plain JavaScript Modules and a Tiny Node Server

This project starts with plain browser JavaScript instead of a framework. That keeps the feedback loop short:

1. Edit a file.
2. Refresh the browser.
3. See the result.

The local server is `tools/dev-server.mjs`. It exists because browsers are stricter with JavaScript modules when files are opened directly from disk.

## Main Pieces

- `ScorchedGame`: owns the game loop, input, turns, drawing, and high-level state.
- `aiming.js`: owns cannon angle math.
- `projectile.js`: owns projectile motion and simple collision checks.

## Teaching Boundary

The project should keep the engine and browser details mostly separate from Daniel's math tasks.

Good Daniel files:

- `src/math/aiming.js`
- `src/physics/projectile.js`
- future files like `src/weapons/basicShot.js` or `src/ai/simpleAi.js`

Good grown-up files:

- `src/game/ScorchedGame.js`
- input handling
- canvas drawing
- menus and future networking

This boundary can move as Daniel gets more comfortable.
