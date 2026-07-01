import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { WebSocketServer } from 'ws';
import { HeadlessScorchedGame } from './headless-scorched-game.mjs';

const root = resolve('.');
const port = Number(process.env.PORT || 5173);
const playableHumanSlots = 2;
const START_HANDSHAKE_TIMEOUT_MS = 10000;
const DISCONNECTED_ROOM_TTL_MS = 10 * 60 * 1000;
const EMPTY_LOBBY_TTL_MS = 10 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const COMMAND_RATE_LIMIT_PER_SECOND = 80;

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = createServer((request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);

  if (url.pathname === '/api/test-reset-room' && request.method === 'POST') {
    if (!isLocalRequest(request)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    resetRooms();
    response.writeHead(204);
    response.end();
    return;
  }

  if (url.pathname === '/api/network-info') {
    response.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify({
      port,
      addresses: localAddresses().map((address) => `http://${address}:${port}`)
    }));
    return;
  }

  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(join(root, normalize(requestedPath)));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(response);
});

const websocketServer = new WebSocketServer({ server, path: '/multiplayer' });
const clients = new Map();
const rooms = new Map();

websocketServer.on('connection', (socket, request) => {
  const clientId = randomUUID();
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  const playerToken = sanitizePlayerToken(url.searchParams.get('playerToken')) || randomUUID();
  clients.set(clientId, {
    id: clientId,
    socket,
    playerToken,
    roomId: null,
    playerSlot: null,
    commandTimes: []
  });
  const reconnectedRoom = reconnectClientToSlot(clientId);
  send(socket, 'welcome', {
    clientId,
    playerToken,
    rooms: publicRooms(),
    room: reconnectedRoom ? publicRoom(reconnectedRoom) : null
  });
  if (reconnectedRoom) {
    broadcastRoom(reconnectedRoom);
  }

  socket.on('message', (rawMessage) => {
    handleClientMessage(clientId, rawMessage);
  });

  socket.on('close', () => {
    disconnectClientFromCurrentRoom(clientId);
    clients.delete(clientId);
    broadcastRooms();
  });
});

setInterval(cleanupRooms, CLEANUP_INTERVAL_MS).unref?.();

server.listen(port, '0.0.0.0', () => {
  console.log(`Tanks! dev server running at http://localhost:${port}`);
  for (const address of localAddresses()) {
    console.log(`LAN players can try http://${address}:${port}`);
  }
});

function handleClientMessage(clientId, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  const client = clients.get(clientId);

  if (!client || typeof message?.type !== 'string') {
    return;
  }

  if (message.type === 'createRoom') {
    createHostedRoom(clientId, message);
    return;
  }

  if (message.type === 'listRooms') {
    send(client.socket, 'roomList', { rooms: publicRooms() });
    return;
  }

  if (message.type === 'joinSlot') {
    const room = findTargetRoom(message.roomId, client.roomId);

    if (!room || room.phase !== 'lobby') {
      return;
    }

    assignPlayerToSlot(room, clientId, Number(message.slotIndex), {
      name: message.name || 'Player',
      modelId: message.modelId,
      color: message.color
    });
    broadcastRoom(room);
    broadcastRooms();
    return;
  }

  if (message.type === 'leaveSlot') {
    leaveCurrentRoom(clientId);
    broadcastRooms();
    return;
  }

  const room = currentRoomForClient(clientId);

  if (!room) {
    return;
  }

  if (message.type === 'setReady') {
    const slot = room.slots.find((candidate) => candidate.clientId === clientId);

    if (slot && !slot.isAi) {
      slot.ready = Boolean(message.ready);
      broadcastRoom(room);
      broadcastRooms();
    }
    return;
  }

  if (message.type === 'updateSlot') {
    const slot = room.slots.find((candidate) => candidate.clientId === clientId);

    if (slot && !slot.isAi) {
      slot.name = sanitizeName(message.name || slot.name);
      slot.color = sanitizeColor(message.color || slot.color);
      slot.modelId = sanitizeId(message.modelId || slot.modelId);
      if (clientId === room.hostId) {
        room.name = `${slot.name}'s Game`;
      }
      broadcastRoom(room);
      broadcastRooms();
    }
    return;
  }

  if (message.type === 'updateLibrary' && clientId === room.hostId) {
    room.library = sanitizeLibrary(message.library);
    broadcastRoom(room);
    broadcastRooms();
    return;
  }

  if (message.type === 'updateSettings' && clientId === room.hostId && room.phase !== 'playing') {
    room.settings = sanitizeSettings(message.settings);
    broadcastRoom(room);
    broadcastRooms();
    return;
  }

  if (message.type === 'configureRoom' && clientId === room.hostId && room.phase !== 'playing') {
    room.settings = sanitizeSettings(message.settings || room.settings);
    configureRoom(room, message);
    broadcastRoom(room);
    broadcastRooms();
    return;
  }

  if (message.type === 'startGame' && clientId === room.hostId) {
    if (!canStartRoom(room)) {
      send(client.socket, 'actionRejected', {
        reason: startBlockReason(room)
      });
      return;
    }

    room.phase = 'starting';
    room.paused = false;
    room.activeSlotIndex = firstOccupiedSlotIndex(room);
    room.turnStartedAt = Date.now();
    touchRoom(room);
    beginStartHandshake(room);
    broadcastRoom(room);
    broadcastRooms();
    broadcastToRoom(room, 'gameStarted', { room: publicRoom(room), serverAuthoritative: true });
    return;
  }

  if (message.type === 'pauseGame' && clientId === room.hostId) {
    room.paused = Boolean(message.paused);
    room.pauseReason = room.paused ? 'manual' : null;
    broadcastRoom(room);
    broadcastRooms();
    return;
  }

  if (message.type === 'turnChanged') {
    const currentSlot = room.slots.find((slot) => slot.clientId === clientId);

    if (!currentSlot && clientId !== room.hostId) {
      return;
    }

    room.activeSlotIndex = clampInteger(message.activeSlotIndex, 0, room.slots.length - 1, room.activeSlotIndex);
    broadcastRoom(room);
    broadcastRooms();
    return;
  }

  if (message.type === 'gameCommand') {
    const slot = room.slots.find((candidate) => candidate.clientId === clientId);

    if (!slot || slot.index !== room.activeSlotIndex || room.paused || room.phase !== 'playing') {
      return;
    }

    if (room.engine) {
      if (acceptGameCommand(client, message.command)) {
        room.engine.applyCommand(message.command);
      }
    }
    return;
  }

  if (message.type === 'initialSnapshot' && clientId === room.hostId && room.phase === 'starting') {
    startServerGameLoop(room, message.snapshot);
    return;
  }

  if (message.type === 'gameSnapshot' && clientId === room.hostId && !room.serverAuthoritative) {
    const activeSlotIndex = clampInteger(
      message.snapshot?.currentPlayerIndex,
      0,
      room.slots.length - 1,
      room.activeSlotIndex
    );
    room.activeSlotIndex = activeSlotIndex;
    broadcastRoom(room);
    broadcastToRoomExcept(room, clientId, 'gameSnapshot', {
      roomId: room.id,
      snapshot: message.snapshot,
      room: publicRoom(room)
    });
  }
}

function createHostedRoom(clientId, message) {
  leaveCurrentRoom(clientId);

  const client = clients.get(clientId);
  const room = createRoom();
  rooms.set(room.id, room);
  room.library = sanitizeLibrary(message.library);
  room.settings = sanitizeSettings(message.settings);
  assignPlayerToSlot(room, clientId, 0, {
    name: message.name || 'Host',
    modelId: message.modelId,
    color: message.color
  });
  room.hostId = clientId;
  room.hostToken = client?.playerToken || '';
  room.name = `${hostName(room)}'s Game`;
  room.phase = 'lobby';
  touchRoom(room);
  broadcastRoom(room);
  broadcastRooms();
}

function createRoom() {
  return {
    id: createRoomCode(),
    name: 'Tanks! Game',
    hostId: null,
    hostToken: '',
    phase: 'empty',
    paused: false,
    pauseReason: null,
    playerSlots: 2,
    aiSlots: 0,
    activeSlotIndex: 0,
    turnStartedAt: Date.now(),
    serverAuthoritative: true,
    engine: null,
    engineTimer: null,
    startTimeout: null,
    library: null,
    settings: defaultSettings(),
    slots: createSlots(2, 0),
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  };
}

function resetRooms() {
  for (const room of rooms.values()) {
    stopServerGameLoop(room);
    clearStartTimeout(room);
  }

  rooms.clear();
  for (const client of clients.values()) {
    client.roomId = null;
    client.playerSlot = null;
  }
  broadcastRooms();
}

function configureRoom(room, message) {
  const playerSlots = clampInteger(message.playerSlots, 2, 6, room.playerSlots);
  const aiSlots = clampInteger(message.aiSlots, 0, 4, room.aiSlots);
  const oldSlots = room.slots;
  room.playerSlots = playerSlots;
  room.aiSlots = aiSlots;
  room.slots = createSlots(playerSlots, aiSlots);

  for (let index = 0; index < Math.min(oldSlots.length, room.slots.length); index++) {
    if (!room.slots[index].isAi && oldSlots[index]?.clientId) {
      room.slots[index] = { ...room.slots[index], ...oldSlots[index], index };
      const client = clients.get(room.slots[index].clientId);

      if (client) {
        client.roomId = room.id;
        client.playerSlot = index;
      }
    }
  }
}

function createSlots(playerSlots, aiSlots) {
  const slots = [];

  for (let index = 0; index < playerSlots; index++) {
    slots.push({
      index,
      type: 'player',
      clientId: null,
      name: `Player ${index + 1}`,
      modelId: index === 0 ? 'p1Custom' : 'p2Custom',
      color: index === 0 ? '#d45745' : '#4d8ad8',
      ready: false,
      playerToken: null,
      disconnected: false,
      disconnectedAt: null,
      isAi: false
    });
  }

  for (let index = 0; index < aiSlots; index++) {
    const slotIndex = slots.length;
    slots.push({
      index: slotIndex,
      type: 'ai',
      clientId: null,
      name: `AI ${index + 1}`,
      modelId: 'hillTurret',
      color: '#8d9388',
      ready: true,
      playerToken: null,
      disconnected: false,
      disconnectedAt: null,
      isAi: true
    });
  }

  return slots;
}

function assignPlayerToSlot(room, clientId, slotIndex, playerDetails = {}) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= room.slots.length) {
    return;
  }

  const slot = room.slots[slotIndex];
  const client = clients.get(clientId);

  if (slot.isAi || slot.index >= playableHumanSlots || (slot.clientId && slot.clientId !== clientId)) {
    return;
  }

  leaveCurrentRoom(clientId);
  slot.clientId = clientId;
  slot.playerToken = client?.playerToken || slot.playerToken;
  slot.disconnected = false;
  slot.disconnectedAt = null;
  slot.name = sanitizeName(playerDetails.name || slot.name);
  slot.modelId = sanitizeId(playerDetails.modelId || slot.modelId);
  slot.color = sanitizeColor(playerDetails.color || slot.color);
  slot.ready = false;

  if (client) {
    client.roomId = room.id;
    client.playerSlot = slotIndex;
  }

  if (!room.hostId) {
    room.hostId = clientId;
    room.hostToken = client?.playerToken || '';
  }

  maybeResumeAfterReconnect(room);
  touchRoom(room);
}

function leaveCurrentRoom(clientId) {
  const client = clients.get(clientId);
  const room = client?.roomId ? rooms.get(client.roomId) : null;

  if (!client || !room) {
    return;
  }

  for (const slot of room.slots) {
    if (slot.clientId === clientId) {
      slot.clientId = null;
      slot.playerToken = null;
      slot.disconnected = false;
      slot.disconnectedAt = null;
      slot.ready = false;
      slot.name = `Player ${slot.index + 1}`;
    }
  }

  client.roomId = null;
  client.playerSlot = null;

  if (room.hostId === clientId) {
    closeRoom(room.id);
    return;
  }

  if (!room.slots.some((slot) => slot.clientId || slot.playerToken)) {
    closeRoom(room.id);
    return;
  }

  touchRoom(room);
  broadcastRoom(room);
}

function disconnectClientFromCurrentRoom(clientId) {
  const client = clients.get(clientId);
  const room = client?.roomId ? rooms.get(client.roomId) : null;

  if (!client || !room) {
    return;
  }

  if (room.phase === 'lobby') {
    leaveCurrentRoom(clientId);
    return;
  }

  for (const slot of room.slots) {
    if (slot.clientId === clientId) {
      slot.clientId = null;
      slot.disconnected = true;
      slot.disconnectedAt = Date.now();
      slot.ready = false;
    }
  }

  if (room.hostId === clientId) {
    room.hostId = null;
  }

  client.roomId = null;
  client.playerSlot = null;
  if (room.phase === 'playing') {
    room.paused = true;
    room.pauseReason = 'disconnect';
  }
  touchRoom(room);
  broadcastRoom(room);
}

function reconnectClientToSlot(clientId) {
  const client = clients.get(clientId);

  if (!client?.playerToken) {
    return null;
  }

  for (const room of rooms.values()) {
    const slot = room.slots.find((candidate) => candidate.playerToken === client.playerToken);

    if (!slot || slot.clientId) {
      continue;
    }

    slot.clientId = clientId;
    slot.disconnected = false;
    slot.disconnectedAt = null;
    client.roomId = room.id;
    client.playerSlot = slot.index;

    if (room.hostToken === client.playerToken) {
      room.hostId = clientId;
    }

    maybeResumeAfterReconnect(room);
    touchRoom(room);
    return room;
  }

  return null;
}

function closeRoom(roomId) {
  const room = rooms.get(roomId);

  if (!room) {
    return;
  }

  stopServerGameLoop(room);
  clearStartTimeout(room);

  for (const slot of room.slots) {
    if (!slot.clientId) {
      continue;
    }

    const client = clients.get(slot.clientId);

    if (client) {
      client.roomId = null;
      client.playerSlot = null;
      send(client.socket, 'roomClosed', { roomId });
    }
  }

  rooms.delete(roomId);
}

function findTargetRoom(roomId, fallbackRoomId) {
  const requestedRoomId = sanitizeRoomId(roomId) || sanitizeRoomId(fallbackRoomId);
  return requestedRoomId ? rooms.get(requestedRoomId) : firstJoinableRoom();
}

function currentRoomForClient(clientId) {
  const client = clients.get(clientId);
  return client?.roomId ? rooms.get(client.roomId) || null : null;
}

function firstJoinableRoom() {
  return [...rooms.values()].find((room) => room.phase === 'lobby' && room.slots.some((slot) => !slot.isAi && slot.index < playableHumanSlots && !slot.clientId)) || null;
}

function firstOccupiedSlotIndex(room) {
  const first = room.slots.find((slot) => slot.isAi || slot.clientId);
  return first?.index ?? 0;
}

function startServerGameLoop(room, initialSnapshot) {
  stopServerGameLoop(room);
  clearStartTimeout(room);
  room.engine = new HeadlessScorchedGame(initialSnapshot);
  room.phase = 'playing';
  room.pauseReason = null;
  room.activeSlotIndex = room.engine.snapshot().currentPlayerIndex;
  room.turnStartedAt = Date.now();
  touchRoom(room);
  broadcastRoom(room);
  broadcastRooms();
  broadcastToRoom(room, 'gameSnapshot', {
    roomId: room.id,
    snapshot: room.engine.snapshot(),
    room: publicRoom(room)
  });

  room.engineTimer = setInterval(() => {
    if (room.paused || room.phase !== 'playing' || !room.engine) {
      return;
    }

    room.engine.tick();
    const snapshot = room.engine.snapshot();
    const nextActiveSlotIndex = clampInteger(snapshot.currentPlayerIndex, 0, room.slots.length - 1, room.activeSlotIndex);

    if (nextActiveSlotIndex !== room.activeSlotIndex) {
      room.turnStartedAt = Date.now();
    }

    room.activeSlotIndex = nextActiveSlotIndex;
    broadcastToRoom(room, 'gameSnapshot', {
      roomId: room.id,
      snapshot,
      room: publicRoom(room)
    });
  }, 33);
}

function stopServerGameLoop(room) {
  if (room.engineTimer) {
    clearInterval(room.engineTimer);
    room.engineTimer = null;
  }

  room.engine = null;
}

function maybeResumeAfterReconnect(room) {
  if (room.pauseReason !== 'disconnect') {
    return;
  }

  const stillDisconnected = room.slots.some((slot) => slot.disconnected);

  if (!stillDisconnected) {
    room.paused = false;
    room.pauseReason = null;
  }
}

function canStartRoom(room) {
  const joinedPlayers = playableSlots(room).filter((slot) => slot.clientId && !slot.disconnected);
  const readyGuests = joinedPlayers.filter((slot) => slot.clientId !== room.hostId);

  return joinedPlayers.length === playableHumanSlots && readyGuests.every((slot) => slot.ready);
}

function startBlockReason(room) {
  const joinedPlayers = playableSlots(room).filter((slot) => slot.clientId && !slot.disconnected);

  if (joinedPlayers.length < playableHumanSlots) {
    return 'Waiting for player 2 to join.';
  }

  const notReadyGuests = joinedPlayers.filter((slot) => slot.clientId !== room.hostId && !slot.ready);

  if (notReadyGuests.length > 0) {
    return `Waiting for ${notReadyGuests.map((slot) => slot.name).join(', ')} to mark ready.`;
  }

  return 'The LAN room is not ready yet.';
}

function hostName(room) {
  const hostSlot = room.slots.find((slot) => slot.clientId === room.hostId);
  return hostSlot?.name || 'Another player';
}

function playableSlots(room) {
  return room.slots.filter((slot) => !slot.isAi && slot.index < playableHumanSlots);
}

function publicRooms() {
  return [...rooms.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(publicRoom);
}

function publicRoom(room) {
  return {
    ...room,
    engine: undefined,
    engineTimer: undefined,
    startTimeout: undefined,
    slots: room.slots.map((slot) => ({
      ...slot,
      isHost: slot.clientId !== null && slot.clientId === room.hostId
    }))
  };
}

function broadcastRoom(room) {
  broadcastToRoom(room, 'roomState', { room: publicRoom(room) });
}

function broadcastRooms() {
  broadcast('roomList', { rooms: publicRooms() });
}

function broadcast(type, payload) {
  for (const { socket } of clients.values()) {
    send(socket, type, payload);
  }
}

function broadcastToRoom(room, type, payload) {
  for (const client of clients.values()) {
    if (client.roomId === room.id) {
      send(client.socket, type, payload);
    }
  }
}

function broadcastToRoomExcept(room, excludedClientId, type, payload) {
  for (const client of clients.values()) {
    if (client.id !== excludedClientId && client.roomId === room.id) {
      send(client.socket, type, payload);
    }
  }
}

function send(socket, type, payload) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
}

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  for (let attempt = 0; attempt < 24; attempt++) {
    let code = '';

    for (let index = 0; index < 4; index++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    if (!rooms.has(code)) {
      return code;
    }
  }

  return randomUUID().slice(0, 8).toUpperCase();
}

function beginStartHandshake(room) {
  clearStartTimeout(room);
  room.startTimeout = setTimeout(() => {
    if (room.phase !== 'starting') {
      return;
    }

    room.phase = 'lobby';
    room.paused = false;
    stopServerGameLoop(room);
    broadcastToRoom(room, 'actionRejected', {
      reason: 'The LAN game did not receive its starting snapshot. Try Start LAN Game again.'
    });
    broadcastRoom(room);
    broadcastRooms();
  }, START_HANDSHAKE_TIMEOUT_MS);
}

function clearStartTimeout(room) {
  if (room.startTimeout) {
    clearTimeout(room.startTimeout);
    room.startTimeout = null;
  }
}

function acceptGameCommand(client, command) {
  if (command?.type === 'keyUp') {
    return true;
  }

  const now = Date.now();
  client.commandTimes = client.commandTimes.filter((time) => now - time < 1000);

  if (client.commandTimes.length >= COMMAND_RATE_LIMIT_PER_SECOND) {
    return false;
  }

  client.commandTimes.push(now);
  return true;
}

function cleanupRooms() {
  const now = Date.now();
  let changed = false;

  for (const room of [...rooms.values()]) {
    const hasConnectedPlayer = room.slots.some((slot) => slot.clientId);
    const hasRememberedPlayer = room.slots.some((slot) => slot.clientId || slot.playerToken);

    if (!hasRememberedPlayer && now - room.lastActiveAt > EMPTY_LOBBY_TTL_MS) {
      closeRoom(room.id);
      changed = true;
      continue;
    }

    if (!hasConnectedPlayer && now - room.lastActiveAt > DISCONNECTED_ROOM_TTL_MS) {
      closeRoom(room.id);
      changed = true;
    }
  }

  if (changed) {
    broadcastRooms();
  }
}

function touchRoom(room) {
  room.lastActiveAt = Date.now();
}

function sanitizeName(name) {
  return String(name).trim().slice(0, 24) || 'Player';
}

function sanitizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color)) ? color : '#d45745';
}

function sanitizeId(id) {
  const text = String(id || '').trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(text) ? text : 'p1Custom';
}

function sanitizeRoomId(id) {
  const text = String(id || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{1,24}$/.test(text) ? text : '';
}

function sanitizePlayerToken(token) {
  const text = String(token || '').trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(text) ? text : '';
}

function sanitizeLibrary(library) {
  if (!library || typeof library !== 'object') {
    return null;
  }

  return {
    tankDesignerItems: Array.isArray(library.tankDesignerItems) ? library.tankDesignerItems : [],
    selectedTankDesignerId: sanitizeId(library.selectedTankDesignerId || ''),
    ammoDesignerItems: Array.isArray(library.ammoDesignerItems) ? library.ammoDesignerItems : [],
    selectedAmmoDesignerId: sanitizeId(library.selectedAmmoDesignerId || '')
  };
}

function defaultSettings() {
  return {
    matchRounds: 3,
    landscapeMode: 'cycle',
    waterEnabled: true,
    waterLevelPercent: 18,
    waterRisePerShot: 0
  };
}

function sanitizeSettings(settings) {
  if (!settings || typeof settings !== 'object') {
    return defaultSettings();
  }

  const landscapeModes = new Set(['cycle', 'rolling', 'cliffs', 'risingSea', 'random']);
  const landscapeMode = landscapeModes.has(settings.landscapeMode) ? settings.landscapeMode : 'cycle';

  return {
    matchRounds: clampInteger(settings.matchRounds, 1, 25, 3),
    landscapeMode,
    waterEnabled: Boolean(settings.waterEnabled),
    waterLevelPercent: clampInteger(settings.waterLevelPercent, 0, 80, 18),
    waterRisePerShot: clampInteger(settings.waterRisePerShot, 0, 40, 0)
  };
}

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

function isLocalRequest(request) {
  const address = request.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
