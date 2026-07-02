# Session Notes

## 2026-06-29

Original project direction:

- Browser-based turn-based tank duel.
- Local turn-based multiplayer first.
- Player versus AI later.
- Online-style features later.
- Low graphics, real-time movement.
- Cannon rotates while an arrow key is held.
- Space fires a projectile.
- Daniel should own meaningful math and logic tasks once the harder scaffolding exists.

## 2026-07-01

Current state:

- The game is now named **Tanks!**.
- Game Setup supports Local Game, Host LAN, and Join LAN.
- Tank/Turret Designer and Ammo Designer exist.
- Inventory, quickbar, health, fuel, landscapes, water, craters, and scorekeeping exist.
- LAN rooms and live LAN matches are server-owned after the start handshake.

Current Daniel path:

- Keep Daniel out of multiplayer/server code for now.
- Have him copy existing tank/turret models instead of replacing starter models.
- Leave the Ammo Designer slider mappings and impact-size logic as small future tasks.
