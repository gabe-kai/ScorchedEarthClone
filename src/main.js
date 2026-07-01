import { ScorchedGame } from './game/ScorchedGame.js';
import { describeItem, ITEM_TYPES } from './game/itemTypes.js';
import { TANK_MODELS } from './game/tankModels.js';

const canvas = document.querySelector('#game');
const hud = {
  status: document.querySelector('#status'),
  roundNumber: document.querySelector('#roundNumber'),
  turnNumber: document.querySelector('#turnNumber'),
  playerPanel: document.querySelector('#playerPanel'),
  playerName: document.querySelector('#playerName'),
  tankModel: document.querySelector('#tankModel'),
  health: document.querySelector('#health'),
  aimGauge: document.querySelector('#aimGauge'),
  windValue: document.querySelector('#windValue'),
  angle: document.querySelector('#angle'),
  power: document.querySelector('#power')
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

const quickbar = document.querySelector('#quickbar');
const inventoryModal = document.querySelector('#inventoryModal');
const inventoryList = document.querySelector('#inventoryList');
const designerModal = document.querySelector('#designerModal');
const designerTabs = document.querySelectorAll('[data-designer-tab]');
const designerPanels = document.querySelectorAll('[data-designer-panel]');
const tankDesignerList = document.querySelector('#tankDesignerList');
const newTankButton = document.querySelector('#newTankButton');
const newTurretButton = document.querySelector('#newTurretButton');
const tankFields = {
  name: document.querySelector('#tankNameInput'),
  kind: document.querySelector('#tankKindInput'),
  bodyColor: document.querySelector('#tankBodyColorInput'),
  cabColor: document.querySelector('#tankCabColorInput'),
  canMove: document.querySelector('#tankCanMoveInput'),
  flipPastEdge: document.querySelector('#tankFlipInput'),
  cannonStyle: document.querySelector('#tankCannonStyleInput'),
  minAngle: document.querySelector('#tankMinAngleInput'),
  maxAngle: document.querySelector('#tankMaxAngleInput'),
  pivotX: document.querySelector('#tankPivotXInput'),
  pivotY: document.querySelector('#tankPivotYInput'),
  bodyPoints: document.querySelector('#tankBodyPointsInput'),
  cabPoints: document.querySelector('#tankCabPointsInput')
};
const tankPreview = {
  canvas: document.querySelector('#tankDesignerPreview'),
  name: document.querySelector('#tankPreviewName'),
  stats: document.querySelector('#tankPreviewStats')
};
const ammoDesignerList = document.querySelector('#ammoDesignerList');
const newAmmoButton = document.querySelector('#newAmmoButton');
const ammoFields = {
  name: document.querySelector('#ammoNameInput'),
  icon: document.querySelector('#ammoIconInput'),
  shotColor: document.querySelector('#ammoShotColorInput'),
  hitColor: document.querySelector('#ammoHitColorInput'),
  missColor: document.querySelector('#ammoMissColorInput'),
  explosionSize: document.querySelector('#ammoExplosionInput'),
  divotSize: document.querySelector('#ammoDivotInput'),
  damage: document.querySelector('#ammoDamageInput'),
  inventoryCount: document.querySelector('#ammoInventoryInput'),
  price: document.querySelector('#ammoPriceInput')
};
const ammoPreview = {
  icon: document.querySelector('#ammoPreviewIcon'),
  name: document.querySelector('#ammoPreviewName'),
  stats: document.querySelector('#ammoPreviewStats'),
  hit: document.querySelector('#ammoPreviewHit'),
  miss: document.querySelector('#ammoPreviewMiss'),
  divot: document.querySelector('#ammoPreviewDivot')
};

const DESIGNER_STORAGE_KEY = 'tanksDesignerState.v1';
const savedDesignerState = loadDesignerState();

let tankDesignerItems = createTankDesignerItems(savedDesignerState);
let selectedTankDesignerId = savedDesignerState?.selectedTankDesignerId || tankDesignerItems[0]?.id || null;
let ammoDesignerItems = createAmmoDesignerItems(savedDesignerState);
let selectedAmmoDesignerId = savedDesignerState?.selectedAmmoDesignerId || ammoDesignerItems[0]?.id || null;
let hoveredInventoryItemId = null;

if (!tankDesignerItems.some((item) => item.id === selectedTankDesignerId)) {
  selectedTankDesignerId = tankDesignerItems[0]?.id || null;
}

if (!ammoDesignerItems.some((item) => item.id === selectedAmmoDesignerId)) {
  selectedAmmoDesignerId = ammoDesignerItems[0]?.id || null;
}

// SAFETY FOR LONG DEV SESSIONS
//
// The game object cleans up its own keyboard listeners in stop().
// main.js also owns some UI listeners, so we keep a cleanup function for those
// too. If this script is ever re-run by a browser tool or future hot reload,
// the old UI listeners are removed before new ones are added.
if (window.tanksUiCleanup) {
  window.tanksUiCleanup();
}

const uiCleanupHandlers = [];

function addUiListener(target, eventName, handler) {
  target.addEventListener(eventName, handler);
  uiCleanupHandlers.push(() => target.removeEventListener(eventName, handler));
}

function openInventory() {
  renderInventory();

  if (!inventoryModal.open) {
    inventoryModal.showModal();
  }
}

function hotkeyForSlot(index) {
  const number = index + 1;
  return number === 10 ? '0' : String(number);
}

function renderQuickbar() {
  // The quickbar is small, so rebuilding it when inventory changes is simple.
  // This does NOT run every animation frame; it only runs when selection or
  // inventory changes.
  quickbar.textContent = '';

  const inventoryButton = document.createElement('button');
  inventoryButton.className = 'quickbar-card inventory-card';
  inventoryButton.type = 'button';
  inventoryButton.innerHTML = `
    <span class="quickbar-hotkey">I</span>
    <span class="quickbar-symbol">INV</span>
    <span class="quickbar-label">Inventory</span>
    <span class="quickbar-tooltip">Open inventory and manage quickbar items</span>
  `;
  inventoryButton.addEventListener('click', openInventory);
  quickbar.append(inventoryButton);

  for (const slot of game.quickbarItems()) {
    const button = document.createElement('button');
    button.className = 'quickbar-card';
    button.classList.toggle('is-selected', slot.isSelected);
    button.classList.toggle('is-empty', !slot.item);
    button.type = 'button';

    if (slot.item) {
      button.innerHTML = `
        <span class="quickbar-hotkey">${hotkeyForSlot(slot.index)}</span>
        <span class="quickbar-symbol">${slot.item.icon}</span>
        <span class="quickbar-label">${slot.item.name}</span>
        <span class="quickbar-tooltip">${describeItem(slot.itemId)}</span>
      `;
      button.addEventListener('click', () => {
        game.selectQuickbarSlot(slot.index);
      });
    } else {
      button.innerHTML = `
        <span class="quickbar-hotkey">${hotkeyForSlot(slot.index)}</span>
        <span class="quickbar-symbol">+</span>
        <span class="quickbar-label">Empty</span>
        <span class="quickbar-tooltip">Open inventory</span>
      `;
      button.addEventListener('click', openInventory);
    }

    quickbar.append(button);
  }
}

function renderInventory() {
  // The inventory modal is ordinary HTML.
  // Each row shows quantity plus purchase/sell buttons.
  // Quickbar assignment is handled by hovering a row and pressing a number key.
  inventoryList.textContent = '';

  for (const inventoryItem of game.inventoryItems()) {
    const row = document.createElement('div');
    row.className = 'inventory-row';
    row.dataset.itemId = inventoryItem.itemId;
    const countText = inventoryItem.count === Infinity ? 'Infinite' : inventoryItem.count;
    const canSell = inventoryItem.count !== Infinity && inventoryItem.count > 0;
    const canPurchase = inventoryItem.count !== Infinity;

    row.innerHTML = `
      <span class="inventory-icon">${inventoryItem.item.icon}</span>
      <span class="inventory-main">
        <strong>${inventoryItem.item.name}</strong>
        <small>${describeItem(inventoryItem.itemId)}</small>
      </span>
      <span class="inventory-quantity"><small>Qty</small><strong>${countText}</strong></span>
      <span class="inventory-actions">
        <button type="button" data-action="purchase" ${canPurchase ? '' : 'disabled'}>Purchase</button>
        <button type="button" data-action="sell" ${canSell ? '' : 'disabled'}>Sell</button>
      </span>
    `;

    row.addEventListener('pointerenter', () => {
      hoveredInventoryItemId = inventoryItem.itemId;
    });

    row.addEventListener('pointerleave', () => {
      if (hoveredInventoryItemId === inventoryItem.itemId) {
        hoveredInventoryItemId = null;
      }
    });

    row.querySelector('[data-action="purchase"]').addEventListener('click', () => {
      game.purchaseItem(inventoryItem.itemId);
    });

    row.querySelector('[data-action="sell"]').addEventListener('click', () => {
      game.sellItem(inventoryItem.itemId);
    });

    inventoryList.append(row);
  }
}

function loadDesignerState() {
  // localStorage is browser storage.
  // It survives refreshes and dev-server restarts, but it stays on this
  // computer/browser instead of changing the source files.
  try {
    const savedText = localStorage.getItem(DESIGNER_STORAGE_KEY);
    return savedText ? JSON.parse(savedText) : null;
  } catch {
    return null;
  }
}

function saveDesignerState() {
  try {
    localStorage.setItem(DESIGNER_STORAGE_KEY, JSON.stringify({
      tankDesignerItems,
      selectedTankDesignerId,
      ammoDesignerItems,
      selectedAmmoDesignerId
    }));
  } catch {
    // If browser storage is full or unavailable, the game should keep running.
  }
}

function createTankDesignerItems(savedState) {
  if (Array.isArray(savedState?.tankDesignerItems) && savedState.tankDesignerItems.length > 0) {
    return savedState.tankDesignerItems.map(normalizeTankDesignerItem);
  }

  // The Tank Designer works on copies so experimenting does not change the
  // real game objects while the modal is open.
  return Object.entries(TANK_MODELS).map(([id, model]) => ({
    id,
    name: model.name,
    kind: model.type || 'tank',
    canMove: model.canMove ?? true,
    bodyColor: model.color || '#d45745',
    cabColor: model.accent || '#f2b36f',
    body: clonePoints(model.body),
    cab: clonePoints(model.cab),
    cannonPivot: { ...model.cannonPivot },
    cannon: {
      style: model.cannon?.style || 'oneSide',
      minAngle: model.cannon?.minAngle ?? 5,
      maxAngle: model.cannon?.maxAngle ?? 175,
      flipPastEdge: model.cannon?.flipPastEdge ?? false
    }
  }));
}

function normalizeTankDesignerItem(model, index) {
  return {
    id: model.id || `savedTank${index}`,
    name: model.name || 'Unnamed Model',
    kind: model.kind === 'turret' ? 'turret' : 'tank',
    canMove: model.kind === 'turret' ? false : Boolean(model.canMove ?? true),
    bodyColor: model.bodyColor || '#d45745',
    cabColor: model.cabColor || '#f2b36f',
    body: normalizePoints(model.body),
    cab: normalizePoints(model.cab),
    cannonPivot: {
      x: Number(model.cannonPivot?.x ?? 0),
      y: Number(model.cannonPivot?.y ?? -24)
    },
    cannon: {
      style: model.cannon?.style === 'topArc' ? 'topArc' : 'oneSide',
      minAngle: clampNumber(Number(model.cannon?.minAngle ?? 5), 0, 180),
      maxAngle: clampNumber(Number(model.cannon?.maxAngle ?? 175), 0, 180),
      flipPastEdge: Boolean(model.cannon?.flipPastEdge)
    }
  };
}

function selectedTankDesignerItem() {
  return tankDesignerItems.find((item) => item.id === selectedTankDesignerId) || tankDesignerItems[0];
}

function renderTankDesigner() {
  renderTankDesignerList();
  renderTankDesignerDetails();
}

function renderTankDesignerList() {
  tankDesignerList.textContent = '';

  for (const model of tankDesignerItems) {
    const button = document.createElement('button');
    button.className = 'designer-list-item';
    button.classList.toggle('is-selected', model.id === selectedTankDesignerId);
    button.type = 'button';

    const swatch = document.createElement('span');
    swatch.className = 'tank-list-swatch';
    swatch.style.background = model.bodyColor;

    const name = document.createElement('strong');
    name.textContent = model.name || 'Unnamed Model';

    const kind = document.createElement('small');
    kind.textContent = model.kind === 'turret' ? 'Turret' : 'Tank';

    button.append(swatch, name, kind);
    button.addEventListener('click', () => {
      selectedTankDesignerId = model.id;
      saveDesignerState();
      renderTankDesigner();
    });

    tankDesignerList.append(button);
  }
}

function renderTankDesignerDetails() {
  const model = selectedTankDesignerItem();

  if (!model) {
    return;
  }

  tankFields.name.value = model.name;
  tankFields.kind.value = model.kind;
  tankFields.bodyColor.value = model.bodyColor;
  tankFields.cabColor.value = model.cabColor;
  tankFields.canMove.checked = model.canMove;
  tankFields.flipPastEdge.checked = model.cannon.flipPastEdge;
  tankFields.cannonStyle.value = model.cannon.style;
  tankFields.minAngle.value = model.cannon.minAngle;
  tankFields.maxAngle.value = model.cannon.maxAngle;
  tankFields.pivotX.value = model.cannonPivot.x;
  tankFields.pivotY.value = model.cannonPivot.y;
  tankFields.bodyPoints.value = formatPoints(model.body);
  tankFields.cabPoints.value = formatPoints(model.cab);

  drawTankDesignerPreview(model);
}

function updateSelectedTankFromFields() {
  const model = selectedTankDesignerItem();

  if (!model) {
    return;
  }

  const parsedBody = parsePointList(tankFields.bodyPoints.value, model.body);
  const parsedCab = parsePointList(tankFields.cabPoints.value, model.cab);
  tankFields.bodyPoints.classList.toggle('has-error', !parsedBody.ok);
  tankFields.cabPoints.classList.toggle('has-error', !parsedCab.ok);

  model.name = tankFields.name.value.trim() || 'Unnamed Model';
  model.kind = tankFields.kind.value;
  model.canMove = tankFields.canMove.checked;
  model.bodyColor = tankFields.bodyColor.value;
  model.cabColor = tankFields.cabColor.value;
  model.body = parsedBody.points;
  model.cab = parsedCab.points;
  model.cannonPivot = {
    x: Number(tankFields.pivotX.value || 0),
    y: Number(tankFields.pivotY.value || 0)
  };
  model.cannon = {
    style: tankFields.cannonStyle.value,
    minAngle: clampNumber(Number(tankFields.minAngle.value || 0), 0, 180),
    maxAngle: clampNumber(Number(tankFields.maxAngle.value || 180), 0, 180),
    flipPastEdge: tankFields.flipPastEdge.checked
  };

  if (model.kind === 'turret') {
    model.canMove = false;
    tankFields.canMove.checked = false;
  }

  renderTankDesignerList();
  drawTankDesignerPreview(model);
  saveDesignerState();
}

function addNewTankDesignerItem(kind) {
  const isTurret = kind === 'turret';
  const number = tankDesignerItems.length + 1;
  const newModel = {
    id: `custom${isTurret ? 'Turret' : 'Tank'}${Date.now()}`,
    name: `New ${isTurret ? 'Turret' : 'Tank'} ${number}`,
    kind: isTurret ? 'turret' : 'tank',
    canMove: !isTurret,
    bodyColor: isTurret ? '#6f756d' : '#8f4d3d',
    cabColor: isTurret ? '#b7a15a' : '#d0a36f',
    body: isTurret
      ? [{ x: -16, y: 0 }, { x: -12, y: -16 }, { x: 12, y: -16 }, { x: 16, y: 0 }]
      : [{ x: -22, y: 0 }, { x: -18, y: -12 }, { x: 18, y: -12 }, { x: 22, y: 0 }],
    cab: isTurret
      ? [{ x: -8, y: -16 }, { x: -5, y: -28 }, { x: 5, y: -28 }, { x: 8, y: -16 }]
      : [{ x: -8, y: -12 }, { x: -4, y: -24 }, { x: 10, y: -24 }, { x: 14, y: -12 }],
    cannonPivot: isTurret ? { x: 0, y: -28 } : { x: 6, y: -24 },
    cannon: {
      style: isTurret ? 'topArc' : 'oneSide',
      minAngle: isTurret ? 0 : 5,
      maxAngle: isTurret ? 180 : 175,
      flipPastEdge: false
    }
  };

  tankDesignerItems = [...tankDesignerItems, newModel];
  selectedTankDesignerId = newModel.id;
  saveDesignerState();
  renderTankDesigner();
}

function drawTankDesignerPreview(model) {
  const ctx = tankPreview.canvas.getContext('2d');
  const width = tankPreview.canvas.width;
  const height = tankPreview.canvas.height;
  const origin = { x: width / 2, y: height - 46 };
  const scale = 4;
  const minAngle = Math.min(model.cannon.minAngle, model.cannon.maxAngle);
  const maxAngle = Math.max(model.cannon.minAngle, model.cannon.maxAngle);
  const previewAngle = (minAngle + maxAngle) / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#101315';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#31462f';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(24, origin.y);
  ctx.lineTo(width - 24, origin.y);
  ctx.stroke();

  drawPreviewArc(ctx, origin, scale, minAngle, maxAngle);
  drawPreviewPolygon(ctx, origin, scale, model.body, model.bodyColor);
  drawPreviewPolygon(ctx, origin, scale, model.cab, model.cabColor);

  const pivot = {
    x: origin.x + model.cannonPivot.x * scale,
    y: origin.y + model.cannonPivot.y * scale
  };
  const radians = (previewAngle * Math.PI) / 180;
  const tip = {
    x: pivot.x + Math.cos(radians) * 76,
    y: pivot.y - Math.sin(radians) * 76
  };

  ctx.strokeStyle = '#22252d';
  ctx.lineWidth = 10;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  ctx.fillStyle = '#ece7db';
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, 6, 0, Math.PI * 2);
  ctx.fill();

  tankPreview.name.textContent = model.name || 'Unnamed Model';
  tankPreview.stats.textContent = `${model.kind === 'turret' ? 'Turret' : 'Tank'} | ${model.canMove ? 'moves' : 'fixed'} | cannon ${minAngle}-${maxAngle} deg`;
}

function drawPreviewPolygon(ctx, origin, scale, points, fillStyle) {
  if (points.length === 0) {
    return;
  }

  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.moveTo(origin.x + points[0].x * scale, origin.y + points[0].y * scale);

  for (let index = 1; index < points.length; index++) {
    ctx.lineTo(origin.x + points[index].x * scale, origin.y + points[index].y * scale);
  }

  ctx.closePath();
  ctx.fill();
}

function drawPreviewArc(ctx, origin, scale, minAngle, maxAngle) {
  ctx.strokeStyle = 'rgba(183, 161, 90, 0.44)';
  ctx.lineWidth = 2;
  ctx.beginPath();

  for (let angle = minAngle; angle <= maxAngle; angle += 3) {
    const radians = (angle * Math.PI) / 180;
    const x = origin.x + Math.cos(radians) * 24 * scale;
    const y = origin.y - Math.sin(radians) * 24 * scale;

    if (angle === minAngle) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();
}

function clonePoints(points) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function normalizePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

function formatPoints(points) {
  // This format matches tankModels.js closely enough that it can be copied
  // into the source file when a design is ready.
  return `[\n${points.map((point) => `  { "x": ${point.x}, "y": ${point.y} }`).join(',\n')}\n]`;
}

function parsePointList(text, fallbackPoints) {
  try {
    const points = JSON.parse(text);

    if (!Array.isArray(points)) {
      return { ok: false, points: fallbackPoints };
    }

    const parsed = points.map((point) => ({
      x: Number(point.x),
      y: Number(point.y)
    }));

    if (parsed.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
      return { ok: false, points: fallbackPoints };
    }

    return { ok: true, points: parsed };
  } catch {
    return { ok: false, points: fallbackPoints };
  }
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createAmmoDesignerItems(savedState) {
  if (Array.isArray(savedState?.ammoDesignerItems) && savedState.ammoDesignerItems.length > 0) {
    return savedState.ammoDesignerItems.map(normalizeAmmoDesignerItem);
  }

  // The designer starts from real ammo data, then lets the player experiment
  // safely in memory. Later we can decide how to save these edits.
  return Object.entries(ITEM_TYPES)
    .filter(([, item]) => item.kind === 'ammo')
    .map(([id, item]) => ({
      id,
      name: item.name,
      icon: item.icon,
      shotColor: item.shotColor || '#20272d',
      hitColor: item.hitColor || '#ff3b2f',
      missColor: item.missColor || '#ff8c2a',
      explosionSize: item.blastRadius || 40,
      divotSize: item.terrainDamage ?? 1,
      damage: item.damage || 20,
      inventoryCount: item.count === Infinity ? 'Infinity' : String(item.count ?? 3),
      price: item.price ?? suggestedAmmoPrice(item)
    }));
}

function normalizeAmmoDesignerItem(ammo, index) {
  return {
    id: ammo.id || `savedAmmo${index}`,
    name: ammo.name || 'Unnamed Ammo',
    icon: String(ammo.icon || '?').slice(0, 2),
    shotColor: ammo.shotColor || '#20272d',
    hitColor: ammo.hitColor || '#ff3b2f',
    missColor: ammo.missColor || '#ff8c2a',
    explosionSize: Number(ammo.explosionSize || 40),
    divotSize: Number(ammo.divotSize ?? 1),
    damage: Number(ammo.damage || 20),
    inventoryCount: ammo.inventoryCount === 'Infinity' ? 'Infinity' : String(ammo.inventoryCount ?? 3),
    price: Number(ammo.price || 0)
  };
}

function selectedAmmoDesignerItem() {
  return ammoDesignerItems.find((item) => item.id === selectedAmmoDesignerId) || ammoDesignerItems[0];
}

function renderAmmoDesigner() {
  renderAmmoDesignerList();
  renderAmmoDesignerDetails();
}

function renderAmmoDesignerList() {
  ammoDesignerList.textContent = '';

  for (const ammo of ammoDesignerItems) {
    const button = document.createElement('button');
    button.className = 'ammo-list-item';
    button.classList.toggle('is-selected', ammo.id === selectedAmmoDesignerId);
    button.type = 'button';

    const icon = document.createElement('span');
    icon.className = 'ammo-list-icon';
    icon.textContent = ammo.icon || '?';

    const name = document.createElement('strong');
    name.textContent = ammo.name || 'Unnamed Ammo';

    const price = document.createElement('small');
    price.textContent = `$${ammo.price || 0}`;

    button.append(icon, name, price);
    button.addEventListener('click', () => {
      selectedAmmoDesignerId = ammo.id;
      saveDesignerState();
      renderAmmoDesigner();
    });

    ammoDesignerList.append(button);
  }
}

function renderAmmoDesignerDetails() {
  const ammo = selectedAmmoDesignerItem();

  if (!ammo) {
    return;
  }

  ammoFields.name.value = ammo.name;
  ammoFields.icon.value = ammo.icon;
  ammoFields.shotColor.value = ammo.shotColor;
  ammoFields.hitColor.value = ammo.hitColor;
  ammoFields.missColor.value = ammo.missColor;
  ammoFields.explosionSize.value = ammo.explosionSize;
  ammoFields.divotSize.value = ammo.divotSize;
  ammoFields.damage.value = ammo.damage;
  ammoFields.inventoryCount.value = ammo.inventoryCount;
  ammoFields.price.value = ammo.price;

  updateAmmoPreview(ammo);
}

function updateSelectedAmmoFromFields() {
  const ammo = selectedAmmoDesignerItem();

  if (!ammo) {
    return;
  }

  ammo.name = ammoFields.name.value.trim() || 'Unnamed Ammo';
  ammo.icon = ammoFields.icon.value.trim().toUpperCase().slice(0, 2) || '?';
  ammo.shotColor = ammoFields.shotColor.value;
  ammo.hitColor = ammoFields.hitColor.value;
  ammo.missColor = ammoFields.missColor.value;
  ammo.explosionSize = Number(ammoFields.explosionSize.value);
  ammo.divotSize = Number(ammoFields.divotSize.value);
  ammo.damage = Number(ammoFields.damage.value || 0);
  ammo.inventoryCount = ammoFields.inventoryCount.value;
  ammo.price = Number(ammoFields.price.value || 0);

  renderAmmoDesignerList();
  updateAmmoPreview(ammo);
  saveDesignerState();
}

function updateAmmoPreview(ammo) {
  const explosionPreviewSize = Math.round(ammo.explosionSize * 0.72);
  const missPreviewSize = Math.max(16, explosionPreviewSize - 10);
  const divotPreviewWidth = Math.max(14, Math.round(ammo.divotSize * 22));

  ammoPreview.icon.textContent = ammo.icon || '?';
  ammoPreview.icon.style.background = ammo.shotColor;
  ammoPreview.name.textContent = ammo.name || 'Unnamed Ammo';
  ammoPreview.stats.textContent = `Damage ${ammo.damage}, explosion ${ammo.explosionSize}, divot ${ammo.divotSize.toFixed(1)}, ${inventoryLabel(ammo.inventoryCount)}, $${ammo.price}`;
  ammoPreview.hit.style.width = `${explosionPreviewSize}px`;
  ammoPreview.hit.style.height = `${explosionPreviewSize}px`;
  ammoPreview.hit.style.background = ammo.hitColor;
  ammoPreview.miss.style.width = `${missPreviewSize}px`;
  ammoPreview.miss.style.height = `${missPreviewSize}px`;
  ammoPreview.miss.style.background = ammo.missColor;
  ammoPreview.divot.style.width = `${divotPreviewWidth}px`;
}

function addNewAmmoDesignerItem() {
  const number = ammoDesignerItems.length + 1;
  const newAmmo = {
    id: `customAmmo${Date.now()}`,
    name: `New Ammo ${number}`,
    icon: 'N',
    shotColor: '#30383d',
    hitColor: '#ff5f2e',
    missColor: '#d9a441',
    explosionSize: 40,
    divotSize: 0.8,
    damage: 20,
    inventoryCount: '3',
    price: 25
  };

  ammoDesignerItems = [...ammoDesignerItems, newAmmo];
  selectedAmmoDesignerId = newAmmo.id;
  saveDesignerState();
  renderAmmoDesigner();
}

function inventoryLabel(count) {
  return count === 'Infinity' ? 'infinite shots' : `${count} shots`;
}

function suggestedAmmoPrice(item) {
  return Math.round((item.damage || 0) + (item.blastRadius || 0) / 2 + (item.terrainDamage || 0) * 8);
}

function selectDesignerTab(tabName) {
  designerTabs.forEach((tab) => {
    tab.classList.toggle('is-selected', tab.dataset.designerTab === tabName);
  });

  designerPanels.forEach((panel) => {
    panel.classList.toggle('is-selected', panel.dataset.designerPanel === tabName);
  });

  if (tabName === 'ammo') {
    renderAmmoDesigner();
  } else if (tabName === 'tank') {
    renderTankDesigner();
  }
}

game.setInventoryChangeHandler(() => {
  // ScorchedGame calls this after ammo is selected, used, added, or removed.
  // Keeping the render call here prevents duplicate quickbar redraws.
  renderQuickbar();

  if (inventoryModal.open) {
    renderInventory();
  }
});

renderQuickbar();
renderTankDesigner();
renderAmmoDesigner();

addUiListener(newTankButton, 'click', () => addNewTankDesignerItem('tank'));
addUiListener(newTurretButton, 'click', () => addNewTankDesignerItem('turret'));
addUiListener(newAmmoButton, 'click', addNewAmmoDesignerItem);

Object.values(tankFields).forEach((field) => {
  addUiListener(field, 'input', updateSelectedTankFromFields);
  addUiListener(field, 'change', updateSelectedTankFromFields);
});

Object.values(ammoFields).forEach((field) => {
  addUiListener(field, 'input', updateSelectedAmmoFromFields);
  addUiListener(field, 'change', updateSelectedAmmoFromFields);
});

designerTabs.forEach((tab) => {
  addUiListener(tab, 'click', () => {
    selectDesignerTab(tab.dataset.designerTab);
  });
});

addUiListener(window, 'keydown', (event) => {
  // These are UI shortcuts, not tank controls:
  // I opens inventory, and number keys select quickbar slots.
  if (isUiInputTarget(event.target)) {
    return;
  }

  if (event.code === 'KeyI') {
    event.preventDefault();
    openInventory();
    return;
  }

  if (!event.code.startsWith('Digit')) {
    return;
  }

  const digit = Number(event.code.replace('Digit', ''));
  const slotIndex = digit === 0 ? 9 : digit - 1;

  if (inventoryModal.open && hoveredInventoryItemId) {
    event.preventDefault();
    game.assignQuickbarSlot(hoveredInventoryItemId, slotIndex);
    return;
  }

  game.selectQuickbarSlot(slotIndex);
});

document.querySelectorAll('[data-modal-target]').forEach((button) => {
  addUiListener(button, 'click', () => {
    const modal = document.querySelector(`#${button.dataset.modalTarget}`);

    if (modal?.showModal) {
      if (modal === designerModal) {
        renderTankDesigner();
        renderAmmoDesigner();
      }

      modal.showModal();
    }
  });
});

window.tanksUiCleanup = () => {
  uiCleanupHandlers.forEach((cleanup) => cleanup());
  uiCleanupHandlers.length = 0;
};

function isUiInputTarget(target) {
  // Let form controls receive their own keys.
  // This keeps typing "wasd" in a designer text box from moving the cannon,
  // and keeps number fields from changing the quickbar.
  if (!target) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON';
}
