import { ScorchedGame } from './game/ScorchedGame.js';

const canvas = document.querySelector('#game');
const hud = {
  status: document.querySelector('#status'),
  angle: document.querySelector('#angle'),
  power: document.querySelector('#power'),
  wind: document.querySelector('#wind')
};

const game = new ScorchedGame(canvas, hud);
game.start();
