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
    turnNumber: { textContent: '' },
    playerPanel: { style: createStyleMock() },
    playerName: { textContent: '' },
    tankModel: { textContent: '' },
    health: { textContent: '' },
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

test('toggleQuickbarItem removes and adds inventory items', () => {
  const game = createGame();

  assert.equal(game.quickbarItems()[1].itemId, 'heavyShell');

  game.toggleQuickbarItem('heavyShell');

  assert.equal(game.quickbarItems()[1].itemId, null);

  game.toggleQuickbarItem('repairKit');

  assert.equal(game.quickbarItems()[1].itemId, 'repairKit');
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
