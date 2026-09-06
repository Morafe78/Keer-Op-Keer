(function () {
  const socket = io();
  const STORAGE_KEY = 'keerOpKeer.session';

  let layout = null;
  let game = null; // last full state from server
  let myPlayerId = null;
  let myToken = null;
  let viewingPlayerId = null; // whose board is currently shown in the game view
  let selectedDiceIds = []; // client-side only, for the reserve-2-dice step

  const views = {
    landing: document.getElementById('view-landing'),
    lobby: document.getElementById('view-lobby'),
    game: document.getElementById('view-game'),
    ended: document.getElementById('view-ended')
  };

  function showView(name) {
    Object.entries(views).forEach(([key, el]) => el.classList.toggle('hidden', key !== name));
  }

  function saveSession(code, token) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, token }));
  }
  function clearSession() {
    localStorage.removeItem(STORAGE_KEY);
  }
  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  }

  // ---------- Landing ----------
  const landingError = document.getElementById('landingError');
  function setLandingError(msg) {
    landingError.textContent = msg || '';
    landingError.classList.toggle('hidden', !msg);
  }

  document.getElementById('btnCreate').addEventListener('click', () => {
    const name = document.getElementById('createName').value.trim();
    if (!name) return setLandingError('Please enter your name.');
    socket.emit('create', { name }, (res) => {
      if (!res.ok) return setLandingError(res.error);
      myPlayerId = res.playerId;
      myToken = res.token;
      saveSession(res.code, res.token);
      setLandingError('');
    });
  });

  document.getElementById('btnJoin').addEventListener('click', () => {
    const code = document.getElementById('joinCode').value.trim().toUpperCase();
    const name = document.getElementById('joinName').value.trim();
    if (!code) return setLandingError('Please enter a room code.');
    if (!name) return setLandingError('Please enter your name.');
    socket.emit('join', { code, name }, (res) => {
      if (!res.ok) return setLandingError(res.error);
      myPlayerId = res.playerId;
      myToken = res.token;
      saveSession(res.code, res.token);
      setLandingError('');
    });
  });

  // ---------- Lobby ----------
  document.getElementById('btnStart').addEventListener('click', () => {
    socket.emit('start', {}, (res) => {
      if (!res.ok) alert(res.error);
    });
  });

  // ---------- Game toolbar ----------
  document.getElementById('btnStop').addEventListener('click', () => {
    if (!confirm('Stop the game for everyone?')) return;
    socket.emit('stop', {}, (res) => {
      if (!res.ok) alert(res.error);
    });
  });
  document.getElementById('btnSkip').addEventListener('click', () => {
    socket.emit('skipTurn', {}, (res) => {
      if (!res.ok) alert(res.error);
    });
  });

  // ---------- Socket state ----------
  socket.on('state', (g) => {
    game = g;
    render();
  });

  socket.on('connect', () => {
    const session = loadSession();
    if (session && session.code && session.token) {
      socket.emit('join', { code: session.code, token: session.token }, (res) => {
        if (res.ok) {
          myPlayerId = res.playerId;
          myToken = res.token;
        } else {
          clearSession();
          render();
        }
      });
    }
  });

  fetch('/api/layout')
    .then((r) => r.json())
    .then((data) => {
      layout = data;
      render();
    });

  // ---------- Rendering ----------
  function render() {
    if (!layout) return;

    if (!game) {
      showView('landing');
      return;
    }

    document.getElementById('roomBadge').textContent = `Room ${game.code}`;
    document.getElementById('roomBadge').classList.remove('hidden');

    if (game.status === 'lobby') {
      showView('lobby');
      renderLobby();
    } else if (game.status === 'active') {
      showView('game');
      renderGame();
    } else if (game.status === 'ended') {
      showView('ended');
      renderEnded();
    }
  }

  function me() {
    return game.players.find((p) => p.id === myPlayerId);
  }

  function renderLobby() {
    document.getElementById('lobbyCode').textContent = game.code;
    const list = document.getElementById('lobbyPlayers');
    list.innerHTML = '';
    game.players.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p.name;
      if (p.isAdmin) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = 'Admin';
        li.appendChild(b);
      }
      if (!p.connected) {
        const b = document.createElement('span');
        b.className = 'badge';
        b.textContent = 'offline';
        li.appendChild(b);
      }
      list.appendChild(li);
    });

    const self = me();
    const startBtn = document.getElementById('btnStart');
    const hint = document.getElementById('lobbyHint');
    if (self && self.isAdmin) {
      startBtn.classList.remove('hidden');
      startBtn.disabled = game.players.length < 1;
      hint.textContent = game.players.length < 2 ? 'You can start solo to try it out, or wait for friends to join (up to 6).' : '';
    } else {
      startBtn.classList.add('hidden');
      hint.textContent = 'Waiting for the admin to start the game…';
    }
  }

  function renderGame() {
    const self = me();
    const isAdmin = self && self.isAdmin;
    const isCurrentRoller = self && self.id === game.currentRollerId;

    document.getElementById('btnStop').classList.toggle('hidden', !isAdmin);
    document.getElementById('btnSkip').classList.toggle('hidden', !isAdmin);

    // Player strip
    const strip = document.getElementById('playerStrip');
    strip.innerHTML = '';
    game.players.forEach((p) => {
      const chip = document.createElement('div');
      chip.className = 'player-chip';
      if (p.id === game.currentRollerId) chip.classList.add('current-roller');
      if (!p.connected) chip.classList.add('disconnected');
      chip.textContent = p.name + (p.isAdmin ? ' 👑' : '');
      strip.appendChild(chip);
    });

    // Turn banner
    const rollerName = game.players.find((p) => p.id === game.currentRollerId)?.name || '?';
    const banner = document.getElementById('turnBanner');
    banner.textContent = isCurrentRoller
      ? `Roll ${game.rollNumber + 1}: It's your turn to roll!`
      : `Roll ${game.rollNumber + 1}: waiting for ${rollerName} to roll…`;

    renderDice(isCurrentRoller);
    renderBoardTabs();
    if (!viewingPlayerId || !game.players.some((p) => p.id === viewingPlayerId)) {
      viewingPlayerId = myPlayerId;
    }
    const viewedPlayer = game.players.find((p) => p.id === viewingPlayerId);
    const readonly = viewingPlayerId !== myPlayerId;
    renderBoard(document.getElementById('boardContainer'), viewedPlayer.board, { readonly });
  }

  function renderDice(isCurrentRoller) {
    const diceArea = document.getElementById('diceArea');
    const diceActions = document.getElementById('diceActions');
    diceArea.innerHTML = '';
    diceActions.innerHTML = '';

    if (!game.dice) {
      if (isCurrentRoller) {
        const btn = document.createElement('button');
        btn.className = 'primary';
        btn.textContent = 'Roll Dice';
        btn.addEventListener('click', () => socket.emit('roll', {}, (res) => { if (!res.ok) alert(res.error); }));
        diceActions.appendChild(btn);
      }
      return;
    }

    const needsReserve = game.rollNumber >= game.reserveFromRoll;
    const alreadyReserved = game.reservedDice.length === 2;
    const reservingNow = isCurrentRoller && needsReserve && !alreadyReserved;

    game.dice.forEach((die) => {
      const el = document.createElement('div');
      el.className = `die ${die.kind === 'number' ? 'number' : 'color-' + die.value}`;
      el.textContent = die.kind === 'number' ? die.value : die.value[0].toUpperCase();
      el.title = die.kind === 'number' ? `Number: ${die.value}` : `Colour: ${die.value}`;

      const isReserved = game.reservedDice.includes(die.id);
      if (isReserved) {
        el.classList.add(isCurrentRoller ? 'reserved' : 'reserved-other');
        const tag = document.createElement('span');
        tag.className = 'die-tag';
        tag.textContent = isCurrentRoller ? 'yours' : 'reserved';
        el.appendChild(tag);
      } else if (reservingNow) {
        el.classList.add('selectable');
        if (selectedDiceIds.includes(die.id)) el.classList.add('selected');
        el.addEventListener('click', () => toggleDieSelection(die));
      }

      diceArea.appendChild(el);
    });

    if (reservingNow) {
      const info = document.createElement('span');
      info.className = 'hint';
      info.textContent = 'Set aside one number die + one colour die for yourself.';
      diceActions.appendChild(info);

      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'primary';
      confirmBtn.textContent = 'Set Aside Selected';
      confirmBtn.disabled = selectedDiceIds.length !== 2;
      confirmBtn.addEventListener('click', () => {
        socket.emit('reserveDice', { dieIds: selectedDiceIds }, (res) => {
          if (!res.ok) alert(res.error);
          selectedDiceIds = [];
        });
      });
      diceActions.appendChild(confirmBtn);
      return;
    }

    if (isCurrentRoller) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'primary';
      nextBtn.textContent = 'Next Roll';
      nextBtn.addEventListener('click', () => socket.emit('nextRoll', {}, (res) => { if (!res.ok) alert(res.error); }));
      diceActions.appendChild(nextBtn);
    } else {
      const info = document.createElement('span');
      info.className = 'hint';
      info.textContent = 'Mark your board, then wait for the roller to move to the next roll.';
      diceActions.appendChild(info);
    }
  }

  function toggleDieSelection(die) {
    if (selectedDiceIds.includes(die.id)) {
      selectedDiceIds = selectedDiceIds.filter((id) => id !== die.id);
    } else {
      const already = selectedDiceIds
        .map((id) => game.dice.find((d) => d.id === id))
        .find((d) => d.kind === die.kind);
      if (already) selectedDiceIds = selectedDiceIds.filter((id) => id !== already.id);
      selectedDiceIds.push(die.id);
    }
    renderDice(true);
  }

  function renderBoardTabs() {
    const tabs = document.getElementById('boardTabs');
    tabs.innerHTML = '';
    game.players.forEach((p) => {
      const btn = document.createElement('button');
      btn.className = 'small' + (p.id === viewingPlayerId ? ' active' : '');
      btn.textContent = p.id === myPlayerId ? `${p.name} (you)` : p.name;
      btn.addEventListener('click', () => {
        viewingPlayerId = p.id;
        renderGame();
      });
      tabs.appendChild(btn);
    });
  }

  function renderEnded() {
    document.getElementById('btnStop').classList.add('hidden');
    document.getElementById('btnSkip').classList.add('hidden');

    const list = document.getElementById('finalScores');
    list.innerHTML = '';
    const ranked = [...game.players].sort((a, b) => (Number(b.board.scores.total) || 0) - (Number(a.board.scores.total) || 0));
    ranked.forEach((p) => {
      const li = document.createElement('li');
      const total = p.board.scores.total === '' ? '—' : p.board.scores.total;
      li.textContent = `${p.name}: ${total}`;
      list.appendChild(li);
    });

    if (!viewingPlayerId || !game.players.some((p) => p.id === viewingPlayerId)) {
      viewingPlayerId = myPlayerId;
    }
    const viewedPlayer = game.players.find((p) => p.id === viewingPlayerId);
    renderBoard(document.getElementById('boardContainerEnded'), viewedPlayer.board, { readonly: true });
  }

  // ---------- Board rendering (shared by game + ended views) ----------
  function renderBoard(container, board, { readonly }) {
    container.innerHTML = '';
    if (readonly) container.classList.add('board-readonly');
    else container.classList.remove('board-readonly');

    const layoutBlock = document.createElement('div');
    layoutBlock.className = 'board-layout';

    const mainBlock = document.createElement('div');
    mainBlock.className = 'main-grid-block';

    // Column headers
    const headerRow = document.createElement('div');
    headerRow.className = 'col-headers';
    layout.columnLetters.forEach((letter, idx) => {
      const d = document.createElement('div');
      d.textContent = letter;
      if (idx === 7) d.classList.add('mid-col'); // column H, per the physical board
      headerRow.appendChild(d);
    });
    mainBlock.appendChild(headerRow);

    // Colour grid
    layout.mainGrid.forEach((row, r) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'grid-row';
      row.forEach((cellDef, c) => {
        const marked = board.mainGrid[r][c];
        const cell = document.createElement('div');
        cell.className = `cell bg-${cellDef.color}${cellDef.star ? ' star' : ''}${marked ? ' marked' : ''}${readonly ? ' readonly' : ''}`;
        if (!readonly) {
          cell.addEventListener('click', () => sendBoardUpdate({ section: 'mainGrid', row: r, col: c }));
        }
        rowEl.appendChild(cell);
      });
      mainBlock.appendChild(rowEl);
    });

    // Number rows
    ['numberRowTop', 'numberRowBottom'].forEach((section) => {
      const rowEl = document.createElement('div');
      rowEl.className = 'number-row';
      const numbers = layout[section];
      numbers.forEach((num, c) => {
        const state = board[section][c];
        const cell = document.createElement('div');
        cell.className = `number-cell${readonly ? ' readonly' : ''}`;
        const numSpan = document.createElement('span');
        numSpan.className = 'num';
        numSpan.textContent = num;
        cell.appendChild(numSpan);
        if (state !== 'blank') {
          const mark = document.createElement('span');
          mark.className = `mark ${state}`;
          mark.textContent = state;
          cell.appendChild(mark);
        }
        if (!readonly) cell.addEventListener('click', () => sendBoardUpdate({ section, col: c }));
        rowEl.appendChild(cell);
      });
      mainBlock.appendChild(rowEl);
    });

    // Exclaim row
    const exRow = document.createElement('div');
    exRow.className = 'exclaim-row';
    for (let i = 0; i < layout.exclaimCount; i++) {
      const marked = board.exclaimRow[i];
      const cell = document.createElement('div');
      cell.className = `exclaim-cell${marked ? ' marked' : ''}${readonly ? ' readonly' : ''}`;
      cell.textContent = '!';
      if (!readonly) cell.addEventListener('click', () => sendBoardUpdate({ section: 'exclaimRow', index: i }));
      exRow.appendChild(cell);
    }
    mainBlock.appendChild(exRow);

    // Side columns (5s and 3s) + score fields
    const sideBlock = document.createElement('div');
    sideBlock.className = 'side-block';

    const sideCols = document.createElement('div');
    sideCols.className = 'side-columns';
    board.sideColumns.forEach((entry, colorIndex) => {
      const row = document.createElement('div');
      row.className = 'side-row';

      const swatch = document.createElement('div');
      swatch.className = `side-swatch bg-${entry.color}`;
      row.appendChild(swatch);

      ['five', 'three'].forEach((column) => {
        const val = layout.sideColumnValues[column];
        const state = entry[column];
        const cell = document.createElement('div');
        cell.className = `side-cell${readonly ? ' readonly' : ''}`;
        cell.innerHTML = `<span>${val}</span>` + (state !== 'blank' ? `<span class="mark ${state}">${state}</span>` : '');
        if (!readonly) cell.addEventListener('click', () => sendBoardUpdate({ section: 'sideColumn', colorIndex, column }));
        row.appendChild(cell);
      });

      sideCols.appendChild(row);
    });
    sideBlock.appendChild(sideCols);

    const scoreFields = document.createElement('div');
    scoreFields.className = 'score-fields';
    layout.scoreFields.forEach((field) => {
      const wrap = document.createElement('div');
      wrap.className = 'score-field';
      const label = document.createElement('label');
      label.textContent = `${field.label} ${field.sign}`;
      const input = document.createElement('input');
      input.type = 'number';
      input.min = 0;
      input.max = 50;
      input.value = board.scores[field.key];
      input.disabled = readonly;
      input.addEventListener('change', () => sendBoardUpdate({ section: 'score', key: field.key, value: input.value }));
      wrap.appendChild(label);
      wrap.appendChild(input);
      scoreFields.appendChild(wrap);
    });
    sideBlock.appendChild(scoreFields);

    if (!readonly) {
      const note = document.createElement('p');
      note.className = 'assumption-note';
      note.textContent = 'Colour grid is transcribed from the physical board — spot a mismatched cell? Edit server/boardLayout.js to fix it for everyone.';
      sideBlock.appendChild(note);
    }

    layoutBlock.appendChild(mainBlock);
    layoutBlock.appendChild(sideBlock);
    container.appendChild(layoutBlock);
  }

  function sendBoardUpdate(action) {
    socket.emit('updateBoard', action, (res) => {
      if (!res.ok) alert(res.error);
    });
  }
})();
