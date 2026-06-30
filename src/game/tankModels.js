// TANK MODELS
//
// A tank model is built from polygon points.
// Each point is measured from the tank's ground point:
// - x: negative is left, positive is right
// - y: negative is up, positive is down
//
// Daniel's graph-paper tank designs will go in this file.

export const TANK_MODELS = {
  // DANIEL TANK MODEL TASK:
  // Replace these starter points with Player 1's graph-paper tank.
  p1Custom: {
    name: 'Player 1 Custom',
    color: '#d45745',
    accent: '#f2b36f',
    body: [
      { x: -20, y: 0 },
      { x: -17, y: -12 },
      { x: 14, y: -12 },
      { x: 22, y: 0 }
    ],
    cab: [
      { x: -8, y: -12 },
      { x: -4, y: -22 },
      { x: 9, y: -22 },
      { x: 13, y: -12 }
    ],
    cannonPivot: { x: 5, y: -22 },
    collision: { width: 44, height: 24 }
  },

  // DANIEL TANK MODEL TASK:
  // Replace these starter points with Player 2's graph-paper tank.
  p2Custom: {
    name: 'Player 2 Custom',
    color: '#4d8ad8',
    accent: '#89d0ff',
    body: [
      { x: -22, y: 0 },
      { x: -12, y: -14 },
      { x: 18, y: -14 },
      { x: 22, y: 0 }
    ],
    cab: [
      { x: -12, y: -14 },
      { x: -8, y: -25 },
      { x: 6, y: -25 },
      { x: 12, y: -14 }
    ],
    cannonPivot: { x: 0, y: -25 },
    collision: { width: 44, height: 26 }
  }
};

export const TANK_MODEL_OPTIONS = Object.entries(TANK_MODELS).map(([id, model]) => ({
  id,
  name: model.name
}));
