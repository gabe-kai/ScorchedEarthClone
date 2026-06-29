export const GRAVITY = 220;

export function createProjectile(start, angleVector, power) {
  return {
    x: start.x,
    y: start.y,
    vx: angleVector.x * power,
    vy: angleVector.y * power,
    radius: 4,
    active: true
  };
}

export function moveProjectile(projectile, wind, deltaSeconds) {
  projectile.vx += wind * deltaSeconds;
  projectile.vy += GRAVITY * deltaSeconds;
  projectile.x += projectile.vx * deltaSeconds;
  projectile.y += projectile.vy * deltaSeconds;
}

export function projectileHitTank(projectile, tank) {
  const left = tank.x - tank.width / 2;
  const right = tank.x + tank.width / 2;
  const top = tank.y - tank.height;
  const bottom = tank.y;

  return projectile.x >= left &&
    projectile.x <= right &&
    projectile.y >= top &&
    projectile.y <= bottom;
}
