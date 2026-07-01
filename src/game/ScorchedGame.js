import { angleToVector, cannonTip, turnCannon } from '../math/aiming.js';
import { createProjectile, moveProjectile, projectileHitTank } from '../physics/projectile.js';
import { createStartingInventory, ITEM_TYPES } from './itemTypes.js';
import { TANK_MODELS } from './tankModels.js';

// GAME SIZE AND TUNING NUMBERS
//
// These constants are the "settings" for the first version of the game.
// Changing these numbers is usually safer than changing the game loop below.
const WIDTH = 1280;
const HEIGHT = 720;
const GROUND_Y = 620;
const CANNON_LENGTH = 34;
const CANNON_TURN_SPEED = 55;
const POWER_STEP = 90;
const MIN_POWER = 80;
const MAX_POWER = 520;
const TERRAIN_STEP = 8;
const IMPACT_DURATION_SECONDS = 0.45;
const SELF_HIT_GRACE_SECONDS = 0.25;
const CRATER_RADIUS = 40;
const CRATER_DEPTH = 50;
const MIN_TERRAIN_Y = 120;
const MAX_TERRAIN_Y = HEIGHT - 8;

// MAIN GAME CLASS
//
// ScorchedGame owns the whole running game:
// - keyboard input
// - whose turn it is
// - the cannon ball
// - drawing everything on the canvas
// - updating the HUD text
export class ScorchedGame {
  constructor(canvas, hud) {
    // The canvas is the rectangle we draw the game into.
    this.canvas = canvas;

    // The context is the drawing tool for the canvas.
    // Most drawing commands below start with "ctx.".
    this.context = canvas.getContext('2d');

    // hud contains the HTML elements for status, angle, power, and the panels.
    this.hud = hud;

    // keys remembers which keyboard keys are currently being held down.
    // A Set is like a list that only keeps one copy of each value.
    this.keys = new Set();

    // lastTime is used to measure how much time passed between frames.
    // That keeps movement smooth even if the computer is a little slow.
    this.lastTime = 0;

    // animationFrameId lets us cancel the game loop when the page unloads.
    this.animationFrameId = null;

    // running prevents accidentally starting two animation loops.
    this.running = false;

    // Bound event handlers are saved so stop() can remove them later.
    this.handleKeyDown = (event) => this.onKeyDown(event);
    this.handleKeyUp = (event) => this.onKeyUp(event);
    this.handleVisibilityChange = () => this.onVisibilityChange();
    this.handlePageHide = () => this.stop();
    this.inventoryChangeHandler = null;

    this.roundNumber = 0;

    // Start the first round.
    this.reset();
  }

  setInventoryChangeHandler(handler) {
    this.inventoryChangeHandler = handler;
  }

  notifyInventoryChanged() {
    if (this.inventoryChangeHandler) {
      this.inventoryChangeHandler();
    }
  }

  start() {
    if (this.running) {
      return;
    }

    this.running = true;

    // Keydown happens when a key is pressed.
    // Keyup happens when a key is released.
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);

    // requestAnimationFrame asks the browser to call tick before the next draw.
    // This starts the game loop.
    this.scheduleNextFrame();
  }

  stop() {
    // SAFETY FOR LONG DEV SESSIONS
    //
    // Stop the animation loop and remove event listeners.
    // This keeps refreshes, page closes, and tool reloads from leaving old
    // game loops behind.
    this.running = false;
    this.keys.clear();

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
  }

  onVisibilityChange() {
    // Pause the animation loop while the tab is hidden.
    // Resume with clean timing when the tab becomes visible again.
    if (document.hidden) {
      this.keys.clear();
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      return;
    }

    this.lastTime = 0;
    this.scheduleNextFrame();
  }

  scheduleNextFrame() {
    if (!this.running || document.hidden || this.animationFrameId !== null) {
      return;
    }

    this.animationFrameId = requestAnimationFrame((time) => this.tick(time));
  }

  reset() {
    this.roundNumber += 1;
    this.turnNumber = 1;

    // terrain is an array of ground heights.
    // Each number says where the ground is at one x position.
    // Right now all values are GROUND_Y, so the battlefield starts flat.
    this.terrain = createFlatTerrain();

    // Put two tanks on opposite sides of the battlefield.
    // The last number is the starting cannon angle in degrees.
    this.players = [
      this.createTank('Player 1', 190, 'p1Custom', 35),
      this.createTank('Player 2', 1090, 'p2Custom', 145)
    ];

    // Player 1 starts because arrays count from 0 in JavaScript.
    this.currentPlayerIndex = 0;

    // No cannon ball exists until someone fires.
    this.projectile = null;

    // impact exists only while a hit animation is playing.
    // It will look like: { x, y, kind, age, endsTurn, endsRound }
    this.impact = null;

    // A tank hit ends the round until R resets.
    this.roundOver = false;

    // Pick a new random wind value for this round.
    this.wind = randomWind();

    // Message shown in the HUD.
    this.message = 'Player 1: aim with arrows, fire with Space.';
  }

  createTank(name, x, modelId, angle) {
    // This function builds a plain object that stores one tank's state.
    //
    // Tricky bit:
    // x is the middle of the tank.
    // y is the ground point under the tank.
    // The drawing code uses those values to calculate the body and cab.
    const model = TANK_MODELS[modelId];

    return {
      name,
      x,
      y: GROUND_Y,
      width: model.collision.width,
      height: model.collision.height,
      health: 100,
      angle,
      power: 240,
      modelId,
      inventory: createStartingInventory()
    };
  }

  onKeyDown(event) {
    if (isUiInputTarget(event.target)) {
      this.keys.clear();
      return;
    }

    // These keys normally make the browser scroll the page.
    // preventDefault stops that so the keys only control the game.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    // R resets the whole round immediately.
    if (event.code === 'KeyR') {
      this.reset();
      this.notifyInventoryChanged();
      return;
    }

    // Space fires one shot. It is handled immediately instead of being stored.
    if (event.code === 'Space') {
      this.fire();
      return;
    }

    // All other control keys are remembered until keyup removes them.
    // That is what lets the cannon keep rotating while a key is held down.
    this.keys.add(event.code);
  }

  onKeyUp(event) {
    this.keys.delete(event.code);
  }

  tick(time) {
    if (!this.running) {
      return;
    }

    if (document.hidden) {
      this.lastTime = 0;
      this.animationFrameId = null;
      return;
    }

    this.animationFrameId = null;

    // deltaSeconds means "how many seconds since the last frame?"
    //
    // Tricky bit:
    // The browser gives us time in milliseconds, so we divide by 1000.
    // Math.min prevents a giant jump if the tab pauses for a moment.
    const deltaSeconds = Math.min((time - this.lastTime) / 1000 || 0, 0.05);
    this.lastTime = time;

    // One frame of the game:
    // 1. update the game state
    // 2. draw the game
    // 3. update the side HUD
    this.update(deltaSeconds);
    this.draw();
    this.updateHud();

    // Schedule the next frame. This keeps the game running.
    this.scheduleNextFrame();
  }

  update(deltaSeconds) {
    // If a cannon ball exists, it gets the whole update.
    // Players cannot aim or fire again until the shot is over.
    if (this.projectile) {
      this.updateProjectile(deltaSeconds);
      return;
    }

    // If an explosion or dirt puff is playing, let it finish before aiming.
    if (this.impact) {
      this.updateImpact(deltaSeconds);
      return;
    }

    // When the round is over, leave the final message on screen.
    // R can still reset the round because onKeyDown handles it directly.
    if (this.roundOver) {
      return;
    }

    // Only the current player's tank should respond to controls.
    const tank = this.currentTank();

    // Cannon aiming controls.
    //
    // turnCannon lives in src/math/aiming.js.
    // The 1 or -1 tells it which direction to rotate.
    if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) {
      tank.angle = turnCannon(tank.angle, 1, CANNON_TURN_SPEED, deltaSeconds);
    }

    if (this.keys.has('ArrowRight')  || this.keys.has('KeyD')) {
      tank.angle = turnCannon(tank.angle, -1, CANNON_TURN_SPEED, deltaSeconds);
    }

    // Power controls.
    //
    // Math.min keeps power from going above MAX_POWER.
    // Math.max keeps power from going below MIN_POWER.
    if (this.keys.has('ArrowUp')  || this.keys.has('KeyW')) {
      tank.power = Math.min(MAX_POWER, tank.power + POWER_STEP * deltaSeconds);
    }

    if (this.keys.has('ArrowDown')  || this.keys.has('KeyS')) {
      tank.power = Math.max(MIN_POWER, tank.power - POWER_STEP * deltaSeconds);
    }
  }

  updateProjectile(deltaSeconds) {
    // MOVE THE CANNON BALL
    //
    // This sends the current wind number into projectile.js.
    // The HUD wind arrow shows this same value visually.
    moveProjectile(this.projectile, this.wind, deltaSeconds);

    // CHECK FOR A DIRECT HIT
    //
    // findProjectileTankHit checks enemy hits and delayed self-hits.
    const target = this.findProjectileTankHit();
    if (target) {
      this.startImpact('tank', this.projectile.x, this.projectile.y, {
        endsRound: true,
        message: `${this.currentTank().name} hit ${target.name}! Press R for a new round.`
      });

      // Setting projectile to null means "there is no active cannon ball now."
      this.projectile = null;
      return;
    }

    // CHECK WHETHER THE SHOT IS OVER
    //
    // offscreen means the ball left the battlefield.
    // hitGround means the ball touched the terrain at its current x position.
    const offscreen = this.projectile.x < -20 || this.projectile.x > WIDTH + 20;
    const groundY = this.groundYAt(this.projectile.x);
    const hitGround = this.projectile.y >= groundY;

    if (hitGround) {
      this.startImpact('ground', this.projectile.x, groundY, {
        endsTurn: true,
        message: `${this.currentTank().name}'s shot hit the ground.`
      });
      this.deformTerrainAt(this.projectile.x, groundY);
      this.projectile = null;
      return;
    }

    if (offscreen) {
      this.projectile = null;

      // A missed shot gives the turn to the other player.
      this.nextTurn();
    }
  }

  updateImpact(deltaSeconds) {
    // IMPACT ANIMATION TIMER
    //
    // age starts at 0 and counts upward until the animation is done.
    this.impact.age += deltaSeconds;

    if (this.impact.age < IMPACT_DURATION_SECONDS) {
      return;
    }

    const finishedImpact = this.impact;
    this.impact = null;

    // Tank hits end the round for now.
    // Ground hits end only the current turn.
    if (finishedImpact.endsRound) {
      this.roundOver = true;
      return;
    }

    if (finishedImpact.endsTurn) {
      this.nextTurn();
    }
  }

  startImpact(kind, x, y, options = {}) {
    // CREATE AN IMPACT ANIMATION
    //
    // kind is either 'ground' or 'tank'.
    // Daniel can use kind to make the two animations look different.
    this.impact = {
      x,
      y,
      kind,
      age: 0,
      endsTurn: Boolean(options.endsTurn),
      endsRound: Boolean(options.endsRound)
    };

    if (options.message) {
      this.message = options.message;
    }
  }

  findProjectileTankHit() {
    // Check the other tank first.
    const candidates = [this.otherTank()];

    // After the cannon ball has been flying for a short time,
    // also allow it to hit the tank that fired it.
    if (this.projectile.age > SELF_HIT_GRACE_SECONDS) {
      candidates.push(this.currentTank());
    }

    for (const target of candidates) {
      if (projectileHitTank(this.projectile, target)) {
        return target;
      }
    }

    return null;
  }

  fire() {
    // Do not allow a second shot while one is already flying.
    if (this.projectile || this.impact || this.roundOver) {
      return;
    }

    // Find the current tank, then calculate where the cannon barrel ends.
    const tank = this.currentTank();
    const pivot = tankCannonPivot(tank);
    const tip = cannonTip(pivot, tank.angle, CANNON_LENGTH);
    const selectedItem = this.selectedItem();
    const selectedItemState = this.selectedItemState();

    if (!selectedItem || selectedItem.kind !== 'ammo') {
      this.message = `${tank.name} needs an ammo item selected.`;
      return;
    }

    if (selectedItemState?.count === 0) {
      this.message = `${tank.name} is out of ${selectedItem.name}.`;
      return;
    }

    // Create the cannon ball with the current angle and power.
    this.projectile = createProjectile(tip, angleToVector(tank.angle), tank.power * selectedItem.speedMultiplier);
    this.projectile.radius = selectedItem.projectileRadius;
    this.consumeSelectedItem();
    this.notifyInventoryChanged();
    this.message = `${tank.name} fired ${selectedItem.name}.`;
  }

  nextTurn() {
    // There are only two players, index 0 and index 1.
    // 1 - 0 becomes 1. 1 - 1 becomes 0.
    // That swaps back and forth between the players.
    this.currentPlayerIndex = 1 - this.currentPlayerIndex;
    this.turnNumber += 1;

    // Each new turn gets new wind, like classic artillery games.
    this.wind = randomWind();
    this.message = `${this.currentTank().name}'s turn.`;
    this.notifyInventoryChanged();
  }

  currentTank() {
    // Return the tank whose turn it is.
    return this.players[this.currentPlayerIndex];
  }

  otherTank() {
    // Return the tank whose turn it is NOT.
    return this.players[1 - this.currentPlayerIndex];
  }

  currentInventory() {
    return this.currentTank().inventory;
  }

  selectedItemId() {
    const inventory = this.currentInventory();
    return inventory.quickbar[inventory.selectedSlot] || null;
  }

  selectedItem() {
    const itemId = this.selectedItemId();
    return itemId ? ITEM_TYPES[itemId] : null;
  }

  selectedItemState() {
    const itemId = this.selectedItemId();
    return itemId ? this.currentInventory().items[itemId] : null;
  }

  quickbarItems() {
    const inventory = this.currentInventory();

    return inventory.quickbar.map((itemId, index) => ({
      index,
      itemId,
      item: itemId ? ITEM_TYPES[itemId] : null,
      isSelected: index === inventory.selectedSlot
    }));
  }

  inventoryItems() {
    const inventory = this.currentInventory();

    return Object.entries(ITEM_TYPES).map(([itemId, item]) => ({
      itemId,
      item,
      count: inventory.items[itemId]?.count || 0,
      isOnQuickbar: inventory.quickbar.includes(itemId)
    }));
  }

  selectQuickbarSlot(slotIndex) {
    const inventory = this.currentInventory();

    if (slotIndex < 0 || slotIndex >= inventory.quickbar.length || !inventory.quickbar[slotIndex]) {
      return;
    }

    inventory.selectedSlot = slotIndex;
    this.updateHud();
    this.notifyInventoryChanged();
  }

  assignQuickbarSlot(itemId, slotIndex) {
    const inventory = this.currentInventory();

    if (slotIndex < 0 || slotIndex >= inventory.quickbar.length || !inventory.items[itemId]) {
      return;
    }

    inventory.quickbar[slotIndex] = itemId;
    inventory.selectedSlot = slotIndex;
    this.updateHud();
    this.notifyInventoryChanged();
  }

  purchaseItem(itemId) {
    const inventory = this.currentInventory();
    const item = ITEM_TYPES[itemId];

    if (!item || item.count === Infinity) {
      return;
    }

    if (!inventory.items[itemId]) {
      inventory.items[itemId] = { count: 0 };
    }

    inventory.items[itemId].count += 1;
    this.notifyInventoryChanged();
  }

  sellItem(itemId) {
    const inventory = this.currentInventory();
    const itemState = inventory.items[itemId];

    if (!itemState || itemState.count === Infinity || itemState.count <= 0) {
      return;
    }

    itemState.count -= 1;

    if (itemState.count === 0) {
      delete inventory.items[itemId];

      for (let index = 0; index < inventory.quickbar.length; index++) {
        if (inventory.quickbar[index] === itemId) {
          inventory.quickbar[index] = null;
        }
      }

      inventory.selectedSlot = firstFilledQuickbarSlot(inventory.quickbar);
    }

    this.updateHud();
    this.notifyInventoryChanged();
  }

  consumeSelectedItem() {
    const inventory = this.currentInventory();
    const itemId = this.selectedItemId();
    const itemState = this.selectedItemState();

    if (!itemId || !itemState || itemState.count === Infinity) {
      return;
    }

    itemState.count -= 1;

    if (itemState.count > 0) {
      return;
    }

    delete inventory.items[itemId];

    for (let index = 0; index < inventory.quickbar.length; index++) {
      if (inventory.quickbar[index] === itemId) {
        inventory.quickbar[index] = null;
      }
    }

    inventory.selectedSlot = firstFilledQuickbarSlot(inventory.quickbar);
  }

  draw() {
    // DRAW ONE FRAME
    //
    // Canvas does not remember "objects" like a game engine.
    // Each frame, we erase the screen and redraw everything.
    const ctx = this.context;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    this.drawSky(ctx);
    this.drawGround(ctx);
    this.players.forEach((tank) => this.drawTank(ctx, tank));

    // Draw the cannon ball only if one exists.
    if (this.projectile) {
      ctx.fillStyle = '#1f2026';
      ctx.beginPath();
      ctx.arc(this.projectile.x, this.projectile.y, this.projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw the impact animation after tanks and cannon ball.
    if (this.impact) {
      this.drawImpact(ctx, this.impact);
    }
  }

  drawSky(ctx) {
    // Paint the sky background and the sun.
    ctx.fillStyle = '#8ec6e6';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#f8df7a';
    ctx.beginPath();
    ctx.arc(84, 78, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGround(ctx) {
    // Draw the terrain.
    //
    // The ground is no longer just one rectangle.
    // It is a line made from the numbers in this.terrain.
    ctx.fillStyle = '#4f8743';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);

    this.terrain.forEach((groundY, index) => {
      ctx.lineTo(index * TERRAIN_STEP, groundY);
    });

    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3d6c36';
    ctx.fillRect(0, GROUND_Y + 20, WIDTH, HEIGHT - GROUND_Y - 20);
  }

  drawTank(ctx, tank) {
    // DRAW ONE TANK MODEL
    //
    // Tricky bit:
    // Canvas x grows to the right.
    // Canvas y grows DOWN, not up.
    // So "higher on screen" means a smaller y number.
    const model = TANK_MODELS[tank.modelId];

    // The cannon is drawn as a thick line from pivot to tip.
    const pivot = tankCannonPivot(tank);
    const tip = cannonTip(pivot, tank.angle, CANNON_LENGTH);

    // Draw tank body and cab from graph-paper polygon points.
    drawPolygon(ctx, tank.x, tank.y, model.body, model.color);
    drawPolygon(ctx, tank.x, tank.y, model.cab, model.accent);

    // Draw cannon barrel.
    ctx.strokeStyle = '#22252d';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Draw player name under the tank.
    ctx.fillStyle = '#f4f0e8';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tank.name, tank.x, tank.y + 36);
  }

  drawImpact(ctx, impact) {
    // DRAW IMPACT ANIMATION
    //
    // Daniel made tank hits and ground hits look different.
    // The impact.kind value tells us which one happened.
    if (impact.kind === 'tank') {
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 50, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#ff6a00';
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  updateHud() {
    // UPDATE THE TEXT ON THE RIGHT SIDE OF THE SCREEN
    //
    // The HUD is normal HTML, not canvas drawing.
    // textContent changes what the player sees in each HUD line.
    const tank = this.currentTank();
    const model = TANK_MODELS[tank.modelId];
    setText(this.hud.roundNumber, `${this.roundNumber}`);
    setText(this.hud.turnNumber, `${this.turnNumber}`);
    setText(this.hud.status, this.message);
    setText(this.hud.angle, `${Math.round(tank.angle)} deg`);
    setText(this.hud.power, Math.round(tank.power).toString());
    setText(this.hud.playerName, tank.name);
    setText(this.hud.tankModel, model.name);
    setText(this.hud.health, `${tank.health}`);

    if (this.hud.playerPanel) {
      setStyleProperty(this.hud.playerPanel, '--player-color', model.color);
      setStyleProperty(this.hud.playerPanel, '--player-glow', hexToRgba(model.color, 0.24));
    }

    if (this.canvas.style) {
      setStyleProperty(this.canvas, '--active-player-color', model.color);
      setStyleProperty(this.canvas, '--active-player-glow', hexToRgba(model.color, 0.32));
    }

    if (this.hud.aimGauge) {
      // The gauge itself is HTML/CSS. JavaScript only updates a few CSS
      // variables, then the browser handles the visual rotation and fill.
      const powerPercent = (tank.power - MIN_POWER) / (MAX_POWER - MIN_POWER);
      const windPercent = Math.min(Math.abs(this.wind) / 35, 1);
      const windDirection = Math.sign(this.wind);
      setStyleProperty(this.hud.aimGauge, '--aim-angle', `${tank.angle}deg`);
      setStyleProperty(this.hud.aimGauge, '--power-percent', powerPercent);
      setStyleProperty(this.hud.aimGauge, '--power-color', powerColor(powerPercent));
      setStyleProperty(this.hud.aimGauge, '--wind-strength', windPercent);
      setStyleProperty(this.hud.aimGauge, '--wind-arrow-rotation', windDirection < 0 ? '180deg' : '0deg');
      setTitle(this.hud.aimGauge, `Angle ${Math.round(tank.angle)} deg | Power ${Math.round(tank.power)} | Wind ${this.wind.toFixed(1)}`);
    }

    if (this.hud.windValue) {
      setText(this.hud.windValue, `${Math.abs(this.wind).toFixed(1)} mph`);
    }
  }

  groundYAt(x) {
    // FIND THE TERRAIN HEIGHT AT ONE X POSITION
    //
    // Clamp keeps the array index inside the terrain array.
    const index = Math.max(0, Math.min(this.terrain.length - 1, Math.round(x / TERRAIN_STEP)));
    return this.terrain[index];
  }

  deformTerrainAt(x, y) {
    // DIG A CRATER INTO THE TERRAIN
    //
    // This function is called every time a shot hits the ground.
    // It loops over every terrain point and asks helper functions:
    // - where is this point?
    // - how far is it from the hit?
    // - is it inside the crater?
    // - how deep should this point move?
    //
    // y is the ground height at the impact. We do not need it yet,
    // but it may be useful later for bigger explosions or particles.

    for (let index = 0; index < this.terrain.length; index++) {
      const pointX = terrainIndexToX(index);
      const distance = distanceBetween(pointX, x);

      if (isInsideCrater(distance, CRATER_RADIUS)) {
        const depth = craterDepthAt(distance, CRATER_RADIUS, CRATER_DEPTH);

        // Canvas y gets bigger as it goes down the screen.
        // Adding depth digs the ground downward.
        this.terrain[index] = clampTerrainY(this.terrain[index] + depth);
      }
    }
  }
}

function terrainIndexToX(index) {
  // Convert a terrain array index into a screen x position.
  //
  // Example:
  // index 0 means x = 0.
  // index 1 means x = TERRAIN_STEP.
  // index 2 means x = TERRAIN_STEP * 2.
  return index * TERRAIN_STEP;
}

function distanceBetween(a, b) {
  // Distance should always be positive.
  // Math.abs turns negative answers into positive answers.
  return Math.abs(a - b);
}

function isInsideCrater(distance, craterRadius) {
  // This function decides whether one terrain point is close enough
  // to the hit to be part of the crater.
  return distance < craterRadius;
}

function craterDepthAt(distance, craterRadius, maxDepth) {
  // Make the crater deeper in the middle and shallower at the edges.
  //
  // closeness is near 1 at the center and near 0 at the edge.
  const closeness = 1 - distance / craterRadius;
  return maxDepth * closeness;
}

function clampTerrainY(y) {
  // Keep future crater code from pushing terrain to wild values.
  // This protects long play sessions from impossible terrain shapes.
  return Math.max(MIN_TERRAIN_Y, Math.min(MAX_TERRAIN_Y, y));
}

function firstFilledQuickbarSlot(quickbar) {
  const filledIndex = quickbar.findIndex((itemId) => itemId !== null);
  return filledIndex === -1 ? 0 : filledIndex;
}

function setText(element, text) {
  // updateHud runs every frame, even when nothing visible changed.
  // Checking first avoids asking the browser to redo text layout needlessly.
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

function isUiInputTarget(target) {
  // When Daniel is typing in a form field, the game should let the browser
  // handle the key. Otherwise W/A/S/D, arrows, and Space would still aim/fire.
  if (!target) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON';
}

function setTitle(element, title) {
  // The title is the hover tooltip for exact aim/wind values.
  // Like textContent, changing it every frame would be wasted work.
  if (element && element.title !== title) {
    element.title = title;
  }
}

function setStyleProperty(element, propertyName, value) {
  // CSS variables let the browser animate the HUD for us.
  // This helper keeps those style writes from happening when the value is
  // already current.
  if (element && element.style.getPropertyValue(propertyName) !== String(value)) {
    element.style.setProperty(propertyName, value);
  }
}

function hexToRgba(hexColor, alpha) {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function powerColor(powerPercent) {
  // Low power is calmer green. High power moves toward hot orange.
  const hue = 125 - powerPercent * 90;
  return `hsl(${hue}, 85%, 58%)`;
}

function tankCannonPivot(tank) {
  // The pivot is the point where the cannon rotates.
  // The tank model decides where the cannon sits.
  const model = TANK_MODELS[tank.modelId];
  return {
    x: tank.x + model.cannonPivot.x,
    y: tank.y + model.cannonPivot.y
  };
}

function drawPolygon(ctx, originX, originY, points, fillStyle) {
  // Draw a shape from graph-paper points.
  //
  // originX/originY is the tank's ground point.
  // Each point is added to that origin.
  if (points.length === 0) {
    return;
  }

  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(originX + points[0].x, originY + points[0].y);

  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(originX + points[index].x, originY + points[index].y);
  }

  ctx.closePath();
  ctx.fill();
}

function randomWind() {
  // This picks a new wind strength between about -35 and +35.
  // Negative wind pushes left. Positive wind pushes right.
  return Math.round((Math.random() * 70 - 35) * 10) / 10;
}

function createFlatTerrain() {
  // Build a flat terrain array.
  //
  // Example:
  // terrain[0] is the ground near x = 0.
  // terrain[1] is the ground near x = TERRAIN_STEP.
  // terrain[2] is the ground near x = TERRAIN_STEP * 2.
  const pointCount = Math.ceil(WIDTH / TERRAIN_STEP) + 1;
  return Array.from({ length: pointCount }, () => GROUND_Y);
}
