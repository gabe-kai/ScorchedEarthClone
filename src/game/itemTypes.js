// ITEM TYPES
//
// Items are things a player can carry. Some items are ammo and can be fired.
// Later, other items can repair tanks, create shields, scan wind, and so on.
//
// The Ammo Designer reads these ammo fields:
// - colors control the shot and impact previews
// - blastRadius is the visible explosion size
// - terrainDamage is how much ground should be carved away
// - damage and price are balance numbers we can tune as the game grows

export const ITEM_TYPES = {
  basicShot: {
    name: 'Basic Shot',
    kind: 'ammo',
    icon: 'B',
    count: Infinity,
    projectileRadius: 4,
    shotColor: '#20272d',
    hitColor: '#ff3b2f',
    missColor: '#ff8c2a',
    damage: 20,
    blastRadius: 40,
    terrainDamage: 1,
    speedMultiplier: 1,
    windMultiplier: 1,
    price: 20,
    description: 'A reliable cannonball with normal speed and blast size.'
  },
  heavyShell: {
    name: 'Heavy Shell',
    kind: 'ammo',
    icon: 'H',
    count: 3,
    projectileRadius: 6,
    shotColor: '#252a2f',
    hitColor: '#ff5f2e',
    missColor: '#d9a441',
    damage: 35,
    blastRadius: 58,
    terrainDamage: 1.4,
    speedMultiplier: 0.85,
    windMultiplier: 0.8,
    price: 42,
    description: 'A slower, heavier shot with a bigger blast.'
  },
  digger: {
    name: 'Digger',
    kind: 'ammo',
    icon: 'D',
    count: 2,
    projectileRadius: 4,
    shotColor: '#31351f',
    hitColor: '#d2b35e',
    missColor: '#8b6f34',
    damage: 8,
    blastRadius: 34,
    terrainDamage: 2,
    speedMultiplier: 1,
    windMultiplier: 1.1,
    price: 28,
    description: 'A terrain-focused shot for making deeper craters.'
  },
  repairKit: {
    name: 'Repair Kit',
    kind: 'tool',
    icon: '+',
    count: 1,
    healAmount: 25,
    description: 'Future item: repair your tank instead of firing.'
  },
  windGauge: {
    name: 'Wind Gauge',
    kind: 'tool',
    icon: 'W',
    count: 1,
    description: 'Future item: inspect wind before taking a shot.'
  }
};

export const STARTING_INVENTORY = {
  items: {
    basicShot: { count: Infinity },
    heavyShell: { count: 3 },
    digger: { count: 2 },
    repairKit: { count: 1 },
    windGauge: { count: 1 }
  },
  quickbar: ['basicShot', 'heavyShell', 'digger', null],
  selectedSlot: 0
};

export function createStartingInventory(itemTypes = ITEM_TYPES) {
  const itemEntries = Object.entries(itemTypes);
  const knownQuickbarItems = STARTING_INVENTORY.quickbar.filter((itemId) => itemTypes[itemId]);
  const fallbackQuickbarItems = itemEntries
    .filter(([, item]) => item.kind === 'ammo')
    .map(([itemId]) => itemId)
    .slice(0, STARTING_INVENTORY.quickbar.length);
  const quickbarItems = knownQuickbarItems.length > 0 ? knownQuickbarItems : fallbackQuickbarItems;

  return {
    items: Object.fromEntries(itemEntries.map(([itemId, item]) => [
      itemId,
      { count: STARTING_INVENTORY.items[itemId]?.count ?? item.count ?? 0 }
    ])),
    quickbar: STARTING_INVENTORY.quickbar.map((_, index) => quickbarItems[index] ?? null),
    selectedSlot: STARTING_INVENTORY.selectedSlot
  };
}

export function describeItem(itemId, itemTypes = ITEM_TYPES) {
  const item = itemTypes[itemId];

  if (!item) {
    return 'Empty slot';
  }

  if (item.kind === 'ammo') {
    return `${item.name}: damage ${item.damage}, blast ${item.blastRadius}, terrain ${item.terrainDamage}`;
  }

  return `${item.name}: ${item.description}`;
}
