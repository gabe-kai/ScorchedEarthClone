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
- `multiplayerClient.js`: owns the LAN room browser, slot UI, message client, and local turn-input lock.
- `tools/dev-server.mjs`: serves files and owns the WebSocket LAN room registry.
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

## Multiplayer Boundary

The current multiplayer code is a multi-room LAN foundation:

- many rooms on one local dev server
- room codes and room listing
- create/join/leave slots
- ready/start/pause state
- local input lock when it is not your slot's turn
- player commands routed through the WebSocket server by room id
- a headless server game loop that applies commands and publishes snapshots
- game snapshots routed only to players in the same room
- browser refresh/reconnect using a local `playerToken`
- disconnect pauses for active games, auto-resumes when everyone is back
- stuck start handshakes and abandoned rooms are cleaned up

The server now owns live multiplayer gameplay after match start. The current bridge is that the room creator's browser still builds the initial match snapshot and sends the custom tank/ammo catalog to the server. The next hardening step is to move match creation/catalog conversion fully into shared code so the server can create the first snapshot by itself.
