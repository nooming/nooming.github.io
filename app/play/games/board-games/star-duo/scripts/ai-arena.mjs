/**
 * Headless AI vs AI using the same script as index.html (via vm).
 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const m = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<script src="/);
if (!m) throw new Error('script block not found');
let gameSrc = m[1];
gameSrc = gameSrc.replace(
  /\/\/ =+\s*\n\/\/ 启动[\s\S]*$/,
  'initGeometry();\nresetBoardData();\n'
);

const defaultEl = () => ({
  classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
  style: { setProperty() {} },
  dataset: {},
  innerHTML: '',
  textContent: '',
  children: [],
  isConnected: true,
  appendChild() {},
  addEventListener() {},
  classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
});

const boardEl = { innerHTML: '', children: [], classList: { toggle() {} }, dataset: {}, __clickBound: false, addEventListener() {} };
const ids = new Map([
  ['board', boardEl],
  ['boardwrap', { style: { setProperty() {} }, clientWidth: 700, clientHeight: 580 }],
  ['editor-stage', { style: { setProperty() {} } }],
  ['editor-panel', { classList: { contains: () => false } }],
  ['screen-select', { classList: { contains: () => true, add() {}, remove() {} } }],
  ['screen-first', { classList: { contains: () => false, add() {}, remove() {} } }],
  ['screen-difficulty', { classList: { contains: () => false, add() {}, remove() {} } }],
  ['screen-game', { classList: { contains: () => false, add() {}, remove() {} } }],
  ['status-line', { innerHTML: '', classList: { remove() {}, toggle() {}, contains: () => false, add() {} }, dataset: {} }],
  ['xd-stage', { dataset: {} }],
  ['cnt-blue', defaultEl()],
  ['cnt-white', defaultEl()],
  ['score-line', defaultEl()],
  ['result-banner', { textContent: '', classList: { contains: () => false, toggle() {} } }],
  ['reset-btn', defaultEl()],
  ['timer-btn', defaultEl()],
  ['xd-page-sub', defaultEl()],
  ['xd-chrome-head', defaultEl()],
  ['modal-content', defaultEl()],
  ['overlay', { classList: { remove() {} } }],
]);

const sandbox = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  Math,
  Date,
  JSON,
  localStorage: { getItem: () => null, setItem() {} },
  window: {},
  document: {
    getElementById: (id) => ids.get(id) || defaultEl(),
    querySelectorAll: () => [],
    querySelector: () => null,
    body: { classList: { add() {}, remove() {}, toggle() {} } },
    createElement: () => defaultEl(),
  },
  requestAnimationFrame: (fn) => setTimeout(fn, 0),
  navigator: { userAgent: 'node' },
};

sandbox.window = sandbox;
sandbox.window.addEventListener = () => {};
sandbox.addEventListener = () => {};
vm.createContext(sandbox);
vm.runInContext(gameSrc, sandbox, { filename: 'star-duo-game.js' });
vm.runInContext(
  `sandboxExport = {
    board, boardVer, edgeWeight, getValidMoves, makeMove, resetBoardData,
    resolveStuck, settleGame, checkWinner, pieceCounts, hellBestMove, evaluate,
    snapBoard, restoreBoard, searchMode, gameOver, currentPlayer, pendingAnim, overText
  };`,
  sandbox
);

const g = sandbox.sandboxExport;
if (!g?.edgeWeight) throw new Error('engine export failed');
g.settleGame = () => { g.gameOver = true; };

function aiPick(player, diff) {
  g.searchMode = true;
  let bestPid = null;
  try {
    const moves = g.getValidMoves(player);
    const keys = Object.keys(moves);
    if (!keys.length) return null;
    if (diff === '体验') {
      bestPid = keys.reduce((a, b) => (moves[a].length >= moves[b].length ? a : b));
    } else if (diff === '标准') {
      let best = -Infinity;
      for (const pid of keys) {
        const score = (g.edgeWeight[pid] || 0) * 3 + moves[pid].length;
        if (score > best) { best = score; bestPid = pid; }
      }
    } else if (diff === '危机合约') {
      bestPid = g.hellBestMove(player);
    } else {
      let best = -Infinity;
      for (const pid of keys) {
        const snap = g.snapBoard();
        g.makeMove(pid, player);
        const myScore = g.evaluate(player);
        const oppMoves = g.getValidMoves(3 - player);
        let oppBest = -Infinity;
        for (const opid of Object.keys(oppMoves)) {
          const snap2 = g.snapBoard();
          g.makeMove(opid, 3 - player);
          const sc = g.evaluate(3 - player);
          if (sc > oppBest) oppBest = sc;
          g.restoreBoard(snap2);
        }
        const total = myScore - (oppBest === -Infinity ? -1000 : oppBest) * 1.2;
        if (total > best) { best = total; bestPid = pid; }
        g.restoreBoard(snap);
      }
    }
  } finally {
    g.searchMode = false;
    g.pendingAnim = null;
  }
  const live = g.getValidMoves(player);
  const liveKeys = Object.keys(live);
  if (!liveKeys.length) return null;
  if (!bestPid || !live[bestPid]) bestPid = liveKeys[0];
  return bestPid;
}

function playOneGame(diffBlack, diffWhite, first = 1, maxPlies = 2500) {
  g.resetBoardData();
  g.gameOver = false;
  g.overText = '';
  g.currentPlayer = first;
  g.pendingAnim = null;
  g.animating = false;
  let plies = 0;
  let passes = 0;
  while (!g.gameOver && plies < maxPlies) {
    g.resolveStuck();
    if (g.gameOver) break;
    const p = g.currentPlayer;
    const diff = p === 1 ? diffBlack : diffWhite;
    const pid = aiPick(p, diff);
    if (!pid) {
      g.currentPlayer = 3 - p;
      passes++;
      if (passes > 12) { g.gameOver = true; break; }
      continue;
    }
    passes = 0;
    if (!g.makeMove(pid, p)) continue;
    g.pendingAnim = null;
    g.currentPlayer = 3 - p;
    plies++;
  }
  if (!g.gameOver) g.gameOver = true;
  const w = g.checkWinner();
  const [b, wct] = g.pieceCounts();
  return { winner: w, plies, black: b, white: wct };
}

function runMatch(label, diffA, diffB, games, firstAlt = true) {
  let aWin = 0, bWin = 0, draw = 0;
  const t0 = Date.now();
  for (let i = 0; i < games; i++) {
    const first = firstAlt ? (i % 2 === 0 ? 1 : 2) : 1;
    const r = playOneGame(
      first === 1 ? diffA : diffB,
      first === 1 ? diffB : diffA,
      first
    );
    const sideA = first === 1 ? 1 : 2;
    const wA = r.winner === sideA ? 1 : r.winner === 0 ? 0 : -1;
    if (wA === 1) aWin++;
    else if (wA === -1) bWin++;
    else draw++;
    process.stdout.write(`  ${label} #${i + 1}: 胜方=${r.winner || '平'} 手数=${r.plies} (${r.black}:${r.white})\n`);
  }
  const sec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`→ ${label}: ${diffA} ${aWin}胜 | ${diffB} ${bWin}胜 | 平 ${draw} (${games}局, ${sec}s)\n`);
  return { aWin, bWin, draw };
}

console.log('星铎棋 AI 天梯自测（标准难度已去随机以便稳定对比）\n');

runMatch('体验 vs 标准', '体验', '标准', 12);
runMatch('标准 vs 磨难', '标准', '磨难', 8);
runMatch('磨难 vs 危机合约', '磨难', '危机合约', 4);
runMatch('体验 vs 危机合约', '体验', '危机合约', 4);
runMatch('标准 vs 危机合约', '标准', '危机合约', 4);

console.log('单局完整流程抽检（危机 vs 体验）:');
{
  g.resetBoardData();
  g.gameOver = false;
  g.currentPlayer = 1;
  let step = 0;
  while (!g.gameOver && step < 80) {
    g.resolveStuck();
    if (g.gameOver) break;
    const p = g.currentPlayer;
    const diff = p === 1 ? '危机合约' : '体验';
    const pid = aiPick(p, diff);
    if (!pid) {
      g.currentPlayer = 3 - p;
      g.resolveStuck();
      continue;
    }
    g.makeMove(pid, p);
    g.pendingAnim = null;
    g.currentPlayer = 3 - p;
    step++;
  }
  if (!g.gameOver) g.gameOver = true;
  const [b, w] = g.pieceCounts();
  console.log(`  共 ${step} 手，终局子力 ${b}:${w}，胜方=${g.checkWinner() || '平'}\n`);
}
