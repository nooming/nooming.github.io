/*!
 * Gomoku engine — board state, pattern evaluation and alpha-beta search.
 * Pure JavaScript, no DOM access, no dependencies. Works in browsers,
 * web workers and Node.js (CommonJS).
 *
 * Board: flat Int8Array(225), index = row * 15 + col, 0 empty, 1 black, 2 white.
 * Evaluation: every row / column / diagonal of length >= 5 is scored from
 * base-3 windows (5 windows for runs, 6 windows for open-four / open-three
 * bonuses). Scores are maintained incrementally on every move.
 */
(function (root) {
  'use strict';

  const SIZE = 15;
  const CELLS = SIZE * SIZE;
  const EMPTY = 0;
  const BLACK = 1;
  const WHITE = 2;
  const WIN_SCORE = 1e9;
  const WIN_THRESHOLD = 1e8;
  const ABORT = { toString: () => 'search-aborted' };

  const now = (typeof performance !== 'undefined' && typeof performance.now === 'function')
    ? () => performance.now()
    : () => Date.now();

  /* ------------------------------------------------------------------ *
   * Deterministic Zobrist keys
   * ------------------------------------------------------------------ */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const rand = mulberry32(0x9e3779b9);
  const Z1 = [new Int32Array(CELLS), new Int32Array(CELLS)];
  const Z2 = [new Int32Array(CELLS), new Int32Array(CELLS)];
  for (let p = 0; p < 2; p++) {
    for (let i = 0; i < CELLS; i++) {
      Z1[p][i] = (rand() * 4294967296) | 0;
      Z2[p][i] = (rand() * 4294967296) | 0;
    }
  }
  const TURN_KEY1 = (rand() * 4294967296) | 0;
  const TURN_KEY2 = (rand() * 4294967296) | 0;

  /* ------------------------------------------------------------------ *
   * Lines (rows, columns and both diagonal families, length >= 5)
   * ------------------------------------------------------------------ */
  const LINES = [];
  const CELL_LINES = [];
  for (let i = 0; i < CELLS; i++) CELL_LINES.push([]);

  function addLine(cells) {
    if (cells.length < 5) return;
    const id = LINES.length;
    LINES.push(Int16Array.from(cells));
    for (let i = 0; i < cells.length; i++) CELL_LINES[cells[i]].push(id);
  }

  for (let r = 0; r < SIZE; r++) {
    const row = [];
    for (let c = 0; c < SIZE; c++) row.push(r * SIZE + c);
    addLine(row);
  }
  for (let c = 0; c < SIZE; c++) {
    const col = [];
    for (let r = 0; r < SIZE; r++) col.push(r * SIZE + c);
    addLine(col);
  }
  // "\" diagonals: start on the top row, then the left column.
  for (let c = 0; c < SIZE; c++) {
    const line = [];
    for (let r = 0, cc = c; r < SIZE && cc < SIZE; r++, cc++) line.push(r * SIZE + cc);
    addLine(line);
  }
  for (let r = 1; r < SIZE; r++) {
    const line = [];
    for (let rr = r, c = 0; rr < SIZE && c < SIZE; rr++, c++) line.push(rr * SIZE + c);
    addLine(line);
  }
  // "/" diagonals: start on the top row, then the right column.
  for (let c = 0; c < SIZE; c++) {
    const line = [];
    for (let r = 0, cc = c; r < SIZE && cc >= 0; r++, cc--) line.push(r * SIZE + cc);
    addLine(line);
  }
  for (let r = 1; r < SIZE; r++) {
    const line = [];
    for (let rr = r, c = SIZE - 1; rr < SIZE && c >= 0; rr++, c--) line.push(rr * SIZE + c);
    addLine(line);
  }

  for (let i = 0; i < CELLS; i++) CELL_LINES[i] = Uint8Array.from(CELL_LINES[i]);
  const LINE_COUNT = LINES.length;

  /* ------------------------------------------------------------------ *
   * Pattern tables
   * ------------------------------------------------------------------ */
  const W5 = [0, 1, 12, 180, 12000, 10000000];
  const OPEN_FOUR_BONUS = 400000;
  const OPEN_THREE_BONUS = 4000;

  const W5_1 = new Float64Array(243);
  const W5_2 = new Float64Array(243);
  const B6_1 = new Float64Array(729);
  const B6_2 = new Float64Array(729);

  const OPEN_FOUR = [0, 1, 1, 1, 1, 0];
  const OPEN_THREES = [
    [0, 0, 1, 1, 1, 0],
    [0, 1, 0, 1, 1, 0],
    [0, 1, 1, 0, 1, 0],
    [0, 1, 1, 1, 0, 0],
  ];

  function samePattern(digits, pattern) {
    for (let i = 0; i < 6; i++) if (digits[i] !== pattern[i]) return false;
    return true;
  }

  (function buildTables() {
    const d5 = new Array(5);
    for (let code = 0; code < 243; code++) {
      let v = code;
      for (let i = 4; i >= 0; i--) {
        d5[i] = v % 3;
        v = (v - d5[i]) / 3;
      }
      let ok1 = true;
      let ok2 = true;
      let n1 = 0;
      let n2 = 0;
      for (let i = 0; i < 5; i++) {
        if (d5[i] === 2) ok1 = false;
        if (d5[i] === 1) ok2 = false;
        if (d5[i] === 1) n1++;
        if (d5[i] === 2) n2++;
      }
      if (ok1) W5_1[code] = W5[n1];
      if (ok2) W5_2[code] = W5[n2];
    }

    const d6 = new Array(6);
    const p1 = new Array(6);
    const p2 = new Array(6);
    for (let code = 0; code < 729; code++) {
      let v = code;
      for (let i = 5; i >= 0; i--) {
        d6[i] = v % 3;
        v = (v - d6[i]) / 3;
      }
      let ok1 = true;
      let ok2 = true;
      for (let i = 0; i < 6; i++) {
        if (d6[i] === 2) ok1 = false;
        if (d6[i] === 1) ok2 = false;
        p1[i] = d6[i] === 1 ? 1 : 0;
        p2[i] = d6[i] === 2 ? 1 : 0;
      }
      if (ok1) {
        if (samePattern(p1, OPEN_FOUR)) B6_1[code] = OPEN_FOUR_BONUS;
        else {
          for (let t = 0; t < OPEN_THREES.length; t++) {
            if (samePattern(p1, OPEN_THREES[t])) { B6_1[code] = OPEN_THREE_BONUS; break; }
          }
        }
      }
      if (ok2) {
        if (samePattern(p2, OPEN_FOUR)) B6_2[code] = OPEN_FOUR_BONUS;
        else {
          for (let t = 0; t < OPEN_THREES.length; t++) {
            if (samePattern(p2, OPEN_THREES[t])) { B6_2[code] = OPEN_THREE_BONUS; break; }
          }
        }
      }
    }
  })();

  // Ordering heuristic: PATTERN[stones][openEnds]
  const PATTERN = new Float64Array([
    0, 0, 0,
    0, 2, 8,
    0, 30, 200,
    0, 500, 5000,
    0, 20000, 1000000,
    0, 10000000, 10000000,
  ]);

  const DIRS = [0, 1, 1, 0, 1, 1, 1, -1];

  const LEVELS = {
    easy: { maxDepth: 2, budget: 120, branch: 12, rootBranch: 14, randomness: 0.4 },
    medium: { maxDepth: 4, budget: 350, branch: 10, rootBranch: 16, randomness: 0 },
    hard: { maxDepth: 8, budget: 900, branch: 8, rootBranch: 20, randomness: 0 },
    master: { maxDepth: 10, budget: 1600, branch: 9, rootBranch: 24, randomness: 0 },
  };

  function coordName(idx) {
    if (idx < 0 || idx >= CELLS) return '--';
    const r = (idx / SIZE) | 0;
    const c = idx % SIZE;
    return String.fromCharCode(65 + c) + (r + 1);
  }

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  /* ------------------------------------------------------------------ *
   * Engine
   * ------------------------------------------------------------------ */
  class Engine {
    constructor() {
      this.board = new Int8Array(CELLS);
      this.history = [];
      this.turn = BLACK;
      this.stoneCount = 0;
      this.winner = 0;
      this.winLine = null;
      this.draw = false;

      this.near = new Int16Array(CELLS);
      this.line1 = new Float64Array(LINE_COUNT);
      this.line2 = new Float64Array(LINE_COUNT);
      this.total1 = 0;
      this.total2 = 0;
      // Lines that currently contain a "four" (four stones in a five-window
      // with no opposing stone: one move away from five).
      this.f1arr = new Uint8Array(LINE_COUNT);
      this.f2arr = new Uint8Array(LINE_COUNT);
      this.four1 = 0;
      this.four2 = 0;
      this._f1 = 0;
      this._f2 = 0;
      this._branch = 8;

      this._h1 = 0;
      this._h2 = 0;
      this._s1 = 0;
      this._s2 = 0;
      this._d1 = 0;
      this._d2 = 0;
      this._vals = new Int8Array(SIZE);
      this._moveScores = new Float64Array(CELLS);
      this._candPool = [];
      this._killers = [];
      for (let i = 0; i < 64; i++) this._killers.push([-1, -1]);
      this._historyTable = [null, new Int32Array(CELLS), new Int32Array(CELLS)];
      this._tt = new Map();
      this._nodes = 0;
      this._deadline = 0;

      this.reset();
    }

    reset() {
      this.board.fill(0);
      this.history.length = 0;
      this.turn = BLACK;
      this.stoneCount = 0;
      this.winner = 0;
      this.winLine = null;
      this.draw = false;
      this.near.fill(0);
      this.line1.fill(0);
      this.line2.fill(0);
      this.f1arr.fill(0);
      this.f2arr.fill(0);
      this.four1 = 0;
      this.four2 = 0;
      this.total1 = 0;
      this.total2 = 0;
      this._h1 = 0;
      this._h2 = 0;
      this._tt.clear();
      this._nodes = 0;
      for (let i = 0; i < 64; i++) {
        this._killers[i][0] = -1;
        this._killers[i][1] = -1;
      }
      this._historyTable[1].fill(0);
      this._historyTable[2].fill(0);
    }

    clone() {
      const e = new Engine();
      e.board.set(this.board);
      e.turn = this.turn;
      e.stoneCount = this.stoneCount;
      e._rebuild();
      return e;
    }

    /** Load a raw board array (0/1/2) and side to move. */
    setBoard(arr, turn) {
      this.reset();
      let count = 0;
      for (let i = 0; i < CELLS; i++) {
        const v = arr[i] | 0;
        if (v === BLACK || v === WHITE) {
          this.board[i] = v;
          count++;
        }
      }
      this.stoneCount = count;
      this.turn = turn === WHITE ? WHITE : BLACK;
      this._rebuild();
    }

    /** Replay a list of flat cell indices. Stops after a win or a draw. */
    loadMoves(moves) {
      this.reset();
      if (!moves) return;
      for (let i = 0; i < moves.length; i++) {
        const idx = moves[i];
        if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS) continue;
        if (this.winner || this.draw) break;
        if (this.board[idx]) continue;
        const player = this.turn;
        this._makeMove(idx, player);
        this.history.push(idx);
        const wl = this.winLineAt(idx, player);
        if (wl) {
          this.winner = player;
          this.winLine = wl;
        } else if (this.stoneCount === CELLS) {
          this.draw = true;
        }
      }
    }

    /** Public move. Returns a result object; never throws. */
    play(idx) {
      if (this.winner || this.draw) return { ok: false, reason: 'over' };
      if (!Number.isInteger(idx) || idx < 0 || idx >= CELLS) return { ok: false, reason: 'invalid' };
      if (this.board[idx] !== EMPTY) return { ok: false, reason: 'occupied' };
      const player = this.turn;
      this._makeMove(idx, player);
      this.history.push(idx);
      const wl = this.winLineAt(idx, player);
      if (wl) {
        this.winner = player;
        this.winLine = wl;
      } else if (this.stoneCount === CELLS) {
        this.draw = true;
      }
      return {
        ok: true,
        idx,
        player,
        win: !!wl,
        winLine: wl,
        draw: this.draw,
        turn: this.turn,
      };
    }

    /** Remove the last move. Returns its cell index or null. */
    undo() {
      if (!this.history.length) return null;
      const idx = this.history.pop();
      const player = this.board[idx];
      this._unmakeMove(idx, player);
      this.winner = 0;
      this.winLine = null;
      this.draw = false;
      return idx;
    }

    isWinAt(idx, player) {
      const b = this.board;
      const r = (idx / SIZE) | 0;
      const c = idx % SIZE;
      for (let d = 0; d < 8; d += 2) {
        const dr = DIRS[d];
        const dc = DIRS[d + 1];
        let n = 1;
        let rr = r + dr;
        let cc = c + dc;
        while (inBounds(rr, cc) && b[rr * SIZE + cc] === player) {
          n++;
          rr += dr;
          cc += dc;
        }
        rr = r - dr;
        cc = c - dc;
        while (inBounds(rr, cc) && b[rr * SIZE + cc] === player) {
          n++;
          rr -= dr;
          cc -= dc;
        }
        if (n >= 5) return true;
      }
      return false;
    }

    /** Winning run through idx (>= 5 cells) or null. */
    winLineAt(idx, player) {
      const b = this.board;
      const r = (idx / SIZE) | 0;
      const c = idx % SIZE;
      for (let d = 0; d < 8; d += 2) {
        const dr = DIRS[d];
        const dc = DIRS[d + 1];
        const forward = [];
        let rr = r + dr;
        let cc = c + dc;
        while (inBounds(rr, cc) && b[rr * SIZE + cc] === player) {
          forward.push(rr * SIZE + cc);
          rr += dr;
          cc += dc;
        }
        const backward = [];
        rr = r - dr;
        cc = c - dc;
        while (inBounds(rr, cc) && b[rr * SIZE + cc] === player) {
          backward.push(rr * SIZE + cc);
          rr -= dr;
          cc -= dc;
        }
        if (forward.length + backward.length + 1 < 5) continue;
        backward.reverse();
        return backward.concat([idx], forward);
      }
      return null;
    }

    /* ------------------------- internals ------------------------- */

    _rebuild() {
      this.near.fill(0);
      for (let i = 0; i < CELLS; i++) if (this.board[i]) this._updateNear(i, 1);
      let h1 = 0;
      let h2 = 0;
      for (let i = 0; i < CELLS; i++) {
        const v = this.board[i];
        if (v) {
          h1 ^= Z1[v - 1][i];
          h2 ^= Z2[v - 1][i];
        }
      }
      this._h1 = h1;
      this._h2 = h2;
      for (let li = 0; li < LINE_COUNT; li++) this._scoreLine(li);
      let t1 = 0;
      let t2 = 0;
      let f1 = 0;
      let f2 = 0;
      for (let li = 0; li < LINE_COUNT; li++) {
        t1 += this.line1[li];
        t2 += this.line2[li];
        f1 += this.f1arr[li];
        f2 += this.f2arr[li];
      }
      this.total1 = t1;
      this.total2 = t2;
      this.four1 = f1;
      this.four2 = f2;
      this.winner = 0;
      this.winLine = null;
      this.draw = false;
    }

    _updateNear(idx, delta) {
      const r = (idx / SIZE) | 0;
      const c = idx % SIZE;
      const near = this.near;
      for (let dr = -2; dr <= 2; dr++) {
        const rr = r + dr;
        if (rr < 0 || rr >= SIZE) continue;
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          const cc = c + dc;
          if (cc < 0 || cc >= SIZE) continue;
          near[rr * SIZE + cc] += delta;
        }
      }
    }

    _calcLine(li) {
      const cells = LINES[li];
      const n = cells.length;
      const b = this.board;
      const vals = this._vals;
      let s1 = 0;
      let s2 = 0;
      let f1 = 0;
      let f2 = 0;
      let n1 = 0;
      let n2 = 0;
      let c5 = 0;
      let c6 = 0;
      for (let k = 0; k < n; k++) {
        const v = b[cells[k]];
        vals[k] = v;
        if (v === 1) n1++;
        else if (v === 2) n2++;
        c5 = c5 * 3 + v;
        c6 = c6 * 3 + v;
        if (k >= 5) {
          c5 -= vals[k - 5] * 243;
          const old = vals[k - 5];
          if (old === 1) n1--;
          else if (old === 2) n2--;
        }
        if (k >= 6) c6 -= vals[k - 6] * 729;
        if (k >= 4) {
          s1 += W5_1[c5];
          s2 += W5_2[c5];
          if (n1 === 4 && n2 === 0) f1 = 1;
          else if (n2 === 4 && n1 === 0) f2 = 1;
        }
        if (k >= 5) {
          s1 += B6_1[c6];
          s2 += B6_2[c6];
        }
      }
      this._s1 = s1;
      this._s2 = s2;
      this._f1 = f1;
      this._f2 = f2;
    }

    _scoreLine(li) {
      this._calcLine(li);
      this.line1[li] = this._s1;
      this.line2[li] = this._s2;
      this.f1arr[li] = this._f1;
      this.f2arr[li] = this._f2;
    }

    _updateLines(idx) {
      const ids = CELL_LINES[idx];
      for (let i = 0; i < ids.length; i++) {
        const li = ids[i];
        this.total1 -= this.line1[li];
        this.total2 -= this.line2[li];
        this.four1 -= this.f1arr[li];
        this.four2 -= this.f2arr[li];
        this._scoreLine(li);
        this.total1 += this.line1[li];
        this.total2 += this.line2[li];
        this.four1 += this.f1arr[li];
        this.four2 += this.f2arr[li];
      }
    }

    _makeMove(idx, player) {
      this.board[idx] = player;
      this.stoneCount++;
      this._updateNear(idx, 1);
      this._updateLines(idx);
      const k = player - 1;
      this._h1 ^= Z1[k][idx];
      this._h2 ^= Z2[k][idx];
      this.turn = 3 - player;
    }

    _unmakeMove(idx, player) {
      this.board[idx] = EMPTY;
      this.stoneCount--;
      this._updateNear(idx, -1);
      this._updateLines(idx);
      const k = player - 1;
      this._h1 ^= Z1[k][idx];
      this._h2 ^= Z2[k][idx];
      this.turn = player;
    }

    _collectCandidates(ply) {
      let pool = this._candPool[ply];
      if (!pool) {
        pool = [];
        this._candPool[ply] = pool;
      }
      pool.length = 0;
      const b = this.board;
      const near = this.near;
      for (let i = 0; i < CELLS; i++) {
        if (b[i] === EMPTY && near[i] > 0) pool.push(i);
      }
      if (pool.length === 0 && this.stoneCount === 0) pool.push(7 * SIZE + 7);
      return pool;
    }

    _wouldWin(idx, player) {
      this.board[idx] = player;
      const win = this.isWinAt(idx, player);
      this.board[idx] = EMPTY;
      return win;
    }

    _findWinningMove(player, candidates) {
      for (let i = 0; i < candidates.length; i++) {
        if (this._wouldWin(candidates[i], player)) return candidates[i];
      }
      return -1;
    }

    _dirScore(r, c, dr, dc, p) {
      const b = this.board;
      let f = 0;
      let rr = r + dr;
      let cc = c + dc;
      while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && b[rr * SIZE + cc] === p) {
        f++;
        rr += dr;
        cc += dc;
      }
      const fOpen = rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && b[rr * SIZE + cc] === EMPTY;
      let back = 0;
      rr = r - dr;
      cc = c - dc;
      while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && b[rr * SIZE + cc] === p) {
        back++;
        rr -= dr;
        cc -= dc;
      }
      const bOpen = rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && b[rr * SIZE + cc] === EMPTY;
      const n = 1 + f + back;
      const open = (fOpen ? 1 : 0) + (bOpen ? 1 : 0);
      return PATTERN[(n > 5 ? 5 : n) * 3 + open];
    }

    _pointScore(idx, p) {
      const r = (idx / SIZE) | 0;
      const c = idx % SIZE;
      return this._dirScore(r, c, 0, 1, p) +
        this._dirScore(r, c, 1, 0, p) +
        this._dirScore(r, c, 1, 1, p) +
        this._dirScore(r, c, 1, -1, p);
    }

    /** Score delta of placing `player` at idx, without mutating the board. */
    _delta(idx, player) {
      const ids = CELL_LINES[idx];
      this.board[idx] = player;
      let d1 = 0;
      let d2 = 0;
      for (let i = 0; i < ids.length; i++) {
        const li = ids[i];
        this._calcLine(li);
        d1 += this._s1 - this.line1[li];
        d2 += this._s2 - this.line2[li];
      }
      this.board[idx] = EMPTY;
      this._d1 = d1;
      this._d2 = d2;
    }

    _evalFor(player) {
      return player === BLACK ? this.total1 - this.total2 : this.total2 - this.total1;
    }

    /** Evaluation after placing `player` at idx, from the opponent's view. */
    _evalAfter(idx, player) {
      this._delta(idx, player);
      const t1 = this.total1 + this._d1;
      const t2 = this.total2 + this._d2;
      return player === BLACK ? t2 - t1 : t1 - t2;
    }

    _orderMoves(candidates, player, ttMove, ply) {
      const scores = this._moveScores;
      const opp = 3 - player;
      const killers = this._killers[ply];
      const hist = this._historyTable[player];
      for (let i = 0; i < candidates.length; i++) {
        const idx = candidates[i];
        let s = this._pointScore(idx, player) + this._pointScore(idx, opp) * 0.9;
        if (idx === ttMove) s += 1e12;
        if (idx === killers[0]) s += 2e5;
        else if (idx === killers[1]) s += 1e5;
        s += hist[idx] * 0.001;
        const r = (idx / SIZE) | 0;
        const c = idx % SIZE;
        s += 14 - Math.abs(r - 7) - Math.abs(c - 7);
        scores[idx] = s;
      }
      candidates.sort((a, b) => scores[b] - scores[a]);
      return candidates;
    }

    _ttStore(key, h2, depth, a0, b0, score, move) {
      let flag = 2; // upper bound
      if (score >= b0) flag = 1; // lower bound
      else if (score > a0) flag = 0; // exact
      if (this._tt.size > 150000) this._tt.clear();
      this._tt.set(key, { h2, depth, flag, score, move });
    }

    /* --------------------------- search --------------------------- */

    /**
     * Best move for `player`. `level` is one of easy/medium/hard/master;
     * `budgetMs` overrides the level's time budget.
     * Returns { idx, score, depth, nodes, time }.
     */
    findBestMove(player, level, budgetMs) {
      const cfg = LEVELS[level] || LEVELS.medium;
      const engine = this.clone();
      engine.turn = player === WHITE ? WHITE : BLACK;
      return engine._searchRoot(engine.turn, cfg, budgetMs == null ? cfg.budget : budgetMs);
    }

    _searchRoot(player, cfg, budget) {
      const t0 = now();
      this._deadline = t0 + Math.max(20, budget);
      this._nodes = 0;
      this._branch = cfg.branch || 8;
      this._tt.clear();
      const candidates = this._collectCandidates(0);
      if (!candidates.length) {
        return { idx: -1, score: 0, depth: 0, nodes: 0, time: 0 };
      }
      const opp = 3 - player;
      const immediate = this._findWinningMove(player, candidates);
      if (immediate >= 0) {
        return { idx: immediate, score: WIN_SCORE, depth: 1, nodes: 1, time: Math.round(now() - t0) };
      }
      const block = this._findWinningMove(opp, candidates);
      let ordered;
      if (block >= 0) {
        ordered = [block];
      } else {
        ordered = this._orderMoves(candidates, player, -1, 0).slice(0, cfg.rootBranch);
      }

      let best = ordered[0];
      let bestScore = -WIN_SCORE;
      let reachedDepth = 0;
      for (let depth = 2; depth <= cfg.maxDepth; depth += 2) {
        let res;
        try {
          res = this._rootSearch(ordered, player, depth, cfg.rootBranch);
        } catch (err) {
          if (err !== ABORT) throw err;
          break;
        }
        best = res.idx;
        bestScore = res.score;
        reachedDepth = depth;
        ordered = res.ordered;
        if (bestScore >= WIN_THRESHOLD || bestScore <= -WIN_THRESHOLD) break;
        if (now() >= this._deadline) break;
      }

      if (cfg.randomness > 0 && ordered.length > 1 && Math.random() < cfg.randomness) {
        const pool = ordered.slice(0, Math.min(3, ordered.length));
        best = pool[(Math.random() * pool.length) | 0];
      }
      return {
        idx: best,
        score: bestScore,
        depth: reachedDepth,
        nodes: this._nodes,
        time: Math.round(now() - t0),
      };
    }

    _rootSearch(ordered, player, depth, rootBranch) {
      const opp = 3 - player;
      const scores = [];
      let alpha = -WIN_SCORE;
      let best = ordered[0];
      let bestScore = -WIN_SCORE;
      const limit = Math.min(ordered.length, Math.max(rootBranch, 8));
      for (let i = 0; i < limit; i++) {
        const idx = ordered[i];
        this._makeMove(idx, player);
        let score;
        try {
          if (this.isWinAt(idx, player)) score = WIN_SCORE - 1;
          else score = -this._negamax(depth - 1, -WIN_SCORE, -alpha, 1, opp);
        } finally {
          this._unmakeMove(idx, player);
        }
        scores.push([score, idx]);
        if (score > bestScore) {
          bestScore = score;
          best = idx;
        }
        if (score > alpha) alpha = score;
        if (bestScore >= WIN_THRESHOLD) break;
        if ((this._nodes & 255) === 0 && now() >= this._deadline) throw ABORT;
      }
      scores.sort((a, b) => b[0] - a[0]);
      return { idx: best, score: bestScore, ordered: scores.map((s) => s[1]) };
    }

    _negamax(depth, alpha, beta, ply, player) {
      this._nodes++;
      if ((this._nodes & 255) === 0 && now() >= this._deadline) throw ABORT;
      if (depth <= 0) {
        // Horizon control: a "four" is a forcing threat, so resolving it is
        // worth one extra ply instead of scoring it statically. The depth-1
        // layer evaluates leaves directly, so this cannot recurse further.
        if (this.four1 || this.four2) depth = 1;
        else return this._evalFor(player);
      }

      const key = this._h1 ^ (player === WHITE ? TURN_KEY1 : 0);
      const h2 = this._h2;
      const tt = this._tt.get(key);
      let ttMove = -1;
      if (tt && tt.h2 === h2) {
        ttMove = tt.move;
        if (tt.depth >= depth) {
          if (tt.flag === 0) return tt.score;
          if (tt.flag === 1) {
            if (tt.score > alpha) alpha = tt.score;
          } else if (tt.flag === 2) {
            if (tt.score < beta) beta = tt.score;
          }
          if (alpha >= beta) return tt.score;
        }
      }
      const a0 = alpha;
      const b0 = beta;

      const candidates = this._collectCandidates(ply);
      if (!candidates.length) return 0;
      const opp = 3 - player;

      if (depth >= 2) {
        if (this._findWinningMove(player, candidates) >= 0) return WIN_SCORE - ply;
        const block = this._findWinningMove(opp, candidates);
        if (block >= 0) {
          this._makeMove(block, player);
          let score;
          try {
            score = this.isWinAt(block, player)
              ? WIN_SCORE - ply
              : -this._negamax(depth - 1, -beta, -alpha, ply + 1, opp);
          } finally {
            this._unmakeMove(block, player);
          }
          this._ttStore(key, h2, depth, a0, b0, score, block);
          return score;
        }
      }

      const moves = this._orderMoves(candidates, player, ttMove, ply);
      const limit = depth === 1
        ? Math.min(moves.length, this._branch + 5)
        : depth >= 3
          ? this._branch
          : Math.min(12, this._branch + 3);
      let best = -WIN_SCORE;
      let bestMove = moves[0];

      for (let i = 0; i < moves.length && i < limit; i++) {
        const idx = moves[i];
        if (depth === 1) {
          if (this._wouldWin(idx, player)) {
            best = WIN_SCORE - ply;
            bestMove = idx;
            break;
          }
          const score = -this._evalAfter(idx, player);
          if (score > best) {
            best = score;
            bestMove = idx;
          }
          if (best > alpha) alpha = best;
          if (alpha >= beta) {
            this._recordCutoff(idx, player, depth, ply);
            break;
          }
          continue;
        }

        this._makeMove(idx, player);
        let score;
        try {
          if (this.isWinAt(idx, player)) score = WIN_SCORE - ply;
          else score = -this._negamax(depth - 1, -beta, -alpha, ply + 1, opp);
        } finally {
          this._unmakeMove(idx, player);
        }
        if (score > best) {
          best = score;
          bestMove = idx;
        }
        if (best > alpha) alpha = best;
        if (alpha >= beta) {
          this._recordCutoff(idx, player, depth, ply);
          break;
        }
      }

      this._ttStore(key, h2, depth, a0, b0, best, bestMove);
      return best;
    }

    _recordCutoff(idx, player, depth, ply) {
      const killers = this._killers[ply];
      if (idx !== killers[0]) {
        killers[1] = killers[0];
        killers[0] = idx;
      }
      const h = this._historyTable[player];
      h[idx] += depth * depth;
      if (h[idx] > 1000000) {
        for (let i = 0; i < CELLS; i++) h[i] >>= 1;
      }
    }
  }

  const api = {
    SIZE,
    CELLS,
    EMPTY,
    BLACK,
    WHITE,
    WIN_SCORE,
    WIN_THRESHOLD,
    LEVELS,
    Engine,
    coordName,
    inBounds,
    createEngine: () => new Engine(),
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GomokuEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
