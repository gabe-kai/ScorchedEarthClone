export const GRAVITY = 220;

export function createProjectile(start, angleVector, power) {
  // This creates the cannon ball at the end of the cannon.
  // vx means "velocity x": how fast the ball moves left or right.
  // vy means "velocity y": how fast the ball moves up or down.
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
  // This is where wind really affects the cannon ball.
  //
  // If wind is positive, vx gets bigger and the ball is pushed right.
  // If wind is negative, vx gets smaller and the ball is pushed left.
  // If wind is zero, vx does not get extra sideways push.
  //
  // Daniel's current task is not to change this physics line.
  // His task is to show this same direction with an arrow in the HUD.
  projectile.vx += wind * deltaSeconds;

  // Gravity always pulls the ball down.
  projectile.vy += GRAVITY * deltaSeconds;

  // These two lines move the ball using its current speed.
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
