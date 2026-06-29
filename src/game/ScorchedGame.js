import { angleToVector, cannonTip, turnCannon } from '../math/aiming.js';
import { createProjectile, moveProjectile, projectileHitTank } from '../physics/projectile.js';

const WIDTH = 960;
const HEIGHT = 540;
const GROUND_Y = 470;
const CANNON_LENGTH = 42;
const CANNON_TURN_SPEED = 55;
const POWER_STEP = 90;
const MIN_POWER = 80;
const MAX_POWER = 420;

export class ScorchedGame {
  constructor(canvas, hud) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.hud = hud;
    this.keys = new Set();
    this.lastTime = 0;
    this.reset();
  }

  start() {
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    requestAnimationFrame((time) => this.tick(time));
  }

  reset() {
    this.players = [
      this.createTank('Player 1', 150, '#d45745', 35),
      this.createTank('Player 2', 810, '#4d8ad8', 145)
    ];
    this.currentPlayerIndex = 0;
    this.projectile = null;
    this.wind = randomWind();
    this.message = 'Player 1: aim with arrows, fire with Space.';
  }

  createTank(name, x, color, angle) {
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
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }

    if (event.code === 'KeyR') {
      this.reset();
      return;
    }

    if (event.code === 'Space') {
      this.fire();
      return;
    }

    this.keys.add(event.code);
  }

  tick(time) {
    const deltaSeconds = Math.min((time - this.lastTime) / 1000 || 0, 0.05);
    this.lastTime = time;

    this.update(deltaSeconds);
    this.draw();
    this.updateHud();

    requestAnimationFrame((nextTime) => this.tick(nextTime));
  }

  update(deltaSeconds) {
    if (this.projectile) {
      this.updateProjectile(deltaSeconds);
      return;
    }

    const tank = this.currentTank();

    if (this.keys.has('ArrowLeft')  || this.keys.has('KeyA')) {
      tank.angle = turnCannon(tank.angle, 1, CANNON_TURN_SPEED, deltaSeconds);
    }

    if (this.keys.has('ArrowRight')  || this.keys.has('KeyD')) {
      tank.angle = turnCannon(tank.angle, -1, CANNON_TURN_SPEED, deltaSeconds);
    }

    if (this.keys.has('ArrowUp')  || this.keys.has('KeyW')) {
      tank.power = Math.min(MAX_POWER, tank.power + POWER_STEP * deltaSeconds);
    }

    if (this.keys.has('ArrowDown')  || this.keys.has('KeyS')) {
      tank.power = Math.max(MIN_POWER, tank.power - POWER_STEP * deltaSeconds);
    }
  }

  updateProjectile(deltaSeconds) {
    moveProjectile(this.projectile, this.wind, deltaSeconds);

    const target = this.otherTank();
    if (projectileHitTank(this.projectile, target)) {
      this.message = `${this.currentTank().name} hit ${target.name}! Press R for a new round.`;
      this.projectile = null;
      return;
    }

    const offscreen = this.projectile.x < -20 || this.projectile.x > WIDTH + 20;
    const hitGround = this.projectile.y >= GROUND_Y;
    if (offscreen || hitGround) {
      this.projectile = null;
      this.nextTurn();
    }
  }

  fire() {
    if (this.projectile) {
      return;
    }

    const tank = this.currentTank();
    const pivot = tankCannonPivot(tank);
    const tip = cannonTip(pivot, tank.angle, CANNON_LENGTH);
    this.projectile = createProjectile(tip, angleToVector(tank.angle), tank.power);
    this.message = `${tank.name} fired.`;
  }

  nextTurn() {
    this.currentPlayerIndex = 1 - this.currentPlayerIndex;
    this.wind = randomWind();
    this.message = `${this.currentTank().name}'s turn.`;
  }

  currentTank() {
    return this.players[this.currentPlayerIndex];
  }

  otherTank() {
    return this.players[1 - this.currentPlayerIndex];
  }

  draw() {
    const ctx = this.context;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    this.drawSky(ctx);
    this.drawGround(ctx);
    this.players.forEach((tank) => this.drawTank(ctx, tank));

    if (this.projectile) {
      ctx.fillStyle = '#1f2026';
      ctx.beginPath();
      ctx.arc(this.projectile.x, this.projectile.y, this.projectile.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawSky(ctx) {
    ctx.fillStyle = '#8ec6e6';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#f8df7a';
    ctx.beginPath();
    ctx.arc(84, 78, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  drawGround(ctx) {
    ctx.fillStyle = '#4f8743';
    ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
    ctx.fillStyle = '#3d6c36';
    ctx.fillRect(0, GROUND_Y + 20, WIDTH, HEIGHT - GROUND_Y - 20);
  }

  drawTank(ctx, tank) {
    const bodyLeft = tank.x - tank.width / 2;
    const bodyTop = tank.y - tank.height;
    const cabLeft = tank.x - tank.cabWidth / 2;
    const cabTop = bodyTop - tank.cabHeight;
    const pivot = tankCannonPivot(tank);
    const tip = cannonTip(pivot, tank.angle, CANNON_LENGTH);

    ctx.fillStyle = tank.color;
    ctx.fillRect(bodyLeft, bodyTop, tank.width, tank.height);
    ctx.fillRect(cabLeft, cabTop, tank.cabWidth, tank.cabHeight);

    ctx.strokeStyle = '#22252d';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    ctx.fillStyle = '#f4f0e8';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(tank.name, tank.x, tank.y + 36);
  }

  updateHud() {
    const tank = this.currentTank();
    this.hud.status.textContent = this.message;
    this.hud.angle.textContent = `${Math.round(tank.angle)} deg`;
    this.hud.power.textContent = Math.round(tank.power).toString();
    this.hud.wind.textContent = this.wind.toFixed(1);
  }
}

function tankCannonPivot(tank) {
  return {
    x: tank.x,
    y: tank.y - tank.height - tank.cabHeight
  };
}

function randomWind() {
  return Math.round((Math.random() * 70 - 35) * 10) / 10;
}
