/* Connect 4 engine: board rules + bot. No DOM access. */
(function (root) {
  'use strict';
  var ROWS = 6, COLS = 7;
  var ORDER = [3, 2, 4, 1, 5, 0, 6]; // centre first = better pruning
  var DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  function newBoard() {
    var b = [];
    for (var r = 0; r < ROWS; r++) b.push(new Array(COLS).fill(0));
    return b;
  }
  function copyBoard(b) { return b.map(function (row) { return row.slice(); }); }
  function lowestEmpty(b, c) {
    for (var r = ROWS - 1; r >= 0; r--) if (b[r][c] === 0) return r;
    return -1;
  }
  function legalMoves(b) {
    return ORDER.filter(function (c) { return b[0][c] === 0; });
  }
  // Returns the winning line (array of [r,c]) through (r,c) for player p, or null.
  function findWin(b, r, c, p) {
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1];
      var cells = [[r, c]];
      var rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === p) { cells.push([rr, cc]); rr += dr; cc += dc; }
      rr = r - dr; cc = c - dc;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === p) { cells.push([rr, cc]); rr -= dr; cc -= dc; }
      if (cells.length >= 4) return cells;
    }
    return null;
  }
  function wins(b, r, c, p) {
    for (var d = 0; d < 4; d++) {
      var dr = DIRS[d][0], dc = DIRS[d][1], n = 1;
      var rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === p) { n++; rr += dr; cc += dc; }
      rr = r - dr; cc = c - dc;
      while (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && b[rr][cc] === p) { n++; rr -= dr; cc -= dc; }
      if (n >= 4) return true;
    }
    return false;
  }
  function winsIfPlayed(b, c, p) {
    var r = lowestEmpty(b, c);
    if (r < 0) return false;
    b[r][c] = p;
    var w = wins(b, r, c, p);
    b[r][c] = 0;
    return w;
  }

  function windowScore(a, b) { // a = my discs, b = opponent discs in a window of 4
    if (a && b) return 0;
    if (a === 3) return 50;
    if (a === 2) return 8;
    if (b === 3) return -60;
    if (b === 2) return -6;
    return 0;
  }
  function evaluate(b, me) {
    var score = 0, r, c, k, a, o, v;
    for (r = 0; r < ROWS; r++) {
      v = b[r][3];
      if (v === me) score += 4; else if (v) score -= 4;
    }
    for (r = 0; r < ROWS; r++) for (c = 0; c < COLS; c++) {
      for (var d = 0; d < 4; d++) {
        var er = r + DIRS[d][0] * 3, ec = c + DIRS[d][1] * 3;
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue;
        a = 0; o = 0;
        for (k = 0; k < 4; k++) {
          v = b[r + DIRS[d][0] * k][c + DIRS[d][1] * k];
          if (v === me) a++; else if (v) o++;
        }
        score += windowScore(a, o);
      }
    }
    return score;
  }
  function search(b, depth, alpha, beta, player, me) {
    var moves = legalMoves(b);
    if (!moves.length) return 0;
    if (depth === 0) return evaluate(b, me);
    var best = player === me ? -Infinity : Infinity;
    for (var i = 0; i < moves.length; i++) {
      var c = moves[i], r = lowestEmpty(b, c), val;
      b[r][c] = player;
      if (wins(b, r, c, player)) val = (player === me ? 1 : -1) * (1000000 + depth);
      else val = search(b, depth - 1, alpha, beta, 3 - player, me);
      b[r][c] = 0;
      if (player === me) { if (val > best) best = val; if (best > alpha) alpha = best; }
      else { if (val < best) best = val; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var DEPTH = { medium: 4, hard: 6 };

  function chooseMove(board, me, difficulty) {
    var b = copyBoard(board), opp = 3 - me, moves = legalMoves(b), i;
    if (!moves.length) return -1;

    if (difficulty === 'easy') {
      if (Math.random() < 0.3) return pick(moves);
      for (i = 0; i < moves.length; i++) if (winsIfPlayed(b, moves[i], me)) return moves[i];
      if (Math.random() < 0.7) for (i = 0; i < moves.length; i++) if (winsIfPlayed(b, moves[i], opp)) return moves[i];
      return pick(moves);
    }

    for (i = 0; i < moves.length; i++) if (winsIfPlayed(b, moves[i], me)) return moves[i];
    for (i = 0; i < moves.length; i++) if (winsIfPlayed(b, moves[i], opp)) return moves[i];

    var depth = DEPTH[difficulty] || 4, scores = [], best = -Infinity;
    for (i = 0; i < moves.length; i++) {
      var c = moves[i], r = lowestEmpty(b, c), val;
      b[r][c] = me;
      val = search(b, depth - 1, -Infinity, Infinity, opp, me);
      b[r][c] = 0;
      scores.push([c, val]);
      if (val > best) best = val;
    }
    var top = scores.filter(function (s) { return s[1] === best; }).map(function (s) { return s[0]; });
    return pick(top);
  }

  var api = {
    ROWS: ROWS, COLS: COLS, newBoard: newBoard, copyBoard: copyBoard, lowestEmpty: lowestEmpty,
    legalMoves: legalMoves, findWin: findWin, chooseMove: chooseMove
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.C4Engine = api;
})(this);
