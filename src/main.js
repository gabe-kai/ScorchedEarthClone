import { ScorchedGame } from './game/ScorchedGame.js';
import { describeItem } from './game/itemTypes.js';

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
        <span class="quickbar-tooltip">Add an item from inventory</span>
      `;
      button.addEventListener('click', openInventory);
    }

    quickbar.append(button);
  }
}

function renderInventory() {
  // The inventory modal is ordinary HTML.
  // Each row gets one button that either adds the item to the quickbar or
  // removes it from the quickbar.
  inventoryList.textContent = '';

  for (const inventoryItem of game.inventoryItems()) {
    const row = document.createElement('div');
    row.className = 'inventory-row';
    const countText = inventoryItem.count === Infinity ? 'inf' : inventoryItem.count;
    const actionText = inventoryItem.isOnQuickbar ? 'Remove' : 'Add';

    row.innerHTML = `
      <span class="inventory-icon">${inventoryItem.item.icon}</span>
      <span class="inventory-main">
        <strong>${inventoryItem.item.name}</strong>
        <small>${describeItem(inventoryItem.itemId)}</small>
      </span>
      <span class="inventory-count">${countText}</span>
      <button type="button">${actionText}</button>
    `;

    row.querySelector('button').addEventListener('click', () => {
      game.toggleQuickbarItem(inventoryItem.itemId);
    });

    inventoryList.append(row);
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

addUiListener(window, 'keydown', (event) => {
  // These are UI shortcuts, not tank controls:
  // I opens inventory, and number keys select quickbar slots.
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
  game.selectQuickbarSlot(slotIndex);
});

document.querySelectorAll('[data-modal-target]').forEach((button) => {
  addUiListener(button, 'click', () => {
    const modal = document.querySelector(`#${button.dataset.modalTarget}`);

    if (modal?.showModal) {
      modal.showModal();
    }
  });
});

window.tanksUiCleanup = () => {
  uiCleanupHandlers.forEach((cleanup) => cleanup());
  uiCleanupHandlers.length = 0;
};
