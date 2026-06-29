import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectile, moveProjectile } from '../src/physics/projectile.js';
import { ScorchedGame } from '../src/game/ScorchedGame.js';

function createGame() {
  const canvas = { getContext: () => ({}) };
  const hud = {
    status: { textContent: '' },
    angle: { textContent: '' },
    power: { textContent: '' },
    wind: { textContent: '' }
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
