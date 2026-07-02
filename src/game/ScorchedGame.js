import { angleToVector, cannonTip, clampAngle, turnCannon } from '../math/aiming.js';
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
const BEDROCK_Y = HEIGHT - 36;
const CANNON_LENGTH = 34;
const CANNON_TURN_SPEED = 55;
const POWER_STEP = 90;
const MIN_POWER = 80;
const MAX_POWER = 520;
const TERRAIN_STEP = 8;
const IMPACT_DURATION_SECONDS = 0.45;
const FLOATER_DURATION_SECONDS = 1.1;
const SELF_HIT_GRACE_SECONDS = 0.25;
const TANK_MAX_HEALTH = 100;
const TANK_GRAVITY = 720;
const TANK_MOVE_SPEED = 86;
const TANK_MOVE_FUEL = 120;
const TANK_MOVE_FUEL_PER_PIXEL = 1;
const MAX_DRIVE_STEP_HEIGHT = 10;
const FALL_DAMAGE_SPEED = 360;
const FALL_DAMAGE_DIVISOR = 18;
const WATER_DAMAGE = 999;
const DEEP_WATER_FRACTION = 1 / 3;
const CRATER_RADIUS = 40;
const CRATER_DEPTH = 50;
const MIN_TERRAIN_Y = 120;
const MAX_TERRAIN_Y = HEIGHT - 8;
const LANDSCAPE_MODES = ['rolling', 'cliffs', 'risingSea', 'random'];

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
    this.turnChangeHandler = null;
    this.commandHandler = null;
    this.inputEnabled = true;
    this.inputBlockedMessage = '';
    this.snapshotOnly = false;
    this.tankModels = TANK_MODELS;
    this.itemTypes = ITEM_TYPES;
    this.playerSetup = [
      { name: 'Player 1', modelId: 'p1Custom', color: '#d45745' },
      { name: 'Player 2', modelId: 'p2Custom', color: '#4d8ad8' }
    ];
    this.matchRounds = 3;
    this.landscapeMode = 'cycle';
    this.waterEnabled = true;
    this.waterLevelPercent = 18;
    this.waterRisePerShot = 0;
    this.seaLevel = waterPercentToY(this.waterLevelPercent);
    this.scoreboard = createScoreboard(this.playerSetup);

    this.roundNumber = 0;

    // Start the first round.
    this.reset();
  }

  // Tell the game what to call when inventory changes.
  //
  // The browser UI uses this to redraw the quickbar and inventory window.
  setInventoryChangeHandler(handler) {
    this.inventoryChangeHandler = handler;
  }

  // Tell the game what to call when the active turn changes.
  //
  // Multiplayer uses this to update the server's active slot.
  setTurnChangeHandler(handler) {
    this.turnChangeHandler = handler;
  }

  // Tell the game what to call when a local player presses a control key.
  //
  // Multiplayer can intercept the command and send it to the server instead
  // of applying it directly in this browser.
  setCommandHandler(handler) {
    this.commandHandler = handler;
  }

  // Enable or disable player controls.
  //
  // When input is disabled, held keys are cleared so the tank does not keep
  // moving after control is restored.
  setInputEnabled(enabled, message = '') {
    const wasEnabled = this.inputEnabled;
    this.inputEnabled = Boolean(enabled);
    this.inputBlockedMessage = message;

    if (wasEnabled && !this.inputEnabled) {
      this.keys.clear();
    }
  }

  // Choose whether this browser is allowed to simulate the game.
  //
  // In multiplayer, non-host clients mostly display server snapshots. That
  // keeps every computer from inventing a different version of the shot.
  setSnapshotOnly(snapshotOnly) {
    const nextSnapshotOnly = Boolean(snapshotOnly);

    if (this.snapshotOnly === nextSnapshotOnly) {
      return;
    }

    this.snapshotOnly = nextSnapshotOnly;

    if (this.snapshotOnly) {
      this.keys.clear();
    }
  }

  // Let the browser UI know inventory/quickbar data changed.
  notifyInventoryChanged() {
    if (this.inventoryChangeHandler) {
      this.inventoryChangeHandler();
    }
  }

  // Replace the active tank model library.
  //
  // The Tank Designer can create a live library of tank models. The game keeps
  // a reference here so the HUD and canvas use designer edits.
  setTankModels(tankModels) {
    this.tankModels = tankModels;

    if (this.players) {
      this.players.forEach((tank) => this.refreshTankModel(tank));
    }

    this.updateHud();
  }

  // Replace the active ammo/item library.
  //
  // The Ammo Designer can build a live item library. Keeping it on the game
  // object lets gameplay use designer edits instead of always reading the
  // starter data from itemTypes.js.
  setItemTypes(itemTypes) {
    this.itemTypes = itemTypes;

    if (this.players) {
      this.players.forEach((tank) => this.syncInventoryWithItemTypes(tank.inventory));
    }

    this.updateHud();
    this.notifyInventoryChanged();
  }

  // Apply player names, colors, and selected tank models.
  //
  // Player Setup chooses each player's display name and tank model. Applying
  // it here updates the current round without resetting shots, terrain,
  // inventory, or health.
  setPlayerSetup(playerSetup) {
    this.playerSetup = playerSetup.map((player, index) => ({
      name: player.name || `Player ${index + 1}`,
      modelId: player.modelId || (index === 0 ? 'p1Custom' : 'p2Custom'),
      color: player.color || (index === 0 ? '#d45745' : '#4d8ad8')
    }));
    this.scoreboard.forEach((score, index) => {
      score.name = this.playerSetup[index].name;
    });

    if (this.players) {
      this.players.forEach((tank, index) => {
        tank.name = this.playerSetup[index].name;
        tank.modelId = this.playerSetup[index].modelId;
        tank.playerColor = this.playerSetup[index].color;
        this.refreshTankModel(tank);
      });
    }

    this.message = `${this.currentTank().name}'s turn.`;
    this.updateHud();
    this.notifyInventoryChanged();
  }

  // Start a full match from the setup screen.
  //
  // A match is the bigger container around several rounds. Starting a match
  // applies setup, clears the scoreboard, and begins round 1.
  startMatch(playerSetup, matchRounds = this.matchRounds, landscapeMode = this.landscapeMode, waterOptions = {}) {
    this.playerSetup = playerSetup.map((player, index) => ({
      name: player.name || `Player ${index + 1}`,
      modelId: player.modelId || (index === 0 ? 'p1Custom' : 'p2Custom'),
      color: player.color || (index === 0 ? '#d45745' : '#4d8ad8')
    }));
    this.matchRounds = Math.max(1, Math.round(matchRounds || 1));
    this.landscapeMode = normalizeLandscapeMode(landscapeMode);
    this.waterEnabled = waterOptions.enabled !== false;
    this.waterLevelPercent = clampNumber(Number(waterOptions.levelPercent ?? this.waterLevelPercent), 0, 80);
    this.waterRisePerShot = clampNumber(Number(waterOptions.risePerShot ?? this.waterRisePerShot), 0, 40);
    this.seaLevel = waterPercentToY(this.waterLevelPercent);
    this.scoreboard = createScoreboard(this.playerSetup);
    this.roundNumber = 0;
    this.reset();
    this.updateHud();
    this.notifyInventoryChanged();
  }

  // Count how many rounds have been won by all players together.
  completedRounds() {
    return this.scoreboard.reduce((total, score) => total + score.roundsWon, 0);
  }

  // True when the match has reached its chosen number of rounds.
  isMatchComplete() {
    return this.completedRounds() >= this.matchRounds;
  }

  // Start the browser animation loop and keyboard listeners.
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

  // Stop the browser animation loop and remove keyboard/page listeners.
  //
  // This is important during long dev sessions so old game loops do not pile
  // up in the background.
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

  // Pause the game loop while the browser tab is hidden.
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

  // Ask the browser for the next animation frame.
  scheduleNextFrame() {
    if (!this.running || document.hidden || this.animationFrameId !== null) {
      return;
    }

    this.animationFrameId = requestAnimationFrame((time) => this.tick(time));
  }

  // Reset the battlefield for a fresh round.
  //
  // This creates new terrain, places both tanks, resets wind and turn state,
  // and clears any projectile or explosion from the last round.
  reset() {
    this.roundNumber += 1;
    this.turnNumber = 1;

    // terrain is an array of ground heights.
    // Each number says where the ground is at one x position.
    const landscape = createLandscape(this.roundNumber, this.landscapeMode);
    this.terrain = landscape.terrain;
    this.landscapeName = landscape.name;
    this.seaLevel = waterPercentToY(this.waterLevelPercent);

    const playerOneModel = this.modelFor(this.playerSetup[0].modelId);
    const playerTwoModel = this.modelFor(this.playerSetup[1].modelId);
    const playerOnePlatformWidth = spawnPlatformWidth(playerOneModel);
    const playerTwoPlatformWidth = spawnPlatformWidth(playerTwoModel);
    const playerOneX = this.findDrySpawnX(190, 70, WIDTH / 2 - 80, playerOnePlatformWidth);
    const playerTwoX = this.findDrySpawnX(1090, WIDTH / 2 + 80, WIDTH - 70, playerTwoPlatformWidth);
    this.ensureDrySpawnZone(playerOneX, playerOnePlatformWidth);
    this.ensureDrySpawnZone(playerTwoX, playerTwoPlatformWidth);

    // Put two tanks on opposite sides of the battlefield.
    // The last number is the starting cannon angle in degrees.
    this.players = [
      this.createTank(this.playerSetup[0].name, playerOneX, this.playerSetup[0].modelId, 35, this.playerSetup[0].color, 1),
      this.createTank(this.playerSetup[1].name, playerTwoX, this.playerSetup[1].modelId, 145, this.playerSetup[1].color, -1)
    ];
    this.players.forEach((tank) => this.snapTankToGround(tank));

    // Player 1 starts because arrays count from 0 in JavaScript.
    this.currentPlayerIndex = 0;
    this.controlMode = 'aim';

    // No cannon ball exists until someone fires.
    this.projectile = null;

    // impact exists only while a hit animation is playing.
    // It will look like: { x, y, kind, age, endsTurn, endsRound }
    this.impact = null;

    // floaters are little words or numbers that rise and fade away.
    this.floaters = [];

    // A tank hit ends the round until Game Setup starts a fresh one.
    this.roundOver = false;

    // Pick a new random wind value for this round.
    this.wind = randomWind();

    // Message shown in the HUD.
    this.message = `${this.players[0].name}: aim with arrows, fire with Space.`;
  }

  // Create one tank state object from a tank model.
  //
  // A model describes the shape. The tank state tracks changing values like
  // health, angle, power, fuel, and inventory.
  createTank(name, x, modelId, angle, playerColor, preferredFacing) {
    // This function builds a plain object that stores one tank's state.
    //
    // Tricky bit:
    // x is the middle of the tank.
    // y is the ground point under the tank.
    // The drawing code uses those values to calculate the body and cab.
    const model = this.modelFor(modelId);
    const facing = startingFacing(model, preferredFacing);
    const localAngle = worldAngleToLocal(angle, facing);
    const clampedAngle = clampAngle(localAngle, model.cannon?.minAngle ?? 5, model.cannon?.maxAngle ?? 175);

    return {
      name,
      x,
      y: GROUND_Y,
      width: model.collision.width,
      height: model.collision.height,
      maxHealth: TANK_MAX_HEALTH,
      health: TANK_MAX_HEALTH,
      destroyed: false,
      vy: 0,
      falling: false,
      moveFuel: TANK_MOVE_FUEL,
      angle: clampedAngle,
      facing,
      power: 240,
      modelId,
      playerColor,
      inventory: createStartingInventory(this.itemTypes)
    };
  }

  // Make one inventory match the current item library.
  //
  // This keeps designer-created ammo available without losing existing counts.
  syncInventoryWithItemTypes(inventory) {
    // Designer-created ammo should show up in each player's inventory list.
    // Existing counts are kept, while new items start with their default count.
    for (const [itemId, item] of Object.entries(this.itemTypes)) {
      if (!inventory.items[itemId]) {
        inventory.items[itemId] = { count: item.count ?? 0 };
      }
    }

    for (const itemId of Object.keys(inventory.items)) {
      if (!this.itemTypes[itemId]) {
        delete inventory.items[itemId];
      }
    }

    inventory.quickbar = inventory.quickbar.map((itemId) => (this.itemTypes[itemId] ? itemId : null));

    if (!inventory.quickbar[inventory.selectedSlot]) {
      inventory.selectedSlot = firstFilledQuickbarSlot(inventory.quickbar);
    }
  }

  // Find a tank model by id, with a safe fallback.
  modelFor(modelId) {
    return this.tankModels[modelId] || this.tankModels.p1Custom || Object.values(this.tankModels)[0];
  }

  // Recalculate a tank's model-dependent values after the designer changes.
  refreshTankModel(tank) {
    tank.modelId = this.tankModels[tank.modelId] ? tank.modelId : Object.keys(this.tankModels)[0];
    const model = this.modelFor(tank.modelId);
    tank.facing = startingFacing(model, tank.facing || 1);
    tank.angle = clampAngle(tank.angle, model.cannon?.minAngle ?? 5, model.cannon?.maxAngle ?? 175);
    tank.width = model.collision.width;
    tank.height = model.collision.height;
  }

  // Handle a key press from the browser.
  //
  // This function does not move the tank directly. Most held keys go into
  // this.keys so update() can respond smoothly every frame.
  onKeyDown(event) {
    if (isUiInputTarget(event.target)) {
      this.keys.clear();
      return;
    }

    // These keys normally make the browser scroll the page.
    // preventDefault stops that so the keys only control the game.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Tab'].includes(event.code)) {
      event.preventDefault();
    }

    if (!this.inputEnabled) {
      if (this.inputBlockedMessage) {
        this.message = this.inputBlockedMessage;
      }
      return;
    }

    if (this.commandHandler?.({ type: 'keyDown', code: event.code })) {
      return;
    }

    if (event.code === 'Tab') {
      this.toggleControlMode();
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

  // Handle a key release from the browser.
  onKeyUp(event) {
    if (this.commandHandler?.({ type: 'keyUp', code: event.code })) {
      return;
    }

    this.keys.delete(event.code);
  }

  // Apply a control command object.
  //
  // Multiplayer uses this because server messages cannot send real KeyboardEvent
  // objects. Plain command objects are easier to serialize.
  applyCommand(command) {
    if (!command || typeof command.type !== 'string') {
      return;
    }

    if (command.type === 'keyDown') {
      if (command.code === 'Tab') {
        this.toggleControlMode();
        return;
      }

      if (command.code === 'Space') {
        this.fire({ ignoreInputLock: true });
        return;
      }

      this.keys.add(command.code);
      return;
    }

    if (command.type === 'keyUp') {
      this.keys.delete(command.code);
      return;
    }

    if (command.type === 'selectQuickbar') {
      this.selectQuickbarSlot(Number(command.slotIndex), { fromCommand: true });
      return;
    }

    if (command.type === 'assignQuickbar') {
      this.assignQuickbarSlot(command.itemId, Number(command.slotIndex), { fromCommand: true });
      return;
    }

    if (command.type === 'purchaseItem') {
      this.purchaseItem(command.itemId, { fromCommand: true });
      return;
    }

    if (command.type === 'sellItem') {
      this.sellItem(command.itemId, { fromCommand: true });
    }
  }

  // Capture the whole game state as plain data.
  //
  // The server sends snapshots to LAN clients, and tests can inspect them too.
  snapshot() {
    return {
      players: this.players.map((tank) => clonePlain(tank)),
      terrain: [...this.terrain],
      currentPlayerIndex: this.currentPlayerIndex,
      turnNumber: this.turnNumber,
      roundNumber: this.roundNumber,
      matchRounds: this.matchRounds,
      landscapeMode: this.landscapeMode,
      landscapeName: this.landscapeName,
      waterEnabled: this.waterEnabled,
      waterLevelPercent: this.waterLevelPercent,
      waterRisePerShot: this.waterRisePerShot,
      seaLevel: this.seaLevel,
      scoreboard: this.scoreboard.map((score) => ({ ...score })),
      projectile: clonePlain(this.projectile),
      impact: clonePlain(this.impact),
      floaters: this.floaters.map((floater) => ({ ...floater })),
      roundOver: this.roundOver,
      wind: this.wind,
      message: this.message,
      controlMode: this.controlMode,
      tankModels: clonePlain(this.tankModels),
      itemTypes: clonePlain(this.itemTypes)
    };
  }

  // Replace this browser's game state with a snapshot.
  //
  // Joining LAN clients use this to follow the server's authoritative game.
  applySnapshot(snapshot, options = {}) {
    if (!snapshot) {
      return;
    }

    this.players = snapshot.players.map((tank) => clonePlain(tank));
    this.terrain = [...snapshot.terrain];
    this.currentPlayerIndex = snapshot.currentPlayerIndex;
    this.turnNumber = snapshot.turnNumber;
    this.roundNumber = snapshot.roundNumber;
    this.matchRounds = snapshot.matchRounds;
    this.landscapeMode = snapshot.landscapeMode;
    this.landscapeName = snapshot.landscapeName;
    this.waterEnabled = snapshot.waterEnabled;
    this.waterLevelPercent = snapshot.waterLevelPercent;
    this.waterRisePerShot = snapshot.waterRisePerShot;
    this.seaLevel = snapshot.seaLevel;
    this.scoreboard = snapshot.scoreboard.map((score) => ({ ...score }));
    this.projectile = clonePlain(snapshot.projectile);
    this.impact = clonePlain(snapshot.impact);
    this.floaters = snapshot.floaters.map((floater) => ({ ...floater }));
    this.roundOver = snapshot.roundOver;
    this.wind = snapshot.wind;
    this.message = snapshot.message;
    this.controlMode = snapshot.controlMode;
    this.tankModels = snapshot.tankModels ? clonePlain(snapshot.tankModels) : this.tankModels;
    this.itemTypes = snapshot.itemTypes ? clonePlain(snapshot.itemTypes) : this.itemTypes;
    this.updateHud();
    this.notifyInventoryChanged();

    if (options.drawNow) {
      this.draw();
    }
  }

  // One browser animation-frame step.
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

  // Update game logic for one frame.
  //
  // Drawing happens separately in draw().
  update(deltaSeconds) {
    if (this.snapshotOnly) {
      return;
    }

    this.updateFloaters(deltaSeconds);
    this.updateTanks(deltaSeconds);

    if (this.roundOver) {
      return;
    }

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
    // Game Setup starts the next round.
    if (this.roundOver) {
      return;
    }

    if (!this.inputEnabled) {
      this.keys.clear();
      return;
    }

    // Only the current player's tank should respond to controls.
    const tank = this.currentTank();

    if (this.controlMode === 'move') {
      if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) {
        this.driveTank(tank, -1, deltaSeconds);
      }

      if (this.keys.has('ArrowRight')  || this.keys.has('KeyD')) {
        this.driveTank(tank, 1, deltaSeconds);
      }

      return;
    }

    // Cannon aiming controls.
    //
    // turnCannon lives in src/math/aiming.js.
    // The 1 or -1 tells it which direction to rotate.
    if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) {
      this.turnTankCannon(tank, 1, deltaSeconds);
    }

    if (this.keys.has('ArrowRight')  || this.keys.has('KeyD')) {
      this.turnTankCannon(tank, -1, deltaSeconds);
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

  // Switch the active player between aiming and driving.
  //
  // The same arrow/WASD controls can aim the cannon or move the tank, so this
  // tiny mode switch decides what those keys mean right now.
  toggleControlMode() {
    this.controlMode = this.controlMode === 'aim' ? 'move' : 'aim';
    this.keys.clear();
    this.updateHud();
  }

  // Update every tank for falling, landing, and water damage.
  updateTanks(deltaSeconds) {
    for (const tank of this.players) {
      this.updateTankFalling(tank, deltaSeconds);
    }
  }

  // Move one tank downward if the ground has disappeared below it.
  updateTankFalling(tank, deltaSeconds) {
    if (tank.destroyed) {
      return;
    }

    const groundY = this.groundYAt(tank.x);

    if (this.isTankInWater(tank)) {
      this.destroyTankInWater(tank);
      return;
    }

    if (tank.y < groundY - 0.5) {
      tank.falling = true;
      tank.vy += TANK_GRAVITY * deltaSeconds;
      tank.y = Math.min(groundY, tank.y + tank.vy * deltaSeconds);
      return;
    }

    if (tank.falling) {
      this.landTank(tank, groundY);
      return;
    }

    tank.y = groundY;
    tank.vy = 0;
  }

  // Finish a fall and apply landing damage if the tank hit hard.
  landTank(tank, groundY) {
    const landingSpeed = tank.vy;
    tank.y = groundY;
    tank.vy = 0;
    tank.falling = false;

    if (landingSpeed <= FALL_DAMAGE_SPEED) {
      return;
    }

    const damage = Math.round((landingSpeed - FALL_DAMAGE_SPEED) / FALL_DAMAGE_DIVISOR);
    this.applyEnvironmentalDamage(tank, damage, `${tank.name} landed hard.`);
  }

  // Drive one tank left or right in Move mode.
  //
  // This spends fuel, follows the terrain, and starts falling if the drop is
  // too steep.
  driveTank(tank, direction, deltaSeconds) {
    if (tank.destroyed || tank.falling || tank.moveFuel <= 0) {
      return;
    }

    const distance = Math.min(tank.moveFuel / TANK_MOVE_FUEL_PER_PIXEL, TANK_MOVE_SPEED * deltaSeconds);
    const nextX = Math.max(28, Math.min(WIDTH - 28, tank.x + direction * distance));
    const currentGround = this.groundYAt(tank.x);
    const nextGround = this.groundYAt(nextX);
    const climbHeight = currentGround - nextGround;
    const dropHeight = nextGround - currentGround;

    if (climbHeight > MAX_DRIVE_STEP_HEIGHT) {
      this.message = `${tank.name} cannot climb that cliff.`;
      return;
    }

    tank.x = nextX;
    tank.moveFuel = Math.max(0, tank.moveFuel - distance * TANK_MOVE_FUEL_PER_PIXEL);
    tank.facing = direction < 0 ? -1 : 1;

    if (dropHeight > MAX_DRIVE_STEP_HEIGHT) {
      tank.falling = true;
    } else {
      tank.y = nextGround;
    }

    if (this.isTankInWater(tank)) {
      this.destroyTankInWater(tank);
    }
  }

  // Find a dry x position near a preferred spawn point.
  findDrySpawnX(preferredX, minX, maxX, platformWidth) {
    if (this.isSpawnZoneDry(preferredX, platformWidth)) {
      return preferredX;
    }

    for (let distance = TERRAIN_STEP; distance <= maxX - minX; distance += TERRAIN_STEP) {
      const leftX = preferredX - distance;
      const rightX = preferredX + distance;

      if (leftX >= minX && this.isSpawnZoneDry(leftX, platformWidth)) {
        return leftX;
      }

      if (rightX <= maxX && this.isSpawnZoneDry(rightX, platformWidth)) {
        return rightX;
      }
    }

    // If the whole side is flooded, fall back to the preferred location and
    // let ensureDrySpawnZone raise a safe island under the tank.
    return preferredX;
  }

  // Check whether a spawn platform would start above water.
  isSpawnZoneDry(centerX, width) {
    const halfWidth = width / 2;

    for (let x = centerX - halfWidth; x <= centerX + halfWidth; x += TERRAIN_STEP) {
      if (this.isWaterAt(x)) {
        return false;
      }
    }

    return true;
  }

  // Raise terrain under a spawn zone so a tank does not begin underwater.
  ensureDrySpawnZone(centerX, width) {
    // Tanks need a little runway. Turrets only need a small pad.
    // Smaller y is higher land, so this raises flooded spawn zones above water.
    const halfWidth = width / 2;
    const targetY = this.waterEnabled
      ? Math.min(this.groundYAt(centerX), this.seaLevel - 18)
      : this.groundYAt(centerX);

    for (let index = 0; index < this.terrain.length; index++) {
      const x = terrainIndexToX(index);

      if (Math.abs(x - centerX) <= halfWidth) {
        this.terrain[index] = Math.min(this.terrain[index], targetY);
      }
    }
  }

  // Put a tank exactly on the terrain under it.
  snapTankToGround(tank) {
    tank.y = this.groundYAt(tank.x);
    tank.vy = 0;
    tank.falling = false;
  }

  // True when the water layer is exposed at this x position.
  isWaterAt(x) {
    return this.waterEnabled && this.groundYAt(x) > this.seaLevel;
  }

  // How deep the water is above the ground at this x position.
  waterDepthAt(x) {
    return this.waterEnabled ? Math.max(0, this.groundYAt(x) - this.seaLevel) : 0;
  }

  // True when a tank is too deep underwater.
  isTankInWater(tank) {
    return this.waterDepthAt(tank.x) > tank.height * DEEP_WATER_FRACTION &&
      tank.y >= this.seaLevel - 2;
  }

  // Destroy a tank because it sank too deep.
  destroyTankInWater(tank) {
    if (tank.destroyed) {
      return;
    }

    this.applyEnvironmentalDamage(tank, WATER_DAMAGE, `${tank.name} sank below the waterline!`);
  }

  // Apply fall/water/environment damage to one tank.
  applyEnvironmentalDamage(tank, damage, message) {
    const actualDamage = Math.min(tank.health, Math.max(0, Math.round(damage)));
    tank.health = Math.max(0, tank.health - actualDamage);
    this.addFloater(`-${actualDamage}`, tank.x, tank.y - tank.height, {
      color: '#9fd8ff',
      size: 24
    });

    if (tank.health > 0) {
      this.message = message;
      return;
    }

    tank.destroyed = true;
    const loserIndex = this.players.indexOf(tank);
    const winnerIndex = loserIndex === 0 ? 1 : 0;
    const winner = this.players[winnerIndex];
    this.scoreboard[winnerIndex].roundsWon += 1;
    this.addFloater('KNOCKOUT!', WIDTH / 2, HEIGHT / 2 - 120, {
      color: winner.playerColor,
      size: 48,
      duration: 1.4
    });
    this.roundOver = true;
    this.impact = null;
    this.projectile = null;
    this.message = `${tank.name} was destroyed by the landscape. ${winner.name} wins the round.`;
  }

  // Turn a tank's cannon, including one-sided tank flip behavior.
  turnTankCannon(tank, direction, deltaSeconds) {
    const model = this.modelFor(tank.modelId);
    const minAngle = model.cannon?.minAngle ?? 5;
    const maxAngle = model.cannon?.maxAngle ?? 175;
    const low = Math.min(minAngle, maxAngle);
    const high = Math.max(minAngle, maxAngle);
    const localDirection = tank.facing < 0 ? -direction : direction;
    const nextAngle = tank.angle + localDirection * CANNON_TURN_SPEED * deltaSeconds;

    // One-sided tanks flip only when the cannon tries to rotate over the top
    // of the tank. Rotating below the front edge just stops at the low limit.
    if (model.cannon?.flipPastEdge && nextAngle > high) {
      tank.facing *= -1;
      tank.angle = high;
      return;
    }

    tank.angle = turnCannon(tank.angle, localDirection, CANNON_TURN_SPEED, deltaSeconds, minAngle, maxAngle);
  }

  // Move the active projectile and decide what it hit.
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
      this.applyTankHit(target, this.projectile.x, this.projectile.y);

      // Setting projectile to null means "there is no active cannon ball now."
      this.projectile = null;
      return;
    }

    // CHECK WHETHER THE SHOT IS OVER
    //
    // offscreen means the ball left the battlefield.
    // hitGround means the ball touched the terrain at its current x position.
    const offscreen = this.projectile.x < -20 || this.projectile.x > WIDTH + 20;
    const hitWater = this.isWaterAt(this.projectile.x) && this.projectile.y >= this.seaLevel;
    const groundY = this.groundYAt(this.projectile.x);
    const hitGround = this.projectile.y >= groundY;

    if (hitWater) {
      this.startImpact('water', this.projectile.x, this.seaLevel, {
        endsTurn: true,
        message: `${this.currentTank().name}'s shot splashed into the water.`
      });
      this.projectile = null;
      return;
    }

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

  // Let an explosion/water splash animation finish before the next turn.
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

    // A lethal tank hit ends the round.
    // Non-lethal tank hits and ground hits end only the current turn.
    if (finishedImpact.endsRound) {
      this.roundOver = true;
      return;
    }

    if (finishedImpact.endsTurn) {
      this.nextTurn();
    }
  }

  // Move floating damage text upward and remove old floaters.
  updateFloaters(deltaSeconds) {
    // Floating text is only decoration, so it should clean itself up quickly.
    this.floaters = this.floaters
      .map((floater) => ({ ...floater, age: floater.age + deltaSeconds }))
      .filter((floater) => floater.age < floater.duration);
  }

  // Apply direct-hit damage to a tank.
  applyTankHit(target, x, y) {
    // DIRECT HIT DAMAGE
    //
    // For now, ammo damage is simple: direct hit removes exactly this many
    // health points. Blast-radius math can come later when splash damage is
    // ready to be its own lesson.
    const attacker = this.currentTank();
    const ammo = this.projectile?.item || this.selectedItem();
    const damage = Math.max(0, Math.round(ammo?.damage ?? 0));
    const actualDamage = Math.min(target.health, damage);
    const attackerIndex = this.players.indexOf(attacker);

    target.health = Math.max(0, target.health - damage);
    target.destroyed = target.health <= 0;
    this.scoreboard[attackerIndex].hits += 1;
    this.scoreboard[attackerIndex].damageDealt += actualDamage;

    this.addFloater(`-${actualDamage}`, x, y - 12, {
      color: '#ffd56b',
      size: 26
    });

    if (target.destroyed) {
      this.scoreboard[attackerIndex].roundsWon += 1;
      const matchComplete = this.isMatchComplete();
      this.addFloater('KNOCKOUT!', WIDTH / 2, HEIGHT / 2 - 120, {
        color: attacker.playerColor,
        size: 48,
        duration: 1.4
      });
      this.startImpact('tank', x, y, {
        endsRound: true,
        message: matchComplete
          ? `${attacker.name} wins the match! Start a new game when ready.`
          : `${attacker.name} destroyed ${target.name}! Open Game Setup for the next round.`
      });
      return;
    }

    this.startImpact('tank', x, y, {
      endsTurn: true,
      message: `${attacker.name} hit ${target.name} for ${actualDamage} damage.`
    });
  }

  // Add one floating message, like "-20" or "KNOCKOUT!".
  addFloater(text, x, y, options = {}) {
    this.floaters.push({
      text,
      x,
      y,
      age: 0,
      duration: options.duration || FLOATER_DURATION_SECONDS,
      color: options.color || '#ece7db',
      size: options.size || 22
    });
  }

  // Start a short visual effect at an impact point.
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

  // Check whether the projectile has hit any tank.
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

  // Fire the selected ammo from the current tank.
  //
  // This does the setup work for a shot. updateProjectile() handles the flying
  // cannon ball on later frames.
  fire(options = {}) {
    if (!this.inputEnabled && !options.ignoreInputLock) {
      if (this.inputBlockedMessage) {
        this.message = this.inputBlockedMessage;
      }
      return;
    }

    // Do not allow a second shot while one is already flying.
    if (this.projectile || this.impact || this.roundOver) {
      return;
    }

    // Find the current tank, then calculate where the cannon barrel ends.
    const tank = this.currentTank();
    const pivot = tankCannonPivot(tank, this.modelFor(tank.modelId));
    const worldAngle = tankWorldAngle(tank);
    const tip = cannonTip(pivot, worldAngle, CANNON_LENGTH);
    const selectedItem = this.selectedItem();
    const selectedItemState = this.selectedItemState();

    if (tank.falling) {
      this.message = `${tank.name} cannot fire while falling.`;
      return;
    }

    if (!selectedItem || selectedItem.kind !== 'ammo') {
      this.message = `${tank.name} needs an ammo item selected.`;
      return;
    }

    if (selectedItemState?.count === 0) {
      this.message = `${tank.name} is out of ${selectedItem.name}.`;
      return;
    }

    // Create the cannon ball with the current angle and power.
    this.projectile = createProjectile(tip, angleToVector(worldAngle), tank.power * selectedItem.speedMultiplier);
    this.projectile.radius = selectedItem.projectileRadius;
    this.projectile.item = selectedItem;
    this.consumeSelectedItem();
    this.raiseWaterAfterShot();
    this.notifyInventoryChanged();
    this.message = `${tank.name} fired ${selectedItem.name}.`;
  }

  // Move sea level upward after a shot for the Rising Sea mode.
  raiseWaterAfterShot() {
    if (!this.waterEnabled || this.waterRisePerShot <= 0) {
      return;
    }

    this.seaLevel = Math.max(MIN_TERRAIN_Y, this.seaLevel - this.waterRisePerShot);
  }

  // End the current turn and give control to the other player.
  nextTurn() {
    // There are only two players, index 0 and index 1.
    // 1 - 0 becomes 1. 1 - 1 becomes 0.
    // That swaps back and forth between the players.
    this.keys.clear();
    this.currentPlayerIndex = 1 - this.currentPlayerIndex;
    this.turnNumber += 1;

    // Each new turn gets new wind, like classic artillery games.
    this.wind = randomWind();
    this.controlMode = 'aim';
    this.currentTank().moveFuel = TANK_MOVE_FUEL;
    this.message = `${this.currentTank().name}'s turn.`;
    this.notifyInventoryChanged();

    if (this.turnChangeHandler) {
      this.turnChangeHandler(this.currentPlayerIndex);
    }
  }

  // Return the tank whose turn it is.
  currentTank() {
    // Return the tank whose turn it is.
    return this.players[this.currentPlayerIndex];
  }

  // Return the tank whose turn it is not.
  otherTank() {
    // Return the tank whose turn it is NOT.
    return this.players[1 - this.currentPlayerIndex];
  }

  // Return the active player's inventory.
  currentInventory() {
    return this.currentTank().inventory;
  }

  // Return the item id in the selected quickbar slot.
  selectedItemId() {
    const inventory = this.currentInventory();
    return inventory.quickbar[inventory.selectedSlot] || null;
  }

  // Return the selected item definition from the item library.
  selectedItem() {
    const itemId = this.selectedItemId();
    return itemId ? this.itemTypes[itemId] : null;
  }

  // Return the active player's count/state for the selected item.
  selectedItemState() {
    const itemId = this.selectedItemId();
    return itemId ? this.currentInventory().items[itemId] : null;
  }

  // Return quickbar data in a shape the UI can render.
  quickbarItems() {
    const inventory = this.currentInventory();

    return inventory.quickbar.map((itemId, index) => ({
      index,
      itemId,
      item: itemId ? this.itemTypes[itemId] : null,
      isSelected: index === inventory.selectedSlot
    }));
  }

  // Return inventory rows in a shape the UI can render.
  inventoryItems() {
    const inventory = this.currentInventory();

    return Object.entries(this.itemTypes).map(([itemId, item]) => ({
      itemId,
      item,
      count: inventory.items[itemId]?.count || 0,
      isOnQuickbar: inventory.quickbar.includes(itemId)
    }));
  }

  // Select a quickbar slot.
  selectQuickbarSlot(slotIndex, options = {}) {
    if (!options.fromCommand && this.commandHandler?.({ type: 'selectQuickbar', slotIndex })) {
      return;
    }

    const inventory = this.currentInventory();

    if (slotIndex < 0 || slotIndex >= inventory.quickbar.length || !inventory.quickbar[slotIndex]) {
      return;
    }

    inventory.selectedSlot = slotIndex;
    this.updateHud();
    this.notifyInventoryChanged();
  }

  // Put an inventory item into a quickbar slot.
  assignQuickbarSlot(itemId, slotIndex, options = {}) {
    if (!options.fromCommand && this.commandHandler?.({ type: 'assignQuickbar', itemId, slotIndex })) {
      return;
    }

    const inventory = this.currentInventory();

    if (slotIndex < 0 || slotIndex >= inventory.quickbar.length || !inventory.items[itemId]) {
      return;
    }

    inventory.quickbar[slotIndex] = itemId;
    inventory.selectedSlot = slotIndex;
    this.updateHud();
    this.notifyInventoryChanged();
  }

  // Buy one item if the item can be purchased.
  purchaseItem(itemId, options = {}) {
    if (!options.fromCommand && this.commandHandler?.({ type: 'purchaseItem', itemId })) {
      return;
    }

    const inventory = this.currentInventory();
    const item = this.itemTypes[itemId];

    if (!item || item.count === Infinity) {
      return;
    }

    if (!inventory.items[itemId]) {
      inventory.items[itemId] = { count: 0 };
    }

    inventory.items[itemId].count += 1;
    this.notifyInventoryChanged();
  }

  // Sell one item if the player has at least one.
  sellItem(itemId, options = {}) {
    if (!options.fromCommand && this.commandHandler?.({ type: 'sellItem', itemId })) {
      return;
    }

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

  // Spend one ammo/tool from the selected quickbar slot after firing.
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

  // Draw the entire battlefield on the canvas.
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

    this.drawFloaters(ctx);
  }

  // Draw the sky and sun.
  drawSky(ctx) {
    // Paint the sky background and the sun.
    ctx.fillStyle = '#8ec6e6';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#f8df7a';
    ctx.beginPath();
    ctx.arc(84, 78, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  // Draw water, grass/terrain, and bedrock.
  drawGround(ctx) {
    this.drawWater(ctx);

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

    this.drawBedrock(ctx);
  }

  // Draw the non-deformable stone layer.
  drawBedrock(ctx) {
    ctx.fillStyle = '#2d2f2f';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    ctx.lineTo(0, bedrockTopYAt(0));

    for (let x = 0; x <= WIDTH; x += 24) {
      ctx.lineTo(x, bedrockTopYAt(x));
    }

    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
  }

  // Draw the water layer behind the terrain.
  drawWater(ctx) {
    if (!this.waterEnabled) {
      return;
    }

    ctx.fillStyle = 'rgba(68, 139, 172, 0.78)';
    ctx.fillRect(0, this.seaLevel, WIDTH, HEIGHT - this.seaLevel);

    ctx.strokeStyle = 'rgba(179, 225, 239, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, this.seaLevel + 1);
    ctx.lineTo(WIDTH, this.seaLevel + 1);
    ctx.stroke();
  }

  // Draw one tank, including body, cab, cannon, damage marks, and name.
  drawTank(ctx, tank) {
    // DRAW ONE TANK MODEL
    //
    // Tricky bit:
    // Canvas x grows to the right.
    // Canvas y grows DOWN, not up.
    // So "higher on screen" means a smaller y number.
    const model = this.modelFor(tank.modelId);

    // The cannon is drawn as a thick line from pivot to tip.
    const pivot = tankCannonPivot(tank, model);
    const tip = cannonTip(pivot, tankWorldAngle(tank), CANNON_LENGTH);

    // Draw tank body and cab from graph-paper polygon points.
    drawPolygon(ctx, tank.x, tank.y, model.body, tank.destroyed ? '#2a2d2e' : model.color, tank.facing);
    drawPolygon(ctx, tank.x, tank.y, model.cab, tank.destroyed ? '#3a3d3c' : model.accent, tank.facing);
    this.drawTankDamage(ctx, tank, model);

    // Draw cannon barrel.
    ctx.strokeStyle = tank.destroyed ? '#111315' : '#22252d';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(tank.destroyed ? pivot.x + tank.facing * 18 : tip.x, tank.destroyed ? pivot.y + 10 : tip.y);
    ctx.stroke();

    // Draw player name under the tank.
    ctx.fillStyle = '#f4f0e8';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tank.name, tank.x, tank.y + 36);
  }

  // Draw the current impact animation.
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
    } else if (impact.kind === 'water') {
      ctx.strokeStyle = '#b8e4f2';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 12 + impact.age * 42, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ff6a00';
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Update the right sidebar HUD and the small tank preview.
  updateHud() {
    // UPDATE THE TEXT ON THE RIGHT SIDE OF THE SCREEN
    //
    // The HUD is normal HTML, not canvas drawing.
    // textContent changes what the player sees in each HUD line.
    const tank = this.currentTank();
    const model = this.modelFor(tank.modelId);
    const worldAngle = tankWorldAngle(tank);
    setText(this.hud.roundNumber, `${this.roundNumber}`);
    setText(this.hud.matchRounds, `${this.matchRounds}`);
    setText(this.hud.turnNumber, `${this.turnNumber}`);
    setText(this.hud.scorePlayerOneName, this.scoreboard[0].name);
    setText(this.hud.scorePlayerOneWins, `${this.scoreboard[0].roundsWon}`);
    setText(this.hud.scorePlayerTwoName, this.scoreboard[1].name);
    setText(this.hud.scorePlayerTwoWins, `${this.scoreboard[1].roundsWon}`);
    setText(this.hud.status, this.message);
    setText(this.hud.angle, `${Math.round(worldAngle)} deg`);
    setText(this.hud.power, Math.round(tank.power).toString());
    setText(this.hud.playerName, tank.name);
    setText(this.hud.health, `${tank.health} / ${tank.maxHealth}`);
    setText(this.hud.controlMode, titleCase(this.controlMode));
    const fuelRemainingPercent = tank.moveFuel / TANK_MOVE_FUEL;
    setText(this.hud.moveFuel, `${Math.round(fuelRemainingPercent * 100)}%`);
    setStyleProperty(this.hud.fuelFill, '--fuel-remaining-percent', fuelRemainingPercent);
    setStyleProperty(this.hud.healthFill, '--health-percent', tank.health / tank.maxHealth);
    setStyleProperty(this.hud.healthFill, '--health-color', healthColor(tank.health / tank.maxHealth));
    this.drawHudTankPreview(tank, model);

    if (this.hud.playerPanel) {
      setStyleProperty(this.hud.playerPanel, '--player-color', tank.playerColor);
      setStyleProperty(this.hud.playerPanel, '--player-glow', hexToRgba(tank.playerColor, 0.24));
    }

    if (this.canvas.style) {
      setStyleProperty(this.canvas, '--active-player-color', tank.playerColor);
      setStyleProperty(this.canvas, '--active-player-glow', hexToRgba(tank.playerColor, 0.32));
    }

    if (this.hud.aimGauge) {
      // The gauge itself is HTML/CSS. JavaScript only updates a few CSS
      // variables, then the browser handles the visual rotation and fill.
      const powerPercent = (tank.power - MIN_POWER) / (MAX_POWER - MIN_POWER);
      const windPercent = Math.min(Math.abs(this.wind) / 35, 1);
      const windDirection = Math.sign(this.wind);
      setStyleProperty(this.hud.aimGauge, '--aim-angle', `${worldAngle}deg`);
      setStyleProperty(this.hud.aimGauge, '--power-percent', powerPercent);
      setStyleProperty(this.hud.aimGauge, '--power-color', powerColor(powerPercent));
      setStyleProperty(this.hud.aimGauge, '--wind-strength', windPercent);
      setStyleProperty(this.hud.aimGauge, '--wind-arrow-rotation', windDirection < 0 ? '180deg' : '0deg');
      setTitle(this.hud.aimGauge, `Angle ${Math.round(worldAngle)} deg | Power ${Math.round(tank.power)} | Wind ${this.wind.toFixed(1)}`);
    }

    if (this.hud.windValue) {
      setText(this.hud.windValue, `${Math.abs(this.wind).toFixed(1)} mph`);
    }
  }

  // Draw the current tank icon in the player panel.
  drawHudTankPreview(tank, model) {
    const canvas = this.hud.tankHudPreview;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    const origin = { x: canvas.width / 2, y: canvas.height - 9 };
    const scale = 1.35;
    const previewTank = {
      ...tank,
      x: origin.x,
      y: origin.y,
      width: model.collision.width * scale,
      height: model.collision.height * scale
    };
    const previewModel = {
      ...model,
      collision: {
        width: model.collision.width * scale,
        height: model.collision.height * scale
      }
    };
    const pivot = {
      x: previewTank.x + model.cannonPivot.x * scale * tank.facing,
      y: previewTank.y + model.cannonPivot.y * scale
    };
    const tip = cannonTip(pivot, tankWorldAngle(tank), CANNON_LENGTH * scale);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScaledPolygon(ctx, previewTank.x, previewTank.y, model.body, tank.destroyed ? '#2a2d2e' : model.color, tank.facing, scale);
    drawScaledPolygon(ctx, previewTank.x, previewTank.y, model.cab, tank.destroyed ? '#3a3d3c' : model.accent, tank.facing, scale);
    this.drawTankDamage(ctx, previewTank, previewModel);

    ctx.strokeStyle = tank.destroyed ? '#111315' : '#22252d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(tank.destroyed ? pivot.x + tank.facing * 14 : tip.x, tank.destroyed ? pivot.y + 7 : tip.y);
    ctx.stroke();
  }

  // Draw scorch/crack/smoke marks for damaged tanks.
  drawTankDamage(ctx, tank, model) {
    // DAMAGE MARKS
    //
    // These marks do not change Daniel's tank points.
    // They are just extra drawings on top of the tank, based on health.
    const healthPercent = tank.health / tank.maxHealth;

    if (healthPercent > 0.75) {
      return;
    }

    const markX = tank.x - tank.facing * model.collision.width * 0.16;
    const markY = tank.y - model.collision.height * 0.55;

    drawScorch(ctx, markX, markY, 7);

    if (healthPercent <= 0.5) {
      drawScorch(ctx, tank.x + tank.facing * model.collision.width * 0.18, tank.y - model.collision.height * 0.34, 9);
    }

    if (healthPercent <= 0.25) {
      drawCrack(ctx, tank.x, tank.y - model.collision.height * 0.78, tank.facing);
    }

    if (tank.destroyed) {
      drawSmoke(ctx, tank.x, tank.y - model.collision.height - 8);
    }
  }

  // Draw floating damage and knockout text.
  drawFloaters(ctx) {
    for (const floater of this.floaters) {
      const progress = floater.age / floater.duration;
      const y = floater.y - progress * 42;

      ctx.save();
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = floater.color;
      ctx.font = `700 ${floater.size}px Arial`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeText(floater.text, floater.x, y);
      ctx.fillText(floater.text, floater.x, y);
      ctx.restore();
    }
  }

  // Interpolate terrain height at any x coordinate.
  groundYAt(x) {
    // FIND THE TERRAIN HEIGHT AT ONE X POSITION
    //
    // Clamp keeps the array index inside the terrain array.
    const index = Math.max(0, Math.min(this.terrain.length - 1, Math.round(x / TERRAIN_STEP)));
    return this.terrain[index];
  }

  // Dig a crater into the terrain around an impact point.
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

    const ammo = this.projectile?.item;
    const craterRadius = ammo?.blastRadius ?? CRATER_RADIUS;
    const craterDepth = CRATER_DEPTH * (ammo?.terrainDamage ?? 1);

    for (let index = 0; index < this.terrain.length; index++) {
      const pointX = terrainIndexToX(index);
      const distance = distanceBetween(pointX, x);

      if (isInsideCrater(distance, craterRadius)) {
        const depth = craterDepthAt(distance, craterRadius, craterDepth);

        // Canvas y gets bigger as it goes down the screen.
        // Adding depth digs the ground downward.
        this.terrain[index] = clampTerrainY(this.terrain[index] + depth);
      }
    }
  }
}

// Convert a terrain array index into a screen x coordinate.
function terrainIndexToX(index) {
  // Convert a terrain array index into a screen x position.
  //
  // Example:
  // index 0 means x = 0.
  // index 1 means x = TERRAIN_STEP.
  // index 2 means x = TERRAIN_STEP * 2.
  return index * TERRAIN_STEP;
}

// Distance between two one-dimensional positions.
function distanceBetween(a, b) {
  // Distance should always be positive.
  // Math.abs turns negative answers into positive answers.
  return Math.abs(a - b);
}

// True when a terrain point is close enough to be affected by a crater.
function isInsideCrater(distance, craterRadius) {
  // This function decides whether one terrain point is close enough
  // to the hit to be part of the crater.
  return distance < craterRadius;
}

// Calculate crater depth for a point.
//
// The center digs deepest; the edge digs only a little.
function craterDepthAt(distance, craterRadius, maxDepth) {
  // Make the crater deeper in the middle and shallower at the edges.
  //
  // closeness is near 1 at the center and near 0 at the edge.
  const closeness = 1 - distance / craterRadius;
  return maxDepth * closeness;
}

// Keep terrain heights inside sane screen bounds.
function clampTerrainY(y) {
  // Keep future crater code from pushing terrain to wild values.
  // This protects long play sessions from impossible terrain shapes.
  return Math.max(MIN_TERRAIN_Y, Math.min(MAX_TERRAIN_Y, y));
}

// Clamp a number inside a range.
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Convert a water-level percentage into a canvas y coordinate.
function waterPercentToY(percent) {
  // Percent is measured upward from the bottom of the battlefield.
  // 0 means no visible water. 50 means halfway up the canvas.
  return HEIGHT - HEIGHT * (percent / 100);
}

// Give the bedrock layer a slight wave so it is not perfectly flat.
function bedrockTopYAt(x) {
  return BEDROCK_Y +
    Math.sin(x / 115) * 5 +
    Math.sin(x / 37) * 2;
}

// Create fresh score rows for a new match.
function createScoreboard(playerSetup) {
  return playerSetup.map((player) => ({
    name: player.name,
    roundsWon: 0,
    hits: 0,
    damageDealt: 0
  }));
}

// Pick the first quickbar slot that has an item.
function firstFilledQuickbarSlot(quickbar) {
  const filledIndex = quickbar.findIndex((itemId) => itemId !== null);
  return filledIndex === -1 ? 0 : filledIndex;
}

// Deep-copy plain data objects and arrays.
//
// Snapshots use this so server/client state does not share object references.
function clonePlain(value) {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(clonePlain);
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, clonePlain(entry)])
  );
}

// Update text only when it actually changed.
function setText(element, text) {
  // updateHud runs every frame, even when nothing visible changed.
  // Checking first avoids asking the browser to redo text layout needlessly.
  if (element && element.textContent !== text) {
    element.textContent = text;
  }
}

// True when keyboard input should belong to a form control, not the game.
function isUiInputTarget(target) {
  // When Daniel is typing in a form field, the game should let the browser
  // handle the key. Otherwise W/A/S/D, arrows, and Space would still aim/fire.
  if (!target) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON';
}

// Update tooltip text only when it changed.
function setTitle(element, title) {
  // The title is the hover tooltip for exact aim/wind values.
  // Like textContent, changing it every frame would be wasted work.
  if (element && element.title !== title) {
    element.title = title;
  }
}

// Update a CSS variable only when it changed.
function setStyleProperty(element, propertyName, value) {
  // CSS variables let the browser animate the HUD for us.
  // This helper keeps those style writes from happening when the value is
  // already current.
  if (element && element.style.getPropertyValue(propertyName) !== String(value)) {
    element.style.setProperty(propertyName, value);
  }
}

// Convert #rrggbb into rgba(r, g, b, alpha).
function hexToRgba(hexColor, alpha) {
  const red = parseInt(hexColor.slice(1, 3), 16);
  const green = parseInt(hexColor.slice(3, 5), 16);
  const blue = parseInt(hexColor.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// Pick a color for the power gauge.
function powerColor(powerPercent) {
  // Low power is calmer green. High power moves toward hot orange.
  const hue = 125 - powerPercent * 90;
  return `hsl(${hue}, 85%, 58%)`;
}

// Pick a health bar color based on remaining health.
function healthColor(healthPercent) {
  // Healthy tanks are green, damaged tanks slide toward red.
  const hue = Math.max(0, Math.min(120, healthPercent * 120));
  return `hsl(${hue}, 78%, 48%)`;
}

// Capitalize the first letter for short HUD labels.
function titleCase(text) {
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

// Choose which way a tank model should face at spawn.
function startingFacing(model, preferredFacing) {
  // Tanks with one-sided cannons should start by facing the enemy.
  // Turrets and full top-arc cannons do not need to flip their artwork.
  if (!model.cannon?.flipPastEdge) {
    return 1;
  }

  return preferredFacing < 0 ? -1 : 1;
}

// Convert a screen/world angle into a tank-local cannon angle.
//
// This matters for tanks that can face left or right.
function worldAngleToLocal(worldAngle, facing) {
  // The designer stores a tank's angle as "local" graph-paper math:
  // 0 points toward the tank's front, 90 points straight up.
  // When the tank faces left, world 145 degrees becomes local 35 degrees.
  return facing < 0 ? 180 - worldAngle : worldAngle;
}

// Convert a tank-local angle into the real screen/world angle.
function tankWorldAngle(tank) {
  // The canvas and projectile math need a world angle:
  // 0 points right, 90 points up, 180 points left.
  return tank.facing < 0 ? 180 - tank.angle : tank.angle;
}

// Find the cannon pivot point on the screen for one tank.
function tankCannonPivot(tank, model) {
  // The pivot is the point where the cannon rotates.
  // If the tank faces left, the x coordinate mirrors across the tank center.
  return {
    x: tank.x + model.cannonPivot.x * (tank.facing || 1),
    y: tank.y + model.cannonPivot.y
  };
}

// Draw a tank body/cab polygon at normal game scale.
function drawPolygon(ctx, originX, originY, points, fillStyle, facing = 1) {
  // Draw a shape from graph-paper points.
  //
  // originX/originY is the tank's ground point.
  // Each point is added to that origin.
  if (points.length === 0) {
    return;
  }

  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(originX + points[0].x * facing, originY + points[0].y);

  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(originX + points[index].x * facing, originY + points[index].y);
  }

  ctx.closePath();
  ctx.fill();
}

// Draw a tank polygon at preview/HUD scale.
function drawScaledPolygon(ctx, originX, originY, points, fillStyle, facing, scale) {
  // Same idea as drawPolygon, but for tiny previews.
  // It avoids building new scaled arrays every animation frame.
  if (points.length === 0) {
    return;
  }

  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(originX + points[0].x * facing * scale, originY + points[0].y * scale);

  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(originX + points[index].x * facing * scale, originY + points[index].y * scale);
  }

  ctx.closePath();
  ctx.fill();
}

// Draw one dark scorch mark on a damaged tank.
function drawScorch(ctx, x, y, radius) {
  ctx.fillStyle = 'rgba(22, 20, 18, 0.72)';
  ctx.beginPath();
  ctx.ellipse(x, y, radius * 1.25, radius * 0.8, -0.35, 0, Math.PI * 2);
  ctx.fill();
}

// Draw one zig-zag crack on a damaged tank.
function drawCrack(ctx, x, y, facing) {
  ctx.strokeStyle = 'rgba(12, 13, 14, 0.86)';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 2 * facing, y - 7);
  ctx.lineTo(x + 3 * facing, y - 1);
  ctx.lineTo(x - 4 * facing, y + 5);
  ctx.lineTo(x + 5 * facing, y + 10);
  ctx.stroke();
}

// Draw a simple smoke puff above a badly damaged tank.
function drawSmoke(ctx, x, y) {
  ctx.fillStyle = 'rgba(28, 31, 33, 0.5)';
  ctx.beginPath();
  ctx.arc(x - 8, y - 4, 8, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 13, 10, 0, Math.PI * 2);
  ctx.arc(x + 13, y - 6, 7, 0, Math.PI * 2);
  ctx.fill();
}

// Pick a new wind value for a turn.
function randomWind() {
  // This picks a new wind strength between about -35 and +35.
  // Negative wind pushes left. Positive wind pushes right.
  return Math.round((Math.random() * 70 - 35) * 10) / 10;
}

// Pick a random number between min and max.
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

// Randomly choose -1 or 1.
function randomSign() {
  return Math.random() < 0.5 ? -1 : 1;
}

// Convert unknown landscape names back to a safe default.
function normalizeLandscapeMode(mode) {
  return mode === 'cycle' || LANDSCAPE_MODES.includes(mode) ? mode : 'cycle';
}

// Create terrain for a new round.
//
// "cycle" moves through landscape types as rounds advance.
function createLandscape(roundNumber, selectedMode = 'cycle') {
  const mode = selectedMode === 'cycle'
    ? LANDSCAPE_MODES[(roundNumber - 1) % LANDSCAPE_MODES.length]
    : normalizeLandscapeMode(selectedMode);
  const variant = createLandscapeVariant(mode);
  const terrain = createBaseTerrain(mode, variant);

  return {
    name: landscapeName(mode),
    terrain
  };
}

// Add random seed-like numbers so each landscape generation is a little
// different without needing a full noise library.
function createLandscapeVariant(mode) {
  // Math.random gives each new round a fresh silhouette.
  // The mode still controls the overall flavor: hills, cliffs, rising sea, or mixed.
  return {
    phaseA: randomRange(0, Math.PI * 2),
    phaseB: randomRange(0, Math.PI * 2),
    phaseC: randomRange(0, Math.PI * 2),
    hillA: randomRange(24, 44),
    hillB: randomRange(12, 30),
    hillC: randomRange(6, 16),
    baseLift: randomRange(-12, 12),
    cliffA: randomRange(300, 420),
    cliffB: randomRange(595, 720),
    cliffC: randomRange(880, 1010),
    cliffStepA: randomSign() * randomRange(42, 68),
    cliffStepB: randomSign() * randomRange(62, 92),
    cliffStepC: randomSign() * randomRange(34, 58),
    mixedBreakA: randomRange(470, 570),
    mixedBreakB: randomRange(800, 900),
    mixedStepA: randomSign() * randomRange(24, 50),
    mixedStepB: randomSign() * randomRange(38, 68),
    basinCenterX: randomRange(520, 760),
    basinWidth: randomRange(230, 360),
    basinDepth: randomRange(42, 86),
    waterDipCenterX: randomRange(420, 860),
    waterDipWidth: randomRange(170, 280),
    waterDipDepth: randomRange(34, 58)
  };
}

// Generate the raw terrain height array for one landscape.
//
// Each entry is a y coordinate. Smaller y means higher ground.
function createBaseTerrain(mode, variant) {
  // Build an array of terrain heights.
  // Smaller y means higher land. Bigger y means lower land.
  const pointCount = Math.ceil(WIDTH / TERRAIN_STEP) + 1;
  const terrain = [];

  for (let index = 0; index < pointCount; index++) {
    const x = terrainIndexToX(index);
    let y = GROUND_Y - landscapeLift(mode) + variant.baseLift;

    if (mode === 'rolling') {
      y += Math.sin(x / 92 + variant.phaseA) * variant.hillA +
        Math.sin(x / 211 + variant.phaseB) * variant.hillB;
      y += lowDipAt(x, variant.waterDipCenterX, variant.waterDipWidth, variant.waterDipDepth);
    } else if (mode === 'cliffs') {
      y += Math.sin(x / 120 + variant.phaseA) * 18;
      y += x > variant.cliffA ? variant.cliffStepA : 0;
      y += x > variant.cliffB ? variant.cliffStepB : 0;
      y += x > variant.cliffC ? variant.cliffStepC : 0;
    } else if (mode === 'risingSea') {
      y += Math.sin(x / 120 + variant.phaseA) * variant.hillA +
        Math.sin(x / 260 + variant.phaseB) * variant.hillB;
      const distanceFromBasin = Math.abs(x - variant.basinCenterX);

      if (distanceFromBasin < variant.basinWidth / 2) {
        const closeness = 1 - distanceFromBasin / (variant.basinWidth / 2);
        y += variant.basinDepth * closeness;
      }
    } else {
      y += Math.sin(x / 70 + variant.phaseA) * variant.hillA +
        Math.sin(x / 178 + variant.phaseB) * variant.hillB +
        Math.cos(x / 41 + variant.phaseC) * variant.hillC;
      y += x > variant.mixedBreakA ? variant.mixedStepA : 0;
      y += x > variant.mixedBreakB ? variant.mixedStepB : 0;
      y += lowDipAt(x, variant.waterDipCenterX, variant.waterDipWidth, variant.waterDipDepth * 0.7);
    }

    terrain.push(clampTerrainY(y));
  }

  protectStartZones(terrain);

  if (mode === 'rolling') {
    ensureDefaultWaterDip(terrain, variant.waterDipCenterX, variant.waterDipWidth);
  }

  if (mode === 'cliffs') {
    ensureMostlyDryTerrain(terrain, 0.7);
  }

  return smoothTerrain(terrain, mode === 'cliffs' ? 1 : 2);
}

// Make a smooth valley shape for water/terrain dips.
function lowDipAt(x, centerX, width, depth) {
  const distance = Math.abs(x - centerX);

  if (distance > width / 2) {
    return 0;
  }

  const closeness = 1 - distance / (width / 2);
  return depth * closeness;
}

// Ensure rolling hills usually expose at least a little water.
function ensureDefaultWaterDip(terrain, centerX, width) {
  const defaultSeaLevel = waterPercentToY(18);

  for (let index = 0; index < terrain.length; index++) {
    const x = terrainIndexToX(index);
    const distance = Math.abs(x - centerX);

    if (distance > width / 2) {
      continue;
    }

    const closeness = 1 - distance / (width / 2);
    terrain[index] = Math.max(terrain[index], defaultSeaLevel + 10 * closeness);
  }
}

// Raise terrain until enough of the map is dry land.
function ensureMostlyDryTerrain(terrain, minimumDryRatio) {
  const defaultSeaLevel = waterPercentToY(18);
  let dryRatio = terrain.filter((groundY) => groundY <= defaultSeaLevel).length / terrain.length;

  while (dryRatio < minimumDryRatio) {
    for (let index = 0; index < terrain.length; index++) {
      terrain[index] = clampTerrainY(terrain[index] - 8);
    }

    dryRatio = terrain.filter((groundY) => groundY <= defaultSeaLevel).length / terrain.length;
  }
}

// Decide how high to lift land for each landscape style.
function landscapeLift(mode) {
  if (mode === 'rolling') {
    return 82;
  }

  if (mode === 'cliffs') {
    return 92;
  }

  if (mode === 'risingSea') {
    return 54;
  }

  return 78;
}

// Tanks need more flat land than turrets because tanks can drive.
function spawnPlatformWidth(model) {
  return model.type === 'turret' || model.canMove === false ? 72 : 190;
}

// Flatten both player start zones enough to make the first turn fair.
function protectStartZones(terrain) {
  // Keep the first version fair: both tanks get usable starting shelves.
  flattenZone(terrain, 190, 92);
  flattenZone(terrain, 1090, 92);
}

// Flatten a small area of terrain around one x coordinate.
function flattenZone(terrain, centerX, width) {
  const centerIndex = Math.round(centerX / TERRAIN_STEP);
  const targetY = terrain[centerIndex];

  for (let index = 0; index < terrain.length; index++) {
    const x = terrainIndexToX(index);

    if (Math.abs(x - centerX) <= width / 2) {
      terrain[index] = targetY;
    }
  }
}

// Smooth terrain by averaging each point with its neighbors.
function smoothTerrain(terrain, passes) {
  let smoothed = terrain;

  for (let pass = 0; pass < passes; pass++) {
    smoothed = smoothed.map((height, index) => {
      const previous = smoothed[Math.max(0, index - 1)];
      const next = smoothed[Math.min(smoothed.length - 1, index + 1)];
      return clampTerrainY((previous + height + next) / 3);
    });
  }

  return smoothed;
}

// Convert a landscape id into readable HUD/setup text.
function landscapeName(mode) {
  if (mode === 'rolling') {
    return 'Rolling Hills';
  }

  if (mode === 'cliffs') {
    return 'Cliffs';
  }

  if (mode === 'risingSea') {
    return 'Rising Sea';
  }

  return 'Mixed Ground';
}
