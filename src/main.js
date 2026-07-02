import { ScorchedGame } from './game/ScorchedGame.js';
import { describeItem, ITEM_TYPES } from './game/itemTypes.js';
import { TANK_MODELS } from './game/tankModels.js';
import { MultiplayerClient } from './network/multiplayerClient.js';

const canvas = document.querySelector('#game');
const hud = {
  status: document.querySelector('#status'),
  roundNumber: document.querySelector('#roundNumber'),
  matchRounds: document.querySelector('#matchRounds'),
  turnNumber: document.querySelector('#turnNumber'),
  scorePlayerOneName: document.querySelector('#scorePlayerOneName'),
  scorePlayerOneWins: document.querySelector('#scorePlayerOneWins'),
  scorePlayerTwoName: document.querySelector('#scorePlayerTwoName'),
  scorePlayerTwoWins: document.querySelector('#scorePlayerTwoWins'),
  playerPanel: document.querySelector('#playerPanel'),
  playerName: document.querySelector('#playerName'),
  tankHudPreview: document.querySelector('#tankHudPreview'),
  health: document.querySelector('#health'),
  healthFill: document.querySelector('#healthFill'),
  controlMode: document.querySelector('#controlMode'),
  moveFuel: document.querySelector('#moveFuel'),
  fuelFill: document.querySelector('#fuelFill'),
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

const setupView = document.querySelector('#setupView');
const gameView = document.querySelector('#gameView');
const showSetupButton = document.querySelector('#showSetupButton');
const setupModeTabs = document.querySelectorAll('[data-setup-mode]');
const setupPanels = document.querySelectorAll('[data-setup-panel]');
const setupLanSections = document.querySelectorAll('[data-setup-lan-section]');
const setupNetworkSections = document.querySelectorAll('[data-setup-network-section]');
const setupLocalSections = document.querySelectorAll('[data-setup-local-section]');
const setupModeNote = document.querySelector('#setupModeNote');
const startNewGameButton = document.querySelector('#startNewGameButton');
const nextRoundButton = document.querySelector('#nextRoundButton');
const matchRoundsInput = document.querySelector('#matchRoundsInput');
const landscapeInput = document.querySelector('#landscapeInput');
const waterEnabledInput = document.querySelector('#waterEnabledInput');
const waterLevelInput = document.querySelector('#waterLevelInput');
const waterRiseInput = document.querySelector('#waterRiseInput');
const quickbar = document.querySelector('#quickbar');
const inventoryModal = document.querySelector('#inventoryModal');
const inventoryList = document.querySelector('#inventoryList');
const multiplayerElements = {
  status: document.querySelector('#multiplayerStatus'),
  hostAddress: document.querySelector('#multiplayerHostAddress'),
  roomHint: document.querySelector('#multiplayerRoomHint'),
  nameInput: document.querySelector('#multiplayerNameInput'),
  tankInput: document.querySelector('#multiplayerTankInput'),
  colorInput: document.querySelector('#multiplayerColorInput'),
  setupMode: () => setupMode,
  createButton: document.querySelector('#createRoomButton'),
  joinButton: document.querySelector('#joinRoomButton'),
  leaveButton: document.querySelector('#leaveRoomButton'),
  playerSlotsInput: document.querySelector('#multiplayerPlayerSlotsInput'),
  aiSlotsInput: document.querySelector('#multiplayerAiSlotsInput'),
  applySettingsButton: document.querySelector('#multiplayerApplySettingsButton'),
  slotList: document.querySelector('#multiplayerSlotList'),
  readyButton: document.querySelector('#multiplayerReadyButton'),
  pauseButton: document.querySelector('#gamePauseButton'),
  startButton: document.querySelector('#multiplayerStartButton'),
  copyHostAddressButton: document.querySelector('#copyHostAddressButton')
};
const playerFields = {
  oneName: document.querySelector('#playerOneNameInput'),
  oneTank: document.querySelector('#playerOneTankInput'),
  oneColor: document.querySelector('#playerOneColorInput'),
  twoName: document.querySelector('#playerTwoNameInput'),
  twoTank: document.querySelector('#playerTwoTankInput'),
  twoColor: document.querySelector('#playerTwoColorInput')
};
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
const PLAYER_SETUP_STORAGE_KEY = 'tanksPlayerSetup.v1';
const savedDesignerState = loadDesignerState();

let tankDesignerItems = createTankDesignerItems(savedDesignerState);
let selectedTankDesignerId = savedDesignerState?.selectedTankDesignerId || tankDesignerItems[0]?.id || null;
let ammoDesignerItems = createAmmoDesignerItems(savedDesignerState);
let selectedAmmoDesignerId = savedDesignerState?.selectedAmmoDesignerId || ammoDesignerItems[0]?.id || null;
let playerSetup = normalizePlayerSetup(loadPlayerSetup());
let hoveredInventoryItemId = null;
let setupMode = 'local';
let multiplayerClient = null;

if (!tankDesignerItems.some((item) => item.id === selectedTankDesignerId)) {
  selectedTankDesignerId = tankDesignerItems[0]?.id || null;
}

if (!ammoDesignerItems.some((item) => item.id === selectedAmmoDesignerId)) {
  selectedAmmoDesignerId = ammoDesignerItems[0]?.id || null;
}

playerSetup = resolvePlayerSetupTankIds(playerSetup);

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

// Attach one UI event listener and remember how to remove it later.
//
// This helps long dev sessions because old listeners can be cleaned up if the
// script is ever re-run.
function addUiListener(target, eventName, handler) {
  target.addEventListener(eventName, handler);
  uiCleanupHandlers.push(() => target.removeEventListener(eventName, handler));
}

// Open the inventory modal and refresh its contents first.
function openInventory() {
  renderInventory();

  if (!inventoryModal.open) {
    openCanvasCenteredModal(inventoryModal);
  }
}

// Start a local hot-seat game using the setup form.
function startNewGame() {
  updatePlayerSetupFromFields();
  startConfiguredGame(playerSetup);
}

// Start a match with a finished player setup.
//
// This is used by local play and by the LAN client after the server starts a
// network game.
function startConfiguredGame(setup) {
  playerSetup = resolvePlayerSetupTankIds(setup);
  game.startMatch(playerSetup, Number(matchRoundsInput.value || 1), landscapeInput.value, {
    enabled: waterEnabledInput.checked,
    levelPercent: Number(waterLevelInput.value || 0),
    risePerShot: Number(waterRiseInput.value || 0)
  });
  savePlayerSetup();
  renderQuickbar();
  showGameView();
}

// Move from a finished round into the next round of the same match.
function startNextRound() {
  game.reset();
  game.notifyInventoryChanged();
  game.updateHud();
  renderQuickbar();

  showGameView();
}

// Copy the current game settings back into the setup screen.
//
// This is useful when the player opens Game Setup from an active match.
function renderGameSetup() {
  renderPlayerSetup();
  landscapeInput.value = game.landscapeMode;
  waterEnabledInput.checked = game.waterEnabled;
  waterLevelInput.value = String(game.waterLevelPercent);
  waterRiseInput.value = String(game.waterRisePerShot);
  const canContinueMatch = game.roundOver && !game.isMatchComplete();
  nextRoundButton.hidden = !canContinueMatch;
}

// Hide setup and show the battlefield.
//
// Blurring the active element prevents Space from clicking a hidden setup
// button instead of firing the tank.
function showGameView() {
  // After clicking a setup button, focus can stay on that button even though
  // the battlefield is now visible. Blur it so Space/arrows go to the game.
  document.activeElement?.blur?.();
  setupView.classList.add('is-hidden');
  gameView.classList.remove('is-hidden');
}

// Hide the battlefield and show Game Setup.
function showSetupView() {
  renderGameSetup();
  setupView.classList.remove('is-hidden');
  gameView.classList.add('is-hidden');
}

// Switch between Local Game, Host LAN, and Join LAN setup panels.
//
// Each mode shows a different set of controls, but the match settings stay in
// the same place.
function selectSetupMode(mode) {
  setupMode = mode;
  setupModeTabs.forEach((tab) => {
    tab.classList.toggle('is-selected', tab.dataset.setupMode === mode);
  });
  setupPanels.forEach((panel) => {
    panel.classList.toggle('is-hidden', panel.dataset.setupPanel !== mode);
  });
  setupLanSections.forEach((section) => {
    section.classList.toggle('is-hidden', mode === 'local');
  });
  setupNetworkSections.forEach((section) => {
    section.classList.toggle('is-hidden', mode === 'local');
  });
  setupLocalSections.forEach((section) => {
    section.classList.toggle('is-hidden', mode !== 'local');
  });

  startNewGameButton.classList.toggle('is-hidden', mode !== 'local');
  multiplayerElements.startButton.classList.toggle('is-hidden', mode !== 'host');
  setupModeNote.textContent = mode === 'host'
    ? 'LAN room with future 2-6 player support'
    : mode === 'join'
      ? 'Join a host room on this network'
      : 'Local hot-seat game';

  if (mode === 'host' && multiplayerClient) {
    multiplayerClient.ensureHosting();
  }

  if (multiplayerClient) {
    multiplayerClient.render();
  }
}

// Rising Sea needs water and a nonzero rise amount to be interesting.
//
// This helper gently fills in those defaults when that landscape is selected.
function syncWaterDefaultsForLandscape() {
  if (landscapeInput.value !== 'risingSea') {
    multiplayerClient?.publishSettings();
    return;
  }

  waterEnabledInput.checked = true;

  if (Number(waterRiseInput.value || 0) === 0) {
    waterRiseInput.value = '6';
  }

  multiplayerClient?.publishSettings();
}

// Read match settings from the setup form.
function currentMatchSettings() {
  return {
    matchRounds: Number(matchRoundsInput.value || 1),
    landscapeMode: landscapeInput.value,
    waterEnabled: waterEnabledInput.checked,
    waterLevelPercent: Number(waterLevelInput.value || 0),
    waterRisePerShot: Number(waterRiseInput.value || 0)
  };
}

// Apply host match settings on a joining browser.
//
// Joining players should see the same rounds, landscape, and water settings as
// the host.
function applyNetworkMatchSettings(settings) {
  if (!settings) {
    return;
  }

  matchRoundsInput.value = String(settings.matchRounds ?? 3);
  landscapeInput.value = settings.landscapeMode || 'cycle';
  waterEnabledInput.checked = Boolean(settings.waterEnabled);
  waterLevelInput.value = String(settings.waterLevelPercent ?? 18);
  waterRiseInput.value = String(settings.waterRisePerShot ?? 0);
}

// Open a dialog centered over the canvas or setup shell.
function openCanvasCenteredModal(modal) {
  centerModalOnCanvas(modal);
  modal.showModal();
}

// Position a modal over the game canvas.
//
// During setup the canvas is hidden, so the setup shell becomes the anchor.
function centerModalOnCanvas(modal) {
  // During play, center modals over the canvas. During setup, the canvas is
  // hidden, so center over the setup shell instead.
  const anchor = gameView.classList.contains('is-hidden')
    ? document.querySelector('.setup-shell')
    : canvas;
  const anchorRect = anchor.getBoundingClientRect();
  modal.style.setProperty('--modal-left', `${anchorRect.left + anchorRect.width / 2}px`);
  modal.style.setProperty('--modal-top', `${anchorRect.top + anchorRect.height / 2}px`);
}

// Recenter any open dialogs after scrolling or resizing.
function centerOpenModalsOnCanvas() {
  document.querySelectorAll('dialog[open]').forEach(centerModalOnCanvas);
}

// Convert a quickbar slot index into the key shown on the button.
//
// Slot 9 displays as 0, like many game hotbars.
function hotkeyForSlot(index) {
  const number = index + 1;
  return number === 10 ? '0' : String(number);
}

// Draw the bottom quickbar.
//
// The quickbar shows inventory, selected ammo/tools, and the number keys used
// to choose each slot.
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
        <span class="quickbar-tooltip">${describeItem(slot.itemId, game.itemTypes)}</span>
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

// Draw the inventory modal.
//
// The inventory lets players purchase/sell items and assign hovered items to
// quickbar slots with number keys.
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
        <small>${describeItem(inventoryItem.itemId, game.itemTypes)}</small>
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

// Load saved local player setup from localStorage.
//
// If nothing has been saved yet, return null and let defaults take over.
function loadPlayerSetup() {
  try {
    const savedText = localStorage.getItem(PLAYER_SETUP_STORAGE_KEY);
    return savedText ? JSON.parse(savedText) : null;
  } catch {
    return null;
  }
}

// Save local player names, colors, and tank choices.
function savePlayerSetup() {
  try {
    localStorage.setItem(PLAYER_SETUP_STORAGE_KEY, JSON.stringify(playerSetup));
  } catch {
    // Player setup is convenient, but the game should still run without it.
  }
}

// Turn possibly-missing saved setup into two complete player objects.
//
// This keeps older saved data from breaking after we add new fields.
function normalizePlayerSetup(savedSetup) {
  const setup = Array.isArray(savedSetup) ? savedSetup : [];

  return [
    {
      name: setup[0]?.name || 'Player 1',
      modelId: setup[0]?.modelId || 'p1Custom',
      color: setup[0]?.color || '#d45745'
    },
    {
      name: setup[1]?.name || 'Player 2',
      modelId: setup[1]?.modelId || 'p2Custom',
      color: setup[1]?.color || '#4d8ad8'
    }
  ];
}

// Make sure every selected tank id still exists.
//
// If a model was deleted or renamed, fall back to a valid tank.
function resolvePlayerSetupTankIds(setup) {
  const availableIds = new Set(tankDesignerItems.map((model) => model.id));
  const fallbackIds = tankDesignerItems.map((model) => model.id);

  return setup.map((player, index) => ({
    name: player.name || `Player ${index + 1}`,
    modelId: availableIds.has(player.modelId) ? player.modelId : fallbackIds[index] || fallbackIds[0],
    color: player.color || (index === 0 ? '#d45745' : '#4d8ad8')
  }));
}

// Fill the setup form with current player names, colors, and tank options.
function renderPlayerSetup() {
  playerSetup = resolvePlayerSetupTankIds(playerSetup);

  matchRoundsInput.value = String(game.matchRounds);
  playerFields.oneName.value = playerSetup[0].name;
  playerFields.twoName.value = playerSetup[1].name;
  playerFields.oneColor.value = playerSetup[0].color;
  playerFields.twoColor.value = playerSetup[1].color;
  renderTankSelect(playerFields.oneTank, playerSetup[0].modelId);
  renderTankSelect(playerFields.twoTank, playerSetup[1].modelId);
  renderTankSelect(multiplayerElements.tankInput, multiplayerElements.tankInput.value || playerSetup[0].modelId);
}

// Rebuild one tank dropdown from the current tank library.
function renderTankSelect(select, selectedModelId) {
  select.textContent = '';

  for (const model of tankDesignerItems) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name || 'Unnamed Model';
    option.selected = model.id === selectedModelId;
    select.append(option);
  }
}

// Read the local player setup form back into playerSetup.
function updatePlayerSetupFromFields() {
  playerSetup = resolvePlayerSetupTankIds([
    {
      name: playerFields.oneName.value.trim() || 'Player 1',
      modelId: playerFields.oneTank.value,
      color: playerFields.oneColor.value
    },
    {
      name: playerFields.twoName.value.trim() || 'Player 2',
      modelId: playerFields.twoTank.value,
      color: playerFields.twoColor.value
    }
  ]);

  savePlayerSetup();
}

// Convert Tank Designer data into ScorchedGame tank models.
//
// This is the bridge between designer UI data and actual gameplay data.
function applyTankLibraryToGame(forcePlayerSetup = false, options = {}) {
  const { publish = true } = options;
  game.setTankModels(buildGameTankModels());
  const resolvedSetup = resolvePlayerSetupTankIds(playerSetup);
  const setupChanged = playerSetup.some((player, index) => (
    player.modelId !== resolvedSetup[index].modelId ||
    player.name !== resolvedSetup[index].name ||
    player.color !== resolvedSetup[index].color
  ));
  playerSetup = resolvedSetup;

  if (forcePlayerSetup || setupChanged) {
    savePlayerSetup();
    game.setPlayerSetup(playerSetup);
  }

  renderPlayerSetup();
  renderQuickbar();

  if (publish) {
    multiplayerClient?.publishLibrary();
  }
}

// Convert Ammo Designer data into ScorchedGame item/ammo data.
function applyItemLibraryToGame(options = {}) {
  const { publish = true } = options;
  game.setItemTypes(buildGameItemTypes());
  renderQuickbar();

  if (publish) {
    multiplayerClient?.publishLibrary();
  }
}

// Bundle the current tank and ammo designer data for LAN sharing.
function currentDesignerLibrary() {
  return {
    tankDesignerItems,
    selectedTankDesignerId,
    ammoDesignerItems,
    selectedAmmoDesignerId
  };
}

// Apply the host's designer library on a joining browser.
//
// This is why LAN joiners can choose custom host tanks and ammo.
function applyNetworkDesignerLibrary(library) {
  if (!library) {
    return;
  }

  if (Array.isArray(library.tankDesignerItems) && library.tankDesignerItems.length > 0) {
    tankDesignerItems = library.tankDesignerItems.map(normalizeTankDesignerItem);
    selectedTankDesignerId = library.selectedTankDesignerId;

    if (!tankDesignerItems.some((item) => item.id === selectedTankDesignerId)) {
      selectedTankDesignerId = tankDesignerItems[0]?.id || null;
    }
  }

  if (Array.isArray(library.ammoDesignerItems) && library.ammoDesignerItems.length > 0) {
    ammoDesignerItems = library.ammoDesignerItems.map(normalizeAmmoDesignerItem);
    selectedAmmoDesignerId = library.selectedAmmoDesignerId;

    if (!ammoDesignerItems.some((item) => item.id === selectedAmmoDesignerId)) {
      selectedAmmoDesignerId = ammoDesignerItems[0]?.id || null;
    }
  }

  applyTankLibraryToGame(false, { publish: false });
  applyItemLibraryToGame({ publish: false });
  renderTankDesigner();
  renderAmmoDesigner();
}

// Build the object shape ScorchedGame expects for tank models.
//
// Designer items are stored as an array for the UI, but the game wants an
// object keyed by model id.
function buildGameTankModels() {
  return Object.fromEntries(tankDesignerItems.map((model) => [model.id, designerTankToGameModel(model)]));
}

// Build the object shape ScorchedGame expects for item/ammo types.
//
// Non-ammo starter tools are kept, while ammo comes from the Ammo Designer.
function buildGameItemTypes() {
  const nonAmmoItems = Object.fromEntries(
    Object.entries(ITEM_TYPES).filter(([, item]) => item.kind !== 'ammo')
  );
  const designerAmmoItems = Object.fromEntries(
    ammoDesignerItems.map((ammo) => [ammo.id, designerAmmoToGameItem(ammo)])
  );

  return {
    ...designerAmmoItems,
    ...nonAmmoItems
  };
}

// Convert one Ammo Designer row into one real gameplay item.
//
// Daniel task:
// The designer has explosionSize and divotSize sliders. Two lines below are
// intentionally left simple so Daniel can wire those sliders into real crater
// behavior.
function designerAmmoToGameItem(ammo) {
  const startingCount = ammo.inventoryCount === 'Infinity'
    ? Infinity
    : Math.max(0, Math.round(Number(ammo.inventoryCount || 0)));

  return {
    name: ammo.name || 'Unnamed Ammo',
    kind: 'ammo',
    icon: ammo.icon || '?',
    count: startingCount,
    projectileRadius: Math.max(3, Math.round(ammo.explosionSize / 12)),
    shotColor: ammo.shotColor,
    hitColor: ammo.hitColor,
    missColor: ammo.missColor,
    damage: Math.max(0, Math.round(ammo.damage || 0)),

    // DANIEL AMMO DESIGNER TASK:
    // These two fixed numbers are intentionally wrong-ish.
    // The sliders in the Ammo Designer already change ammo.explosionSize and
    // ammo.divotSize. Daniel's job will be to connect those slider values to
    // blastRadius and terrainDamage so the real shot matches the preview.
    blastRadius: 40,
    terrainDamage: 1,

    speedMultiplier: 1,
    windMultiplier: 1,
    price: Math.max(0, Math.round(ammo.price || 0)),
    description: `${ammo.name || 'Unnamed Ammo'} from the Ammo Designer.`
  };
}

// Convert one Tank Designer row into one real gameplay tank model.
//
// The UI says bodyColor/cabColor, while the game uses color/accent.
function designerTankToGameModel(model) {
  return {
    name: model.name || 'Unnamed Model',
    type: model.kind,
    canMove: model.canMove,
    color: model.bodyColor,
    accent: model.cabColor,
    body: clonePoints(model.body),
    cab: clonePoints(model.cab),
    cannonPivot: { ...model.cannonPivot },
    cannon: { ...model.cannon },
    collision: collisionFromPoints([...model.body, ...model.cab])
  };
}

// Estimate a simple rectangle hit box from polygon points.
//
// A real polygon hit test would be harder. This gives us a useful first
// collision box that Daniel can tune later.
function collisionFromPoints(points) {
  if (!points.length) {
    return { width: 32, height: 24 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const width = Math.max(12, Math.max(...xs) - Math.min(...xs) + 4);
  const height = Math.max(12, Math.max(...ys) - Math.min(...ys) + 4);
  return { width, height };
}

// Load saved Tank/Ammo Designer data from localStorage.
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

// Save Tank/Ammo Designer data to localStorage.
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

// Create the Tank Designer list.
//
// Saved models win. If there is no save yet, start from tankModels.js.
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
    canMove: (model.type || 'tank') === 'tank',
    bodyColor: model.color || '#d45745',
    cabColor: model.accent || '#f2b36f',
    body: clonePoints(model.body),
    cab: clonePoints(model.cab),
    cannonPivot: { ...model.cannonPivot },
    cannon: {
      style: model.cannon?.style || 'oneSide',
      minAngle: model.cannon?.minAngle ?? 5,
      maxAngle: model.cannon?.maxAngle ?? 175,
      flipPastEdge: (model.type || 'tank') === 'tank'
    }
  }));
}

// Make sure one tank designer item has every field the UI expects.
function normalizeTankDesignerItem(model, index) {
  const kind = model.kind === 'turret' ? 'turret' : 'tank';

  return {
    id: model.id || `savedTank${index}`,
    name: model.name || 'Unnamed Model',
    kind,
    canMove: kind === 'tank',
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
      minAngle: clampNumber(Number(model.cannon?.minAngle ?? 5), -180, 180),
      maxAngle: clampNumber(Number(model.cannon?.maxAngle ?? 175), -180, 180),
      flipPastEdge: kind === 'tank'
    }
  };
}

// Return the currently selected tank designer item.
function selectedTankDesignerItem() {
  return tankDesignerItems.find((item) => item.id === selectedTankDesignerId) || tankDesignerItems[0];
}

// Redraw the whole Tank Designer tab.
function renderTankDesigner() {
  renderTankDesignerList();
  renderTankDesignerDetails();
}

// Draw the left-side list of tank/turret models.
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

// Fill the right-side Tank Designer fields for the selected model.
function renderTankDesignerDetails() {
  const model = selectedTankDesignerItem();

  if (!model) {
    return;
  }

  tankFields.name.value = model.name;
  tankFields.kind.value = model.kind;
  tankFields.bodyColor.value = model.bodyColor;
  tankFields.cabColor.value = model.cabColor;
  tankFields.cannonStyle.value = model.cannon.style;
  tankFields.minAngle.value = model.cannon.minAngle;
  tankFields.maxAngle.value = model.cannon.maxAngle;
  tankFields.pivotX.value = model.cannonPivot.x;
  tankFields.pivotY.value = model.cannonPivot.y;
  tankFields.bodyPoints.value = formatPoints(model.body);
  tankFields.cabPoints.value = formatPoints(model.cab);

  drawTankDesignerPreview(model);
}

// Copy field values back into the selected tank designer item.
//
// This runs whenever a tank designer input changes.
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
  model.canMove = model.kind === 'tank';
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
    minAngle: clampNumber(Number(tankFields.minAngle.value || 0), -180, 180),
    maxAngle: clampNumber(Number(tankFields.maxAngle.value || 180), -180, 180),
    flipPastEdge: model.kind === 'tank'
  };

  renderTankDesignerList();
  drawTankDesignerPreview(model);
  saveDesignerState();
  applyTankLibraryToGame();
}

// Add a new blank-ish tank or turret to the Tank Designer list.
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
      minAngle: isTurret ? 0 : -15,
      maxAngle: isTurret ? 180 : 175,
      flipPastEdge: !isTurret
    }
  };

  tankDesignerItems = [...tankDesignerItems, newModel];
  selectedTankDesignerId = newModel.id;
  saveDesignerState();
  applyTankLibraryToGame();
  renderTankDesigner();
}

// Draw the Tank Designer preview canvas.
//
// The preview shows the body, cab, cannon pivot, cannon angle, and allowed arc
// so graph-paper points are easier to understand.
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

  const pivot = {
    x: origin.x + model.cannonPivot.x * scale,
    y: origin.y + model.cannonPivot.y * scale
  };
  const protractorRadius = Math.min(96, Math.max(58, distanceToCanvasEdge(pivot, width, height) - 12));
  const radians = (previewAngle * Math.PI) / 180;
  const tip = {
    x: pivot.x + Math.cos(radians) * 76,
    y: pivot.y - Math.sin(radians) * 76
  };

  drawPreviewProtractor(ctx, pivot, protractorRadius, minAngle, maxAngle);
  drawPreviewPolygon(ctx, origin, scale, model.body, model.bodyColor);
  drawPreviewPolygon(ctx, origin, scale, model.cab, model.cabColor);

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

// Draw one scaled polygon in the Tank Designer preview.
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

// Draw the circular angle guide behind the preview cannon.
//
// The warm arc shows allowed cannon angles. The darker arc shows angles that
// are outside the model's limits.
function drawPreviewProtractor(ctx, pivot, radius, minAngle, maxAngle) {
  // The preview protractor is centered on the real cannon pivot.
  // Muted red is blocked. Accent yellow is the allowed cannon range.
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(137, 76, 70, 0.48)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(pivot.x, pivot.y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(183, 161, 90, 0.86)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  // Draw clockwise from the high angle back to the low angle. Because
  // canvas angles run downward, that paints only the designer's allowed arc.
  ctx.arc(pivot.x, pivot.y, radius, canvasRadians(maxAngle), canvasRadians(minAngle));
  ctx.stroke();

  for (let angle = 0; angle < 360; angle += 15) {
    const majorTick = angle % 45 === 0;
    const radians = canvasRadians(angle);
    const innerRadius = radius - (majorTick ? 10 : 6);
    const outerRadius = radius + 1;

    ctx.strokeStyle = majorTick ? 'rgba(236, 231, 219, 0.62)' : 'rgba(236, 231, 219, 0.28)';
    ctx.lineWidth = majorTick ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(pivot.x + Math.cos(radians) * innerRadius, pivot.y + Math.sin(radians) * innerRadius);
    ctx.lineTo(pivot.x + Math.cos(radians) * outerRadius, pivot.y + Math.sin(radians) * outerRadius);
    ctx.stroke();
  }
}

// Convert game degrees into canvas radians.
//
// Canvas uses radians and y points down, so this conversion is easy to get
// backwards.
function canvasRadians(angleDegrees) {
  // Game angles use 0 degrees to the right and 90 degrees upward.
  // Canvas y grows downward, so positive game angles become negative canvas
  // angles.
  return (-angleDegrees * Math.PI) / 180;
}

// Find how close a point is to the nearest edge of a preview canvas.
function distanceToCanvasEdge(point, width, height) {
  return Math.min(point.x, width - point.x, point.y, height - point.y);
}

// Copy point objects so editing one model does not mutate another model.
function clonePoints(points) {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

// Make sure a point list is safe to draw and save.
function normalizePoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }

  return points
    .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
}

// Turn point data into pretty JSON for the textarea.
function formatPoints(points) {
  // This format matches tankModels.js closely enough that it can be copied
  // into the source file when a design is ready.
  return `[\n${points.map((point) => `  { "x": ${point.x}, "y": ${point.y} }`).join(',\n')}\n]`;
}

// Parse the body/cab point textarea.
//
// If the JSON is invalid, keep the previous points instead of crashing.
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

// Clamp a number for designer fields.
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Create the Ammo Designer list.
//
// Saved ammo wins. If there is no save yet, start from itemTypes.js.
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

// Make sure one ammo designer item has every field the UI expects.
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

// Return the currently selected ammo designer item.
function selectedAmmoDesignerItem() {
  return ammoDesignerItems.find((item) => item.id === selectedAmmoDesignerId) || ammoDesignerItems[0];
}

// Redraw the whole Ammo Designer tab.
function renderAmmoDesigner() {
  renderAmmoDesignerList();
  renderAmmoDesignerDetails();
}

// Draw the left-side list of ammunition types.
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

// Fill the Ammo Designer fields for the selected ammo.
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

// Copy field values back into the selected ammo designer item.
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
  applyItemLibraryToGame();
}

// Draw the small visual ammo preview in the designer.
//
// This preview already follows explosionSize and divotSize, even though the
// real gameplay mapping is intentionally left for Daniel.
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

// Add a new ammunition type to the Ammo Designer list.
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
  applyItemLibraryToGame();
  renderAmmoDesigner();
}

// Convert an inventory count into display text.
function inventoryLabel(count) {
  return count === 'Infinity' ? 'infinite shots' : `${count} shots`;
}

// Guess a starter price from ammo stats.
function suggestedAmmoPrice(item) {
  return Math.round((item.damage || 0) + (item.blastRadius || 0) / 2 + (item.terrainDamage || 0) * 8);
}

// Switch between Ammunition, Tanks & Turrets, and Items tabs.
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

// Connect ScorchedGame inventory changes back to the HTML UI.
game.setInventoryChangeHandler(() => {
  // ScorchedGame calls this after ammo is selected, used, added, or removed.
  // Keeping the render call here prevents duplicate quickbar redraws.
  renderQuickbar();

  if (inventoryModal.open) {
    renderInventory();
  }
});

// Boot the page with saved designer data before the player starts clicking.
applyTankLibraryToGame(true);
applyItemLibraryToGame();
renderQuickbar();
renderTankDesigner();
renderAmmoDesigner();

// Create the multiplayer helper.
//
// The helper receives callbacks instead of importing UI data directly. That
// keeps network code separate from designer/setup code.
multiplayerClient = new MultiplayerClient({
  game,
  elements: multiplayerElements,
  getPlayerSetup: () => {
    updatePlayerSetupFromFields();
    return playerSetup;
  },
  getNetworkPlayerDetails: () => ({
    name: multiplayerElements.nameInput.value.trim() || 'Player',
    modelId: multiplayerElements.tankInput.value || playerSetup[0]?.modelId || 'p1Custom',
    color: multiplayerElements.colorInput.value || '#d45745'
  }),
  getDesignerLibrary: currentDesignerLibrary,
  applyDesignerLibrary: applyNetworkDesignerLibrary,
  getMatchSettings: currentMatchSettings,
  applyMatchSettings: applyNetworkMatchSettings,
  startLocalGame: (setup) => {
    startConfiguredGame(setup);
  }
});

// MAIN SETUP BUTTONS
//
// These turn clicks in the setup screen into game actions.
addUiListener(startNewGameButton, 'click', startNewGame);
addUiListener(nextRoundButton, 'click', startNextRound);
addUiListener(showSetupButton, 'click', showSetupView);

// MATCH SETTING CHANGES
//
// In LAN play, the host's setup choices are shared with joined players.
addUiListener(landscapeInput, 'change', syncWaterDefaultsForLandscape);
addUiListener(matchRoundsInput, 'change', () => multiplayerClient?.publishSettings());
addUiListener(waterEnabledInput, 'change', () => multiplayerClient?.publishSettings());
addUiListener(waterLevelInput, 'change', () => multiplayerClient?.publishSettings());
addUiListener(waterRiseInput, 'change', () => multiplayerClient?.publishSettings());

// DESIGNER CREATE BUTTONS
//
// These add a new editable item to the current designer tab.
addUiListener(newTankButton, 'click', () => addNewTankDesignerItem('tank'));
addUiListener(newTurretButton, 'click', () => addNewTankDesignerItem('turret'));
addUiListener(newAmmoButton, 'click', addNewAmmoDesignerItem);

// Tank designer fields update the selected tank as Daniel edits.
Object.values(tankFields).forEach((field) => {
  addUiListener(field, 'input', updateSelectedTankFromFields);
  addUiListener(field, 'change', updateSelectedTankFromFields);
});

// Ammo designer fields update the selected ammo as Daniel edits.
Object.values(ammoFields).forEach((field) => {
  addUiListener(field, 'input', updateSelectedAmmoFromFields);
  addUiListener(field, 'change', updateSelectedAmmoFromFields);
});

// Designer tabs switch between the three designer panels.
designerTabs.forEach((tab) => {
  addUiListener(tab, 'click', () => {
    selectDesignerTab(tab.dataset.designerTab);
  });
});

// Setup tabs switch between local play, hosting, and joining LAN games.
setupModeTabs.forEach((tab) => {
  addUiListener(tab, 'click', () => {
    selectSetupMode(tab.dataset.setupMode);
  });
});

// Copy the host address so another computer can paste it into the browser.
addUiListener(multiplayerElements.copyHostAddressButton, 'click', async () => {
  const text = multiplayerElements.hostAddress.textContent.trim();

  try {
    await navigator.clipboard.writeText(text);
    multiplayerElements.roomHint.textContent = 'Join address copied';
  } catch {
    multiplayerElements.roomHint.textContent = text;
  }
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

// Keep canvas-centered modals centered if the browser window changes.
addUiListener(window, 'resize', centerOpenModalsOnCanvas);
addUiListener(window, 'scroll', centerOpenModalsOnCanvas);

// Any button with data-modal-target can open its matching dialog.
document.querySelectorAll('[data-modal-target]').forEach((button) => {
  addUiListener(button, 'click', () => {
    const modal = document.querySelector(`#${button.dataset.modalTarget}`);

    if (modal?.showModal) {
      if (modal === designerModal) {
        renderTankDesigner();
        renderAmmoDesigner();
      }

      openCanvasCenteredModal(modal);
    }
  });
});

// Draw the first setup screen.
renderGameSetup();
selectSetupMode('local');

// Test helpers can call this to remove listeners between browser runs.
window.tanksUiCleanup = () => {
  uiCleanupHandlers.forEach((cleanup) => cleanup());
  uiCleanupHandlers.length = 0;
};

// True when the user is typing/clicking inside a UI control.
//
// Game hotkeys should not fire while someone is editing a text field.
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
