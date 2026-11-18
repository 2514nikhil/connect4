(function () {
  'use strict';
  var E = window.C4Engine, ROWS = E.ROWS, COLS = E.COLS;
  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var settings = { mode: 'bot', diff: 'medium', side: '1' };
  var state = {
    mode: 'bot', diff: 'medium', human: 1, bot: 2,
    board: null, turn: 1, history: [], over: false, busy: false,
    scores: [0, 0], starter: 1, token: 0, botTimer: null, sheetTimer: null
  };

  var boardEl = $('#board'), slotsEl = $('#slots'), sheet = $('#sheet');
  var cells = [], slots = [];

  /* ---------- build board ---------- */
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r; cell.dataset.c = c;
      cell.setAttribute('role', 'gridcell');
      boardEl.appendChild(cell);
      cells.push(cell);
    }
  }
  for (c = 0; c < COLS; c++) {
    var s = document.createElement('div');
    s.className = 'slot disc';
    slotsEl.appendChild(s);
    slots.push(s);
  }
  function cellAt(r, c) { return cells[r * COLS + c]; }

  /* ---------- menu ---------- */
  function syncMenu() {
    $$('.seg').forEach(function (seg) {
      Array.prototype.forEach.call(seg.querySelectorAll('button'), function (b) {
        b.setAttribute('aria-pressed', String(settings[seg.dataset.key] === b.dataset.value));
      });
    });
    $$('.bot-only').forEach(function (el) { el.hidden = settings.mode !== 'bot'; });
  }
  $$('.seg').forEach(function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      settings[seg.dataset.key] = b.dataset.value;
      syncMenu();
    });
  });
  syncMenu();

  function show(id) {
    $$('.screen').forEach(function (el) { el.classList.toggle('active', el.id === id); });
  }

  /* ---------- helpers ---------- */
  function name(p) {
    if (state.mode === 'pvp') return p === 1 ? 'Player 1' : 'Player 2';
    return p === state.human ? 'You' : 'Bot';
  }
  function colorName(p) { return p === 1 ? 'Coral' : 'Gold'; }
  function isBotTurn() { return state.mode === 'bot' && state.turn === state.bot; }

  function updateScores() {
    [1, 2].forEach(function (p) {
      var el = $('#score' + p);
      el.querySelector('.nm').textContent = name(p);
      el.querySelector('b').textContent = state.scores[p - 1];
      el.classList.toggle('active', !state.over && state.turn === p);
    });
  }
  function setStatus(text, p, thinking) {
    $('#statusText').textContent = text;
    var dot = $('#statusDot');
    dot.className = 'dot' + (p ? ' p' + p : '');
    dot.style.visibility = p ? 'visible' : 'hidden';
    $('#status').classList.toggle('thinking', !!thinking);
  }
  function updateTurnStatus() {
    updateScores();
    if (state.mode === 'bot') {
      if (isBotTurn()) setStatus('Bot is thinking', state.turn, true);
      else setStatus('Your turn', state.turn);
    } else {
      setStatus(name(state.turn) + '\u2019s turn', state.turn);
    }
    $('#undoBtn').disabled = state.over || state.busy || state.history.length === 0;
    showGhost(-1);
  }
  function showGhost(col) {
    slots.forEach(function (s, i) {
      var on = i === col && !state.over && !state.busy && !isBotTurn();
      s.classList.toggle('on', on);
      s.classList.remove('p1', 'p2');
      s.classList.add('p' + state.turn);
    });
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------- round flow ---------- */
  function clearDiscs() {
    cells.forEach(function (cell) { while (cell.firstChild) cell.removeChild(cell.firstChild); });
  }
  function hideSheet() {
    clearTimeout(state.sheetTimer);
    sheet.classList.remove('show');
    sheet.setAttribute('aria-hidden', 'true');
  }
  function newRound() {
    state.token++;
    clearTimeout(state.botTimer);
    hideSheet();
    state.board = E.newBoard();
    state.history = [];
    state.over = false;
    state.busy = false;
    state.turn = state.starter;
    clearDiscs();
    updateTurnStatus();
    maybeBot();
  }
  function startSession() {
    state.mode = settings.mode;
    state.diff = settings.diff;
    state.human = Number(settings.side);
    state.bot = 3 - state.human;
    state.scores = [0, 0];
    state.starter = 1;
    show('game');
    newRound();
  }

  function addDisc(r, c, p) {
    var d = document.createElement('div');
    d.className = 'disc p' + p;
    var dur = 160 + (r + 1) * 55;
    d.style.setProperty('--drop', r + 1);
    d.style.setProperty('--dur', dur + 'ms');
    cellAt(r, c).appendChild(d);
    return dur + 40;
  }

  function applyMove(col) {
    var r = E.lowestEmpty(state.board, col);
    if (r < 0) { buzz(30); return; }
    var p = state.turn, tok = state.token;
    state.board[r][col] = p;
    state.history.push({ r: r, c: col, p: p });
    var dur = addDisc(r, col, p);
    var line = E.findWin(state.board, r, col, p);
    state.busy = true;
    showGhost(-1);
    $('#undoBtn').disabled = true;
    buzz(12);
    setTimeout(function () {
      if (tok !== state.token) return;
      state.busy = false;
      if (line) finish(line, p);
      else if (state.history.length === ROWS * COLS) finish(null, 0);
      else { state.turn = 3 - p; updateTurnStatus(); maybeBot(); }
    }, dur);
  }

  function maybeBot() {
    if (state.over || !isBotTurn()) return;
    var tok = state.token;
    state.busy = true;
    updateTurnStatus();
    state.botTimer = setTimeout(function () {
      if (tok !== state.token) return;
      var col = E.chooseMove(state.board, state.bot, state.diff);
      state.busy = false;
      applyMove(col);
    }, 450 + Math.random() * 350);
  }

  function finish(line, p) {
    state.over = true;
    var tok = state.token, title, sub;
    if (line) {
      line.forEach(function (rc) {
        var d = cellAt(rc[0], rc[1]).firstChild;
        if (d) d.classList.add('win');
      });
      state.scores[p - 1]++;
      if (state.mode === 'bot') {
        title = p === state.human ? 'You win!' : 'Bot wins';
        sub = p === state.human ? 'Four in a row. Nicely done.' : 'Try again, or lower the bot level from the menu.';
      } else {
        title = name(p) + ' wins!';
        sub = colorName(p) + ' connected four.';
      }
      setStatus(title, p);
      buzz([30, 40, 30]);
    } else {
      title = 'It\u2019s a draw';
      sub = 'The board is full.';
      setStatus(title, 0);
    }
    updateScores();
    $('#undoBtn').disabled = true;
    $('#sheetTitle').textContent = title;
    $('#sheetSub').textContent = sub;
    state.sheetTimer = setTimeout(function () {
      if (tok !== state.token) return;
      sheet.classList.add('show');
      sheet.setAttribute('aria-hidden', 'false');
    }, 900);
  }

  function undo() {
    if (state.busy || state.over || !state.history.length) return;
    var last;
    do {
      last = state.history.pop();
      state.board[last.r][last.c] = 0;
      var cell = cellAt(last.r, last.c);
      while (cell.firstChild) cell.removeChild(cell.firstChild);
    } while (state.mode === 'bot' && last.p !== state.human && state.history.length);
    state.turn = last.p;
    state.token++;
    updateTurnStatus();
    maybeBot();
  }

  /* ---------- input ---------- */
  function humanMove(col) {
    if (state.over || state.busy || isBotTurn()) return;
    applyMove(col);
  }
  boardEl.addEventListener('click', function (e) {
    var cell = e.target.closest('.cell');
    if (cell) humanMove(Number(cell.dataset.c));
  });
  boardEl.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    var cell = e.target.closest('.cell');
    showGhost(cell ? Number(cell.dataset.c) : -1);
  });
  boardEl.addEventListener('pointerleave', function () { showGhost(-1); });
  document.addEventListener('keydown', function (e) {
    if (!$('#game').classList.contains('active')) return;
    var n = parseInt(e.key, 10);
    if (n >= 1 && n <= COLS) humanMove(n - 1);
  });

  $('#startBtn').addEventListener('click', startSession);
  $('#undoBtn').addEventListener('click', undo);
  $('#restartBtn').addEventListener('click', function () {
    if (!state.over && state.history.length > 1 && !confirm('Restart this game?')) return;
    newRound();
  });
  $('#againBtn').addEventListener('click', function () {
    state.starter = 3 - state.starter;
    newRound();
  });
  function toMenu() {
    if (!state.over && state.history.length > 1 && !confirm('Leave this game? Scores will reset.')) return;
    state.token++;
    clearTimeout(state.botTimer);
    hideSheet();
    show('menu');
  }
  $('#menuBtn').addEventListener('click', toMenu);
  $('#sheetMenuBtn').addEventListener('click', toMenu);
})();
