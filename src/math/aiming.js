export const MIN_ANGLE_DEGREES = 5;
export const MAX_ANGLE_DEGREES = 175;

export function clampAngle(angleDegrees, minAngle = MIN_ANGLE_DEGREES, maxAngle = MAX_ANGLE_DEGREES) {
  const low = Math.min(minAngle, maxAngle);
  const high = Math.max(minAngle, maxAngle);
  return Math.max(low, Math.min(high, angleDegrees));
}

export function turnCannon(angleDegrees, direction, turnSpeed, deltaSeconds, minAngle = MIN_ANGLE_DEGREES, maxAngle = MAX_ANGLE_DEGREES) {
  const nextAngle = angleDegrees + direction * turnSpeed * deltaSeconds;
  return clampAngle(nextAngle, minAngle, maxAngle);
}

export function angleToVector(angleDegrees) {
  const radians = angleDegrees * Math.PI / 180;

  return {
    x: Math.cos(radians),
    y: -Math.sin(radians)
  };
}

export function cannonTip(pivot, angleDegrees, length) {
  const direction = angleToVector(angleDegrees);

  return {
    x: pivot.x + direction.x * length,
    y: pivot.y + direction.y * length
  };
}
