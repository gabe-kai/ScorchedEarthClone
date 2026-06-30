# TODO

This file is the project map and task list. Start here when deciding what to change next.

## Important Files

- [README.md](README.md): explains how to run the game and the current controls.
- [index.html](index.html): the browser page. It creates the canvas, game field, and HUD panels.
- [src/main.js](src/main.js): starts the game and connects HTML HUD elements to JavaScript.
- [src/game/ScorchedGame.js](src/game/ScorchedGame.js): the main game file. It handles keyboard input, turns, drawing, firing, impact animations, terrain, and the HUD.
- [src/game/tankModels.js](src/game/tankModels.js): tank shapes built from graph-paper polygon points. This is the next Daniel file.
- [src/game/itemTypes.js](src/game/itemTypes.js): inventory item data, including ammo and future tools.
- [src/math/aiming.js](src/math/aiming.js): cannon angle math.
- [src/physics/projectile.js](src/physics/projectile.js): projectile movement, wind, gravity, and simple tank hits.
- [src/styles.css](src/styles.css): page layout and visual styling.
- [tools/dev-server.mjs](tools/dev-server.mjs): tiny local web server used by `npm.cmd run dev`.

## Done So Far

- Daniel fixed the controls and added WASD.
- Daniel added wind direction arrows.
- Daniel added cannonball hit animations.
- Daniel added self-hit.
- Daniel made cannonballs dig sloped craters.
- Grown-up scaffold added a bigger battlefield, smaller polygon tanks, current-turn UI, setup/admin panels, tank model data, and ammo data.
- Grown-up UI pass changed the bottom ammo bar into an inventory quickbar with an inventory window, add/remove behavior, and item tooltips.

## Daniel TODO 6: Design Two Tanks On Graph Paper

The file to edit after drawing is:

- [src/game/tankModels.js](src/game/tankModels.js)

### Goal

Design two different tanks:

- one for Player 1
- one for Player 2

Each tank should be made from straight lines connecting dots.

### Step 1: Draw The Axes

On graph paper, draw a point called the tank's ground point.

Use this as the center-bottom of the tank:

```text
(0, 0)
```

Then draw:

- x goes left and right
- y goes up and down

Important:

- right is positive x
- left is negative x
- down is positive y
- up is negative y

So a point above the ground might be:

```text
(4, -10)
```

### Step 2: Draw The Body Shape

Draw a tank body with straight lines.

Keep it small:

- left side around `x = -24`
- right side around `x = 24`
- bottom around `y = 0`
- top around `y = -12` to `y = -20`

Mark each corner dot around the outside of the body.

Then write the dots in order around the shape.

Example:

```js
body: [
  { x: -20, y: 0 },
  { x: -18, y: -12 },
  { x: 14, y: -12 },
  { x: 22, y: 0 }
]
```

### Step 3: Draw The Cab Shape

Draw a smaller shape on top of the body.

Example:

```js
cab: [
  { x: -8, y: -12 },
  { x: -4, y: -22 },
  { x: 9, y: -22 },
  { x: 13, y: -12 }
]
```

### Step 4: Pick The Cannon Pivot

The cannon pivot is the dot where the cannon rotates.

It should usually be on top of the cab.

Example:

```js
cannonPivot: { x: 5, y: -22 }
```

### Step 5: Put Your Points Into The Code

Open [src/game/tankModels.js](src/game/tankModels.js).

Find:

```js
p1Custom
```

Replace the starter `body`, `cab`, and `cannonPivot` points with Player 1's design.

Then find:

```js
p2Custom
```

Replace the starter points with Player 2's design.

### Step 6: Test By Refreshing

Refresh the browser page.

Check:

- Player 1 and Player 2 look different.
- The cannon starts on top of the cab.
- The tank is not too huge.
- The tank is not floating far above the ground.
- The tank is not buried too far below the ground.

### Step 7: Fix The Collision Box If Needed

Each tank model has:

```js
collision: { width: 44, height: 24 }
```

This is still a simple rectangle used for hit detection.

If your tank is wider, make `width` bigger.

If your tank is taller, make `height` bigger.

## Future Grown-Up Work

- Make the setup window actually choose player names and tank models.
- Make the ammo panel actually switch weapons.
- Make the ammo admin panel edit ammo properties.
- Add health and blast-radius damage.
- Make tanks settle onto cratered ground.
