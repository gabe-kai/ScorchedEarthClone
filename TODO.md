# TODO

This file is the project map and task list. Start here when deciding what to change next.

## Important Files

- [README.md](README.md): explains how to run the game and the current controls.
- [index.html](index.html): the browser page. It creates the canvas and the sidebar text.
- [src/main.js](src/main.js): starts the game by creating a `ScorchedGame`.
- [src/game/ScorchedGame.js](src/game/ScorchedGame.js): the main game file. It handles keyboard input, turns, drawing tanks, firing, and updating the projectile.
- [src/math/aiming.js](src/math/aiming.js): cannon angle math. This is a good Daniel file.
- [src/physics/projectile.js](src/physics/projectile.js): projectile movement, wind, gravity, and simple tank hits. This is another good Daniel file.
- [src/styles.css](src/styles.css): page layout and visual styling.
- [tools/dev-server.mjs](tools/dev-server.mjs): tiny local web server used by `npm.cmd run dev`.
- [test/aiming.test.js](test/aiming.test.js): small tests for the aiming math.
- [docs/architecture.md](docs/architecture.md): notes about how the code is organized.
- [docs/daniel-tasks.md](docs/daniel-tasks.md): future Daniel-sized programming tasks.
- [docs/milestones.md](docs/milestones.md): bigger game milestones.
- [docs/session-notes.md](docs/session-notes.md): notes from project setup and planning.

## Daniel TODO 1: Fix And Add Control Keys

Right now the controls work, but they are backwards from what we want:

- Up and down arrows change the cannon angle.
- Left and right arrows change shot power.

We want:

- Left and right arrows rotate the cannon.
- Up and down arrows change shot power.
- WASD should also work for left-handed controls.

The file to edit is:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

### Step 1: Find The Key Code

Open `src/game/ScorchedGame.js`.

Find the `update(deltaSeconds)` method.

Look for code like this:

```js
if (this.keys.has('ArrowUp')) {
  tank.angle = turnCannon(tank.angle, 1, CANNON_TURN_SPEED, deltaSeconds);
}
```

That is one of the places where a key changes the tank.

### Step 2: Decide The New Controls

Use this mapping:

| Action | Arrow Key | WASD Key |
| --- | --- | --- |
| Rotate cannon left/down | `ArrowLeft` | `KeyA` |
| Rotate cannon right/up | `ArrowRight` | `KeyD` |
| Raise power | `ArrowUp` | `KeyW` |
| Lower power | `ArrowDown` | `KeyS` |

For now, keep:

- Fire: `Space`
- Reset: `KeyR`

### Step 3: Add WASD To The Prevent-Scroll List

Near the top of `onKeyDown(event)`, there is a list of keys that should not scroll the page.

Add the WASD codes to that list:

```js
'KeyW', 'KeyA', 'KeyS', 'KeyD'
```

### Step 4: Change The Angle Checks

The angle checks should use left and right controls.

That means each angle check should accept either an arrow key or a WASD key.

Example:

```js
if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) {
  tank.angle = turnCannon(tank.angle, 1, CANNON_TURN_SPEED, deltaSeconds);
}
```

Then make the matching check for left:

```js
if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) {
  tank.angle = turnCannon(tank.angle, -1, CANNON_TURN_SPEED, deltaSeconds);
}
```

### Step 5: Change The Power Checks

The power checks should use up and down controls.

Example:

```js
if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) {
  tank.power = Math.min(MAX_POWER, tank.power + POWER_STEP * deltaSeconds);
}
```

Then make the matching check for lowering power:

```js
if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) {
  tank.power = Math.max(MIN_POWER, tank.power - POWER_STEP * deltaSeconds);
}
```

### Step 6: Test It

Run the game:

```powershell
npm.cmd run dev
```

Then check:

- `Left Arrow` and `A` rotate the cannon one way.
- `Right Arrow` and `D` rotate the cannon the other way.
- `Up Arrow` and `W` raise power.
- `Down Arrow` and `S` lower power.
- `Space` still fires.

If that works, Daniel completed the first real game-control task.
