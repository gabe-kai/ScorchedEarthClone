import test from 'node:test';
import assert from 'node:assert/strict';
import { angleToVector, cannonTip, clampAngle } from '../src/math/aiming.js';

test('clampAngle keeps the cannon inside the playable range', () => {
  assert.equal(clampAngle(-20), 5);
  assert.equal(clampAngle(200), 175);
  assert.equal(clampAngle(45), 45);
});

test('angleToVector points right at 0 degrees and up at 90 degrees', () => {
  assert.equal(angleToVector(0).x, 1);
  assert.equal(Math.round(angleToVector(90).x), 0);
  assert.equal(angleToVector(90).y, -1);
});

test('cannonTip uses the pivot, angle, and length', () => {
  const tip = cannonTip({ x: 10, y: 20 }, 0, 30);

  assert.equal(tip.x, 40);
  assert.equal(tip.y, 20);
});
