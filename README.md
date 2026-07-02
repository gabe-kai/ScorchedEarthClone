# Tanks!

A browser game project for building a turn-based tank duel with Daniel.

The goal is not just to make the game. The goal is to set up a project where the grown-up can build the tricky engine pieces, then Daniel can program meaningful parts that use angle, direction, velocity, collision, turns, and game logic.

## Run It

Install dependencies once:

```powershell
npm.cmd install
```

On Windows PowerShell, use:

```powershell
npm.cmd run dev
```

Then open:

```text
http://localhost:5173
```

The app opens to **Game Setup** first. Choose **Local Game**, **Host LAN**, or **Join LAN**, then start the match to show the battlefield.

If PowerShell still has trouble with npm, run the server directly:

```powershell
node tools/dev-server.mjs
```

When you are done for the day, stop the dev server with `Ctrl+C` in the terminal. The game also pauses its animation loop when the browser tab is hidden, which helps keep long dev sessions lighter.

## Test It

Run the logic tests:

```powershell
npm.cmd test
```

Run the browser UI tests:

```powershell
npm.cmd run test:ui
```

If Playwright reuses an old dev server, stop the server on port `5173` and run the UI tests again.

## LAN Multiplayer

The LAN multiplayer layer is now a server-owned room and game foundation, not finished online play.

One PC starts the dev server. Other PCs on the same network open the host address shown in the Host Lobby panel or terminal, such as:

```text
http://192.168.x.x:5173
```

Choose **Host LAN** to create a new room. Choose **Join LAN** to browse the rooms currently waiting on that server, pick one, join a slot, mark ready, and start playing. The server owns the room list, slots, ready state, start state, turn lock, command handling, and game snapshots for multiple rooms at once.

Current limitation: the room creator's browser still provides the initial match snapshot and custom tank/ammo catalog. After that handshake, the Node server runs a headless game loop and every browser follows server snapshots.

The server also remembers each browser with a local player token. If a player refreshes during an active LAN game, their browser reclaims the same slot. A live game pauses while a player is disconnected and resumes when everyone is back. Empty or abandoned rooms are cleaned up automatically.

## Controls

- `Tab`: switch between Aim mode and Move mode
- Aim mode: `ArrowLeft` / `ArrowRight` or `A` / `D` rotate the current tank cannon
- Aim mode: `ArrowUp` / `ArrowDown` or `W` / `S` raise or lower shot power
- Move mode: `ArrowLeft` / `ArrowRight` or `A` / `D` drive the current tank
- `Space`: fire
- `I`: open inventory
- `1` through `0`: select quickbar slots

## Project Shape

- `src/main.js`: starts the game and wires the browser UI, setup screen, inventory, and designers
- `src/game/ScorchedGame.js`: game loop, turns, drawing, state snapshots, and game rules
- `src/game/tankModels.js`: graph-paper tank and turret model data
- `src/game/itemTypes.js`: inventory item data, including ammo and future tools
- `src/math/aiming.js`: cannon angle math, intentionally Daniel-friendly
- `src/physics/projectile.js`: projectile movement, wind, and hit detection
- `src/network/multiplayerClient.js`: LAN room browser, slot UI, turn-lock helper, and game message client
- `tools/headless-scorched-game.mjs`: server-side wrapper around the game rules for LAN matches
- `docs/`: design notes, architecture, and Daniel task ideas
- `tools/dev-server.mjs`: local web server plus multi-room LAN WebSocket server

## Current Milestone

Local and LAN players can move, aim, buy ammo, choose quickbar items, and fire across generated landscapes with wind, craters, water, fuel, health, and scorekeeping.

## Current Daniel Task

Daniel can design one custom tank on graph paper, copy an existing model in [src/game/tankModels.js](src/game/tankModels.js), rename the copy, edit the points, and choose it on the Game Setup screen. See [TODO.md](TODO.md).
