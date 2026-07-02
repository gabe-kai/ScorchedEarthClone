# Milestones

## Milestone 1: Local Tank Duel

Status: done.

- Two tanks appear on opposite sides of the screen.
- Players take turns.
- Current player can rotate the cannon in real time.
- Current player can adjust shot power.
- Projectile flies with gravity and wind.
- Direct hits and self-hits work.

## Milestone 2: Terrain And Hits

Status: done.

- Projectile impact animations.
- Sloped craters.
- Tank health.
- Floating damage text.
- Knockout messages.
- Scoreboard across rounds.

## Milestone 3: Inventory And Designers

Status: mostly done, with Daniel-sized gaps.

- Inventory and quickbar exist.
- Purchase and sell buttons exist.
- Ammo Designer exists.
- Tank/Turret Designer exists.
- Player setup can choose names, player colors, tank models, match length, landscape, and water settings.
- Daniel still needs to connect a few Ammo Designer values to real shot behavior.

## Milestone 4: Landscapes And Movement

Status: done enough for playtesting.

- Rolling hills, cliffs, random terrain, and Rising Sea exist.
- Water level controls exist.
- Rising Sea can climb after shots.
- Tanks spawn on dry land.
- Tanks can move, spend fuel, fall, and drown in deep water.

## Milestone 5: Better Daniel Features

Status: next.

- Hand-import one custom tank.
- Hand-import one custom turret.
- Fix Ammo Designer explosion/divot mappings.
- Make impact animations match ammo size.
- Add blast-radius damage for near misses.
- Make uphill driving cost more fuel.
- Improve water-depth rules.

## Milestone 6: LAN Multiplayer

Status: prototype foundation done.

- One Node server can host multiple LAN rooms.
- Players can create rooms, browse rooms, join slots, mark ready, and start.
- Live LAN matches run on the server after the start handshake.
- Browser refresh can reclaim the same active slot.
- Active games pause on disconnect and resume after reconnect.
- Stuck start handshakes and abandoned rooms are cleaned up.

Next polish:

- Move initial match creation fully onto the server.
- Add visible turn timers.
- Add better room names or room codes in the UI.

## Milestone 7: Computer Player

Status: future.

- Add a simple AI that tries random angle and power.
- Improve AI by adjusting based on the previous miss.

## Milestone 8: Online Later

Status: future.

- Keep accounts, friends, and internet hosting out of the first kid-focused version.
- LAN multiplayer should stay fun before we turn this into a larger online platform.
