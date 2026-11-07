/*!
 * 星铎棋 · 游戏脚本（无依赖、非模块，顶层函数即页面内联事件处理器的全局入口）
 * 结构：常量与状态 → 几何（三角网/六向吃子线）→ 渲染 → 对局流程 → 编辑器 → AI → 计时 → 启动
 * 说明：以 defer 方式加载，因此末段启动代码执行时 DOM 已就绪。
 */

const TRI_SIZE = 55;
const FACE_K = 0.955;
const CANVAS_W = 700, CANVAS_H = 580;

// 开局摆子（键为显示序号，由 assignIds() 的排序决定），对局与编辑器共用
const START_SETUP = { '0': 0, '18': 2, '19': 0, '22': 0, '23': 1, '24': 1, '25': 0, '29': 2, '30': 2, '35': 1 };

let board = {};
let boardVer = 0;
let currentPlayer = 0;
let gameOver = false;
let myColor = 0;
let pveMode = false;
let botColor = 0;
let difficulty = '标准';
let firstPlayer = 0;
let history = [0, 0, 0];
let lastBotPid = null;
let botHintTimer = null;
let animating = false;
let id2tri = {};
let id2disp = {}, disp2id = {};
let lines = {};
let edgeWeight = {};

let editorBoard = {};
let editorMode = 1;
let inCustomGame = false;
let customBoardForGame = null;
let isCustomGame = false;
let flowDifficulty = '标准';

let customPresets = {};
const PRESETS_STORAGE_KEY = 'star_duo_custom_presets';
function loadCustomPresets() {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) customPresets = parsed;
    }
  } catch (e) {
    customPresets = {};
  }
}
function persistCustomPresets() {
  try { localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(customPresets)); } catch (e) {}
}
loadCustomPresets();

const DEFAULT_SETTINGS = { animation: true, showAiHint: true, aiHintDuration: 1200, turnHintDuration: 900 };
const SETTINGS_STORAGE_KEY = 'starchess_settings';
let settings = { ...DEFAULT_SETTINGS };

// 读取本地设置：逐项校验，避免损坏/手改的 localStorage 让界面出现 NaN 或非法值
function loadSettings() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
  if (!saved || typeof saved !== 'object') return;
  if (typeof saved.animation === 'boolean') settings.animation = saved.animation;
  if (typeof saved.showAiHint === 'boolean') settings.showAiHint = saved.showAiHint;
  settings.aiHintDuration = clampMs(saved.aiHintDuration, DEFAULT_SETTINGS.aiHintDuration);
  settings.turnHintDuration = clampMs(saved.turnHintDuration, DEFAULT_SETTINGS.turnHintDuration);
}
function clampMs(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(200, Math.min(5000, n)) : fallback;
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
}
loadSettings();

// 战绩（本地持久化，跨刷新累计）
const HISTORY_STORAGE_KEY = 'star_duo_history';
function loadHistory() {
  let v = null;
  try { v = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || 'null'); } catch (e) { v = null; }
  if (Array.isArray(v) && v.length === 3 && v.every(n => Number.isFinite(n) && n >= 0)) {
    history = v.map(n => Math.floor(n));
  }
}
function persistHistory() {
  try { localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history)); } catch (e) {}
}
loadHistory();

function genTri() {
  const size = TRI_SIZE, radius = 3;
  const verts = [];
  for (let q = -radius; q <= radius; q++)
    for (let r = -radius; r <= radius; r++) {
      const s = -q - r;
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= radius) verts.push([q, r]);
    }
  const vset = new Set(verts.map(v => v.join(',')));
  const tris = new Set();
  for (const [q, r] of verts) {
    if (vset.has(`${q+1},${r}`) && vset.has(`${q},${r+1}`))
      tris.add(JSON.stringify([[q,r],[q+1,r],[q,r+1]].sort()));
    if (vset.has(`${q-1},${r}`) && vset.has(`${q},${r-1}`))
      tris.add(JSON.stringify([[q,r],[q-1,r],[q,r-1]].sort()));
  }
  const dx = size * Math.sqrt(3), dy = size * 1.5;
  let pixels = [];
  for (const t of tris) {
    const tri = JSON.parse(t);
    const pts = tri.map(([q, r]) => [q * dx + r * dx / 2, r * dy]);
    const cx = pts.reduce((s, p) => s + p[0], 0) / 3;
    const cy = pts.reduce((s, p) => s + p[1], 0) / 3;
    const ys = pts.map(p => p[1]);
    const minY = Math.min(...ys);
    const dir = ys.filter(y => Math.abs(y - minY) < 0.01).length === 1 ? 'up' : 'down';
    pixels.push([cx, cy, dir]);
  }
  const ax = pixels.reduce((s, p) => s + p[0], 0) / pixels.length;
  const ay = pixels.reduce((s, p) => s + p[1], 0) / pixels.length;
  let ci = 0, minD = Infinity;
  pixels.forEach((p, i) => {
    const d = (p[0] - ax) ** 2 + (p[1] - ay) ** 2;
    if (d < minD) { minD = d; ci = i; }
  });
  [pixels[0], pixels[ci]] = [pixels[ci], pixels[0]];
  const rest = pixels.slice(1).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  pixels = [pixels[0], ...rest];
  const minx = Math.min(...pixels.map(p => p[0]));
  const maxx = Math.max(...pixels.map(p => p[0]));
  const miny = Math.min(...pixels.map(p => p[1]));
  const maxy = Math.max(...pixels.map(p => p[1]));
  const sx = CANVAS_W / 2 - (minx + maxx) / 2;
  const sy = CANVAS_H / 2 - (miny + maxy) / 2;
  const map = {};
  pixels.forEach((p, i) => { map[String(i)] = [p[0] + sx, p[1] + sy, p[2]]; });
  return map;
}
function buildTriNeigh() {
  const ids = Object.keys(id2tri);
  const maxD = TRI_SIZE * 1.02;
  const maxD2 = maxD * maxD;
  const neigh = {};
  for (const pid of ids) neigh[pid] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i], b = ids[j];
      const dx = id2tri[a][0] - id2tri[b][0];
      const dy = id2tri[a][1] - id2tri[b][1];
      if (dx * dx + dy * dy <= maxD2) {
        neigh[a].push(b);
        neigh[b].push(a);
      }
    }
  }
  return neigh;
}
function buildLines() {
  const ids = Object.keys(id2tri);
  const ang = [0, 60, 120, 180, 240, 300].map(a => a * Math.PI / 180);
  const neigh = buildTriNeigh();
  const res = {};
  for (const pid of ids) {
    res[pid] = Array.from({ length: 6 }, () => []);
    const cx = id2tri[pid][0], cy = id2tri[pid][1];
    for (let d = 0; d < 6; d++) {
      const ux = Math.cos(ang[d]), uy = Math.sin(ang[d]);
      let first = null, bestDot = 0.42;
      for (let ni = 0; ni < neigh[pid].length; ni++) {
        const nb = neigh[pid][ni];
        const dx = id2tri[nb][0] - cx, dy = id2tri[nb][1] - cy;
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        const dot = (dx / len) * ux + (dy / len) * uy;
        if (dot > bestDot) { bestDot = dot; first = nb; }
      }
      if (!first) continue;
      const line = [];
      let cur = first, prev = pid;
      while (cur) {
        if (line.indexOf(cur) >= 0) break;
        line.push(cur);
        const ncx = id2tri[cur][0], ncy = id2tri[cur][1];
        let next = null, nDot = 0.5;
        for (let ni = 0; ni < neigh[cur].length; ni++) {
          const nb = neigh[cur][ni];
          if (nb === prev) continue;
          const dx = id2tri[nb][0] - ncx, dy = id2tri[nb][1] - ncy;
          const len = Math.hypot(dx, dy);
          if (len < 1e-6) continue;
          const dot = (dx / len) * ux + (dy / len) * uy;
          if (dot > nDot) { nDot = dot; next = nb; }
        }
        prev = cur;
        cur = next;
      }
      res[pid][d] = line;
    }
  }
  return res;
}
function assertLinesGeometry(neigh) {
  let bad = 0;
  for (const pid in lines) {
    const nb = neigh[pid];
    for (let d = 0; d < 6; d++) {
      const chain = lines[pid][d];
      if (!chain.length) continue;
      if (nb.indexOf(chain[0]) < 0) {
        bad++;
        if (bad <= 5) console.error('[星铎棋] 吃子线首格非邻接', pid, 'dir', d, 'cell', chain[0]);
      }
    }
  }
  return bad;
}
function canPlaceAt(pid, player) {
  return board[pid] === 0 && getFlips(pid, player).length > 0;
}
function assignIds() {
  const items = Object.keys(id2tri).map(pid => [pid, id2tri[pid][0], id2tri[pid][1]]);
  items.sort((a, b) => a[2] - b[2] || a[1] - b[1]);
  const i2d = {}, d2i = {};
  items.forEach(([pid], i) => { i2d[pid] = String(i); d2i[String(i)] = pid; });
  return [i2d, d2i];
}
function initGeometry() {
  id2tri = genTri();
  lines = buildLines();
  // 开发期自检：邻接表只算一次，避免重复的 O(n²) 计算
  if (assertLinesGeometry(buildTriNeigh()) > 0) {
    console.warn('[星铎棋] 六向吃子线几何自检未通过');
  }
  [id2disp, disp2id] = assignIds();
  edgeWeight = {};
  for (const pid in id2tri) {
    const cnt = lines[pid].filter(l => l.length > 0).length;
    edgeWeight[pid] = Math.max(0, 6 - cnt);
  }
  indexAiGeometry();
}

function resetBoardData() {
  clearAnim();
  pendingAnim = null;
  lastStatusHtml = '';
  timerStop();
  board = {};
  for (const pid in id2tri) board[pid] = 0;
  for (const d in START_SETUP) if (disp2id[d]) board[disp2id[d]] = START_SETUP[d];
  boardVer++;
  currentPlayer = 0;
  gameOver = false;
  clearBotHint();
  animating = false;
}
function getFlips(pid, player) {
  const opp = 3 - player;
  if (board[pid] !== 0) return [];
  const flips = new Set();
  for (let d = 0; d < 6; d++) {
    const line = lines[pid][d];
    if (!line.length || board[line[0]] !== opp) continue;
    let j = 0;
    while (j < line.length && board[line[j]] === opp) j++;
    if (j < line.length && board[line[j]] === player)
      for (let k = 0; k < j; k++) flips.add(line[k]);
  }
  return [...flips];
}
function getValidMoves(player) {
  const moves = {};
  for (const pid in id2tri) {
    if (board[pid] === 0) {
      const f = getFlips(pid, player);
      if (f.length) moves[pid] = f;
    }
  }
  return moves;
}
let cntVer = -1, cntB = 0, cntW = 0;
function pieceCounts() {
  if (cntVer !== boardVer) {
    let b = 0, w = 0;
    for (const pid in board) {
      const v = board[pid];
      if (v === 1) b++;
      else if (v === 2) w++;
    }
    cntB = b; cntW = w; cntVer = boardVer;
  }
  return [cntB, cntW];
}
function makeMove(pid, player) {
  const f = getFlips(pid, player);
  if (!f.length) return false;
  board[pid] = player;
  f.forEach(fid => { board[fid] = player; });
  boardVer++;
  if (!searchMode) pendingAnim = { pid: pid, player: player, flips: f };
  return true;
}
function checkWinner() {
  const c = pieceCounts();
  return c[0] > c[1] ? 1 : c[1] > c[0] ? 2 : 0;
}
function deserializeBoard(data) {
  board = {};
  for (const pid in id2tri) board[pid] = 0;
  if (data) for (const pid in data) if (pid in board) {
    const v = data[pid];
    board[pid] = (v === 1 || v === 2) ? v : 0;
  }
  boardVer++;
}

let FACE_MS = 420;
let RING_MS = 100;
let tileEls = {};
let boardEl = null;
let busyUntil = {};
let animTouched = {};
let pendingAnim = null;
let animTimer = null;
let animEndAt = 0;
let searchMode = false;
let skipNote = '';
let skipUntil = 0;
let overText = '';

// 无障碍与动效偏好
const PRM_QUERY = (window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null);
function prefersReducedMotion() { return !!(PRM_QUERY && PRM_QUERY.matches); }
let boardFocusPid = null;
let modalReturnFocus = null;
let lastSpokenStatus = '';

function triPath(dir, k) {
  const S = TRI_SIZE, H = TRI_SIZE * Math.sqrt(3) / 2;
  const cx0 = S / 2, cy0 = (dir === 'up') ? (2 * H / 3) : (H / 3);
  const raw = (dir === 'up')
    ? [[S / 2, 0], [0, H], [S, H]]
    : [[S / 2, H], [0, 0], [S, 0]];
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const x = cx0 + (raw[i][0] - cx0) * k;
    const y = cy0 + (raw[i][1] - cy0) * k;
    parts.push(x.toFixed(2) + 'px ' + y.toFixed(2) + 'px');
  }
  return 'polygon(' + parts.join(',') + ')';
}
function faceState(el, v) {
  const k = (v === 1) ? 'st1' : (v === 2 ? 'st2' : 'st0');
  el.classList.remove('st0', 'st1', 'st2');
  el.classList.add(k);
}
function tileOrdinal(pid) {
  const n = Number(id2disp[pid]);
  return (isFinite(n) ? n : 0) + 1;
}
function tileLabel(pid, v, playable, isLast) {
  let s = '第 ' + tileOrdinal(pid) + ' 格 · ' + (v === 1 ? '黑子' : (v === 2 ? '白子' : '空位'));
  if (playable) s += ' · 可落子';
  if (isLast) s += ' · 电脑刚下的位置';
  return s;
}
function buildTiles() {
  const wrap = document.getElementById('board');
  if (!wrap) return;
  boardEl = wrap;
  const S = TRI_SIZE, H = TRI_SIZE * Math.sqrt(3) / 2;
  const cpFull = {}, cpIn = {};
  for (const d of ['up', 'down']) { cpFull[d] = triPath(d, 1); cpIn[d] = triPath(d, FACE_K); }
  const html = [], pids = [];
  for (const pid in id2tri) {
    const cx = id2tri[pid][0], cy = id2tri[pid][1], dir = id2tri[pid][2];
    const pf = cpFull[dir], ps = cpIn[dir];
    const face = function (cls) {
      return '<div class="face ' + cls + '"><div class="plate" style="clip-path:' + pf
        + '"><div class="surf" style="clip-path:' + ps + '"><div class="etch"></div></div></div></div>';
    };
    html.push('<div class="tile ' + dir + '" data-pid="' + pid + '" role="button" tabindex="-1"'
      + ' aria-label="第 ' + tileOrdinal(pid) + ' 格"'
      + ' style="left:' + (cx - S / 2)
      + 'px;top:' + ((dir === 'up') ? (cy - 2 * H / 3) : (cy - H / 3)) + 'px;width:' + S
      + 'px;height:' + H + 'px">'
      + '<div class="tinner">' + face('fa') + face('fb') + '</div>'
      + '<div class="halo"></div></div>');
    pids.push(pid);
  }
  wrap.innerHTML = html.join('');
  tileEls = {};
  const roots = wrap.children;
  for (let i = 0; i < pids.length; i++) {
    const root = roots[i];
    const inner = root.children[0];
    tileEls[pids[i]] = { root: root, inner: inner, fa: inner.children[0], fb: inner.children[1],
                         st: -1, hint: false, last: false, lbl: '' };
  }
  boardFocusPid = null;
  if (pids.length) setRoving(pids[0]);
  if (!wrap.__clickBound) {
    wrap.__clickBound = true;
    wrap.addEventListener('click', function (e) {
      let el = e.target;
      while (el && el !== wrap && !el.classList.contains('tile')) el = el.parentElement;
      if (!el || el === wrap) return;
      setRoving(el.dataset.pid);
      handleTileClick(el.dataset.pid);
    });
  }
}
function setRoving(pid) {
  if (!pid || boardFocusPid === pid) return;
  const prev = boardFocusPid ? tileEls[boardFocusPid] : null;
  if (prev) prev.root.tabIndex = -1;
  boardFocusPid = pid;
  const t = tileEls[pid];
  if (t) t.root.tabIndex = 0;
}
function boardStep(pid, dx, dy) {
  const c = id2tri[pid];
  if (!c) return null;
  const ln = lines[pid] || [];
  let best = null, bestDot = 0.3;
  for (let d = 0; d < 6; d++) {
    const nb = ln[d] && ln[d][0];
    if (!nb) continue;
    const o = id2tri[nb];
    if (!o) continue;
    const vx = o[0] - c[0], vy = o[1] - c[1];
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    const dot = (vx * dx + vy * dy) / len;
    if (dot > bestDot) { bestDot = dot; best = nb; }
  }
  return best;
}
function focusTile(pid) {
  const t = pid ? tileEls[pid] : null;
  if (!t) return;
  setRoving(pid);
  try { t.root.focus({ preventScroll: true }); } catch (e) { t.root.focus(); }
}
function ringDistances(pid) {
  const dist = {};
  dist[pid] = 0;
  const q = [pid];
  while (q.length) {
    const cur = q.shift();
    const line = lines[cur] || [];
    for (let d = 0; d < 6; d++) {
      const nb = line[d] && line[d].length ? line[d][0] : null;
      if (nb && dist[nb] === undefined) {
        dist[nb] = dist[cur] + 1;
        q.push(nb);
      }
    }
  }
  return dist;
}
function setFaceStates(pid, v) {
  const t = tileEls[pid];
  if (!t) return;
  if (t.st === v) return;
  t.st = v;
  faceState(t.fa, v);
  faceState(t.fb, v);
}
function snapReset(el) {
  el.style.transition = 'none';
  el.classList.remove('flip');
  void el.offsetWidth;
  el.style.transition = '';
}
let animGen = 0;
let animTimers = [];
function animLater(fn, ms, gen) {
  const id = setTimeout(function () {
    const k = animTimers.indexOf(id);
    if (k >= 0) animTimers.splice(k, 1);
    if (gen !== animGen) return;
    fn();
  }, ms);
  animTimers.push(id);
  return id;
}
function clearAnim() {
  clearTimeout(animTimer);
  animTimer = null;
  animGen++;
  for (let i = 0; i < animTimers.length; i++) clearTimeout(animTimers[i]);
  animTimers = [];
  busyUntil = {};
  animating = false;
  animEndAt = 0;
  const back = [];
  for (const pid in animTouched) {
    const t = tileEls[pid];
    if (!t) continue;
    if (t.inner.classList.contains('drop')) t.inner.classList.remove('drop');
    if (t.inner.classList.contains('flip')) {
      t.inner.style.transition = 'none';
      t.inner.classList.remove('flip');
      back.push(t.inner);
    }
  }
  if (back.length) void back[0].offsetWidth;
  for (let i = 0; i < back.length; i++) back[i].style.transition = '';
  animTouched = {};
  if (lastBotPid !== null) {
    const lt = tileEls[lastBotPid];
    if (lt) { lt.root.classList.remove('lastbot'); lt.last = false; }
  }
}
function animRemaining() { return Math.max(0, animEndAt - Date.now()); }
function startFlip(pid, player, delay, place) {
  const t = tileEls[pid];
  if (!t) return;
  const gen = animGen;
  animTouched[pid] = 1;
  if (place) {
    setFaceStates(pid, player);
    t.inner.classList.add('drop');
    animLater(function () { t.inner.classList.remove('drop'); }, delay + 420, gen);
    return;
  }
  busyUntil[pid] = Date.now() + delay + FACE_MS + 120;
  faceState(t.fb, player);
  animLater(function () {
    t.inner.classList.add('flip');
    animLater(function () {
      setFaceStates(pid, player);
      snapReset(t.inner);
      delete busyUntil[pid];
    }, FACE_MS + 60, gen);
  }, delay, gen);
}
function playAnim(a) {
  if (!settings.animation || prefersReducedMotion()) {
    setFaceStates(a.pid, a.player);
    for (let i = 0; i < a.flips.length; i++) setFaceStates(a.flips[i], a.player);
    draw();
    return;
  }
  clearAnim();
  const gen = animGen;
  const dist = ringDistances(a.pid);
  const list = [];
  for (let i = 0; i < a.flips.length; i++) {
    const f = a.flips[i];
    list.push([f, dist[f] === undefined ? 1 : dist[f]]);
  }
  list.sort(function (x, y) { return x[1] - y[1]; });
  let maxD = 0;
  for (let i = 0; i < list.length; i++) maxD = Math.max(maxD, list[i][1]);
  animating = true;
  animEndAt = Date.now() + (list.length ? (maxD * RING_MS + FACE_MS + 200) : 380);
  startFlip(a.pid, a.player, 0, true);
  for (let i = 0; i < list.length; i++) startFlip(list[i][0], a.player, list[i][1] * RING_MS, false);
  clearTimeout(animTimer);
  animTimer = animLater(function () {
    animating = false;
    animEndAt = 0;
    busyUntil = {};
    draw();
  }, Math.max(0, animEndAt - Date.now()) + 30, gen);
}
const __hud = {};
function hudEl(id) {
  let e = __hud[id];
  if (!e || !e.isConnected) { e = document.getElementById(id); __hud[id] = e; }
  return e;
}
function setText(el, v) {
  if (el && el.textContent !== v) el.textContent = v;
}
let lastResetCanShow = null;
function updateResetBtn() {
  const btn = document.getElementById('reset-btn');
  if (!btn) return;
  const canReset = true;
  if (lastResetCanShow === canReset) return;
  lastResetCanShow = canReset;
  btn.classList.toggle('hidden', !canReset);
}
function syncHud() {
  const c = pieceCounts();
  setText(hudEl('cnt-blue'), String(c[0]));
  setText(hudEl('cnt-white'), String(c[1]));
  const st = hudEl('xd-stage');
  const turn = String(gameOver ? 0 : currentPlayer);
  if (st && st.dataset.turn !== turn) st.dataset.turn = turn;
  setText(hudEl('score-line'), '黑 ' + history[0] + ' · 平 ' + history[2] + ' · 白 ' + history[1]);
  const bn = hudEl('result-banner');
  if (bn) {
    setText(bn, overText);
    const show = !!(overText && gameOver);
    if (bn.classList.contains('show') !== show) bn.classList.toggle('show', show);
  }
  updateResetBtn();
  updateStatus();
}

let fitLast = '', fitRaf = 0;
function fitBoardSoon() {
  if (fitRaf) return;
  fitRaf = requestAnimationFrame(function () { fitRaf = 0; fitBoard(); });
}
function fitBoard() {
  const vv = window.visualViewport;
  const vw = Math.round((vv && vv.width) || window.innerWidth || 1280);
  const vh = Math.round((vv && vv.height) || window.innerHeight || 720);
  const wrap = document.getElementById('boardwrap');
  if (!wrap) return;
  const vkey = vw + 'x' + vh;
  if (fitLast === vkey) return;
  fitLast = vkey;
  const tiny = vw <= 820 || vh <= 520;
  let s;
  if (tiny) {
    const padY = (vh < vw) ? 140 : 176;
    s = Math.min((vw - 18) / 700, Math.max(150, vh - padY) / 580);
  } else {
    s = Math.min(vw * 0.58 / 700, vh * 0.94 / 580);
  }
  wrap.style.setProperty('--s', Math.max(0.3, Math.min(2.4, s)).toFixed(4));
}
let viewportBound = false;
function bindViewport() {
  fitBoard();
  if (viewportBound) return;
  viewportBound = true;
  window.addEventListener('resize', fitBoardSoon);
  window.addEventListener('orientationchange', function () { setTimeout(fitBoardSoon, 200); });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', fitBoardSoon);
    window.visualViewport.addEventListener('scroll', fitBoardSoon);
  }
}
function bumpSkip(msg, ms) {
  skipNote = msg;
  // 默认沿用“回合提示时长”设置，用户在设置里调过就跟着变
  skipUntil = Date.now() + (ms || settings.turnHintDuration || 900);
  lastStatusHtml = '';
  updateStatus();
  draw(true);
}
function hintDuration() { return (settings.turnHintDuration | 0) || 900; }
function handleTileClick(pid) {
  if (gameOver || currentPlayer === 0) return;
  if (animating || botThinking || botPending || searchMode) {
    bumpSkip('请稍候（动画或演算中）', hintDuration());
    return;
  }
  if (pveMode && currentPlayer === botColor) return;
  if (!canPlaceAt(pid, currentPlayer)) {
    bumpSkip('此处不可落子', hintDuration());
    return;
  }
  skipNote = '';
  if (!makeMove(pid, currentPlayer)) {
    bumpSkip('落子失败，请重试', hintDuration());
    return;
  }
  afterMove();
}
function draw(skipResolve) {
  const boardBusy = animating || botThinking || botPending || searchMode;
  if (!skipResolve && !gameOver && !boardBusy && currentPlayer !== 0) resolveStuck();
  if (pendingAnim) {
    const a = pendingAnim;
    pendingAnim = null;
    playAnim(a);
  }
  const now = Date.now();
  let showHints = false;
  let hintPlayer = 0;
  if (!gameOver && !boardBusy && currentPlayer !== 0) {
    showHints = true;
    if (pveMode && currentPlayer === botColor) showHints = false;
    else hintPlayer = currentPlayer;
  }
  let hintCount = 0;
  for (const pid in id2tri) {
    const t = tileEls[pid];
    if (!t) continue;
    const busy = !!(busyUntil[pid] && busyUntil[pid] > now);
    if (!busy) setFaceStates(pid, board[pid]);
    const isLast = settings.showAiHint && (pid === lastBotPid);
    const isHint = !!(showHints && hintPlayer && canPlaceAt(pid, hintPlayer));
    if (isHint) hintCount++;
    if (t.last !== isLast) { t.last = isLast; t.root.classList.toggle('lastbot', isLast); }
    if (t.hint !== isHint) { t.hint = isHint; t.root.classList.toggle('hint', isHint); }
    const lbl = tileLabel(pid, board[pid], isHint, isLast);
    if (t.lbl !== lbl) { t.lbl = lbl; t.root.setAttribute('aria-label', lbl); }
  }
  const bel = boardEl || (boardEl = document.getElementById('board'));
  if (bel) {
    const np = String(hintCount > 12);
    if (bel.dataset.nopulse !== np) {
      bel.dataset.nopulse = np;
      bel.classList.toggle('nopulse', hintCount > 12);
    }
  }
  syncTimer();
  syncHud();
}

function updateStarDuoPageSubtitle() {
  const el = document.getElementById('xd-page-sub');
  if (!el) return;
  if (document.body.classList.contains('xd-immersive')) {
    el.textContent = '';
    return;
  }
  if (document.getElementById('screen-select').classList.contains('active')) {
    el.textContent = '六角翻转 · 本地双人 · 人机';
  } else if (document.getElementById('screen-first').classList.contains('active')) {
    el.textContent = (pveMode ? '人机对战' : '双人对战') + ' · 选择先手';
  } else if (document.getElementById('screen-difficulty').classList.contains('active')) {
    el.textContent = '人机对战 · 选择难度';
  }
}

function syncStarDuoChrome() {
  const inGame = document.getElementById('screen-game').classList.contains('active');
  const inEditor = document.getElementById('editor-panel').classList.contains('active');
  const immersive = inGame || inEditor;
  document.body.classList.toggle('xd-immersive', immersive);
  document.body.classList.toggle('shell-chrome-hidden', immersive);
  updateStarDuoPageSubtitle();
  const meta = document.getElementById('theme-color-meta');
  if (meta) {
    const tc = immersive ? '#0b0908' : '#FFFA00';
    if (meta.getAttribute('content') !== tc) meta.setAttribute('content', tc);
  }
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  syncStarDuoChrome();
  focusScreen(id);
}
// 切屏后把焦点交给新屏幕的主要控件，避免键盘/读屏用户被留在已隐藏的元素上。
function focusScreen(id) {
  const el = document.getElementById(id);
  if (!el || !el.classList.contains('active')) return;
  const cur = document.activeElement;
  if (cur && cur !== document.body && el.contains(cur)) return;
  let target = null;
  if (id === 'screen-game') {
    const t = boardFocusPid ? tileEls[boardFocusPid] : null;
    target = (t && t.root) || el.querySelector('.tile[tabindex="0"]');
  } else {
    const seq = ['.menu-btns .btn', '.diff-btn', '.segmented__btn', '.btn'];
    for (let i = 0; i < seq.length && !target; i++) target = el.querySelector(seq[i]);
  }
  if (!target || !target.focus) return;
  try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
}
function resetPlaySession() {
  clearInterval(pveWatchTimer); pveWatchTimer = null; botPending = false;
  clearAnim();
  pendingAnim = null;
  busyUntil = {};
  lastBotPid = null;
  timerStop();
}
function goSelect() {
  closeModal();
  resetPlaySession();
  pveMode = false;
  inCustomGame = false;
  isCustomGame = false;
  editorBoard = {};
  document.getElementById('editor-panel').classList.remove('active');
  updateResetBtn();
  showScreen('screen-select');
}
// 弹窗打开时把背景区域设为 inert：读屏与 Tab 都不会穿透到被遮挡的界面。
// inert 不可用时（老浏览器）退化为仅靠焦点陷阱 + aria-modal。
function setBackgroundInert(on) {
  const targets = ['xd-chrome-head', 'xd-app', 'xd-chrome-foot'];
  for (let i = 0; i < targets.length; i++) {
    const el = document.getElementById(targets[i]);
    if (!el) continue;
    if (on) {
      if (el.hasAttribute('inert')) continue;
      el.setAttribute('inert', '');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el.removeAttribute('inert');
      el.removeAttribute('aria-hidden');
    }
  }
}
function showModal(html) {
  const content = document.getElementById('modal-content');
  const ov = document.getElementById('overlay');
  if (!content || !ov) return;
  if (!ov.classList.contains('active')) modalReturnFocus = document.activeElement;
  content.innerHTML = String(html).replace('<h3>', '<h3 id="modal-title">');
  ov.classList.add('active');
  setBackgroundInert(true);
  const first = content.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (first && first.focus) {
    try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); }
  }
}
function closeModal() {
  const ov = document.getElementById('overlay');
  if (!ov || !ov.classList.contains('active')) return;
  ov.classList.remove('active');
  setBackgroundInert(false);
  const back = modalReturnFocus;
  modalReturnFocus = null;
  if (back && back.focus && document.contains(back)) {
    try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); }
  }
}
function initModalA11y() {
  const ov = document.getElementById('overlay');
  if (!ov || ov.__a11yBound) return;
  ov.__a11yBound = true;
  document.addEventListener('keydown', function (e) {
    if (ov.classList.contains('active')) {
      if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
      if (e.key !== 'Tab') return;
      const items = ov.querySelectorAll('button:not([disabled]), input:not([disabled]), select, textarea, [href], [tabindex]:not([tabindex="-1"])');
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const cur = document.activeElement;
      if (!ov.contains(cur)) { e.preventDefault(); first.focus(); return; }
      if (e.shiftKey && cur === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && cur === last) { e.preventDefault(); first.focus(); }
      return;
    }
    if (e.key !== 'Escape') return;
    if (document.getElementById('editor-panel').classList.contains('active')) {
      e.preventDefault();
      goSelect();
    }
  });
}

function showRules() {
  showModal(
    '<h3>游戏规则</h3>' +
    '<p class="modal-copy">' +
    '星铎棋 · 六边形翻转棋<br>' +
    '· 棋盘由 54 个小三角组成大正六边形。<br>' +
    '· 落子时，从该格 6 个方向出发：若某方向存在<b>连续对方棋子</b>且尽头为<b>己方棋子</b>，则这些对方棋子翻转为己方颜色。<br>' +
    '· 无合法位置时自动跳过；双方均无法落子时结算，<b>棋子多的一方获胜</b>。' +
    '</p>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">知道了</button></div>'
  );
}
function showSettings() {
  showModal(
    '<h3>设置</h3>' +
    '<label><input type="checkbox" id="st-anim"' + (settings.animation ? ' checked' : '') + '>启用落子动画</label>' +
    '<label><input type="checkbox" id="st-hint"' + (settings.showAiHint ? ' checked' : '') + '>显示 AI 下子位置（红边）</label>' +
    '<div class="modal-copy modal-copy--field">AI 位置提示时长 (ms)：<input type="number" id="st-aidur" min="200" max="5000" step="100" inputmode="numeric" aria-label="AI 位置提示时长，单位毫秒" value="' + settings.aiHintDuration + '"></div>' +
    '<div class="modal-copy modal-copy--field">回合提示时长 (ms)：<input type="number" id="st-turndur" min="200" max="5000" step="100" inputmode="numeric" aria-label="回合提示时长，单位毫秒" value="' + settings.turnHintDuration + '"></div>' +
    '<p class="hint" id="st-record">当前战绩：黑 ' + history[0] + ' · 平 ' + history[2] + ' · 白 ' + history[1] + '</p>' +
    '<div class="row" style="margin-top:16px">' +
    '<button type="button" class="btn small light" onclick="resetSettings()">恢复默认</button> ' +
    '<button type="button" class="btn small green" onclick="applySettings()">应用</button> ' +
    '<button type="button" class="btn small light" onclick="closeModal()">取消</button>' +
    '</div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="clearHistory()">清空战绩</button></div>'
  );
}
function applySettings() {
  const a = document.getElementById('st-anim');
  const h = document.getElementById('st-hint');
  const d1 = document.getElementById('st-aidur');
  const d2 = document.getElementById('st-turndur');
  settings.animation = !!(a && a.checked);
  settings.showAiHint = !!(h && h.checked);
  settings.aiHintDuration = clampMs(d1 && d1.value, DEFAULT_SETTINGS.aiHintDuration);
  settings.turnHintDuration = clampMs(d2 && d2.value, DEFAULT_SETTINGS.turnHintDuration);
  saveSettings();
  closeModal();
  draw();
}
function resetSettings() {
  settings = { ...DEFAULT_SETTINGS };
  saveSettings();
  showSettings();
}
function clearHistory() {
  history = [0, 0, 0];
  persistHistory();
  const rec = document.getElementById('st-record');
  if (rec) rec.textContent = '当前战绩：黑 0 · 平 0 · 白 0';
  draw();
}

function startLocalPVP() {
  closeModal();
  pveMode = false;
  isCustomGame = false; customBoardForGame = null;
  inCustomGame = false;
  updateResetBtn();
  showFirstChoice('pvp');
}
function startPVE() {
  isCustomGame = false; customBoardForGame = null;
  inCustomGame = false;
  updateResetBtn();
  showModal(
    '<h3>人机对战</h3>' +
    '<div class="color-btns">' +
    '<button type="button" class="color-btn black" onclick="startPVEColor(1)">玩家执黑</button>' +
    '<button type="button" class="color-btn white" onclick="startPVEColor(2)">玩家执白</button>' +
    '</div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">取消</button></div>'
  );
}
function startPVEColor(color) {
  closeModal();
  pveMode = true;
  myColor = color; botColor = 3 - color;
  updateResetBtn();
  showFirstChoice('pve');
}
function showFirstChoice(mode) {
  showScreen('screen-first');
  const box = document.getElementById('first-btns');
  const h2 = document.getElementById('first-title');
  box.innerHTML = '';
  if (mode === 'pvp') {
    h2.textContent = '选择先手颜色';
    box.innerHTML =
      '<button type="button" class="segmented__btn" onclick="startLocalGame(1)">黑方先手</button>' +
      '<button type="button" class="segmented__btn" onclick="startLocalGame(Math.random()<0.5?1:2)">随机先手</button>' +
      '<button type="button" class="segmented__btn" onclick="startLocalGame(2)">白方先手</button>';
  } else if (mode === 'pve') {
    h2.textContent = '选择先手';
    if (myColor === 1) {
      box.innerHTML =
        '<button type="button" class="segmented__btn" onclick="startPVEFirst(\'player\')">黑方先手</button>' +
        '<button type="button" class="segmented__btn" onclick="startPVEFirst(\'random\')">随机先手</button>' +
        '<button type="button" class="segmented__btn" onclick="startPVEFirst(\'ai\')">白方先手</button>';
    } else {
      box.innerHTML =
        '<button type="button" class="segmented__btn" onclick="startPVEFirst(\'ai\')">黑方先手</button>' +
        '<button type="button" class="segmented__btn" onclick="startPVEFirst(\'random\')">随机先手</button>' +
        '<button type="button" class="segmented__btn" onclick="startPVEFirst(\'player\')">白方先手</button>';
    }
  }
}
function startLocalGame(first) {
  firstPlayer = first;
  resetBoardData();
  if (isCustomGame && customBoardForGame) deserializeBoard(customBoardForGame);
  currentPlayer = first;
  pveMode = false;
  showScreen('screen-game');
  draw(); updateStatus();
}
function startPVEFirst(who) {
  if (who === 'player') firstPlayer = myColor;
  else if (who === 'ai') firstPlayer = botColor;
  else firstPlayer = Math.random() < 0.5 ? myColor : botColor;
  flowDifficulty = '标准';
  showDifficultyScreen();
}
function showDifficultyScreen() {
  showScreen('screen-difficulty');
  const box = document.getElementById('diff-btns');
  box.innerHTML = '';
  const diffs = [
    { key: '体验', cls: 'easy',   desc: '轻松上手 · AI 选择翻子最多的位置' },
    { key: '标准', cls: 'normal', desc: '均衡难度 · AI 考虑边角权重' },
    { key: '磨难', cls: 'hard',   desc: '全力应战 · AI 搜索两步最优' },
    { key: '危机合约', cls: 'hell',   desc: '极限挑战 · 迭代加深 + 深度搜索' }
  ];
  for (const d of diffs) {
    const selected = (flowDifficulty === d.key);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diff-btn ' + d.cls + (selected ? ' is-active' : '');
    btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    btn.innerHTML = '<div class="diff-btn-title">' + d.key + '</div>' +
      '<div class="diff-btn-desc">' + d.desc + '</div>';
    btn.onclick = (function (key) {
      return function () { flowDifficulty = key; showDifficultyScreen(); };
    })(d.key);
    box.appendChild(btn);
  }
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-primary btn--block';
  startBtn.textContent = '开始对局';
  startBtn.onclick = function () { pveBeginGame(); };
  box.appendChild(startBtn);
}
function backFromDifficulty() { showScreen('screen-first'); }
function pveBeginGame() {
  difficulty = flowDifficulty;
  resetBoardData();
  if (isCustomGame && customBoardForGame) deserializeBoard(customBoardForGame);
  currentPlayer = firstPlayer;
  gameOver = false; overText = '';
  showScreen('screen-game');
  draw(); updateStatus();
  startPveWatch();
  scheduleBot(600);
}

let botPending = false;
let botThinking = false;
let pveWatchTimer = null;
function scheduleBot(delay, force) {
  if (!pveMode || gameOver || currentPlayer !== botColor) return;
  if (force) {
    setTimeout(function () {
      if (!pveMode || gameOver || currentPlayer !== botColor) return;
      if (botPending || botThinking) {
        scheduleBot(Math.max(40, (delay | 0) >> 1), true);
        return;
      }
      botThinking = true;
      try { botMove(); }
      finally { botThinking = false; }
      if (pveMode && !gameOver && currentPlayer === botColor) {
        scheduleBot(Math.max(560, animRemaining() + 280));
      }
    }, delay | 0);
    return;
  }
  if (botPending || botThinking) return;
  botPending = true;
  setTimeout(function () {
    botPending = false;
    botThinking = true;
    try { botMove(); }
    finally { botThinking = false; }
    if (pveMode && !gameOver && currentPlayer === botColor) {
      scheduleBot(Math.max(560, animRemaining() + 280));
    }
  }, delay);
}
function startPveWatch() {
  clearInterval(pveWatchTimer);
  pveWatchTimer = setInterval(function () {
    if (!pveMode) { clearInterval(pveWatchTimer); pveWatchTimer = null; return; }
    if (gameOver || animating || botPending || botThinking) return;
    if (currentPlayer === botColor) scheduleBot(500);
  }, 1200);
}
function updateStatus(text) {
  const el = document.getElementById('status-line');
  if (!el) return;
  el.classList.remove('hidden');
  let msg = text;
  if (!msg) {
    if (gameOver) {
      msg = overText || '对局结束';
    } else if (skipNote && Date.now() < skipUntil) {
      msg = skipNote;
    } else if (currentPlayer === 0) {
      msg = '等待开始...';
    } else if (pveMode) {
      msg = (currentPlayer === myColor) ? '你的回合' : (difficulty === '危机合约' ? '危机合约演算中......' : '思索中......');
    } else {
      msg = (currentPlayer === 1) ? '黑方回合' : '白方回合';
    }
  }
  const secs = timerSecondsLeft();
  const html = (secs >= 0) ? msg + '<span class="tsec">' + secs + 's</span>' : msg;
  if (lastStatusHtml !== html) { lastStatusHtml = html; el.innerHTML = html; }
  if (!gameOver && lastSpokenStatus !== msg) {
    lastSpokenStatus = msg;
    const live = document.getElementById('a11y-live');
    if (live && live.textContent !== msg) live.textContent = msg;
  }
  const warn = (secs >= 0 && secs <= 10);
  if (el.classList.contains('timer-warn') !== warn) el.classList.toggle('timer-warn', warn);
  const bar = gameOver ? 'bar-c' : (currentPlayer === 2 ? 'bar-r' : 'bar-l');
  if (el.dataset.bar !== bar) {
    el.dataset.bar = bar;
    el.classList.remove('bar-l', 'bar-r', 'bar-c');
    el.classList.add(bar);
  }
}
function settleGame() {
  if (gameOver) return;
  gameOver = true;
  timerStop();
  const w = checkWinner();
  overText = (w === 1) ? '黑方获胜' : (w === 2) ? '白方获胜' : '平局';
  skipNote = '';
  history[w === 1 ? 0 : w === 2 ? 1 : 2]++;
  persistHistory();
  draw();
}
function settleTimeout(loser) {
  if (gameOver) return;
  gameOver = true;
  timerStop();
  overText = (loser === 1) ? '黑方超时，白方获胜' : '白方超时，黑方获胜';
  skipNote = '';
  history[loser === 1 ? 1 : 0]++;
  persistHistory();
  draw();
}
function hasMoves(who) {
  return who !== 0 && Object.keys(getValidMoves(who)).length > 0;
}
// 一方无子可落时跳过回合；双方都无法落子则结算。
// 这里不可能连续跳过两次以上（跳过之后对方一定还有子可落），guard 只作兜底。
function resolveStuck() {
  if (gameOver || currentPlayer === 0) return false;
  let acted = false, guard = 0;
  while (guard++ < 4 && currentPlayer !== 0 && !hasMoves(currentPlayer)) {
    const other = 3 - currentPlayer;
    if (!hasMoves(other)) { settleGame(); return true; }
    skipNote = (currentPlayer === 1 ? '黑方' : '白方') + '无法落子，回合跳过';
    skipUntil = Date.now() + 1800;
    currentPlayer = other;
    acted = true;
  }
  if (acted) {
    const stamp = skipUntil;
    setTimeout(function () {
      if (!gameOver && skipUntil === stamp) { skipNote = ''; draw(); }
    }, 1900);
  }
  return acted;
}
function afterMove() {
  if (gameOver) { draw(); return; }
  if (currentPlayer === 0) { draw(); updateStatus(); return; }
  skipNote = '';
  currentPlayer = 3 - currentPlayer;
  resolveStuck();
  draw();
  scheduleBot(Math.max(560, animRemaining() + 280));
}

function snapBoard() {
  return { cells: Object.assign({}, board) };
}
// 注意：版本号必须单调递增，不能回退到快照时的值。
// 旧实现回退 boardVer，导致 pieceCounts() 的缓存键在不同局面上重合，
// 搜索回滚后可能读到上一局面的子数。这里每次都推进版本号使缓存失效。
function restoreBoard(snap) {
  const cells = snap.cells;
  for (const pid in board) {
    board[pid] = cells[pid] !== undefined ? cells[pid] : 0;
  }
  boardVer++;
}
function syncBoardFaces() {
  const now = Date.now();
  for (const pid in id2tri) {
    const busy = !!(busyUntil[pid] && busyUntil[pid] > now);
    if (!busy) setFaceStates(pid, board[pid]);
  }
}
function hellMainLineScore(player, pid) {
  searchMode = true;
  const moves = getValidMoves(player);
  if (!moves[pid]) { searchMode = false; return -HELL_INF; }
  const opp = 3 - player;
  const snap = snapBoard();
  makeMove(pid, player);
  const myScore = evaluate(player);
  const oppMoves = getValidMoves(opp);
  let oppBest = -Infinity;
  for (const opid in oppMoves) {
    const snap2 = snapBoard();
    makeMove(opid, opp);
    const sc = evaluate(opp);
    if (sc > oppBest) oppBest = sc;
    restoreBoard(snap2);
  }
  restoreBoard(snap);
  searchMode = false;
  return myScore - (oppBest === -Infinity ? -1000 : oppBest) * 1.2;
}
function hellMainTwoPly(player) {
  searchMode = true;
  const moves = getValidMoves(player);
  const keys = Object.keys(moves);
  if (!keys.length) { searchMode = false; return null; }
  let best = -Infinity;
  let bestPid = keys[0];
  for (let i = 0; i < keys.length; i++) {
    const pid = keys[i];
    const sc = hellMainLineScore(player, pid);
    if (sc > best || (sc === best && pid < bestPid)) {
      best = sc;
      bestPid = pid;
    }
  }
  searchMode = false;
  return bestPid;
}
function clearBotHint() {
  if (botHintTimer) { clearTimeout(botHintTimer); botHintTimer = null; }
  lastBotPid = null;
}
function showBotMoveHint(pid) {
  if (!settings.showAiHint || !pid) return;
  lastBotPid = pid;
  if (botHintTimer) clearTimeout(botHintTimer);
  const ms = Math.max(settings.aiHintDuration | 0, animRemaining() + 520);
  botHintTimer = setTimeout(function () {
    botHintTimer = null;
    lastBotPid = null;
    draw();
  }, ms);
}
function botMove() {
  if (gameOver || currentPlayer !== botColor) return;
  clearBotHint();
  searchMode = true;
  let bestPid = null;
  try {
    const moves = getValidMoves(botColor);
    const keys = Object.keys(moves);
    if (!keys.length) {
      bestPid = null;
    } else if (difficulty === '体验') {
      bestPid = keys.reduce(function (a, b) { return moves[a].length >= moves[b].length ? a : b; });
    } else if (difficulty === '标准') {
      let best = -Infinity;
      for (const pid of keys) {
        const score = (edgeWeight[pid] || 0) * 3 + moves[pid].length + (Math.random() - 0.5) * 4;
        if (score > best) { best = score; bestPid = pid; }
      }
    } else if (difficulty === '危机合约') {
      try { bestPid = hellBestMove(botColor); }
      catch (e) { bestPid = null; }
    } else {
      let best = -Infinity;
      for (const pid of keys) {
        const snap = snapBoard();
        makeMove(pid, botColor);
        const myScore = evaluate(botColor);
        const oppMoves = getValidMoves(3 - botColor);
        let oppBest = -Infinity;
        for (const opid of Object.keys(oppMoves)) {
          const snap2 = snapBoard();
          makeMove(opid, 3 - botColor);
          const sc = evaluate(3 - botColor);
          if (sc > oppBest) oppBest = sc;
          restoreBoard(snap2);
        }
        const total = myScore - (oppBest === -Infinity ? -1000 : oppBest) * 1.2 + (Math.random() - 0.5) * 2;
        if (total > best) { best = total; bestPid = pid; }
        restoreBoard(snap);
      }
    }
  } finally {
    searchMode = false;
  }
  const live = getValidMoves(botColor);
  const liveKeys = Object.keys(live);
  if (!liveKeys.length) {
    afterMove();
    return;
  }
  if (!bestPid || !live[bestPid]) bestPid = liveKeys[0];
  if (!makeMove(bestPid, botColor)) {
    scheduleBot(120, true);
    return;
  }
  showBotMoveHint(bestPid);
  draw();
  afterMove();
}
function evaluate(player) {
  const opp = 3 - player;
  let score = 0;
  for (const pid in board) {
    const v = board[pid];
    if (v === player) score += 10 + (edgeWeight[pid] || 0) * 5;
    else if (v === opp) score -= 10 + (edgeWeight[pid] || 0) * 5;
  }
  return score;
}

// 危机合约：迭代加深的 Alpha-Beta。中盘看重行动力与边角，残局按子数算到底。
let aiPids = [];
let aiLines = [];
let aiNeigh = [];
let aiEdge = [];
let aiCorner = 3;
let hellZ1 = null, hellZ2 = null, hellSide1 = 0, hellSide2 = 0;
let hellHist = [null, null, null];
let hellKill = [];
let hellMoveBuf = [];
let hellTTKey1 = null, hellTTKey2 = null, hellTTDepth = null, hellTTScore = null;
let hellTTFlag = null, hellTTMove = null, hellTTAge = null, hellTTMask = 0;
let hellSeen = null;
let hellStamp = 1;
let hellAge = 0, hellNodes = 0, hellAbort = false, hellDeadline = 0;
let HH1 = 0, HH2 = 0;
const HELL_INF = 1000000000;

function aiRand32(seed) {
  let a = seed.s | 0;
  a = a + 0x6D2B79F5 | 0;
  seed.s = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (t ^ (t >>> 14)) >>> 0;
}
function indexAiGeometry() {
  aiPids = Object.keys(id2tri);
  const idx = Object.create(null);
  const n = aiPids.length;
  for (let i = 0; i < n; i++) idx[aiPids[i]] = i;
  aiLines = new Array(n);
  aiNeigh = new Array(n);
  aiEdge = new Array(n);
  let maxE = 0;
  for (let i = 0; i < n; i++) {
    const pid = aiPids[i];
    const dirs = lines[pid] || [];
    const darr = new Array(6);
    const nb = [];
    for (let d = 0; d < 6; d++) {
      const src = dirs[d] || [];
      const arr = new Array(src.length);
      for (let k = 0; k < src.length; k++) arr[k] = idx[src[k]];
      darr[d] = arr;
      if (arr.length) nb.push(arr[0]);
    }
    aiLines[i] = darr;
    aiNeigh[i] = nb;
    const ew = edgeWeight[pid] | 0;
    aiEdge[i] = ew;
    if (ew > maxE) maxE = ew;
  }
  // 角格 = 边线权重的最大值。旧写法要求 maxE >= 3 才生效，
  // 而本棋盘 54 格的 edgeWeight 只有 {0, 2} 两种取值，条件永远不成立，
  // 于是“角落优先”的排序奖励成了死代码。这里改为直接取实际最大值。
  aiCorner = maxE > 0 ? maxE : 99;
  hellHist = [null, new Int32Array(n), new Int32Array(n)];
  hellSeen = new Uint8Array(n);
  hellStamp = 1;
  hellZ1 = new Uint32Array(n * 2);
  hellZ2 = new Uint32Array(n * 2);
  const seed = { s: 0x51a7c0de };
  for (let i = 0; i < n * 2; i++) {
    hellZ1[i] = aiRand32(seed) || 1;
    hellZ2[i] = aiRand32(seed) || 1;
  }
  hellSide1 = aiRand32(seed) || 1;
  hellSide2 = aiRand32(seed) || 1;
  hellTTKey1 = null;
}
function ensureHellTT() {
  if (hellTTKey1) return;
  const S = 1 << 18;
  hellTTMask = S - 1;
  hellTTKey1 = new Uint32Array(S);
  hellTTKey2 = new Uint32Array(S);
  hellTTDepth = new Int16Array(S);
  hellTTScore = new Int32Array(S);
  hellTTFlag = new Uint8Array(S);
  hellTTMove = new Int16Array(S);
  hellTTAge = new Uint16Array(S);
}
function hellHash(b, player) {
  let h1 = player === 2 ? hellSide1 : 0;
  let h2 = player === 2 ? hellSide2 : 0;
  const zA = hellZ1, zB = hellZ2, n = b.length;
  for (let i = 0; i < n; i++) {
    const v = b[i];
    if (v) {
      const p = (i << 1) + v - 1;
      h1 ^= zA[p];
      h2 ^= zB[p];
    }
  }
  HH1 = h1 >>> 0;
  HH2 = h2 >>> 0;
}
function hellTTProbe(h1, h2) {
  const i = h1 & hellTTMask;
  if (hellTTAge[i] === hellAge && hellTTKey1[i] === h1 && hellTTKey2[i] === h2) return i;
  return -1;
}
function hellTTStore(h1, h2, depth, score, flag, move) {
  const i = h1 & hellTTMask;
  if (hellTTAge[i] === hellAge && hellTTKey1[i] === h1 && hellTTKey2[i] === h2 && hellTTDepth[i] > depth) return;
  hellTTAge[i] = hellAge;
  hellTTKey1[i] = h1;
  hellTTKey2[i] = h2;
  hellTTDepth[i] = depth;
  hellTTScore[i] = score;
  hellTTFlag[i] = flag;
  hellTTMove[i] = move;
}
function genMovesInto(b, player, ply, needFlips) {
  const opp = 3 - player;
  let buf = hellMoveBuf[ply];
  if (!buf) buf = hellMoveBuf[ply] = [];
  const linesOf = aiLines;
  const N = b.length;
  let n = 0;
  for (let i = 0; i < N; i++) {
    if (b[i] !== 0) continue;
    const dirs = linesOf[i];
    let mv = null;
    for (let d = 0; d < 6; d++) {
      const line = dirs[d];
      const len = line.length;
      if (!len || b[line[0]] !== opp) continue;
      let j = 0;
      while (j < len && b[line[j]] === opp) j++;
      if (j >= len || b[line[j]] !== player) continue;
      if (!mv) {
        mv = buf[n];
        if (!mv) mv = buf[n] = { i: 0, flips: [], ord: 0 };
        mv.i = i;
        if (needFlips) {
          mv.flips.length = 0;
          if (++hellStamp >= 250) { hellSeen.fill(0); hellStamp = 1; }
        }
      }
      if (!needFlips) break;
      for (let k = 0; k < j; k++) {
        const f = line[k];
        if (hellSeen[f] === hellStamp) continue;
        hellSeen[f] = hellStamp;
        mv.flips.push(f);
      }
    }
    if (mv) n++;
  }
  buf.count = n;
  return buf;
}
function hellApply(b, i, player, flips) {
  b[i] = player;
  for (let k = 0; k < flips.length; k++) b[flips[k]] = player;
}
function hellUndo(b, i, player, flips) {
  const opp = 3 - player;
  b[i] = 0;
  for (let k = 0; k < flips.length; k++) b[flips[k]] = opp;
}
function hellSort(arr, n) {
  for (let i = 1; i < n; i++) {
    const v = arr[i];
    const o = v.ord;
    let j = i - 1;
    while (j >= 0 && arr[j].ord < o) {
      arr[j + 1] = arr[j];
      j--;
    }
    arr[j + 1] = v;
  }
}
/** 若某着法一步吃完对方所有棋子，必须优先（不依赖深度搜索是否来得及算到） */
function hellPickOppWipe(b, player, moves) {
  const opp = 3 - player;
  let hadOpp = false;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === opp) { hadOpp = true; break; }
  }
  if (!hadOpp) return -1;
  let pick = -1;
  let bestFlips = -1;
  for (let m = 0; m < moves.count; m++) {
    const mv = moves[m];
    hellApply(b, mv.i, player, mv.flips);
    let rem = 0;
    for (let i = 0; i < b.length; i++) if (b[i] === opp) rem++;
    hellUndo(b, mv.i, player, mv.flips);
    if (rem !== 0) continue;
    const fc = mv.flips.length;
    if (fc > bestFlips) { bestFlips = fc; pick = mv.i; }
  }
  return pick;
}
function hellOrder(moves, n, player, ply, ttMove, empties) {
  const late = empties <= 14;
  const k = hellKill[ply];
  const k0 = k ? k[0] : -1;
  const k1 = k ? k[1] : -1;
  const hist = hellHist[player];
  const edge = aiEdge;
  const corner = aiCorner;
  for (let i = 0; i < n; i++) {
    const mv = moves[i];
    const sq = mv.i;
    let s = hist[sq];
    if (sq === ttMove) s += 10000000;
    else if (sq === k0) s += 5000000;
    else if (sq === k1) s += 4000000;
    const ew = edge[sq];
    s += ew * 20000;
    if (ew >= corner) s += 300000;
    const fc = mv.flips.length;
    s += fc * (late ? 60 : 28) + ew * 120;
    if (fc >= 4) s += fc * fc * 9000;
    if (fc >= 7) s += 1800000;
    mv.ord = s;
  }
  hellSort(moves, n);
}
function hellTerminal(b, player) {
  const opp = 3 - player;
  let my = 0, op = 0;
  for (let i = 0; i < b.length; i++) {
    const v = b[i];
    if (v === player) my++;
    else if (v === opp) op++;
  }
  const diff = my - op;
  if (diff > 0) return 100000 + diff * 50;
  if (diff < 0) return -100000 + diff * 50;
  return 0;
}
function evalIndexed(b, player) {
  const opp = 3 - player;
  let score = 0;
  for (let i = 0; i < b.length; i++) {
    const v = b[i];
    const ew = aiEdge[i];
    if (v === player) score += 10 + ew * 5;
    else if (v === opp) score -= 10 + ew * 5;
  }
  return score;
}
function evalIndexedMobility(b, player, empties, myMoves, oppMoves) {
  const mobW = empties > 28 ? 12 : (empties > 16 ? 8 : 4);
  return evalIndexed(b, player) + (myMoves.count - oppMoves.count) * mobW;
}
function hellEval(b, player, empties, myMoves, oppMoves) {
  if (empties <= 16) return evalIndexed(b, player);
  return evalIndexedMobility(b, player, empties, myMoves, oppMoves);
}
function contractEval(b, player, empties, ply) {
  if (empties <= 16) return evalIndexed(b, player);
  const moves = genMovesInto(b, player, ply, false);
  const opp = 3 - player;
  const oppMoves = genMovesInto(b, opp, ply + 1, false);
  return evalIndexedMobility(b, player, empties, moves, oppMoves);
}
function contractNegamax(b, player, depth, alpha, beta, empties, ply) {
  if (hellAbort) return 0;
  hellNodes++;
  if ((hellNodes & 1023) === 0 && (Date.now() >= hellDeadline || hellNodes > 4000000)) {
    hellAbort = true;
    return 0;
  }
  const opp = 3 - player;
  const moves = genMovesInto(b, player, ply, depth > 0);
  const nMoves = moves.count;
  if (nMoves === 0) {
    const oppMoves = genMovesInto(b, opp, ply + 1, false);
    if (oppMoves.count === 0) return hellTerminal(b, player);
    return -contractNegamax(b, opp, depth, -beta, -alpha, empties, ply + 1);
  }
  if (depth === 0) return contractEval(b, player, empties, ply);
  hellOrder(moves, nMoves, player, ply, -1, empties);
  let best = -HELL_INF;
  for (let m = 0; m < nMoves; m++) {
    const mv = moves[m];
    hellApply(b, mv.i, player, mv.flips);
    let sc = -contractNegamax(b, opp, depth - 1, -beta, -alpha, empties - 1, ply + 1);
    hellUndo(b, mv.i, player, mv.flips);
    if (sc > best) best = sc;
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) {
      hellHist[player][mv.i] += depth * depth;
      break;
    }
  }
  return best;
}
function contractRootPick(b, player, empties, maxDepth, deadline, floorPid) {
  hellDeadline = deadline;
  hellAbort = false;
  hellNodes = 0;
  const liveSnap = snapBoard();
  let floorScore;
  try {
    floorScore = hellMainLineScore(player, floorPid);
  } finally {
    restoreBoard(liveSnap);
    searchMode = false;
  }
  let floorI = -1;
  for (let i = 0; i < aiPids.length; i++) {
    if (aiPids[i] === floorPid) { floorI = i; break; }
  }
  if (floorI < 0) return 0;
  const moves = genMovesInto(b, player, 0, true);
  if (!moves.count) return floorI;
  hellOrder(moves, moves.count, player, 0, -1, empties);
  const opp = 3 - player;
  const plySearch = Math.max(5, Math.min(maxDepth | 0, empties > 32 ? 6 : (empties > 18 ? 7 : (empties > 10 ? 8 : 10))));
  let bestI = floorI;
  let bestDeep = -HELL_INF;
  let floorDeep = -HELL_INF;
  for (let m = 0; m < moves.count; m++) {
    if (aiPids[moves[m].i] === floorPid) {
      hellApply(b, moves[m].i, player, moves[m].flips);
      floorDeep = -contractNegamax(b, opp, plySearch - 1, -HELL_INF, HELL_INF, empties - 1, 1);
      hellUndo(b, moves[m].i, player, moves[m].flips);
      bestDeep = floorDeep;
      break;
    }
  }
  for (let m = 0; m < moves.count; m++) {
    if (m > 0 && Date.now() >= deadline) break;
    const mv = moves[m];
    const pid = aiPids[mv.i];
    let s2;
    try {
      s2 = hellMainLineScore(player, pid);
    } finally {
      restoreBoard(liveSnap);
      searchMode = false;
    }
    if (s2 + 0.01 < floorScore) continue;
    hellApply(b, mv.i, player, mv.flips);
    const sDeep = -contractNegamax(b, opp, plySearch - 1, -HELL_INF, HELL_INF, empties - 1, 1);
    hellUndo(b, mv.i, player, mv.flips);
    let sBest = 0;
    try {
      sBest = hellMainLineScore(player, aiPids[bestI]);
    } finally {
      restoreBoard(liveSnap);
      searchMode = false;
    }
    if (sDeep > bestDeep || (sDeep === bestDeep && (s2 > sBest || (s2 === sBest && mv.i < bestI)))) {
      bestDeep = sDeep;
      bestI = mv.i;
    }
  }
  if (bestDeep <= -HELL_INF / 2) return floorI;
  let sFinal;
  try {
    sFinal = hellMainLineScore(player, aiPids[bestI]);
  } finally {
    restoreBoard(liveSnap);
    searchMode = false;
  }
  if (sFinal + 0.01 < floorScore) return floorI;
  return bestI;
}
function hellNegamax(b, player, depth, alpha, beta, empties, ply) {
  if (hellAbort) return 0;
  hellNodes++;
  if ((hellNodes & 1023) === 0 && (Date.now() >= hellDeadline || hellNodes > 3000000)) {
    hellAbort = true;
    return 0;
  }
  const alphaOrig = alpha;
  hellHash(b, player);
  const h1 = HH1, h2 = HH2;
  let ttMove = -1;
  const ti = hellTTProbe(h1, h2);
  if (ti >= 0) {
    ttMove = hellTTMove[ti];
    if (hellTTDepth[ti] >= depth) {
      const fl = hellTTFlag[ti];
      const sc = hellTTScore[ti];
      if (fl === 0) return sc;
      if (fl === 1 && sc > alpha) alpha = sc;
      else if (fl === 2 && sc < beta) beta = sc;
      if (alpha >= beta) return sc;
    }
  }
  const opp = 3 - player;
  const moves = genMovesInto(b, player, ply, depth > 0);
  const nMoves = moves.count;
  if (nMoves === 0) {
    const oppMoves = genMovesInto(b, opp, ply + 1, false);
    if (oppMoves.count === 0) {
      const sc = hellTerminal(b, player);
      hellTTStore(h1, h2, 64, sc, 0, -1);
      return sc;
    }
    if (depth === 0) return hellEval(b, player, empties, moves, oppMoves);
    const sc = -hellNegamax(b, opp, depth, -beta, -alpha, empties, ply + 1);
    if (hellAbort) return 0;
    return sc;
  }
  if (depth === 0) {
    const oppMoves = genMovesInto(b, opp, ply + 1, false);
    return hellEval(b, player, empties, moves, oppMoves);
  }
  hellOrder(moves, nMoves, player, ply, ttMove, empties);
  let best = -HELL_INF;
  let bestI = moves[0].i;
  for (let m = 0; m < nMoves; m++) {
    const mv = moves[m];
    hellApply(b, mv.i, player, mv.flips);
    let sc;
    if (m === 0) sc = -hellNegamax(b, opp, depth - 1, -beta, -alpha, empties - 1, ply + 1);
    else {
      sc = -hellNegamax(b, opp, depth - 1, -alpha - 1, -alpha, empties - 1, ply + 1);
      if (!hellAbort && sc > alpha && sc < beta)
        sc = -hellNegamax(b, opp, depth - 1, -beta, -alpha, empties - 1, ply + 1);
    }
    hellUndo(b, mv.i, player, mv.flips);
    if (hellAbort) return 0;
    if (sc > best) { best = sc; bestI = mv.i; }
    if (sc > alpha) alpha = sc;
    if (alpha >= beta) {
      hellHist[player][mv.i] += depth * depth;
      const kk = hellKill[ply] || (hellKill[ply] = [-1, -1]);
      if (kk[0] !== mv.i) { kk[1] = kk[0]; kk[0] = mv.i; }
      break;
    }
  }
  let flag = 0;
  if (best <= alphaOrig) flag = 2;
  else if (best >= beta) flag = 1;
  hellTTStore(h1, h2, depth, best, flag, bestI);
  return best;
}
function hellRoot(b, player, depth, empties) {
  const moves = genMovesInto(b, player, 0, true);
  const nMoves = moves.count;
  hellHash(b, player);
  const h1 = HH1, h2 = HH2;
  const ti = hellTTProbe(h1, h2);
  const ttMove = ti >= 0 ? hellTTMove[ti] : -1;
  hellOrder(moves, nMoves, player, 0, ttMove, empties);
  const opp = 3 - player;
  let alpha = -HELL_INF;
  let best = -HELL_INF;
  let bestI = moves[0].i;
  for (let m = 0; m < nMoves; m++) {
    if (m > 0 && Date.now() >= hellDeadline) { hellAbort = true; break; }
    const mv = moves[m];
    hellApply(b, mv.i, player, mv.flips);
    let sc;
    if (m === 0) sc = -hellNegamax(b, opp, depth - 1, -HELL_INF, -alpha, empties - 1, 1);
    else {
      sc = -hellNegamax(b, opp, depth - 1, -alpha - 1, -alpha, empties - 1, 1);
      if (!hellAbort && sc > alpha)
        sc = -hellNegamax(b, opp, depth - 1, -HELL_INF, -alpha, empties - 1, 1);
    }
    hellUndo(b, mv.i, player, mv.flips);
    if (hellAbort) break;
    if (sc > best) { best = sc; bestI = mv.i; }
    if (sc > alpha) alpha = sc;
  }
  if (!hellAbort) hellTTStore(h1, h2, depth, best, 0, bestI);
  return { move: bestI, score: best };
}
function hellBestMove(player) {
  if ((player !== 1 && player !== 2) || !aiPids.length) return null;
  const liveSnap = snapBoard();
  try {
    ensureHellTT();
    const n = aiPids.length;
    const b = new Uint8Array(n);
    let empties = 0;
    for (let i = 0; i < n; i++) {
      const v = board[aiPids[i]] | 0;
      b[i] = (v === 1 || v === 2) ? v : 0;
      if (!b[i]) empties++;
    }
    const root0 = genMovesInto(b, player, 0, true);
    const nRoot = root0.count;
    if (!nRoot) return null;
    if (nRoot === 1) return aiPids[root0[0].i];
    const wipeI = hellPickOppWipe(b, player, root0);
    if (wipeI >= 0) return aiPids[wipeI];
    let bestI = root0[0].i;
    hellHist[1].fill(0);
    hellHist[2].fill(0);
    for (let i = 0; i < hellKill.length; i++) {
      const k = hellKill[i];
      if (k) { k[0] = -1; k[1] = -1; }
    }
    hellAge++;
    if (hellAge >= 65535) { hellTTAge.fill(0); hellAge = 1; }
    // 时间预算只是安全上限；实际强度由 maxDepth 决定。
    // 旧版在到达 maxDepth 之后仍然继续循环（每轮都重搜同一深度），
    // 由于置换表让重复搜索近乎瞬间完成，结果就是空转到预算耗尽：
    // 开局白等 2.8 秒、残局白等 11 秒，棋力一点没涨。这里改为到深度即止。
    let budget = 1200;
    if (empties <= 34) budget = 1400;
    if (empties <= 24) budget = 1600;
    if (empties <= 16) budget = 2000;
    hellDeadline = Date.now() + budget;
    hellAbort = false;
    hellNodes = 0;
    const minDepth = empties > 28 ? 4 : 5;
    let maxDepth = 8;
    if (empties <= 26) maxDepth = 10;
    if (empties <= 18) maxDepth = 12;
    if (empties <= 12) maxDepth = 14;
    if (empties <= 8) maxDepth = 16;
    let lastComplete = false;
    let d = minDepth;
    while (d <= maxDepth && Date.now() < hellDeadline - 60) {
      hellAbort = false;
      hellNodes = 0;
      const r = hellRoot(b, player, d, empties);
      if (hellAbort) break;
      if (r.move >= 0) {
        bestI = r.move;
        lastComplete = true;
      }
      d++;
    }
    if (!lastComplete && nRoot > 1 && Date.now() < hellDeadline - 200) {
      searchMode = true;
      const floorPid = hellMainTwoPly(player);
      searchMode = false;
      if (floorPid) {
        hellAbort = false;
        hellNodes = 0;
        const pickI = contractRootPick(b, player, empties, maxDepth, hellDeadline, floorPid);
        if (pickI >= 0) bestI = pickI;
      }
    }
    // 首个“必吃光对方”的着法在这里已经处理过（wipeI），无需在搜索后再查一次：
    // 此时局面未被改动，且 root0 指向的是会被搜索复用的共享缓冲，结果不可能变化。
    return aiPids[bestI];
  } finally {
    restoreBoard(liveSnap);
    searchMode = false;
    syncBoardFaces();
  }
}

let timerLimit = 0;
let timerTurn = 0;
let timerDeadline = 0;
let timerTick = null;
let lastStatusHtml = '';
// 人机对战里 AI 的回合不计时：搜索会同步占用主线程，
// 若让 AI 的时钟跟着走，慢设备上它会因为“自己想太久”而判负。
function isBotClockPaused() { return pveMode && currentPlayer !== 0 && currentPlayer === botColor; }
function timerSecondsLeft() {
  if (!timerLimit || gameOver || currentPlayer === 0 || isBotClockPaused()) return -1;
  if (!timerDeadline) return timerLimit;
  return Math.max(0, Math.ceil((timerDeadline - Date.now()) / 1000));
}
function timerStop() {
  timerTurn = 0;
  timerDeadline = 0;
  if (timerTick) { clearInterval(timerTick); timerTick = null; }
}
function timerHold(player) { timerTurn = player; timerDeadline = 0; }
function timerStart(player) {
  timerTurn = player;
  timerDeadline = Date.now() + timerLimit * 1000;
  if (!timerTick) timerTick = setInterval(timerPulse, 250);
  updateStatus();
}
function syncTimer() {
  if (!timerLimit || gameOver || currentPlayer === 0) { timerStop(); return; }
  if (animating || isBotClockPaused()) { timerHold(currentPlayer); return; }
  if (timerTurn !== currentPlayer || !timerDeadline) timerStart(currentPlayer);
}
function timerPulse() {
  if (!timerLimit || gameOver) { timerStop(); return; }
  if (!timerDeadline) return;
  if (Date.now() < timerDeadline) { updateStatus(); return; }
  const loser = timerTurn;
  timerStop();
  settleTimeout(loser);
}
function updateTimerBtn() {
  const b = document.getElementById('timer-btn');
  if (b) setText(b, timerLimit ? ('计时 · ' + timerLimit + ' 秒') : '计时 · 关');
}
function setTimerLimit(n) {
  const v = Math.round(Number(n) || 0);
  timerLimit = (v > 0) ? Math.min(600, v) : 0;
  updateTimerBtn();
  timerStop();
  draw();
}
function toggleTimer() {
  function opt(n, label) {
    const on = (timerLimit === n);
    return '<button type="button" class="color-btn" style="background:' + (on ? '#8d6b45' : '#CDBA96')
      + ';color:' + (on ? '#fff' : '#3E2A1F') + ';font-size:16px;padding:12px 22px" '
      + 'aria-pressed="' + (on ? 'true' : 'false') + '" '
      + 'onclick="chooseTimer(' + n + ')">' + (on ? '✓ ' : '') + label + '</button>';
  }
  showModal(
    '<h3>计时设置</h3>' +
    '<p class="modal-copy">每步限时，超时判负</p>' +
    '<div class="color-btns">' +
    opt(0, '不限时') + opt(15, '15 秒') + opt(30, '30 秒') +
    opt(60, '60 秒') + opt(120, '120 秒') +
    '</div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">取消</button></div>'
  );
}
function chooseTimer(n) { closeModal(); setTimerLimit(n); }
function resetBoard() {
  resetBoardData();
  if (isCustomGame && customBoardForGame) deserializeBoard(customBoardForGame);
  currentPlayer = firstPlayer;
  gameOver = false; overText = ''; skipNote = '';
  draw(); updateStatus();
  startPveWatch();
  scheduleBot(560);
}
function confirmReturn() {
  if (inCustomGame) {
    returnToEditor();
    return;
  }
  goSelect();
}
function returnToEditor() {
  resetPlaySession();
  pveMode = false;
  gameOver = false; overText = '';
  inCustomGame = false;
  updateResetBtn();
  
  // 确保抽屉隐藏
  const side = document.querySelector('.editor-side');
  if (side) side.classList.remove('show');
  const presetBtn = document.getElementById('ed-toggle-preset');
  if (presetBtn) presetBtn.setAttribute('aria-expanded', 'false');

  document.getElementById('editor-panel').classList.add('active');
  setTimeout(function () {
    if (!document.getElementById('editor-board').children.length) {
      buildEditorTiles(document.getElementById('editor-board'));
    }
    fitEditorBoard();
    renderEditor();
    refreshPresetHighlight();
  }, 20);
}

// ============================================================
// 编辑器
// ============================================================
function toggleEditorPreset() {
  const side = document.querySelector('.editor-side');
  if (!side) return;
  const open = side.classList.toggle('show');
  const btn = document.getElementById('ed-toggle-preset');
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function openCustomEditor() {
  closeModal();
  editorBoard = {};
  for (const pid in id2tri) editorBoard[pid] = 0;
  editorDefaultToBoard();
  editorMode = 1;
  updateEditorModeBtns();
  
  // 隐藏预设抽屉
  const side = document.querySelector('.editor-side');
  if (side) side.classList.remove('show');
  const presetBtn = document.getElementById('ed-toggle-preset');
  if (presetBtn) presetBtn.setAttribute('aria-expanded', 'false');
  
  const wrap = document.getElementById('editor-board');
  wrap.innerHTML = '';
  buildEditorTiles(wrap);
  document.getElementById('editor-panel').classList.add('active');
  syncStarDuoChrome();
  refreshPresetList();
  setTimeout(function () {
    fitEditorBoard();
    renderEditor();
  }, 20);
}
function editorDefaultToBoard() {
  const setup = { '0':0,'18':2,'19':0,'22':0,'23':1,'24':1,'25':0,'29':2,'30':2,'35':1 };
  for (const d in setup) if (disp2id[d]) editorBoard[disp2id[d]] = setup[d];
}
function refreshPresetList() {
  const list = document.getElementById('editor-preset-list');
  if (!list) return;
  list.innerHTML = '';
  const builtin = [
    { key: '__default__', label: '默认开局' },
    { key: '__endgame__', label: '残局' }
  ];
  for (const p of builtin) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'preset-item';
    item.dataset.key = p.key;
    item.textContent = p.label;
    item.setAttribute('aria-pressed', 'false');
    item.onclick = (function (k) { return function () { applyPreset(k); }; })(p.key);
    list.appendChild(item);
  }
  const names = Object.keys(customPresets).sort(function (a, b) { return a.localeCompare(b, 'zh-CN'); });
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const item = document.createElement('div');
    item.className = 'preset-item preset-item--custom';
    item.dataset.key = '__custom__' + name;
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'preset-item-label';
    label.textContent = name;
    label.setAttribute('aria-pressed', 'false');
    label.setAttribute('aria-label', '载入预设「' + name + '」');
    label.onclick = (function (n) { return function () { applyCustomPreset(n); }; })(name);
    item.onclick = label.onclick;
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'preset-item-delete';
    del.setAttribute('aria-label', '删除预设「' + name + '」');
    del.textContent = '删除';
    del.onclick = (function (n) {
      return function (e) {
        e.preventDefault();
        e.stopPropagation();
        deleteCustomPreset(n);
      };
    })(name);
    item.appendChild(label);
    item.appendChild(del);
    list.appendChild(item);
  }
}
function presetItemControl(it) {
  return it.classList.contains('preset-item--custom') ? it.querySelector('.preset-item-label') : it;
}
function refreshPresetHighlight() {
  const list = document.getElementById('editor-preset-list');
  if (!list) return;
  const items = list.querySelectorAll('.preset-item');
  for (const it of items) {
    it.classList.remove('active');
    const ctrl = presetItemControl(it);
    if (ctrl) ctrl.setAttribute('aria-pressed', 'false');
  }
}
function applyPreset(key) {
  if (key === '__default__') {
    for (const pid in editorBoard) editorBoard[pid] = 0;
    editorDefaultToBoard();
  } else if (key === '__endgame__') {
    const emptyIds = [5, 38, 43, 47, 51, 53, 50, 42, 32];
    const whiteIds = [35];
    for (const pid in editorBoard) editorBoard[pid] = 0;
    for (let i = 0; i < 54; i++) {
      const dpid = disp2id[String(i)];
      if (!dpid) continue;
      if (emptyIds.indexOf(i) !== -1) editorBoard[dpid] = 0;
      else if (whiteIds.indexOf(i) !== -1) editorBoard[dpid] = 2;
      else editorBoard[dpid] = 1;
    }
  }
  renderEditor();
  const list = document.getElementById('editor-preset-list');
  if (list) {
    const items = list.querySelectorAll('.preset-item');
    for (const it of items) {
      const on = (it.dataset.key === key);
      it.classList.toggle('active', on);
      const ctrl = presetItemControl(it);
      if (ctrl) ctrl.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
}
function applyCustomPreset(name) {
  const snap = customPresets[name];
  if (!snap) return;
  for (const pid in editorBoard) editorBoard[pid] = snap[pid] || 0;
  renderEditor();
  const list = document.getElementById('editor-preset-list');
  if (list) {
    const items = list.querySelectorAll('.preset-item');
    for (const it of items) {
      const on = (it.dataset.key === '__custom__' + name);
      it.classList.toggle('active', on);
      const ctrl = presetItemControl(it);
      if (ctrl) ctrl.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
}
function escHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function defaultPresetName() {
  return '自定义 ' + (Object.keys(customPresets).length + 1);
}
function saveCustomPreset() {
  showModal(
    '<h3>保存预设</h3>' +
    '<p class="modal-copy">当前棋子布局将保存到本机浏览器</p>' +
    '<div class="row"><input id="preset-name-input" type="text" maxlength="24" autocomplete="off" spellcheck="false" value="' +
      escHtml(defaultPresetName()) + '" aria-label="预设名称" placeholder="预设名称"></div>' +
    '<p class="hint" id="preset-hint">同名预设会被覆盖</p>' +
    '<div class="row"><button type="button" class="btn green" onclick="confirmSavePreset()">保存</button></div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">取消</button></div>'
  );
  const inp = document.getElementById('preset-name-input');
  if (!inp) return;
  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmSavePreset(); }
  });
}
function confirmSavePreset() {
  const inp = document.getElementById('preset-name-input');
  const hint = document.getElementById('preset-hint');
  const key = ((inp && inp.value) || '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!key) {
    if (hint) { hint.textContent = '名称不能为空'; hint.classList.add('is-error'); }
    if (inp) inp.focus();
    return;
  }
  const snap = {};
  for (const pid in editorBoard) snap[pid] = editorBoard[pid];
  customPresets[key] = snap;
  persistCustomPresets();
  closeModal();
  refreshPresetList();
  applyCustomPreset(key);
  flashPresetItem('__custom__' + key);
}
function flashPresetItem(key) {
  const list = document.getElementById('editor-preset-list');
  if (!list) return;
  const items = list.querySelectorAll('.preset-item');
  for (const it of items) {
    if (it.dataset.key !== key) continue;
    it.classList.add('is-flash');
    setTimeout(function () { it.classList.remove('is-flash'); }, 900);
  }
}
let pendingDeletePreset = '';
function deleteCustomPreset(name) {
  if (!customPresets[name]) return;
  pendingDeletePreset = name;
  showModal(
    '<h3>删除预设</h3>' +
    '<p class="modal-copy">确定删除「' + escHtml(name) + '」？此操作不可恢复。</p>' +
    '<div class="row"><button type="button" class="btn light" onclick="closeModal();confirmDeletePreset()">删除</button></div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">取消</button></div>'
  );
}
function confirmDeletePreset() {
  const name = pendingDeletePreset;
  pendingDeletePreset = '';
  if (!name || !customPresets[name]) return;
  delete customPresets[name];
  persistCustomPresets();
  refreshPresetList();
  refreshPresetHighlight();
}
function buildEditorTiles(container) {
  const S = TRI_SIZE, H = TRI_SIZE * Math.sqrt(3) / 2;
  const cpFull = {}, cpIn = {};
  for (const d of ['up', 'down']) { cpFull[d] = triPath(d, 1); cpIn[d] = triPath(d, FACE_K); }
  const html = [], pids = [];
  for (const pid in id2tri) {
    const cx = id2tri[pid][0], cy = id2tri[pid][1], dir = id2tri[pid][2];
    const pf = cpFull[dir], ps = cpIn[dir];
    const face = function (cls) {
      return '<div class="face ' + cls + '"><div class="plate" style="clip-path:' + pf +
        '"><div class="surf" style="clip-path:' + ps + '"><div class="etch"></div></div></div></div>';
    };
    html.push('<div class="tile ' + dir + '" data-pid="' + pid + '" role="button" tabindex="-1"'
      + ' aria-label="第 ' + tileOrdinal(pid) + ' 格 · 空位" style="left:' + (cx - S / 2) +
      'px;top:' + ((dir === 'up') ? (cy - 2 * H / 3) : (cy - H / 3)) + 'px;width:' + S +
      'px;height:' + H + 'px"><div class="tinner">' + face('fa') + face('fb') +
      '</div><div class="halo"></div></div>');
    pids.push(pid);
  }
  container.innerHTML = html.join('');
  const firstEl = container.children[0];
  if (firstEl) firstEl.tabIndex = 0;
  if (!container.__edBound) {
    container.__edBound = true;
    container.addEventListener('click', function (e) {
      let el = e.target;
      while (el && el !== container && !el.classList.contains('tile')) el = el.parentElement;
      if (!el || el === container) return;
      editorBoard[el.dataset.pid] = editorMode;
      renderEditor();
      refreshPresetHighlight();
    });
  }
}
function renderEditor() {
  const wrap = document.getElementById('editor-board');
  if (!wrap) return;
  const tiles = wrap.querySelectorAll('.tile');
  for (let i = 0; i < tiles.length; i++) {
    const el = tiles[i];
    const pid = el.dataset.pid;
    const v = editorBoard[pid] || 0;
    const inner = el.children[0];
    faceState(inner.children[0], v);
    faceState(inner.children[1], v);
    const lbl = '第 ' + tileOrdinal(pid) + ' 格 · ' + (v === 1 ? '黑子' : (v === 2 ? '白子' : '空位'));
    if (el.getAttribute('aria-label') !== lbl) el.setAttribute('aria-label', lbl);
  }
}
function setEditMode(m) { editorMode = m; updateEditorModeBtns(); }
function updateEditorModeBtns() {
  const set = function (id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('active', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
  };
  set('ed-black', editorMode === 1);
  set('ed-white', editorMode === 2);
  set('ed-erase', editorMode === 0);
}
function editorClear() {
  for (const pid in editorBoard) editorBoard[pid] = 0;
  renderEditor();
  refreshPresetHighlight();
}
function editorStartGame() {
  // 只先记下棋盘快照；“自定义对局”标记留到真正开局时再置位，
  // 否则用户在“选择对战模式”里点取消后，标记会残留并影响后续的普通对局。
  customBoardForGame = {};
  for (const pid in editorBoard) customBoardForGame[pid] = editorBoard[pid];
  showModal(
    '<h3>选择对战模式</h3>' +
    '<div class="row"><button type="button" class="btn light" style="width:100%" onclick="closeModal();startCustomLocal()">本地双人</button></div>' +
    '<div class="row"><button type="button" class="btn" style="width:100%" onclick="closeModal();startCustomPVE()">人机对战</button></div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">取消</button></div>'
  );
}
function startCustomLocal() {
  isCustomGame = true;
  inCustomGame = true;
  closeEditor();
  pveMode = false;
  updateResetBtn();
  showFirstChoice('pvp');
}
function startCustomPVE() {
  isCustomGame = true;
  inCustomGame = true;
  closeEditor();
  showModal(
    '<h3>选择你的颜色</h3>' +
    '<div class="color-btns">' +
    '<button type="button" class="color-btn black" onclick="closeModal();customPVEColor(1)">玩家执黑</button>' +
    '<button type="button" class="color-btn white" onclick="closeModal();customPVEColor(2)">玩家执白</button>' +
    '</div>' +
    '<div class="row"><button type="button" class="btn small light" onclick="closeModal()">取消</button></div>'
  );
}
function customPVEColor(color) {
  myColor = color; botColor = 3 - color;
  pveMode = true;
  updateResetBtn();
  showFirstChoice('pve');
}
// 只负责收起编辑器面板（用于“开始游戏”后跳转流程）。
// 用户主动退出编辑器请走 goSelect()——否则会露出底下的对局屏幕。
function closeEditor() {
  document.getElementById('editor-panel').classList.remove('active');
  syncStarDuoChrome();
}
function fitEditorBoard() {
  const wrap = document.querySelector('.editor-board-wrap');
  if (!wrap) return;
  const vw = wrap.clientWidth - 20, vh = wrap.clientHeight - 20;
  const s = Math.min(vw / 700, vh / 580);
  document.getElementById('editor-stage').style.setProperty('--es', Math.max(0.3, s).toFixed(3));
}
window.addEventListener('resize', function () {
  if (document.getElementById('editor-panel').classList.contains('active')) fitEditorBoard();
});

// ============================================================
// 启动
// ============================================================
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.pathname.indexOf('/app/play/games/board-games/star-duo') !== -1) return;
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      // 有新版本在等待：提示一次即可，直接激活，避免用户长期停留在旧缓存
      if (reg && reg.waiting) reg.waiting.postMessage('SKIP_WAITING');
    }).catch(function () {});
  });
}

// 支持 PWA 快捷方式深链：index.html?mode=pvp / index.html?mode=pve
// 处理完用 replaceState 清掉查询串，避免刷新后又被强制跳进对局。
function handleLaunchQuery() {
  let mode = '';
  try {
    if (!window.URLSearchParams) return;
    mode = new URLSearchParams(location.search || '').get('mode') || '';
  } catch (e) { return; }
  if (mode !== 'pvp' && mode !== 'pve') return;
  try {
    if (window.history && history.replaceState) {
      history.replaceState(null, '', location.pathname + (location.hash || ''));
    }
  } catch (e) {}
  if (mode === 'pvp') startLocalPVP();
  else startPVE();
}

initGeometry();
buildTiles();
resetBoardData();
draw();
bindViewport();
updateTimerBtn();
updateResetBtn();
syncStarDuoChrome();
initModalA11y();
handleLaunchQuery();
registerServiceWorker();

console.log('[星铎棋] 独立测试包已就绪');
