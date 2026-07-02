import { ScorchedGame } from '../src/game/ScorchedGame.js';

const SERVER_TICK_SECONDS = 1 / 30;

// Run the browser game rules on the Node server.
//
// The real ScorchedGame normally expects a canvas and HUD. This wrapper gives
// it fake canvas/HUD objects so the server can update the game state without
// opening a browser window.
export class HeadlessScorchedGame {
  // Create a server game from the snapshot sent by the room creator.
  //
  // The snapshot includes tanks, terrain, wind, inventory, and custom designer
  // data. After this point the server becomes the source of truth.
  constructor(initialSnapshot) {
    this.game = new ScorchedGame(createNoopCanvas(), createNoopHud());
    this.game.applySnapshot(initialSnapshot);
    this.game.setInputEnabled(true);
    this.game.setSnapshotOnly(false);
  }

  // Apply one player's command to the server game.
  //
  // Example commands are keyDown, keyUp, fire, and quickbar actions.
  applyCommand(command) {
    this.game.applyCommand(command);
  }

  // Advance the server game by one small slice of time.
  //
  // This replaces requestAnimationFrame on the server.
  tick() {
    this.game.update(SERVER_TICK_SECONDS);
  }

  // Return a plain object that browsers can draw.
  //
  // The server broadcasts this snapshot to every player in the room.
  snapshot() {
    return this.game.snapshot();
  }
}

// Fake the game canvas for Node.
//
// ScorchedGame asks for getContext('2d'), so we return an object that has all
// the drawing methods but does nothing when they are called.
function createNoopCanvas() {
  return {
    width: 1280,
    height: 720,
    style: createNoopStyle(),
    getContext: () => createNoopContext()
  };
}

// Fake the HUD for Node.
//
// The server does not show a sidebar, but ScorchedGame still writes status,
// health, wind, and similar values during updates.
function createNoopHud() {
  return {
    status: createNoopElement(),
    roundNumber: createNoopElement(),
    matchRounds: createNoopElement(),
    turnNumber: createNoopElement(),
    scorePlayerOneName: createNoopElement(),
    scorePlayerOneWins: createNoopElement(),
    scorePlayerTwoName: createNoopElement(),
    scorePlayerTwoWins: createNoopElement(),
    playerPanel: createNoopElement(),
    playerName: createNoopElement(),
    tankHudPreview: createNoopCanvas(),
    health: createNoopElement(),
    healthFill: createNoopElement(),
    controlMode: createNoopElement(),
    moveFuel: createNoopElement(),
    fuelFill: createNoopElement(),
    aimGauge: createNoopElement(),
    windValue: createNoopElement(),
    angle: createNoopElement(),
    power: createNoopElement()
  };
}

// Fake an HTML element with text, title, and style fields.
function createNoopElement() {
  return {
    textContent: '',
    title: '',
    style: createNoopStyle()
  };
}

// Fake CSS style storage.
//
// This lets setProperty/getPropertyValue work without a real DOM.
function createNoopStyle() {
  const values = new Map();

  return {
    getPropertyValue: (name) => values.get(name) || '',
    setProperty: (name, value) => values.set(name, String(value))
  };
}

// Fake CanvasRenderingContext2D.
//
// Any drawing method that ScorchedGame calls becomes a no-op function. A Proxy
// catches unknown method names so a new drawing call will not crash the server.
function createNoopContext() {
  const noop = () => {};
  const context = {
    arc: noop,
    beginPath: noop,
    clearRect: noop,
    closePath: noop,
    ellipse: noop,
    fill: noop,
    fillRect: noop,
    fillText: noop,
    lineTo: noop,
    moveTo: noop,
    restore: noop,
    save: noop,
    stroke: noop,
    strokeText: noop
  };

  return new Proxy(context, {
    get(target, property) {
      return property in target ? target[property] : noop;
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
}
