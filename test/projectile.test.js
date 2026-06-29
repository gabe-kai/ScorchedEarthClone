import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectile, moveProjectile } from '../src/physics/projectile.js';

test('createProjectile starts with age 0', () => {
  const projectile = createProjectile({ x: 0, y: 0 }, { x: 1, y: 0 }, 100);

  assert.equal(projectile.age, 0);
});

test('moveProjectile increases projectile age', () => {
  const projectile = createProjectile({ x: 0, y: 0 }, { x: 1, y: 0 }, 100);

  moveProjectile(projectile, 0, 0.25);

  assert.equal(projectile.age, 0.25);
});
