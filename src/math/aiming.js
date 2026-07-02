export const MIN_ANGLE_DEGREES = 5;
export const MAX_ANGLE_DEGREES = 175;

// Keep an angle inside the cannon's allowed range.
//
// Daniel note:
// If a tank is only allowed to aim from 0 to 90 degrees, this function is the
// guard rail that stops the cannon at those edges.
export function clampAngle(angleDegrees, minAngle = MIN_ANGLE_DEGREES, maxAngle = MAX_ANGLE_DEGREES) {
  const low = Math.min(minAngle, maxAngle);
  const high = Math.max(minAngle, maxAngle);
  return Math.max(low, Math.min(high, angleDegrees));
}

// Rotate the cannon a little bit for one frame.
//
// direction is usually 1 or -1.
// deltaSeconds keeps turning speed fair on fast and slow computers.
export function turnCannon(angleDegrees, direction, turnSpeed, deltaSeconds, minAngle = MIN_ANGLE_DEGREES, maxAngle = MAX_ANGLE_DEGREES) {
  const nextAngle = angleDegrees + direction * turnSpeed * deltaSeconds;
  return clampAngle(nextAngle, minAngle, maxAngle);
}

// Convert an angle in degrees into an x/y direction.
//
// This is one of the most important math helpers in the game:
// - 0 degrees points right
// - 90 degrees points up
// - x tells the cannonball how much to move sideways
// - y tells the cannonball how much to move up/down
export function angleToVector(angleDegrees) {
  const radians = angleDegrees * Math.PI / 180;

  return {
    x: Math.cos(radians),
    y: -Math.sin(radians)
  };
}

// Find the end of the cannon barrel.
//
// pivot is the point where the cannon rotates.
// length is how long the barrel is.
// The projectile starts at this returned point.
export function cannonTip(pivot, angleDegrees, length) {
  const direction = angleToVector(angleDegrees);

  return {
    x: pivot.x + direction.x * length,
    y: pivot.y + direction.y * length
  };
}
