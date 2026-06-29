// PROJECTILE PHYSICS
//
// This file is about the cannon ball after it leaves the cannon.
// It does not draw the ball. It only changes numbers like x, y, vx, and vy.

// Gravity is how strongly the ball gets pulled downward.
// Bigger number means the ball falls faster.
export const GRAVITY = 220;

export function createProjectile(start, angleVector, power) {
  // CREATE A NEW CANNON BALL
  //
  // This creates the cannon ball at the end of the cannon.
  // vx means "velocity x": how fast the ball moves left or right.
  // vy means "velocity y": how fast the ball moves up or down.
  //
  // Tricky bit:
  // The cannon angle is already turned into angleVector before this function.
  // angleVector.x says how much of the shot points sideways.
  // angleVector.y says how much of the shot points up or down.
  // power makes both parts stronger.
  return {
    // Start at the end of the cannon barrel.
    x: start.x,
    y: start.y,

    // Starting speed comes from angle times power.
    vx: angleVector.x * power,
    vy: angleVector.y * power,

    // radius is used when drawing the cannon ball.
    radius: 4,

    // age counts how many seconds the cannon ball has been flying.
    // Later, we use this to avoid hitting our own tank instantly.
    age: 0,

    // active is not used much yet, but it leaves room for later logic.
    active: true
  };
}

export function moveProjectile(projectile, wind, deltaSeconds) {
  // MOVE THE CANNON BALL FOR ONE FRAME
  //
  // deltaSeconds is the amount of time since the last frame.
  // Multiplying by deltaSeconds keeps motion smooth on fast and slow computers.

  // This is where wind really affects the cannon ball.
  //
  // If wind is positive, vx gets bigger and the ball is pushed right.
  // If wind is negative, vx gets smaller and the ball is pushed left.
  // If wind is zero, vx does not get extra sideways push.
  //
  // Daniel's current task is not to change this physics line.
  // His task is to show this same direction with an arrow in the HUD.
  projectile.vx += wind * deltaSeconds;

  // Count how long the shot has been alive.
  projectile.age += deltaSeconds;

  // Gravity always pulls the ball down.
  //
  // Tricky bit:
  // In canvas, bigger y means lower on the screen.
  // So adding to vy makes the ball fall downward.
  projectile.vy += GRAVITY * deltaSeconds;

  // These two lines move the ball using its current speed.
  //
  // x changes by left/right speed.
  // y changes by up/down speed.
  projectile.x += projectile.vx * deltaSeconds;
  projectile.y += projectile.vy * deltaSeconds;
}

export function projectileHitTank(projectile, tank) {
  // CHECK WHETHER THE CANNON BALL IS INSIDE THE TANK BODY
  //
  // This is a simple rectangle hit test.
  // It does not check the cab yet, only the main tank body.

  // Convert the tank from center position into rectangle edges.
  const left = tank.x - tank.width / 2;
  const right = tank.x + tank.width / 2;
  const top = tank.y - tank.height;
  const bottom = tank.y;

  // The projectile hits if its x is between left and right,
  // and its y is between top and bottom.
  return projectile.x >= left &&
    projectile.x <= right &&
    projectile.y >= top &&
    projectile.y <= bottom;
}
