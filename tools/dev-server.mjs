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

// Handle one JSON message from one browser.
//
// This is the server's traffic controller. It checks the message type, finds
// the right room, and then updates room/game state or sends a response.
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

// Create a brand-new room for a player who clicked Host LAN.
//
// Important: this does not reuse or overwrite someone else's room.
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

// Build the server-side object for one LAN room.
//
// The room stores lobby state, player slots, game phase, and cleanup timers.
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

// Clear all rooms.
//
// This is only used by browser tests through the local-only test endpoint.
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

// Change the number of player/AI slots before the game starts.
//
// Existing joined players are kept in their same slot when possible.
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

// Create the slot rows for a room.
//
// Human slots wait for browsers to join. AI slots are marked ready, but only
// the first two human slots are playable right now.
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

// Put one browser into one open human slot.
//
// This is used by both room creation and Join buttons.
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

// Voluntarily leave the current room.
//
// This frees the slot. It is different from a disconnect, which may reserve a
// slot during an active game so the player can refresh and return.
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

// Handle a browser tab closing or losing its WebSocket.
//
// In a lobby, disconnecting behaves like leaving. In an active game, the slot
// is reserved and the room pauses until the player reconnects.
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

// Reconnect a refreshed browser to its old slot.
//
// The browser sends a local playerToken. If a disconnected slot remembers that
// token, the server gives the slot back to the new WebSocket connection.
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

// Close a room and detach all connected clients from it.
//
// This also stops any server game loop for the room.
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

// Find the room a command is trying to use.
//
// Some commands include roomId directly. Others use the room the client is
// already in as a fallback.
function findTargetRoom(roomId, fallbackRoomId) {
  const requestedRoomId = sanitizeRoomId(roomId) || sanitizeRoomId(fallbackRoomId);
  return requestedRoomId ? rooms.get(requestedRoomId) : firstJoinableRoom();
}

// Return the room this client currently belongs to.
function currentRoomForClient(clientId) {
  const client = clients.get(clientId);
  return client?.roomId ? rooms.get(client.roomId) || null : null;
}

// Find the first lobby room with an open playable slot.
function firstJoinableRoom() {
  return [...rooms.values()].find((room) => room.phase === 'lobby' && room.slots.some((slot) => !slot.isAi && slot.index < playableHumanSlots && !slot.clientId)) || null;
}

// Pick the first slot that can take a turn.
function firstOccupiedSlotIndex(room) {
  const first = room.slots.find((slot) => slot.isAi || slot.clientId);
  return first?.index ?? 0;
}

// Start the server-owned game loop for one room.
//
// The host browser sends the first snapshot. After that, this loop applies
// commands and broadcasts snapshots to everyone in the room.
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

// Stop the interval that ticks a room's server game.
function stopServerGameLoop(room) {
  if (room.engineTimer) {
    clearInterval(room.engineTimer);
    room.engineTimer = null;
  }

  room.engine = null;
}

// If a room paused only because somebody disconnected, resume once everyone is
// connected again.
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

// True when all currently playable human slots are filled and guests are ready.
function canStartRoom(room) {
  const joinedPlayers = playableSlots(room).filter((slot) => slot.clientId && !slot.disconnected);
  const readyGuests = joinedPlayers.filter((slot) => slot.clientId !== room.hostId);

  return joinedPlayers.length === playableHumanSlots && readyGuests.every((slot) => slot.ready);
}

// Explain why the host cannot start the room yet.
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

// Find the display name of the room host.
function hostName(room) {
  const hostSlot = room.slots.find((slot) => slot.clientId === room.hostId);
  return hostSlot?.name || 'Another player';
}

// Return only the human slots that are active in today's game.
function playableSlots(room) {
  return room.slots.filter((slot) => !slot.isAi && slot.index < playableHumanSlots);
}

// Build the room list that is safe to send to browsers.
function publicRooms() {
  return [...rooms.values()]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(publicRoom);
}

// Remove server-only objects before sending a room to browsers.
//
// WebSocket messages must be JSON-friendly, so timers and engine objects stay
// on the server.
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

// Send one room's full state to players already inside that room.
function broadcastRoom(room) {
  broadcastToRoom(room, 'roomState', { room: publicRoom(room) });
}

// Send the room list to every connected browser.
function broadcastRooms() {
  broadcast('roomList', { rooms: publicRooms() });
}

// Send one message to every connected browser.
function broadcast(type, payload) {
  for (const { socket } of clients.values()) {
    send(socket, type, payload);
  }
}

// Send one message to every browser inside a specific room.
function broadcastToRoom(room, type, payload) {
  for (const client of clients.values()) {
    if (client.roomId === room.id) {
      send(client.socket, type, payload);
    }
  }
}

// Send one message to everyone in a room except one browser.
function broadcastToRoomExcept(room, excludedClientId, type, payload) {
  for (const client of clients.values()) {
    if (client.id !== excludedClientId && client.roomId === room.id) {
      send(client.socket, type, payload);
    }
  }
}

// Send JSON through one WebSocket if it is open.
function send(socket, type, payload) {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify({ type, ...payload }));
  }
}

// Make a short room code like "K7Q2".
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

// Start a timer while waiting for the host's initial snapshot.
//
// If the snapshot never arrives, the room returns to lobby instead of getting
// stuck in "starting" forever.
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

// Cancel a room's start-handshake timer.
function clearStartTimeout(room) {
  if (room.startTimeout) {
    clearTimeout(room.startTimeout);
    room.startTimeout = null;
  }
}

// Basic command-rate protection.
//
// Holding a key should be fine. A broken or malicious client should not be
// allowed to flood a room with thousands of commands per second.
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

// Periodically remove rooms that nobody is using anymore.
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

// Mark a room as recently active.
function touchRoom(room) {
  room.lastActiveAt = Date.now();
}

// Keep player names short and non-empty.
function sanitizeName(name) {
  return String(name).trim().slice(0, 24) || 'Player';
}

// Accept only normal HTML hex colors like #d45745.
function sanitizeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color)) ? color : '#d45745';
}

// Keep model/item ids simple so they are safe to store and compare.
function sanitizeId(id) {
  const text = String(id || '').trim();
  return /^[a-zA-Z0-9_-]{1,80}$/.test(text) ? text : 'p1Custom';
}

// Keep room ids in a simple uppercase-code format.
function sanitizeRoomId(id) {
  const text = String(id || '').trim().toUpperCase();
  return /^[A-Z0-9_-]{1,24}$/.test(text) ? text : '';
}

// Validate the browser's reconnect token.
//
// This is not authentication. It only helps a refreshed browser reclaim its
// previous LAN slot.
function sanitizePlayerToken(token) {
  const text = String(token || '').trim();
  return /^[a-zA-Z0-9_-]{16,80}$/.test(text) ? text : '';
}

// Accept the host's tank/ammo designer library in a predictable shape.
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

// Default match settings for a new room.
function defaultSettings() {
  return {
    matchRounds: 3,
    landscapeMode: 'cycle',
    waterEnabled: true,
    waterLevelPercent: 18,
    waterRisePerShot: 0
  };
}

// Accept match settings from the browser and clamp unsafe values.
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

// Convert a value to an integer inside a range.
function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, number));
}

// Find this computer's LAN IPv4 addresses.
function localAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((address) => address && address.family === 'IPv4' && !address.internal)
    .map((address) => address.address);
}

// Only allow certain test/debug endpoints from this same computer.
function isLocalRequest(request) {
  const address = request.socket.remoteAddress || '';
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}
