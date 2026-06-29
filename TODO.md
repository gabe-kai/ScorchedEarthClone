# TODO

This file is the project map and task list. Start here when deciding what to change next.

## Important Files

- [README.md](README.md): explains how to run the game and the current controls.
- [index.html](index.html): the browser page. It creates the canvas and the sidebar text.
- [src/main.js](src/main.js): starts the game by creating a `ScorchedGame`.
- [src/game/ScorchedGame.js](src/game/ScorchedGame.js): the main game file. It handles keyboard input, turns, drawing tanks, firing, impact animations, terrain, and the HUD.
- [src/math/aiming.js](src/math/aiming.js): cannon angle math. This is a good Daniel file.
- [src/physics/projectile.js](src/physics/projectile.js): projectile movement, wind, gravity, and simple tank hits. This is another good Daniel file.
- [src/styles.css](src/styles.css): page layout and visual styling.
- [tools/dev-server.mjs](tools/dev-server.mjs): tiny local web server used by `npm.cmd run dev`.
- [test/aiming.test.js](test/aiming.test.js): small tests for the aiming math.
- [test/projectile.test.js](test/projectile.test.js): small tests for projectile age and self-hit behavior.
- [docs/architecture.md](docs/architecture.md): notes about how the code is organized.
- [docs/daniel-tasks.md](docs/daniel-tasks.md): future Daniel-sized programming tasks.
- [docs/milestones.md](docs/milestones.md): bigger game milestones.
- [docs/session-notes.md](docs/session-notes.md): notes from project setup and planning.

## Done: Daniel TODO 1: Fix And Add Control Keys

Daniel updated the controls so left/right rotate the cannon, up/down change power, and WASD also works.

## Done: Daniel TODO 2: Add A Wind Direction Arrow

Daniel updated the wind HUD so the number includes a direction arrow. Negative wind shows `<-`, positive wind shows `->`, and the strength is shown as a positive number.

## Done: Daniel TODO 3: Add Cannonball Hit Animations

Daniel added visible hit animations in `drawImpact(ctx, impact)`. Tank hits and ground hits now use different circle sizes and colors.

## Done: Daniel TODO 4: Add Self-Hit

Daniel updated `findProjectileTankHit()` so shots can hit the firing player's own tank after the cannonball has been flying longer than `SELF_HIT_GRACE_SECONDS`.

## Daniel TODO 5: Make Cannon Balls Dig Craters

The file to edit is:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

The crater code is split into small helper functions near the bottom of the file.

The grown-up code already loops through the terrain points in:

```js
deformTerrainAt(x, y)
```

Daniel does not need to write that loop yet.

Instead, fix one small helper function at a time.

## Daniel TODO 5A: Make Any Crater Change Happen

Find this helper function:

```js
function isInsideCrater(distance, craterRadius)
```

Right now it always says:

```js
return false;
```

That means no terrain points are inside the crater, so nothing changes.

### Goal

Change it so a terrain point is inside the crater when `distance` is less than `craterRadius`.

The fixed line should use:

```js
distance < craterRadius
```

### Test It

Refresh the browser page.

Fire at the ground.

Something should happen to the ground near the hit.

It might look wrong at first. That is okay. That is the next task.

## Daniel TODO 5B: Fix The Hill Bug

After TODO 5A, the cannonball may make a hill instead of a crater.

That is an intentional bug.

Find this line inside `deformTerrainAt(x, y)`:

```js
this.terrain[index] -= depth;
```

### Goal

Change the sign so the ground moves down instead of up.

Remember:

- canvas y gets bigger as it goes lower
- adding to terrain digs downward
- subtracting from terrain pushes upward

### Test It

Refresh the browser page.

Fire at the ground.

The ground should now dig downward where the shot lands.

## Daniel TODO 5C: Tune The Crater Size

Find these constants near the top of `src/game/ScorchedGame.js`:

```js
const CRATER_RADIUS = 36;
const CRATER_DEPTH = 22;
```

### Goal

Try changing the numbers and predict what will happen.

Questions:

- What happens if `CRATER_RADIUS` is bigger?
- What happens if `CRATER_RADIUS` is smaller?
- What happens if `CRATER_DEPTH` is bigger?
- What happens if `CRATER_DEPTH` is smaller?

### Test It

Refresh the browser page after each change.

Fire at the ground and compare the crater.

## Daniel TODO 5D: Make The Crater Rounder

Important ideas:

- A blocky crater uses the same depth everywhere.
- A rounder crater is deeper in the middle.
- A rounder crater is shallower near the edges.

Find this helper function:

```js
function craterDepthAt(distance, craterRadius, maxDepth)
```

Right now it returns the same depth every time:

```js
return maxDepth;
```

### Goal

Use `distance` to make the depth smaller near the edge.

```js
const closeness = 1 - distance / craterRadius;
return maxDepth * closeness;
```

That means:

- distance near `0`: deep crater
- distance near `craterRadius`: shallow edge

### Test It

Refresh the browser page.

Fire at the ground.

The crater should look less square and more sloped.

## Bonus: What The Helper Functions Mean

These helper functions each do one small job:

- `terrainIndexToX(index)`: turns an array spot into a screen x position.
- `distanceBetween(a, b)`: measures how far apart two x positions are.
- `isInsideCrater(distance, craterRadius)`: decides whether a point gets changed.
- `craterDepthAt(distance, craterRadius, maxDepth)`: decides how much a point changes.
