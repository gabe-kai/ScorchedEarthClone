# Tanks!

A small browser game project for building a turn-based tank duel with Daniel.

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

## LAN Multiplayer

The LAN multiplayer layer is now a server-owned room and game foundation, not finished online play.

One PC starts the dev server. Other PCs on the same network open the host address shown in the Multiplayer window or terminal, such as:

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

- `src/main.js`: starts the game
- `src/game/ScorchedGame.js`: game loop, turns, drawing, and input
- `src/game/tankModels.js`: graph-paper tank shapes for Player 1 and Player 2
- `src/game/itemTypes.js`: inventory item data, including ammo and future tools
- `src/math/aiming.js`: cannon angle math, intentionally Daniel-friendly
- `src/physics/projectile.js`: projectile movement, wind, and hit detection
- `src/network/multiplayerClient.js`: LAN room browser, slot UI, turn-lock helper, and game message client
- `docs/`: design notes, architecture, and Daniel task ideas
- `tools/dev-server.mjs`: local web server plus multi-room LAN WebSocket server

## Current Milestone

Two local players take turns moving, aiming, buying ammo, choosing quickbar items, and firing across generated landscapes with wind, craters, water, fuel, health, and scorekeeping.

## Current Daniel Task

Daniel can design one custom tank on graph paper, add it by hand to [src/game/tankModels.js](src/game/tankModels.js), then choose it on the Game Setup screen. See [TODO.md](TODO.md).
