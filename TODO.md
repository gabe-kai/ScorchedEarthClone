# Daniel's Tank Missions

This is your mission board for **Tanks!**

You are not just playing the game. You are programming real parts of it.

## Stuff Daniel Already Built

You have already made real changes to the game:

- You fixed the keyboard controls.
- You added WASD controls.
- You added arrows so wind direction is easier to see.
- You made cannonballs show hit animations.
- You made it possible for a player to hit their own tank.
- You made cannonballs dig craters in the ground.

That is a lot. Nice work.

## Tiny Project Map

These are the files you are most likely to use:

- [src/game/tankModels.js](src/game/tankModels.js): tank and turret shapes made from graph-paper points.
- [src/main.js](src/main.js): connects menu and Designer choices to the game.
- [src/game/ScorchedGame.js](src/game/ScorchedGame.js): main game rules, like movement, damage, water, and drawing.
- [src/physics/projectile.js](src/physics/projectile.js): cannonball motion, gravity, and wind.
- [src/math/aiming.js](src/math/aiming.js): cannon angle math.

For the next mission, start with:

- [src/game/tankModels.js](src/game/tankModels.js)

## Mission 1: Add One Tank From Graph Paper

### What You Are Making

Draw one tank on graph paper.

Then put the dot coordinates into the game so your tank appears in **Game Setup**.

### The Coordinate Rules

Use the bottom-middle of your tank as:

```text
(0, 0)
```

Directions:

- right means bigger `x`
- left means smaller `x`
- down means bigger `y`
- up means smaller `y`

Example:

```js
{ x: 4, y: -10 }
```

That point is:

- 4 squares to the right
- 10 squares up

## Step 1: Draw The Body

The `body` is the lower part of the tank.

Keep it small for the first try:

- left side near `x: -24`
- right side near `x: 24`
- bottom near `y: 0`
- top near `y: -12`

Example body:

```js
body: [
  { x: -20, y: 0 },
  { x: -17, y: -12 },
  { x: 14, y: -12 },
  { x: 22, y: 0 }
]
```

## Step 2: Draw The Cab

The `cab` is the smaller shape on top of the body.

Example cab:

```js
cab: [
  { x: -8, y: -12 },
  { x: -4, y: -22 },
  { x: 9, y: -22 },
  { x: 13, y: -12 }
]
```

## Step 3: Pick The Cannon Pivot

The `cannonPivot` is the point where the cannon spins.

It should usually be on top of the cab.

Example:

```js
cannonPivot: { x: 5, y: -22 }
```

## Step 4: Add Your Tank To The Code

Open:

- [src/game/tankModels.js](src/game/tankModels.js)

Find this:

```js
export const TANK_MODELS = {
```

Copy one of the existing tanks.

Paste your copy under `p2Custom`.

Rename it something simple, like:

```js
danielTank
```

Starter shape:

```js
danielTank: {
  name: 'Daniel Tank',
  type: 'tank',
  canMove: true,
  color: '#44dd55',
  accent: '#b6ff8f',
  body: [
    { x: -20, y: 0 },
    { x: -17, y: -12 },
    { x: 14, y: -12 },
    { x: 22, y: 0 }
  ],
  cab: [
    { x: -8, y: -12 },
    { x: -4, y: -22 },
    { x: 9, y: -22 },
    { x: 13, y: -12 }
  ],
  cannonPivot: { x: 5, y: -22 },
  cannon: {
    style: 'oneSide',
    minAngle: -20,
    maxAngle: 100,
    flipPastEdge: true
  },
  collision: { width: 44, height: 28 }
}
```

### Important Comma Rule

If another tank comes after your tank, put a comma after your tank:

```js
},
```

If your tank is the very last one, no comma is needed.

## Step 5: Test Your Tank

Refresh the browser.

Open **Game Setup**.

Choose your tank for Player 1.

Start the game.

Check:

- Does your tank appear?
- Is it the right size?
- Is it sitting on the ground?
- Is the cannon attached to the cab?
- Can it shoot?

## Step 6: Fix The Hit Box

The `collision` box controls where cannonballs count as a hit.

```js
collision: { width: 44, height: 28 }
```

Try this:

- If shots pass through the tank, make `width` or `height` bigger.
- If shots hit empty air near the tank, make `width` or `height` smaller.

## Mission 2: Add One Turret

A turret is like a tank that cannot drive.

Copy `hillTurret` in [src/game/tankModels.js](src/game/tankModels.js).

Make your own turret with a new name.

Turret settings:

```js
type: 'turret',
canMove: false,
cannon: {
  style: 'topArc',
  minAngle: 0,
  maxAngle: 180,
  flipPastEdge: false
}
```

Test:

- Choose the turret in **Game Setup**.
- Switch to Move mode.
- It should not drive.
- It should still be able to aim and shoot.

## Mission 3: Fix The Ammo Designer Sliders

The Ammo Designer has sliders for:

- Explosion Size
- Divot

But the real cannonball does not fully use those sliders yet.

Open:

- [src/main.js](src/main.js)

Find:

```js
function designerAmmoToGameItem(ammo) {
```

Then find these two lines:

```js
blastRadius: 40,
terrainDamage: 1,
```

Your job:

- make `blastRadius` use `ammo.explosionSize`
- make `terrainDamage` use `ammo.divotSize`

Then test:

- Make tiny ammo.
- Fire it at the ground.
- Make huge ammo.
- Fire it at the ground.
- The crater should change size.

## Mission 4: Make The Flash Match The Ammo

After Mission 3, the crater can change size.

But the explosion flash still needs help.

Open:

- [src/game/ScorchedGame.js](src/game/ScorchedGame.js)

Look for:

```js
startImpact
```

and:

```js
drawImpact
```

Goal:

- small ammo makes a small flash
- big ammo makes a big flash

## Later Missions

These are for later, not today unless you want a bigger challenge.

### Blast Damage

Near misses should damage tanks.

Idea:

- very close = lots of damage
- edge of explosion = little damage
- outside explosion = no damage

### Smarter Fuel

Driving uphill could cost more fuel.

Driving downhill could cost less fuel.

Look for:

```js
driveTank(tank, direction, deltaSeconds)
```

### Better Water Rules

Right now, deep water destroys tanks.

Later, you could change how deep is too deep.

Look for:

```js
isTankInWater(tank)
```
