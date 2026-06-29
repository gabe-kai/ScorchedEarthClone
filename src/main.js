import { ScorchedGame } from './game/ScorchedGame.js';

const canvas = document.querySelector('#game');
const hud = {
  status: document.querySelector('#status'),
  angle: document.querySelector('#angle'),
  power: document.querySelector('#power'),
  wind: document.querySelector('#wind')
};

// SAFETY FOR LONG DEV SESSIONS
//
// If the page script ever runs again without a full browser cleanup,
// stop the previous game before starting a new one.
// This prevents multiple requestAnimationFrame loops from stacking up.
if (window.scorchedGame) {
  window.scorchedGame.stop();
}

const game = new ScorchedGame(canvas, hud);
window.scorchedGame = game;
game.start();
