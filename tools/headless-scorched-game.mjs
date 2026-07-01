import { ScorchedGame } from '../src/game/ScorchedGame.js';

const SERVER_TICK_SECONDS = 1 / 30;

export class HeadlessScorchedGame {
  constructor(initialSnapshot) {
    this.game = new ScorchedGame(createNoopCanvas(), createNoopHud());
    this.game.applySnapshot(initialSnapshot);
    this.game.setInputEnabled(true);
    this.game.setSnapshotOnly(false);
  }

  applyCommand(command) {
    this.game.applyCommand(command);
  }

  tick() {
    this.game.update(SERVER_TICK_SECONDS);
  }

  snapshot() {
    return this.game.snapshot();
  }
}

function createNoopCanvas() {
  return {
    width: 1280,
    height: 720,
    style: createNoopStyle(),
    getContext: () => createNoopContext()
  };
}

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

function createNoopElement() {
  return {
    textContent: '',
    title: '',
    style: createNoopStyle()
  };
}

function createNoopStyle() {
  const values = new Map();

  return {
    getPropertyValue: (name) => values.get(name) || '',
    setProperty: (name, value) => values.set(name, String(value))
  };
}

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
