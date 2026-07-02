// Browser-side LAN multiplayer helper.
//
// This class does not run the game rules. Its job is to:
// - connect this browser to the Node WebSocket server
// - show LAN rooms and slots
// - send this player's commands to the server
// - apply server snapshots to the canvas
// - lock input when it is another player's turn
export class MultiplayerClient {
  // Store all the UI hooks and connect to the server.
  //
  // The constructor receives callbacks from main.js so this file does not need
  // to know how every menu and designer is built.
  constructor({
    game,
    elements,
    getPlayerSetup,
    getNetworkPlayerDetails,
    getDesignerLibrary,
    applyDesignerLibrary,
    getMatchSettings,
    applyMatchSettings,
    startLocalGame
  }) {
    this.game = game;
    this.elements = elements;
    this.getPlayerSetup = getPlayerSetup;
    this.getNetworkPlayerDetails = getNetworkPlayerDetails;
    this.getDesignerLibrary = getDesignerLibrary;
    this.applyDesignerLibrary = applyDesignerLibrary;
    this.getMatchSettings = getMatchSettings;
    this.applyMatchSettings = applyMatchSettings;
    this.startLocalGame = startLocalGame;
    this.socket = null;
    this.clientId = null;
    this.playerToken = stablePlayerToken();
    this.room = null;
    this.rooms = [];
    this.selectedRoomId = '';
    this.ready = false;
    this.snapshotTimer = null;
    this.lastSnapshotAt = 0;
    this.lastAppliedLibraryText = '';
    this.lastAppliedSettingsText = '';
    this.lobbyMessage = '';
    this.pendingHostCreate = false;
    this.serverAuthoritative = false;
    this.sentKeyCodes = new Set();
    this.networkGameStarted = false;
    this.name = localStorage.getItem('tanksLanName.v1') || 'Player';
    this.color = localStorage.getItem('tanksLanColor.v1') || '#d45745';
    this.modelId = localStorage.getItem('tanksLanModel.v1') || this.elements.tankInput.value || 'p1Custom';

    this.elements.nameInput.value = this.name;
    this.elements.colorInput.value = this.color;
    this.elements.tankInput.value = this.modelId;
    this.bindEvents();
    this.loadNetworkInfo();
    this.connect();
    this.applyTurnLock();
  }

  // Attach click/change listeners to multiplayer UI controls.
  //
  // This is where buttons like Host LAN, Ready, Start, and Pause get their
  // behavior.
  bindEvents() {
    this.elements.createButton.addEventListener('click', () => this.createRoom());
    this.elements.joinButton.addEventListener('click', () => this.joinFirstOpenSlot());
    this.elements.leaveButton.addEventListener('click', () => this.send('leaveSlot'));
    this.elements.applySettingsButton.addEventListener('click', () => this.configureRoom());
    this.elements.readyButton.addEventListener('click', () => this.toggleReady());
    this.elements.startButton.addEventListener('click', () => this.startGame());
    this.elements.pauseButton.addEventListener('click', () => this.togglePause());
    this.elements.nameInput.addEventListener('input', () => {
      this.saveAndSendPlayerDetails();
    });
    this.elements.tankInput.addEventListener('change', () => {
      this.saveAndSendPlayerDetails();
    });
    this.elements.colorInput.addEventListener('input', () => {
      this.saveAndSendPlayerDetails();
    });

    this.game.setTurnChangeHandler((activeSlotIndex) => {
      if (this.currentSlot() || this.isHost()) {
        this.send('turnChanged', { activeSlotIndex });
      }

      this.applyTurnLock();
    });
    this.game.setCommandHandler((command) => this.handleLocalGameCommand(command));
  }

  // Ask the local server which LAN addresses other computers can try.
  //
  // Example result: http://192.168.1.25:5173
  async loadNetworkInfo() {
    try {
      const response = await fetch('/api/network-info');
      const info = await response.json();
      this.elements.hostAddress.textContent = info.addresses?.[0] || window.location.origin;
    } catch {
      this.elements.hostAddress.textContent = window.location.origin;
    }
  }

  // Open the WebSocket connection.
  //
  // WebSocket is the always-open pipe used for room updates, player commands,
  // and game snapshots.
  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.socket = new WebSocket(`${protocol}//${window.location.host}/multiplayer?playerToken=${encodeURIComponent(this.playerToken)}`);
    this.setStatus('Connecting...');

    this.socket.addEventListener('open', () => {
      this.setStatus('Connected');

      if (this.pendingHostCreate || this.elements.setupMode?.() === 'host') {
        this.pendingHostCreate = false;
        this.ensureHosting();
      }
    });

    this.socket.addEventListener('close', () => {
      this.setStatus('Offline');
      this.game.setInputEnabled(true);
      window.setTimeout(() => this.connect(), 1600);
    });

    this.socket.addEventListener('message', (event) => {
      this.handleMessage(event.data);
    });
  }

  // Handle one message from the server.
  //
  // Most multiplayer state changes enter the browser through this function.
  handleMessage(rawMessage) {
    let message;

    try {
      message = JSON.parse(rawMessage);
    } catch {
      return;
    }

    if (message.type === 'welcome') {
      this.clientId = message.clientId;
      this.playerToken = message.playerToken || this.playerToken;
      localStorage.setItem('tanksLanPlayerToken.v1', this.playerToken);
      this.rooms = message.rooms || [];
      this.room = message.room || null;
      this.selectedRoomId = this.room?.id || this.selectedRoomId || this.firstJoinableRoom()?.id || '';
      this.applyRoomLibrary();
      this.applyRoomSettings();
      this.resumeNetworkGameIfNeeded();
      this.render();
      return;
    }

    if (message.type === 'roomList') {
      this.rooms = message.rooms || [];

      if (this.room && !this.rooms.some((room) => room.id === this.room.id)) {
        this.room = null;
        this.networkGameStarted = false;
      }

      if (!this.selectedRoomId || !this.rooms.some((room) => room.id === this.selectedRoomId)) {
        this.selectedRoomId = this.room?.id || this.firstJoinableRoom()?.id || this.rooms[0]?.id || '';
      }

      this.applyRoomLibrary();
      this.applyRoomSettings();
      this.resumeNetworkGameIfNeeded();
      this.render();
      return;
    }

    if (message.type === 'roomState') {
      this.room = message.room;
      this.selectedRoomId = message.room?.id || this.selectedRoomId;
      this.lobbyMessage = '';
      this.applyRoomLibrary();
      this.applyRoomSettings();
      this.resumeNetworkGameIfNeeded();
      this.render();
      this.applyTurnLock();
      this.updateSnapshotPublishing();
      return;
    }

    if (message.type === 'gameStarted') {
      this.room = message.room;
      this.serverAuthoritative = Boolean(message.serverAuthoritative);
      this.selectedRoomId = message.room?.id || this.selectedRoomId;
      this.lobbyMessage = '';
      this.applyRoomLibrary();
      this.applyRoomSettings();
      this.startLocalMultiplayerGame();
      this.networkGameStarted = true;
      if (this.isHost() && this.serverAuthoritative) {
        this.send('initialSnapshot', { snapshot: this.game.snapshot() });
      }
      this.render();
      this.applyTurnLock();
      this.updateSnapshotPublishing();
      return;
    }

    if (message.type === 'actionRejected') {
      this.lobbyMessage = message.reason || 'That LAN action is not available yet.';
      this.render();
      return;
    }

    if (message.type === 'roomClosed') {
      if (this.room?.id === message.roomId) {
        this.room = null;
      }
      this.networkGameStarted = false;
      this.lobbyMessage = 'That LAN room closed.';
      this.render();
      return;
    }

    if (message.type === 'gameCommand' && this.isHost()) {
      this.game.applyCommand(message.command);
      this.publishSnapshot();
      return;
    }

    if (message.type === 'gameSnapshot') {
      this.room = message.room || this.room;

      if (this.serverAuthoritative || !this.isHost()) {
        this.game.applySnapshot(message.snapshot, { drawNow: true });
      }

      this.applyTurnLock();
    }
  }

  // Ask the server to create a brand-new LAN room.
  //
  // This includes this browser's player name, tank choice, color, designer
  // library, and match settings.
  createRoom() {
    this.ready = false;
    const sent = this.send('createRoom', {
      ...this.playerPayload(),
      library: this.getDesignerLibrary?.() || null,
      settings: this.getMatchSettings?.() || null
    });

    if (!sent) {
      this.pendingHostCreate = true;
    }
  }

  // Make sure Host LAN has an active room.
  //
  // If the socket is not open yet, createRoom remembers that we need to host as
  // soon as the connection finishes.
  ensureHosting() {
    if (this.isHost()) {
      this.publishLibrary();
      this.publishSettings();
      return;
    }

    this.createRoom();
  }

  // Join the first open playable slot in the currently selected room.
  joinFirstOpenSlot() {
    const room = this.activeRoom();
    const slot = room?.slots.find((candidate) => this.isPlayableSlot(candidate) && !candidate.clientId);

    if (!slot) {
      this.setStatus('No open player slots');
      return;
    }

    this.ready = false;
    this.send('joinSlot', { roomId: room.id, slotIndex: slot.index, ...this.playerPayload() });
  }

  // Send player/AI slot counts and match settings to the server.
  configureRoom() {
    this.send('configureRoom', {
      playerSlots: Number(this.elements.playerSlotsInput.value || 2),
      aiSlots: Number(this.elements.aiSlotsInput.value || 0),
      settings: this.getMatchSettings?.() || null
    });
  }

  // Ready means "I am done choosing my player details."
  toggleReady() {
    this.ready = !this.currentSlot()?.ready;
    this.send('setReady', { ready: this.ready });
  }

  // Ask the server to start the LAN game.
  //
  // The server checks whether enough players have joined and marked ready.
  startGame() {
    if (!this.canStart()) {
      this.lobbyMessage = this.startBlockReason();
      this.render();
      return;
    }

    this.send('startGame');
  }

  // Pause or resume the LAN game for everyone in the room.
  togglePause() {
    this.send('pauseGame', { paused: !this.room?.paused });
  }

  // Intercept local game input during LAN play.
  //
  // Returning true means "the multiplayer client handled this; the local game
  // should not also apply it directly."
  handleLocalGameCommand(command) {
    if (!this.room || this.room.phase !== 'playing') {
      return false;
    }

    if (this.serverAuthoritative) {
      if (this.room.paused) {
        return true;
      }

      const currentSlot = this.currentSlot();

      if (!currentSlot || currentSlot.index !== this.room.activeSlotIndex) {
        return true;
      }

      if (this.shouldSendGameCommand(command)) {
        this.send('gameCommand', { command });
      }
      return true;
    }

    if (this.isHost()) {
      const currentSlot = this.currentSlot();
      return Boolean(currentSlot && currentSlot.index !== this.room.activeSlotIndex);
    }

    if (this.room.paused) {
      return true;
    }

    const currentSlot = this.currentSlot();

    if (!currentSlot || currentSlot.index !== this.room.activeSlotIndex) {
      return true;
    }

    if (this.shouldSendGameCommand(command)) {
      this.send('gameCommand', { command });
    }
    return true;
  }

  // Avoid sending endless repeated keyDown messages while a key is held.
  //
  // Browsers repeat keyDown events automatically. The server only needs one
  // keyDown when the key starts and one keyUp when it stops.
  shouldSendGameCommand(command) {
    if (command?.type === 'keyDown') {
      if (this.sentKeyCodes.has(command.code)) {
        return false;
      }

      this.sentKeyCodes.add(command.code);
      return true;
    }

    if (command?.type === 'keyUp') {
      this.sentKeyCodes.delete(command.code);
      return true;
    }

    return true;
  }

  // Old host-authoritative fallback.
  //
  // Current LAN games are server-authoritative after start, so this should not
  // run unless we deliberately support the older mode again.
  updateSnapshotPublishing() {
    if (this.snapshotTimer) {
      window.cancelAnimationFrame(this.snapshotTimer);
      this.snapshotTimer = null;
    }

    if (this.serverAuthoritative || !this.isHost() || this.room?.phase !== 'playing') {
      return;
    }

    this.publishSnapshot();
    const publishLoop = (time) => {
      if (this.serverAuthoritative || !this.isHost() || this.room?.phase !== 'playing') {
        this.snapshotTimer = null;
        return;
      }

      if (time - this.lastSnapshotAt >= 33) {
        this.lastSnapshotAt = time;
        this.publishSnapshot();
      }

      this.snapshotTimer = window.requestAnimationFrame(publishLoop);
    };
    this.snapshotTimer = window.requestAnimationFrame(publishLoop);
  }

  // Send this browser's local snapshot in the old fallback mode.
  publishSnapshot() {
    if (!this.serverAuthoritative && this.isHost() && this.room?.phase === 'playing') {
      this.send('gameSnapshot', { snapshot: this.game.snapshot() });
    }
  }

  // Send the host's current tank/ammo designer library to the room.
  publishLibrary() {
    if (this.isHost()) {
      this.send('updateLibrary', { library: this.getDesignerLibrary?.() || null });
    }
  }

  // Send the host's match settings to the room.
  publishSettings() {
    if (this.isHost()) {
      this.send('updateSettings', { settings: this.getMatchSettings?.() || null });
    }
  }

  // Apply the host's tank/ammo designer data on a joining browser.
  applyRoomLibrary() {
    const room = this.activeRoom();

    if (!room?.library || this.isHost()) {
      return;
    }

    const libraryText = JSON.stringify(room.library);

    if (libraryText === this.lastAppliedLibraryText) {
      return;
    }

    this.lastAppliedLibraryText = libraryText;
    this.applyDesignerLibrary?.(room.library);

    if (this.currentSlot()) {
      this.saveAndSendPlayerDetails();
    }
  }

  // Apply the host's match settings on a joining browser.
  applyRoomSettings() {
    const room = this.activeRoom();

    if (!room?.settings || this.isHost()) {
      return;
    }

    const settingsText = JSON.stringify(room.settings);

    if (settingsText === this.lastAppliedSettingsText) {
      return;
    }

    this.lastAppliedSettingsText = settingsText;
    this.applyMatchSettings?.(room.settings);
  }

  // Start the browser's local ScorchedGame view for a LAN match.
  //
  // In server-authoritative play, this local game becomes a renderer/controller
  // that follows server snapshots.
  startLocalMultiplayerGame() {
    const slots = this.room?.slots.filter((slot) => !slot.isAi).slice(0, 2) || [];
    const localSetup = this.getPlayerSetup();
    const setup = [0, 1].map((index) => ({
      ...localSetup[index],
      name: slots[index]?.name || localSetup[index]?.name || `Player ${index + 1}`,
      modelId: slots[index]?.modelId || localSetup[index]?.modelId,
      color: slots[index]?.color || localSetup[index]?.color
    }));

    this.startLocalGame(setup);
  }

  // Re-open the battlefield after a refresh if this browser reclaimed a slot in
  // an already-running LAN game.
  resumeNetworkGameIfNeeded() {
    if (this.room?.phase !== 'playing' || this.networkGameStarted) {
      return;
    }

    this.serverAuthoritative = this.room.serverAuthoritative !== false;
    this.startLocalMultiplayerGame();
    this.networkGameStarted = true;
    this.applyTurnLock();
  }

  // Store this browser's LAN player details and send them to the server.
  saveAndSendPlayerDetails() {
    const details = this.playerPayload();
    this.name = details.name;
    this.color = details.color;
    localStorage.setItem('tanksLanName.v1', this.name);
    localStorage.setItem('tanksLanColor.v1', this.color);
    localStorage.setItem('tanksLanModel.v1', details.modelId);
    this.send('updateSlot', details);
  }

  // Read the current player name, tank, and color from the UI.
  playerPayload() {
    const details = this.getNetworkPlayerDetails();

    return {
      name: details.name || 'Player',
      modelId: details.modelId || 'p1Custom',
      color: details.color || '#d45745'
    };
  }

  // Redraw the LAN room panel.
  //
  // This rebuilds the room cards and slot rows from the latest server state.
  render() {
    const setupMode = this.elements.setupMode?.() || 'local';
    const room = setupMode === 'host' ? this.room : this.activeRoom();
    const currentSlot = this.currentSlot();
    const isHost = this.isHost();
    const isPlaying = room?.phase === 'playing';

    this.elements.playerSlotsInput.value = String(room?.playerSlots ?? 2);
    this.elements.aiSlotsInput.value = String(room?.aiSlots ?? 0);
    this.elements.applySettingsButton.disabled = !isHost;
    this.elements.startButton.disabled = !isHost || !this.canStart();
    this.elements.startButton.title = isHost ? this.startBlockReason() : 'Only the host can start the LAN game.';
    this.elements.pauseButton.classList.toggle('is-hidden', !isHost || !isPlaying);
    this.elements.pauseButton.disabled = !isHost || !isPlaying;
    this.elements.pauseButton.textContent = room?.paused ? 'Resume LAN Game' : 'Pause LAN Game';
    this.elements.readyButton.disabled = !currentSlot || isPlaying;
    this.elements.readyButton.textContent = currentSlot?.ready ? 'Unready' : 'Ready';
    this.elements.leaveButton.disabled = !currentSlot;
    this.elements.roomHint.textContent = this.lobbyMessage || this.roomHintText(room, currentSlot, isHost);
    this.elements.slotList.textContent = '';

    if (setupMode === 'join') {
      this.renderRoomList(room);
    }

    for (const slot of room?.slots || []) {
      const row = document.createElement('div');
      row.className = 'multiplayer-slot-row';
      row.classList.toggle('is-me', Boolean(this.clientId && slot.clientId === this.clientId));
      row.classList.toggle('is-ai', slot.isAi);
      row.classList.toggle('is-filled', Boolean(slot.clientId || slot.isAi || slot.disconnected));
      row.style.setProperty('--slot-player-color', slot.color);

      const status = slot.isAi
        ? 'AI'
        : !this.isPlayableSlot(slot)
          ? 'Future'
        : slot.disconnected
          ? 'Disconnected'
        : slot.clientId
          ? slot.ready ? 'Ready' : 'Not Ready'
          : 'Open';

      row.innerHTML = `
        <strong>Slot ${slot.index + 1}</strong>
        <span>${slot.clientId || slot.isAi || slot.disconnected ? slot.name : 'Open'}</span>
        <small>${slot.isHost ? 'Host' : status}</small>
      `;

      const actions = document.createElement('span');
      actions.className = 'slot-row-actions';

      if (!slot.clientId && !slot.disconnected && this.isPlayableSlot(slot) && !isPlaying && room?.phase === 'lobby' && setupMode === 'join') {
        actions.append(this.createSlotButton('Join', () => {
          this.ready = false;
          this.send('joinSlot', { roomId: room.id, slotIndex: slot.index, ...this.playerPayload() });
        }));
      }

      if (slot.clientId === this.clientId && !isPlaying) {
        if (!slot.isHost) {
          actions.append(this.createSlotButton(slot.ready ? 'Unready' : 'Ready', () => this.toggleReady()));
        }

        actions.append(this.createSlotButton('Leave', () => this.send('leaveSlot')));
      }

      row.append(actions);

      this.elements.slotList.append(row);
    }
  }

  // Draw the list of LAN rooms on the Join LAN tab.
  renderRoomList(activeRoom) {
    const list = document.createElement('div');
    list.className = 'multiplayer-room-list';

    if (this.rooms.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'multiplayer-empty-note';
      empty.textContent = 'No LAN rooms are waiting yet.';
      this.elements.slotList.append(empty);
      return;
    }

    for (const room of this.rooms) {
      const filledSlots = room.slots.filter((slot) => this.isPlayableSlot(slot) && (slot.clientId || slot.disconnected)).length;
      const playableSlots = room.slots.filter((slot) => this.isPlayableSlot(slot)).length;
      const roomStatus = room.phase === 'playing'
        ? 'Playing'
        : room.phase === 'starting'
          ? 'Starting'
          : 'Waiting';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'multiplayer-room-card';
      button.classList.toggle('is-selected', room.id === activeRoom?.id);
      button.innerHTML = `
        <strong>${room.name || 'Tanks! Game'}</strong>
        <span>${room.id} · ${room.phase === 'playing' ? 'Playing' : 'Waiting'} · ${filledSlots}/${playableSlots}</span>
      `;
      button.querySelector('span').textContent = `${room.id} - ${roomStatus} - ${filledSlots}/${playableSlots}`;
      button.addEventListener('click', () => {
        this.selectedRoomId = room.id;
        this.applyRoomLibrary();
        this.applyRoomSettings();
        this.render();
      });
      list.append(button);
    }

    this.elements.slotList.append(list);
  }

  // Build a small button for a slot row.
  createSlotButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  // Decide whether local input should be enabled.
  //
  // During LAN games, only the active player's browser should control the tank.
  applyTurnLock() {
    if (!this.room || this.room.phase !== 'playing') {
      this.game.setSnapshotOnly(false);
      this.game.setInputEnabled(true);
      return;
    }

    if (this.serverAuthoritative) {
      this.game.setSnapshotOnly(true);
      this.applyNetworkTurnInputLock();
      return;
    }

    this.game.setSnapshotOnly(!this.isHost());

    if (this.isHost()) {
      this.game.setInputEnabled(true);
      return;
    }

    if (this.room.paused) {
      this.game.setInputEnabled(false, 'The LAN game is paused.');
      return;
    }

    this.applyNetworkTurnInputLock();
  }

  // Shared turn-lock logic for server-authoritative and fallback network play.
  applyNetworkTurnInputLock() {
    if (this.room.paused) {
      this.game.setInputEnabled(false, 'The LAN game is paused.');
      return;
    }

    const currentSlot = this.currentSlot();
    const isMyTurn = currentSlot && currentSlot.index === this.room.activeSlotIndex;
    const activeSlot = this.room.slots[this.room.activeSlotIndex];

    this.game.setInputEnabled(
      Boolean(isMyTurn),
      isMyTurn
        ? ''
        : activeSlot?.disconnected
          ? `Waiting for ${activeSlot.name} to reconnect.`
          : activeSlot
            ? `Waiting for ${activeSlot.name}'s turn.`
            : 'Waiting for your turn.'
    );
  }

  // Find this browser's current player slot, if it has one.
  currentSlot() {
    return this.room?.slots.find((slot) => slot.clientId === this.clientId) || null;
  }

  // True when this browser created the room.
  isHost() {
    return Boolean(this.room?.hostId && this.room.hostId === this.clientId);
  }

  // The room the UI should currently show.
  //
  // Host mode shows your own room. Join mode can show a selected room even
  // before you join it.
  activeRoom() {
    if (this.room) {
      return this.room;
    }

    return this.rooms.find((room) => room.id === this.selectedRoomId) || this.firstJoinableRoom() || this.rooms[0] || null;
  }

  // Find the first lobby room with an open playable slot.
  firstJoinableRoom() {
    return this.rooms.find((room) => room.phase !== 'playing' && room.slots.some((slot) => this.isPlayableSlot(slot) && !slot.clientId)) || null;
  }

  // Check whether the room is ready to start.
  canStart() {
    const playerSlots = this.room?.slots.filter((slot) => this.isPlayableSlot(slot)) || [];
    const joinedPlayers = playerSlots.filter((slot) => slot.clientId);
    const readyGuests = joinedPlayers.filter((slot) => slot.clientId !== this.room?.hostId);
    return joinedPlayers.length === 2 && readyGuests.every((slot) => slot.ready);
  }

  // Explain why Start LAN Game is disabled.
  startBlockReason() {
    if (!this.room || this.room.phase === 'empty') {
      return 'Host a LAN room before starting.';
    }

    if (!this.isHost()) {
      return 'Only the host can start the LAN game.';
    }

    if (this.room.phase === 'playing') {
      return 'The LAN game is already running.';
    }

    const joinedPlayers = this.room.slots.filter((slot) => this.isPlayableSlot(slot) && slot.clientId);

    if (joinedPlayers.length < 2) {
      return 'Waiting for player 2 to join.';
    }

    const notReadyGuests = joinedPlayers.filter((slot) => slot.clientId !== this.room.hostId && !slot.ready);

    if (notReadyGuests.length > 0) {
      return `Waiting for ${notReadyGuests.map((slot) => slot.name).join(', ')} to mark ready.`;
    }

    return 'Ready to start.';
  }

  // Return the display name of the room host.
  hostName() {
    return this.room?.slots.find((slot) => slot.clientId === this.room?.hostId)?.name || 'Another player';
  }

  // Only the first two human slots are playable right now.
  //
  // Slots 3-6 are UI scaffolding for later multiplayer expansion.
  isPlayableSlot(slot) {
    return Boolean(slot && !slot.isAi && slot.index < 2);
  }

  // Choose the short hint text at the top of the LAN slots panel.
  roomHintText(room, currentSlot, isHost) {
    if (!room || room.phase === 'empty') {
      return 'Host or join a room to use these slots';
    }

    if (room.phase === 'starting') {
      return 'Starting LAN game...';
    }

    if (room.phase === 'playing') {
      const disconnectedSlots = room.slots.filter((slot) => slot.disconnected);

      if (disconnectedSlots.length > 0) {
        return `Paused; waiting for ${disconnectedSlots.map((slot) => slot.name).join(', ')} to reconnect`;
      }

      return room.paused ? 'LAN game paused' : 'LAN game in progress';
    }

    if (isHost) {
      return this.startBlockReason();
    }

    if (currentSlot) {
      return currentSlot.ready ? 'Ready; waiting for host to start' : 'Join complete; mark ready when you are set';
    }

    return 'Choose an open slot to join this room';
  }

  // Update the small connection status label.
  setStatus(status) {
    this.elements.status.textContent = status;
  }

  // Send a JSON message to the WebSocket server.
  //
  // Returns false if the socket is not ready yet.
  send(type, payload = {}) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, ...payload }));
      return true;
    }

    return false;
  }
}

// Give this browser a stable LAN identity.
//
// This is not a real login. It is just enough for "I refreshed my browser" to
// reclaim the same LAN slot during an active game.
function stablePlayerToken() {
  const existingToken = localStorage.getItem('tanksLanPlayerToken.v1');

  if (existingToken) {
    return existingToken;
  }

  const token = crypto.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem('tanksLanPlayerToken.v1', token);
  return token;
}
