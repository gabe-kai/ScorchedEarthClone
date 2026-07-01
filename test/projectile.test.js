import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectile, moveProjectile } from '../src/physics/projectile.js';
import { ScorchedGame } from '../src/game/ScorchedGame.js';

function createStyleMock() {
  const values = new Map();

  return {
    getPropertyValue(name) {
      return values.get(name) || '';
    },
    setProperty(name, value) {
      values.set(name, String(value));
    }
  };
}

function createGame() {
  const canvas = { getContext: () => ({}), style: createStyleMock() };
  const hud = {
    status: { textContent: '' },
    roundNumber: { textContent: '' },
    matchRounds: { textContent: '' },
    turnNumber: { textContent: '' },
    scorePlayerOneName: { textContent: '' },
    scorePlayerOneWins: { textContent: '' },
    scorePlayerTwoName: { textContent: '' },
    scorePlayerTwoWins: { textContent: '' },
    playerPanel: { style: createStyleMock() },
    playerName: { textContent: '' },
    health: { textContent: '' },
    healthFill: { style: createStyleMock() },
    controlMode: { textContent: '' },
    moveFuel: { textContent: '' },
    fuelFill: { style: createStyleMock() },
    aimGauge: { style: createStyleMock(), title: '' },
    angle: { textContent: '' },
    power: { textContent: '' }
  };

  return new ScorchedGame(canvas, hud);
}

test('createProjectile starts with age 0', () => {
  const projectile = createProjectile({ x: 0, y: 0 }, { x: 1, y: 0 }, 100);

  assert.equal(projectile.age, 0);
});

test('moveProjectile increases projectile age', () => {
  const projectile = createProjectile({ x: 0, y: 0 }, { x: 1, y: 0 }, 100);

  moveProjectile(projectile, 0, 0.25);

  assert.equal(projectile.age, 0.25);
});

test('findProjectileTankHit allows a self-hit after the grace period', () => {
  const game = createGame();
  const currentTank = game.currentTank();

  game.projectile = {
    x: currentTank.x,
    y: currentTank.y - 5,
    age: 0.1,
    radius: 4
  };

  assert.equal(game.findProjectileTankHit(), null);

  game.projectile.age = 0.3;

  assert.equal(game.findProjectileTankHit(), currentTank);
});

test('deformTerrainAt digs nearby terrain downward', () => {
  const game = createGame();
  const impactX = 160;
  const impactY = game.groundYAt(impactX);
  const centerIndex = Math.round(impactX / 8);
  const farIndex = 0;
  const centerBefore = game.terrain[centerIndex];
  const farBefore = game.terrain[farIndex];

  game.deformTerrainAt(impactX, impactY);

  assert.ok(game.terrain[centerIndex] > centerBefore);
  assert.equal(game.terrain[farIndex], farBefore);
});

test('landscapes cycle to rising sea with exposed water zones', () => {
  const game = createGame();

  game.reset();
  game.reset();

  assert.equal(game.landscapeName, 'Rising Sea');
  assert.equal(game.waterEnabled, true);
  assert.equal(game.terrain.some((groundY) => groundY > game.seaLevel), true);
});

test('rolling and cliff landscapes are mostly above the default sea level', () => {
  const game = createGame();

  game.startMatch(game.playerSetup, 3, 'rolling', {
    enabled: true,
    levelPercent: 18,
    risePerShot: 0
  });
  const rollingDryCount = game.terrain.filter((groundY) => groundY <= game.seaLevel).length;
  const rollingWaterCount = game.terrain.filter((groundY) => groundY > game.seaLevel).length;

  game.startMatch(game.playerSetup, 3, 'cliffs', {
    enabled: true,
    levelPercent: 18,
    risePerShot: 0
  });
  const cliffDryCount = game.terrain.filter((groundY) => groundY <= game.seaLevel).length;

  assert.ok(rollingDryCount / game.terrain.length > 0.65);
  assert.ok(rollingWaterCount > 0);
  assert.ok(cliffDryCount / game.terrain.length > 0.65);
});

test('tanks start on dry land when dry land is available', () => {
  const game = createGame();

  game.startMatch(game.playerSetup, 3, 'risingSea', {
    enabled: true,
    levelPercent: 18,
    risePerShot: 0
  });

  assert.equal(game.isWaterAt(game.players[0].x), false);
  assert.equal(game.isWaterAt(game.players[1].x), false);
});

test('tank spawn zones include dry driving room', () => {
  const game = createGame();

  game.startMatch(game.playerSetup, 3, 'risingSea', {
    enabled: true,
    levelPercent: 34,
    risePerShot: 0
  });

  for (const tank of game.players) {
    for (let x = tank.x - 72; x <= tank.x + 72; x += 8) {
      assert.equal(game.isWaterAt(x), false);
    }
  }
});

test('turret spawn zones only need a dry standing pad', () => {
  const game = createGame();

  game.startMatch([
    { name: 'Left Turret', modelId: 'hillTurret', color: '#44dd55' },
    { name: 'Right Turret', modelId: 'hillTurret', color: '#dd5544' }
  ], 3, 'risingSea', {
    enabled: true,
    levelPercent: 34,
    risePerShot: 0
  });

  for (const tank of game.players) {
    for (let x = tank.x - 24; x <= tank.x + 24; x += 8) {
      assert.equal(game.isWaterAt(x), false);
    }
  }
});

test('fixed landscape selections still generate fresh terrain each match', () => {
  const game = createGame();

  game.startMatch(game.playerSetup, 3, 'rolling');
  const firstTerrain = game.terrain.join(',');
  game.startMatch(game.playerSetup, 3, 'rolling');
  const secondTerrain = game.terrain.join(',');

  assert.notEqual(firstTerrain, secondTerrain);
  assert.equal(game.landscapeMode, 'rolling');
});

test('Tab toggles between aim and move mode', () => {
  const game = createGame();
  let prevented = false;

  game.onKeyDown({
    code: 'Tab',
    target: null,
    preventDefault() {
      prevented = true;
    }
  });

  assert.equal(prevented, true);
  assert.equal(game.controlMode, 'move');
  assert.equal(game.hud.controlMode.textContent, 'Move');
});

test('driveTank spends movement fuel and follows the terrain', () => {
  const game = createGame();
  const tank = game.currentTank();
  const startX = tank.x;

  game.driveTank(tank, 1, 0.2);

  assert.ok(tank.x > startX);
  assert.ok(tank.moveFuel < 120);
  game.updateHud();
  assert.match(game.hud.moveFuel.textContent, /%/);
  assert.notEqual(game.hud.fuelFill.style.getPropertyValue('--fuel-remaining-percent'), '1');
  assert.equal(tank.y, game.groundYAt(tank.x));
});

test('tank falls when terrain drops away underneath it', () => {
  const game = createGame();
  const tank = game.currentTank();
  const startY = tank.y;

  game.deformTerrainAt(tank.x, tank.y);
  game.updateTanks(0.1);

  assert.equal(tank.falling, true);
  assert.ok(tank.y > startY);
});

test('shallow water is safe but deep water destroys a tank', () => {
  const game = createGame();

  game.reset();
  game.reset();

  const tank = game.currentTank();
  const shallowDepth = tank.height * 0.25;
  const deepDepth = tank.height * 0.5;
  const tankIndex = Math.round(tank.x / 8);

  game.terrain[tankIndex] = game.seaLevel + shallowDepth;
  tank.y = game.groundYAt(tank.x);

  game.updateTanks(0.016);

  assert.equal(tank.destroyed, false);

  game.terrain[tankIndex] = game.seaLevel + deepDepth;
  tank.y = game.groundYAt(tank.x);

  game.updateTanks(0.016);

  assert.equal(tank.destroyed, true);
  assert.equal(game.roundOver, true);
  assert.equal(game.scoreboard[1].roundsWon, 1);
});

test('water level rises after a shot when rise per shot is enabled', () => {
  const game = createGame();

  game.startMatch(game.playerSetup, 3, 'risingSea', {
    enabled: true,
    levelPercent: 18,
    risePerShot: 6
  });
  const seaLevelBefore = game.seaLevel;

  game.fire();

  assert.equal(game.seaLevel, seaLevelBefore - 6);
});

test('selectQuickbarSlot changes selected item', () => {
  const game = createGame();

  game.selectQuickbarSlot(2);

  assert.equal(game.selectedItemId(), 'digger');
});

test('fire consumes finite ammo from inventory', () => {
  const game = createGame();
  const inventory = game.currentInventory();

  game.selectQuickbarSlot(1);
  game.fire();

  assert.equal(inventory.items.heavyShell.count, 2);
});

test('setItemTypes lets designer ammo affect inventory and damage', () => {
  const game = createGame();

  game.setItemTypes({
    kidShot: {
      name: 'Kid Shot',
      kind: 'ammo',
      icon: 'K',
      count: 2,
      projectileRadius: 5,
      shotColor: '#123456',
      hitColor: '#abcdef',
      missColor: '#fedcba',
      damage: 12,
      blastRadius: 44,
      terrainDamage: 1,
      speedMultiplier: 1,
      windMultiplier: 1,
      price: 7,
      description: 'Designer test shot.'
    }
  });

  const inventory = game.currentInventory();
  inventory.quickbar[0] = 'kidShot';
  inventory.selectedSlot = 0;
  const target = game.otherTank();

  game.projectile = {
    x: target.x,
    y: target.y - 8,
    item: game.selectedItem()
  };

  game.applyTankHit(target, target.x, target.y - 8);

  assert.equal(game.inventoryItems()[0].itemId, 'kidShot');
  assert.equal(target.health, 88);
});

test('purchaseItem and sellItem change inventory quantity', () => {
  const game = createGame();
  const inventory = game.currentInventory();

  assert.equal(inventory.items.heavyShell.count, 3);

  game.purchaseItem('heavyShell');
  assert.equal(inventory.items.heavyShell.count, 4);

  game.sellItem('heavyShell');
  assert.equal(inventory.items.heavyShell.count, 3);
});

test('assignQuickbarSlot replaces a quickbar item', () => {
  const game = createGame();

  game.assignQuickbarSlot('repairKit', 1);

  assert.equal(game.quickbarItems()[1].itemId, 'repairKit');
  assert.equal(game.selectedItemId(), 'repairKit');
});

test('setTankModels updates the current tank from the live tank library', () => {
  const game = createGame();
  const renamedModels = {
    ...game.tankModels,
    p1Custom: {
      ...game.tankModels.p1Custom,
      name: 'Red',
      collision: { width: 60, height: 30 }
    }
  };

  game.setTankModels(renamedModels);

  assert.equal(game.modelFor('p1Custom').name, 'Red');
  assert.equal(game.currentTank().width, 60);
});

test('one-sided tanks start facing the enemy and obey the designer angle limit', () => {
  const game = createGame();
  const sideTank = {
    ...game.tankModels.p1Custom,
    name: 'Side Cannon',
    cannonPivot: { x: 11, y: -18 },
    cannon: {
      style: 'oneSide',
      minAngle: 0,
      maxAngle: 85,
      flipPastEdge: true
    },
    collision: { width: 44, height: 24 }
  };

  game.setTankModels({
    ...game.tankModels,
    sideTank
  });
  game.setPlayerSetup([
    { name: 'Daniel', modelId: 'sideTank', color: '#44dd55' },
    { name: 'Eli', modelId: 'sideTank', color: '#dd5544' }
  ]);
  game.reset();

  assert.equal(game.players[0].facing, 1);
  assert.equal(game.players[0].angle, 35);
  assert.equal(game.players[1].facing, -1);
  assert.equal(game.players[1].angle, 35);
});

test('turning a one-sided cannon past the top edge flips the tank around', () => {
  const game = createGame();
  const sideTank = {
    ...game.tankModels.p1Custom,
    cannon: {
      style: 'oneSide',
      minAngle: 0,
      maxAngle: 85,
      flipPastEdge: true
    }
  };

  game.setTankModels({
    ...game.tankModels,
    sideTank
  });
  game.setPlayerSetup([
    { name: 'Daniel', modelId: 'sideTank', color: '#44dd55' },
    { name: 'Eli', modelId: 'sideTank', color: '#dd5544' }
  ]);
  game.reset();

  const playerOne = game.players[0];
  playerOne.angle = 85;

  game.turnTankCannon(playerOne, 1, 1);

  assert.equal(playerOne.facing, -1);
  assert.equal(playerOne.angle, 85);
});

test('screen direction still works when a one-sided tank is facing left', () => {
  const game = createGame();
  const sideTank = {
    ...game.tankModels.p1Custom,
    cannon: {
      style: 'oneSide',
      minAngle: 0,
      maxAngle: 85,
      flipPastEdge: true
    }
  };

  game.setTankModels({
    ...game.tankModels,
    sideTank
  });
  game.setPlayerSetup([
    { name: 'Daniel', modelId: 'sideTank', color: '#44dd55' },
    { name: 'Eli', modelId: 'sideTank', color: '#dd5544' }
  ]);
  game.reset();

  const playerTwo = game.players[1];
  playerTwo.angle = 35;

  game.turnTankCannon(playerTwo, 1, 0.1);

  assert.equal(playerTwo.facing, -1);
  assert.ok(playerTwo.angle < 35);
});

test('a left-facing tank fires toward the left side of the battlefield', () => {
  const game = createGame();
  const sideTank = {
    ...game.tankModels.p1Custom,
    cannonPivot: { x: 11, y: -18 },
    cannon: {
      style: 'oneSide',
      minAngle: 0,
      maxAngle: 85,
      flipPastEdge: true
    }
  };

  game.setTankModels({
    ...game.tankModels,
    sideTank
  });
  game.setPlayerSetup([
    { name: 'Daniel', modelId: 'sideTank', color: '#44dd55' },
    { name: 'Eli', modelId: 'sideTank', color: '#dd5544' }
  ]);
  game.reset();
  game.currentPlayerIndex = 1;
  game.players[1].angle = 35;
  game.players[1].facing = -1;

  game.fire();

  assert.ok(game.projectile.vx < 0);
});

test('a non-lethal tank hit applies ammo damage and ends the turn', () => {
  const game = createGame();
  const target = game.otherTank();

  game.projectile = {
    item: { damage: 20 }
  };

  game.applyTankHit(target, target.x, target.y - 10);

  assert.equal(target.health, 80);
  assert.equal(target.destroyed, false);
  assert.equal(game.impact.endsTurn, true);
  assert.equal(game.impact.endsRound, false);
  assert.equal(game.scoreboard[0].hits, 1);
  assert.equal(game.scoreboard[0].damageDealt, 20);
  assert.equal(game.floaters[0].text, '-20');
});

test('a lethal tank hit destroys the target and records a round win', () => {
  const game = createGame();
  const target = game.otherTank();

  target.health = 15;
  game.projectile = {
    item: { damage: 35 }
  };

  game.applyTankHit(target, target.x, target.y - 10);

  assert.equal(target.health, 0);
  assert.equal(target.destroyed, true);
  assert.equal(game.impact.endsRound, true);
  assert.equal(game.scoreboard[0].roundsWon, 1);
  assert.equal(game.scoreboard[0].damageDealt, 15);
  assert.equal(game.floaters.some((floater) => floater.text === 'KNOCKOUT!'), true);
});

test('player setup keeps scoreboard names in sync without clearing wins', () => {
  const game = createGame();

  game.scoreboard[0].roundsWon = 2;
  game.setPlayerSetup([
    { name: 'Daniel', modelId: 'p1Custom', color: '#44dd55' },
    { name: 'Eli', modelId: 'p2Custom', color: '#dd5544' }
  ]);

  assert.equal(game.scoreboard[0].name, 'Daniel');
  assert.equal(game.scoreboard[1].name, 'Eli');
  assert.equal(game.scoreboard[0].roundsWon, 2);
  assert.equal(game.hud.scorePlayerOneName.textContent, 'Daniel');
});

test('startMatch applies setup, clears scores, and stores match length', () => {
  const game = createGame();

  game.scoreboard[0].roundsWon = 2;
  game.startMatch([
    { name: 'Daniel', modelId: 'p1Custom', color: '#44dd55' },
    { name: 'Eli', modelId: 'p2Custom', color: '#dd5544' }
  ], 5, 'cliffs');

  assert.equal(game.matchRounds, 5);
  assert.equal(game.landscapeMode, 'cliffs');
  assert.equal(game.landscapeName, 'Cliffs');
  assert.equal(game.roundNumber, 1);
  assert.equal(game.players[0].name, 'Daniel');
  assert.equal(game.scoreboard[0].roundsWon, 0);
  assert.equal(game.hud.matchRounds.textContent, '5');
});

test('player color controls HUD and canvas accents without repainting the tank model', () => {
  const game = createGame();

  game.setPlayerSetup([
    { name: 'Red Player', modelId: 'p1Custom', color: '#aa1122' },
    { name: 'Blue Player', modelId: 'p2Custom', color: '#2244aa' }
  ]);

  assert.equal(game.currentTank().playerColor, '#aa1122');
  assert.equal(game.hud.playerPanel.style.getPropertyValue('--player-color'), '#aa1122');
  assert.equal(game.canvas.style.getPropertyValue('--active-player-color'), '#aa1122');
  assert.equal(game.tankModels.p1Custom.color, '#d45745');
});

test('R key no longer resets the round', () => {
  const game = createGame();
  const originalRoundNumber = game.roundNumber;

  game.turnNumber = 7;
  game.onKeyDown({ code: 'KeyR', target: null, preventDefault() {} });

  assert.equal(game.roundNumber, originalRoundNumber);
  assert.equal(game.turnNumber, 7);
});
