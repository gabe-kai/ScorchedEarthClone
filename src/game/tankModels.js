// TANK MODELS
//
// A tank model is built from polygon points.
// Each point is measured from the tank's ground point:
// - x: negative is left, positive is right
// - y: negative is up, positive is down
//
// Daniel's graph-paper tank designs will go in this file.
//
// Model vocabulary:
// - body is the lower polygon.
// - cab is the smaller upper polygon.
// - cannonPivot is the dot where the cannon rotates.
// - type tells the designer whether this is a mobile tank or a fixed turret.
// - cannon describes the angle rules we want to support as the designer grows.

export const TANK_MODELS = {
  // DANIEL TANK MODEL TASK:
  // Replace these starter points with Player 1's graph-paper tank.
  p1Custom: {
    name: 'Player 1 Custom',
    type: 'tank',
    canMove: true,
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
    cannon: {
      style: 'oneSide',
      minAngle: 5,
      maxAngle: 175,
      flipPastEdge: false
    },
    collision: { width: 44, height: 24 }
  },

  // DANIEL TANK MODEL TASK:
  // Replace these starter points with Player 2's graph-paper tank.
  p2Custom: {
    name: 'Player 2 Custom',
    type: 'tank',
    canMove: true,
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
    cannon: {
      style: 'oneSide',
      minAngle: 5,
      maxAngle: 175,
      flipPastEdge: false
    },
    collision: { width: 44, height: 26 }
  },

  // This starter turret is here for the Designer tab.
  // It is not assigned to either player yet, but it shows the different rules:
  // a turret does not move, and its cannon can sweep the whole top half.
  hillTurret: {
    name: 'Hill Turret',
    type: 'turret',
    canMove: false,
    color: '#6f756d',
    accent: '#b7a15a',
    body: [
      { x: -18, y: 0 },
      { x: -14, y: -18 },
      { x: 14, y: -18 },
      { x: 18, y: 0 }
    ],
    cab: [
      { x: -10, y: -18 },
      { x: -6, y: -30 },
      { x: 6, y: -30 },
      { x: 10, y: -18 }
    ],
    cannonPivot: { x: 0, y: -30 },
    cannon: {
      style: 'topArc',
      minAngle: 0,
      maxAngle: 180,
      flipPastEdge: false
    },
    collision: { width: 36, height: 32 }
  }
};

export const TANK_MODEL_OPTIONS = Object.entries(TANK_MODELS).map(([id, model]) => ({
  id,
  name: model.name
}));
