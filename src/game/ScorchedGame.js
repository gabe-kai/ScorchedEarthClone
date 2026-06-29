import { angleToVector, cannonTip, turnCannon } from '../math/aiming.js';
import { createProjectile, moveProjectile, projectileHitTank } from '../physics/projectile.js';

// GAME SIZE AND TUNING NUMBERS
//
// These constants are the "settings" for the first version of the game.
// Changing these numbers is usually safer than changing the game loop below.
const WIDTH = 960;
const HEIGHT = 540;
const GROUND_Y = 470;
const CANNON_LENGTH = 42;
const CANNON_TURN_SPEED = 55;
const POWER_STEP = 90;
const MIN_POWER = 80;
const MAX_POWER = 420;
const TERRAIN_STEP = 8;
const IMPACT_DURATION_SECONDS = 0.45;
const SELF_HIT_GRACE_SECONDS = 0.25;

// MAIN GAME CLASS
//
// ScorchedGame owns the whole running game:
// - keyboard input
// - whose turn it is
// - the cannon ball
// - drawing everything on the canvas
// - updating the HUD text
export class ScorchedGame {
  constructor(canvas, hud) {
    // The canvas is the rectangle we draw the game into.
    this.canvas = canvas;

    // The context is the drawing tool for the canvas.
    // Most drawing commands below start with "ctx.".
    this.context = canvas.getContext('2d');

    // hud contains the HTML elements for status, angle, power, and wind.
    this.hud = hud;

    // keys remembers which keyboard keys are currently being held down.
    // A Set is like a list that only keeps one copy of each value.
    this.keys = new Set();

    // lastTime is used to measure how much time passed between frames.
    // That keeps movement smooth even if the computer is a little slow.
    this.lastTime = 0;

    // Start the first round.
    this.reset();
  }

  start() {
    // Keydown happens when a key is pressed.
    // Keyup happens when a key is released.
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));

    // requestAnimationFrame asks the browser to call tick before the next draw.
    // This starts the game loop.
    requestAnimationFrame((time) => this.tick(time));
  }

  reset() {
    // terrain is an array of ground heights.
    // Each number says where the ground is at one x position.
    // Right now all values are GROUND_Y, so the battlefield starts flat.
    this.terrain = createFlatTerrain();

    // Put two tanks on opposite sides of the battlefield.
    // The last number is the starting cannon angle in degrees.
    this.players = [
      this.createTank('Player 1', 150, '#d45745', 35),
      this.createTank('Player 2', 810, '#4d8ad8', 145)
    ];

    // Player 1 starts because arrays count from 0 in JavaScript.
    this.currentPlayerIndex = 0;

    // No cannon ball exists until someone fires.
    this.projectile = null;

    // impact exists only while a hit animation is playing.
    // It will look like: { x, y, kind, age, endsTurn, endsRound }
    this.impact = null;

    // A tank hit ends the round until R resets.
    this.roundOver = false;

    // Pick a new random wind value for this round.
    this.wind = randomWind();

    // Message shown in the HUD.
    this.message = 'Player 1: aim with arrows, fire with Space.';
  }

  createTank(name, x, color, angle) {
    // This function builds a plain object that stores one tank's state.
    //
    // Tricky bit:
    // x is the middle of the tank.
    // y is the ground point under the tank.
    // The drawing code uses those values to calculate the body and cab.
    return {
      name,
      x,
      y: GROUND_Y,
      width: 64,
      height: 24,
      cabWidth: 28,
      cabHeight: 18,
      angle,
      power: 240,
      color
    };
  }

  onKeyDown(event) {
    // These keys normally make the browser scroll the page.
    // preventDefault stops that so the keys only control the game.
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    // R resets the whole round immediately.
    if (event.code === 'KeyR') {
      this.reset();
      return;
    }

    // Space fires one shot. It is handled immediately instead of being stored.
    if (event.code === 'Space') {
      this.fire();
      return;
    }

    // All other control keys are remembered until keyup removes them.
    // That is what lets the cannon keep rotating while a key is held down.
    this.keys.add(event.code);
  }

  tick(time) {
    // deltaSeconds means "how many seconds since the last frame?"
    //
    // Tricky bit:
    // The browser gives us time in milliseconds, so we divide by 1000.
    // Math.min prevents a giant jump if the tab pauses for a moment.
    const deltaSeconds = Math.min((time - this.lastTime) / 1000 || 0, 0.05);
    this.lastTime = time;

    // One frame of the game:
    // 1. update the game state
    // 2. draw the game
    // 3. update the side HUD
    this.update(deltaSeconds);
    this.draw();
    this.updateHud();

    // Schedule the next frame. This keeps the game running.
    requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  update(deltaSeconds) {
    // If a cannon ball exists, it gets the whole update.
    // Players cannot aim or fire again until the shot is over.
    if (this.projectile) {
      this.updateProjectile(deltaSeconds);
      return;
    }

    // If an explosion or dirt puff is playing, let it finish before aiming.
    if (this.impact) {
      this.updateImpact(deltaSeconds);
      return;
    }

    // When the round is over, leave the final message on screen.
    // R can still reset the round because onKeyDown handles it directly.
    if (this.roundOver) {
      return;
    }

    // Only the current player's tank should respond to controls.
    const tank = this.currentTank();

    // Cannon aiming controls.
    //
    // turnCannon lives in src/math/aiming.js.
    // The 1 or -1 tells it which direction to rotate.
    if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) {
      tank.angle = turnCannon(tank.angle, 1, CANNON_TURN_SPEED, deltaSeconds);
    }

    if (this.keys.has('ArrowRight')  || this.keys.has('KeyD')) {
      tank.angle = turnCannon(tank.angle, -1, CANNON_TURN_SPEED, deltaSeconds);
    }

    // Power controls.
    //
    // Math.min keeps power from going above MAX_POWER.
    // Math.max keeps power from going below MIN_POWER.
    if (this.keys.has('ArrowUp')  || this.keys.has('KeyW')) {
      tank.power = Math.min(MAX_POWER, tank.power + POWER_STEP * deltaSeconds);
    }

    if (this.keys.has('ArrowDown')  || this.keys.has('KeyS')) {
      tank.power = Math.max(MIN_POWER, tank.power - POWER_STEP * deltaSeconds);
    }
  }

  updateProjectile(deltaSeconds) {
    // MOVE THE CANNON BALL
    //
    // This sends the current wind number into projectile.js.
    // Daniel's wind-arrow task does not need to change this line.
    // This line is here so you can connect the HUD number to the real physics.
    moveProjectile(this.projectile, this.wind, deltaSeconds);

    // CHECK FOR A DIRECT HIT
    //
    // findProjectileTankHit is the place where self-hit support belongs.
    const target = this.findProjectileTankHit();
    if (target) {
      this.startImpact('tank', this.projectile.x, this.projectile.y, {
        endsRound: true,
        message: `${this.currentTank().name} hit ${target.name}! Press R for a new round.`
      });

      // Setting projectile to null means "there is no active cannon ball now."
      this.projectile = null;
      return;
    }

    // CHECK WHETHER THE SHOT IS OVER
    //
    // offscreen means the ball left the battlefield.
    // hitGround means the ball touched the terrain at its current x position.
    const offscreen = this.projectile.x < -20 || this.projectile.x > WIDTH + 20;
    const groundY = this.groundYAt(this.projectile.x);
    const hitGround = this.projectile.y >= groundY;

    if (hitGround) {
      this.startImpact('ground', this.projectile.x, groundY, {
        endsTurn: true,
        message: `${this.currentTank().name}'s shot hit the ground.`
      });
      this.deformTerrainAt(this.projectile.x, groundY);
      this.projectile = null;
      return;
    }

    if (offscreen) {
      this.projectile = null;

      // A missed shot gives the turn to the other player.
      this.nextTurn();
    }
  }

  updateImpact(deltaSeconds) {
    // IMPACT ANIMATION TIMER
    //
    // age starts at 0 and counts upward until the animation is done.
    this.impact.age += deltaSeconds;

    if (this.impact.age < IMPACT_DURATION_SECONDS) {
      return;
    }

    const finishedImpact = this.impact;
    this.impact = null;

    // Tank hits end the round for now.
    // Ground hits end only the current turn.
    if (finishedImpact.endsRound) {
      this.roundOver = true;
      return;
    }

    if (finishedImpact.endsTurn) {
      this.nextTurn();
    }
  }

  startImpact(kind, x, y, options = {}) {
    // CREATE AN IMPACT ANIMATION
    //
    // kind is either 'ground' or 'tank'.
    // Daniel can use kind to make the two animations look different.
    this.impact = {
      x,
      y,
      kind,
      age: 0,
      endsTurn: Boolean(options.endsTurn),
      endsRound: Boolean(options.endsRound)
    };

    if (options.message) {
      this.message = options.message;
    }
  }

  findProjectileTankHit() {
    const candidates = [this.otherTank()];

    if (this.projectile.age > SELF_HIT_GRACE_SECONDS) {
      candidates.push(this.currentTank());
    }

    for (const target of candidates) {
      if (projectileHitTank(this.projectile, target)) {
        return target;
      }
    }

    return null;
  }

  fire() {
    // Do not allow a second shot while one is already flying.
    if (this.projectile || this.impact || this.roundOver) {
      return;
    }

    // Find the current tank, then calculate where the cannon barrel ends.
    const tank = this.currentTank();
    const pivot = tankCannonPivot(tank);
    const tip = cannonTip(pivot, tank.angle, CANNON_LENGTH);

    // Create the cannon ball with the current angle and power.
    this.projectile = createProjectile(tip, angleToVector(tank.angle), tank.power);
    this.message = `${tank.name} fired.`;
  }

  nextTurn() {
    // There are only two players, index 0 and index 1.
    // 1 - 0 becomes 1. 1 - 1 becomes 0.
    // That swaps back and forth between the players.
    this.currentPlayerIndex = 1 - this.currentPlayerIndex;

    // Each new turn gets new wind, like classic artillery games.
    this.wind = randomWind();
    this.message = `${this.currentTank().name}'s turn.`;
  }

  currentTank() {
    // Return the tank whose turn it is.
    return this.players[this.currentPlayerIndex];
  }

  otherTank() {
    // Return the tank whose turn it is NOT.
    return this.players[1 - this.currentPlayerIndex];
  }

  draw() {
    // DRAW ONE FRAME
    //
    // Canvas does not remember "objects" like a game engine.
    // Each frame, we erase the screen and redraw everything.
    const ctx = this.context;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    this.drawSky(ctx);
    this.drawGround(ctx);
    this.players.forEach((tank) => this.drawTank(ctx, tank));

    // Draw the cannon ball only if one exists.
    if (this.projectile) {
      ctx.fillStyle = '#1f2026';
      ctx.beginPath();
      ctx.arc(this.projectile.x, this.projectile.y, this.projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw the impact animation after tanks and cannon ball.
    if (this.impact) {
      this.drawImpact(ctx, this.impact);
    }
  }

  drawSky(ctx) {
    // Paint the sky background and the sun.
    ctx.fillStyle = '#8ec6e6';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.fillStyle = '#f8df7a';
    ctx.beginPath();
    ctx.arc(84, 78, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGround(ctx) {
    // Draw the terrain.
    //
    // The ground is no longer just one rectangle.
    // It is a line made from the numbers in this.terrain.
    ctx.fillStyle = '#4f8743';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);

    this.terrain.forEach((groundY, index) => {
      ctx.lineTo(index * TERRAIN_STEP, groundY);
    });

    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3d6c36';
    ctx.fillRect(0, GROUND_Y + 20, WIDTH, HEIGHT - GROUND_Y - 20);
  }

  drawTank(ctx, tank) {
    // CALCULATE TANK PART POSITIONS
    //
    // Tricky bit:
    // Canvas x grows to the right.
    // Canvas y grows DOWN, not up.
    // So "higher on screen" means a smaller y number.
    const bodyLeft = tank.x - tank.width / 2;
    const bodyTop = tank.y - tank.height;
    const cabLeft = tank.x - tank.cabWidth / 2;
    const cabTop = bodyTop - tank.cabHeight;

    // The cannon is drawn as a thick line from pivot to tip.
    const pivot = tankCannonPivot(tank);
    const tip = cannonTip(pivot, tank.angle, CANNON_LENGTH);

    // Draw tank body and cab.
    ctx.fillStyle = tank.color;
    ctx.fillRect(bodyLeft, bodyTop, tank.width, tank.height);
    ctx.fillRect(cabLeft, cabTop, tank.cabWidth, tank.cabHeight);

    // Draw cannon barrel.
    ctx.strokeStyle = '#22252d';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Draw player name under the tank.
    ctx.fillStyle = '#f4f0e8';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tank.name, tank.x, tank.y + 36);
  }

  drawImpact(ctx, impact) {
    // DANIEL IMPACT ANIMATION PHASE STARTS HERE
    //
    // This function is called while an impact is happening,
    // but it intentionally draws nothing right now.
    //
    // That means the game is READY for hit animations,
    // but Daniel still gets to create the first visible version.
    //
    // Useful values:
    // - impact.x is where the cannon ball hit.
    // - impact.y is where the cannon ball hit.
    // - impact.kind is either 'ground' or 'tank'.
    // - impact.age is how many seconds the impact has existed.
    //
    if (impact.kind === 'tank') {
      // tank hit drawing goes here
      ctx.fillStyle = '#ff0000';
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 50, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // ground hit drawing goes here
      ctx.fillStyle = '#ff6a00';
      ctx.beginPath();
      ctx.arc(impact.x, impact.y, 20, 0, Math.PI * 2);
      ctx.fill();
    }
    //
    // DANIEL IMPACT ANIMATION PHASE ENDS HERE
    void ctx;
    void impact;
  }

  updateHud() {
    // UPDATE THE TEXT ON THE RIGHT SIDE OF THE SCREEN
    //
    // The HUD is normal HTML, not canvas drawing.
    // textContent changes what the player sees in each HUD line.
    const tank = this.currentTank();
    this.hud.status.textContent = this.message;
    this.hud.angle.textContent = `${Math.round(tank.angle)} deg`;
    this.hud.power.textContent = Math.round(tank.power).toString();

    // DANIEL WIND TASK STARTS HERE
    //
    // Goal:
    // Make the wind HUD show direction and strength.
    //
    // Right now it only shows a number, like:
    //   12.5
    //
    // We want it to show an arrow and a positive number, like:
    //   -> 12.5
    // or:
    //   <- 12.5
    //
    let windArrow = '-';

if (this.wind < 0) {
  windArrow = '<-';
} else if (this.wind > 0) {
  windArrow = '->';
}
    // Put your new variable declaration RIGHT HERE, above the textContent line.
    //
    // Hint:
    //   let windArrow = '-';
    //
    // Then put your if / else if statement RIGHT AFTER that variable.
    //
    // Hint:
    //   if (this.wind < 0) {
    //     windArrow = '<-';
    //   } else if (this.wind > 0) {
    //     windArrow = '->';
    //   }
    //
    // Finally, change the line below so it uses windArrow and Math.abs(this.wind).
    // This is the only line in this method that should display the wind.
   this.hud.wind.textContent = `${windArrow} ${Math.abs(this.wind).toFixed(1)}`;
    //
    // DANIEL WIND TASK ENDS HERE
  }

  groundYAt(x) {
    // FIND THE TERRAIN HEIGHT AT ONE X POSITION
    //
    // Clamp keeps the array index inside the terrain array.
    const index = Math.max(0, Math.min(this.terrain.length - 1, Math.round(x / TERRAIN_STEP)));
    return this.terrain[index];
  }

  deformTerrainAt(x, y) {
    // DANIEL CRATER PHASE STARTS HERE
    //
    // This function is called every time a shot hits the ground.
    // Right now it does nothing, so the ground does not deform yet.
    //
    // Daniel's future job:
    // Change nearby terrain points to make a crater.
    //
    // Useful ideas:
    // - x is where the cannon ball hit.
    // - y is the terrain height where it hit.
    // - this.terrain is the array of ground heights.
    // - TERRAIN_STEP tells how many screen pixels are between terrain points.
    //
    // Tricky bit:
    // In canvas, bigger y numbers are lower on screen.
    // So adding to a terrain value digs downward.
    //
    // This line keeps JavaScript from complaining that y is unused for now.
    void y;
    //
    // DANIEL CRATER PHASE ENDS HERE
  }
}

function tankCannonPivot(tank) {
  // The pivot is the point where the cannon rotates.
  // For now, it sits at the top center of the cab.
  return {
    x: tank.x,
    y: tank.y - tank.height - tank.cabHeight
  };
}

function randomWind() {
  // This picks a new wind strength between about -35 and +35.
  // Negative wind pushes left. Positive wind pushes right.
  // Daniel's current task is only to DISPLAY that direction in the HUD.
  return Math.round((Math.random() * 70 - 35) * 10) / 10;
}

function createFlatTerrain() {
  // Build a flat terrain array.
  //
  // Example:
  // terrain[0] is the ground near x = 0.
  // terrain[1] is the ground near x = TERRAIN_STEP.
  // terrain[2] is the ground near x = TERRAIN_STEP * 2.
  const pointCount = Math.ceil(WIDTH / TERRAIN_STEP) + 1;
  return Array.from({ length: pointCount }, () => GROUND_Y);
}
