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

Run the game:

```powershell
npm.cmd run dev
```

Then check:

- wind sometimes shows `<-`
- wind sometimes shows `->`
- the projectile bends in the same direction as the arrow
- the number still changes each turn

If the wind number is near zero, the projectile may not bend much. Fire a few times and watch the stronger wind values.
