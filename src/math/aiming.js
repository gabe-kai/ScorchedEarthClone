export const MIN_ANGLE_DEGREES = 5;
export const MAX_ANGLE_DEGREES = 175;

export function clampAngle(angleDegrees) {
  return Math.max(MIN_ANGLE_DEGREES, Math.min(MAX_ANGLE_DEGREES, angleDegrees));
}

export function turnCannon(angleDegrees, direction, turnSpeed, deltaSeconds) {
  const nextAngle = angleDegrees + direction * turnSpeed * deltaSeconds;
  return clampAngle(nextAngle);
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
