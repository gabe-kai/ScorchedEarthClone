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

## Done: Daniel TODO 1: Fix And Add Control Keys

Daniel updated the controls so left/right rotate the cannon, up/down change power, and WASD also works.

## Daniel TODO 2: Add A Wind Direction Arrow

Wind is already in the game. The projectile is pushed sideways by this line in [src/physics/projectile.js](src/physics/projectile.js):

```js
projectile.vx += wind * deltaSeconds;
```

That means:

- positive wind pushes the projectile to the right
- negative wind pushes the projectile to the left
- zero wind does not push sideways

The problem is that the HUD only shows a number. We want the wind display to show both direction and strength.

The file to edit is:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

### Step 1: Find The HUD Code

Open `src/game/ScorchedGame.js`.

Find the `updateHud()` method near the bottom of the file.

Look for this line:

```js
this.hud.wind.textContent = this.wind.toFixed(1);
```

That line is where the wind number gets shown on the screen.

### Step 2: Decide The Arrow

Make a variable called `windArrow`.

Use this rule:

| Wind Value | Arrow |
| --- | --- |
| less than 0 | `<-` |
| greater than 0 | `->` |
| exactly 0 | `-` |

You can write this with `if`, `else if`, and `else`.

Example shape:

```js
let windArrow = '-';

if (this.wind < 0) {
  windArrow = '<-';
} else if (this.wind > 0) {
  windArrow = '->';
}
```

### Step 3: Show Arrow Plus Number

Change the wind HUD line so it shows the arrow and the number together.

Example:

```js
this.hud.wind.textContent = `${windArrow} ${Math.abs(this.wind).toFixed(1)}`;
```

Why `Math.abs`? It turns negative numbers positive, so the display can say:

```text
<- 12.5
```

instead of:

```text
<- -12.5
```

### Step 4: Test It

Refresh the browser page. Then check:

- wind sometimes shows `<-`
- wind sometimes shows `->`
- the projectile bends in the same direction as the arrow
- the number still changes each turn

If the wind number is near zero, the projectile may not bend much. Fire a few times and watch the stronger wind values.

## Daniel TODO 3: Add Cannonball Hit Animations

The file to edit is:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

Find this method:

```js
drawImpact(ctx, impact)
```

This method is called when the cannonball hits something.

Right now it intentionally draws nothing.

That means the game is ready for hit animations, but you get to make the first one appear.

### Goal

First, make any hit show a visible circle.

Then, make ground hits and tank hits look different.

Useful values:

- `impact.x`: where the hit happened
- `impact.y`: where the hit happened
- `impact.kind`: either `'ground'` or `'tank'`
- `impact.age`: how long the impact has been happening

Ideas:

- tank hit: orange or red explosion
- ground hit: brown dirt puff or gray smoke
- tank hit: bigger circle
- ground hit: smaller circle

### Things To Try

Start by adding this inside `drawImpact`:

```js
ctx.fillStyle = '#f08a24';
ctx.beginPath();
ctx.arc(impact.x, impact.y, 20, 0, Math.PI * 2);
ctx.fill();
```

Then refresh the browser page and fire at the ground.

After that works, try using an `if` statement:

```js
if (impact.kind === 'tank') {
  // tank hit drawing goes here
} else {
  // ground hit drawing goes here
}
```

Inside the two parts, change:

```js
ctx.fillStyle
```

Change:

```js
radius
```

Or add a second circle after the first one.

### Test It

Refresh the browser page after each change. Then fire at:

- the ground
- the other tank

First, you should see an impact circle.

Then, after you add the `if` statement, the two impact types should look different.

## Daniel TODO 4: Add Self-Hit

The file to edit is:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

Find this method:

```js
findProjectileTankHit()
```

Right now it only checks the other tank.

### Goal

Let a player hit their own tank too, but not instantly when the cannon ball first appears.

Use this constant near the top of the file:

```js
SELF_HIT_GRACE_SECONDS
```

Use this projectile property:

```js
this.projectile.age
```

### Idea

Only check the current tank if:

```js
this.projectile.age > SELF_HIT_GRACE_SECONDS
```

That gives the cannon ball time to leave the cannon before it can hit the player who fired it.

### Test It

Try a very low-power shot or a bad angle.

You should be able to hit your own tank after the ball has been flying for a moment.

## Daniel TODO 5: Make Cannon Balls Dig Craters

The file to edit is:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

Find this method:

```js
deformTerrainAt(x, y)
```

This function is already called when a shot hits the ground.

Right now it does nothing.

### Goal

Change nearby terrain points so the ground makes a crater.

Important ideas:

- `this.terrain` is an array of ground heights.
- Each array value is a y position.
- Bigger y means lower on the screen.
- So adding to a terrain value digs downward.
- `TERRAIN_STEP` tells how many pixels apart the terrain points are.

### Simple First Version

Pick a crater size:

```js
const craterRadius = 36;
const craterDepth = 22;
```

Loop over every terrain point.

For each point:

1. figure out its x position
2. measure how far it is from the impact x
3. if it is close enough, add to that terrain height

### Test It

Fire at the ground.

You should see the ground change shape where the cannon ball lands.
