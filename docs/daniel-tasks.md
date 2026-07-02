# Daniel Task List

These are intentionally small programming jobs where the interesting part is
coordinates, math, or logic.

Use [../TODO.md](../TODO.md) as the main mission board. This file is a shorter
index of good task ideas.

## Current Best Sequence

1. Copy an existing tank in `src/game/tankModels.js`, rename the copy, and turn it into one hand-drawn tank.
2. Copy `hillTurret`, rename the copy, and turn it into one hand-drawn turret.
3. Tune the collision box for the new tank.
4. Fix the Ammo Designer slider mappings in `src/main.js`.
5. Make impact animations use the selected ammo size.
6. Add blast-radius damage for near misses.
7. Make fuel cost more when driving uphill.
8. Improve the water-depth rule.

## Good Daniel Files

- `src/game/tankModels.js`: graph-paper tank and turret points.
- `src/math/aiming.js`: angle helpers.
- `src/physics/projectile.js`: gravity, wind, and projectile movement.
- `src/main.js`: Designer data mapping. Only touch small functions at first.
- `src/game/ScorchedGame.js`: game logic. Only touch one named function at a time.

## Good First Questions

1. Which way is positive x?
2. Which way is positive y on canvas?
3. Why does `90` degrees point up?
4. What happens if `blastRadius` gets bigger?
5. What happens if `terrainDamage` gets bigger?
6. What should happen if a tank tries to climb a cliff?
7. How deep should water be before a tank is destroyed?

## Tasks To Avoid For Now

- Rebuilding modal layouts.
- Saving/loading with `localStorage`.
- Large canvas drawing rewrites.
- Full landscape generation.
- Multiplayer, networking, and server code.
