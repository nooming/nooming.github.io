/* global GomokuEngine */
'use strict';

/**
 * 五子棋 · 界面与交互
 *
 * 依赖 engine.js（纯逻辑，无 DOM）：
 *   - 棋盘状态、胜负判定、AI 搜索全部在 engine 中完成
 *   - 本文件只负责渲染、输入、音效、持久化与 AI 调度
 */
(function () {
    const E = typeof GomokuEngine !== 'undefined' ? GomokuEngine : null;
    const root = document.documentElement;
    const isSiteShell = document.body.classList.contains('gomoku-root');

    if (!E) {
        const status = document.getElementById('status');
        if (status) status.textContent = '引擎加载失败';
        return;
    }

    const SIZE = E.SIZE;
    const CELLS = E.CELLS;
    const BLACK = E.BLACK;
    const WHITE = E.WHITE;
    const EMPTY = E.EMPTY;
    const LEVELS = E.LEVELS;

    const STORAGE_KEY = isSiteShell ? 'gomoku.site.v1' : 'gomoku.standalone.v1';
    const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';
    const STARS = [[3, 3], [3, 11], [11, 3], [11, 11], [7, 7]];

    const LEVEL_TEXT = {
        easy: { name: '简单', hint: '2 层搜索，偶尔漏看威胁，适合先熟悉规则。' },
        medium: { name: '普通', hint: '4 层搜索，攻守均衡，适合休闲对局。' },
        hard: { name: '困难', hint: '8 层搜索，防守稳健，很少漏防活三。' },
        master: { name: '大师', hint: '10 层搜索，会主动寻找连续冲四的杀棋。' },
    };

    /* ------------------------------------------------------------------ *
     * DOM
     * ------------------------------------------------------------------ */

    const $ = (id) => document.getElementById(id);
    const canvas = $('board');
    const ctx = canvas.getContext('2d', { alpha: false });
    const boardFrame = $('boardFrame');
    const statusEl = $('status');
    const statusSub = $('statusSub');
    const turnDot = $('turnDot');
    const moveListEl = $('moveList');
    const moveEmptyEl = $('moveEmpty');
    const moveCountEl = $('moveCount');
    const aiSettings = $('aiSettings');
    const aiMetaEl = $('aiMeta');
    const levelHintEl = $('levelHint');
    const undoBtn = $('undoBtn');
    const redoBtn = $('redoBtn');
    const hintBtn = $('hintBtn');
    const lastBtn = $('lastBtn');
    const newBtn = $('newBtn');
    const copyBtn = $('copyBtn');
    const soundToggle = $('soundToggle');
    const themeToggle = $('themeToggle');
    const toastEl = $('toast');
    const cursorAnnounce = $('cursorAnnounce');
    const statMoves = $('statMoves');
    const statBlack = $('statBlack');
    const statWhite = $('statWhite');
    const metaTheme = document.querySelector('meta[name="theme-color"]');

    /* ------------------------------------------------------------------ *
     * State
     * ------------------------------------------------------------------ */

    const state = {
        mode: 'two',            // 'two' | 'ai'
        side: BLACK,            // 人机模式下玩家执子
        level: 'hard',
        theme: 'light',
        sound: true,
        engine: E.createEngine(),
        thinking: false,
        hover: -1,
        cursor: 7 * SIZE + 7,
        cursorActive: false,
        hint: -1,
        hintTimer: 0,
        flashUntil: 0,
        redo: [],
        lastAI: null,
    };

    const geo = { size: 600, pad: 38, cell: 37.4, r: 16 };
    let palette = null;
    let frameId = 0;
    let toastTimer = 0;
    let renderedCount = -1;

    /* ------------------------------------------------------------------ *
     * Palette (canvas colours follow CSS custom properties)
     * ------------------------------------------------------------------ */

    function readPalette() {
        const cs = getComputedStyle(root);
        const pick = (name, fallback) => {
            const value = cs.getPropertyValue(name).trim();
            return value || fallback;
        };
        palette = {
            dark: root.dataset.theme === 'dark',
            boardBg: pick('--board-bg', '#fbf6d9'),
            line: pick('--board-line', 'rgba(11,11,11,0.55)'),
            star: pick('--board-star', '#0b0b0b'),
            label: pick('--text-faint', '#8b8b83'),
            brand: pick('--brand', '#fffa00'),
        };
    }

    /* ------------------------------------------------------------------ *
     * Sound (WebAudio, created lazily on first gesture)
     * ------------------------------------------------------------------ */

    const audio = (function () {
        let audioCtx = null;

        function ensure() {
            if (audioCtx) {
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }
                return audioCtx;
            }
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            try {
                audioCtx = new Ctor();
            } catch (err) {
                return null;
            }
            return audioCtx;
        }

        function tone(freq, duration, type, gainValue, delay) {
            if (!state.sound) return;
            const ac = ensure();
            if (!ac) return;
            const t0 = ac.currentTime + (delay || 0);
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.type = type || 'triangle';
            osc.frequency.setValueAtTime(freq, t0);
            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.exponentialRampToValueAtTime(gainValue || 0.12, t0 + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
            osc.connect(gain).connect(ac.destination);
            osc.start(t0);
            osc.stop(t0 + duration + 0.02);
        }

        return {
            place(player) {
                const base = player === BLACK ? 190 : 250;
                tone(base, 0.07, 'triangle', 0.16, 0);
                tone(base * 2.6, 0.045, 'sine', 0.05, 0.004);
            },
            win() {
                [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, 'square', 0.075, i * 0.09));
            },
            draw() {
                tone(220, 0.2, 'sine', 0.09, 0);
                tone(180, 0.26, 'sine', 0.07, 0.1);
            },
            error() {
                tone(120, 0.12, 'sawtooth', 0.06, 0);
            },
            hint() {
                tone(880, 0.06, 'sine', 0.05, 0);
            },
        };
    })();

    /* ------------------------------------------------------------------ *
     * Toast
     * ------------------------------------------------------------------ */

    function toast(message, ms) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), ms || 2400);
    }

    function announce(message) {
        if (cursorAnnounce) cursorAnnounce.textContent = message;
    }

    /* ------------------------------------------------------------------ *
     * Geometry & drawing
     * ------------------------------------------------------------------ */

    function computeGeometry() {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || 600;
        geo.size = Math.max(220, width);
        geo.pad = Math.round(geo.size * 0.062);
        geo.cell = (geo.size - geo.pad * 2) / (SIZE - 1);
        geo.r = geo.cell * 0.43;
    }

    function scheduleDraw() {
        if (frameId) return;
        frameId = requestAnimationFrame(function frame() {
            frameId = 0;
            draw();
            if (state.flashUntil > performance.now()) scheduleDraw();
        });
    }

    function drawStone(idx, player, alpha) {
        const x = geo.pad + (idx % SIZE) * geo.cell;
        const y = geo.pad + Math.floor(idx / SIZE) * geo.cell;
        const r = geo.r;
        ctx.save();
        ctx.globalAlpha = alpha;
        const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.12, x, y, r * 1.08);
        const dark = palette.dark;
        if (player === BLACK) {
            g.addColorStop(0, dark ? '#7c7c7c' : '#5f5f5f');
            g.addColorStop(0.42, dark ? '#2f2f2f' : '#242424');
            g.addColorStop(1, dark ? '#0d0d0d' : '#050505');
        } else {
            g.addColorStop(0, '#ffffff');
            g.addColorStop(0.55, dark ? '#f7f4ea' : '#f5f2e7');
            g.addColorStop(1, dark ? '#d9d6c9' : '#cfccbd');
        }
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = player === BLACK
            ? (dark ? 'rgba(255,255,255,0.42)' : 'rgba(0,0,0,0.9)')
            : (dark ? 'rgba(0,0,0,0.35)' : 'rgba(72,66,48,0.55)');
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }

    function draw() {
        if (!palette) readPalette();
        const size = geo.size;
        if (!size) return;
        const pad = geo.pad;
        const cell = geo.cell;
        const board = state.engine.board;
        const now = performance.now();

        ctx.fillStyle = palette.boardBg;
        ctx.fillRect(0, 0, size, size);

        // 网格
        ctx.strokeStyle = palette.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const end = pad + (SIZE - 1) * cell;
        for (let i = 0; i < SIZE; i++) {
            const p = pad + i * cell;
            ctx.moveTo(pad, p);
            ctx.lineTo(end, p);
            ctx.moveTo(p, pad);
            ctx.lineTo(p, end);
        }
        ctx.stroke();

        // 星位
        ctx.fillStyle = palette.star;
        const starR = Math.max(2, cell * 0.1);
        for (let i = 0; i < STARS.length; i++) {
            const sr = STARS[i][0];
            const sc = STARS[i][1];
            ctx.beginPath();
            ctx.arc(pad + sc * cell, pad + sr * cell, starR, 0, Math.PI * 2);
            ctx.fill();
        }

        // 坐标
        const labelSize = Math.max(8, Math.min(13, Math.round(cell * 0.38)));
        ctx.fillStyle = palette.label;
        ctx.font = '600 ' + labelSize + 'px ' + FONT_STACK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let c = 0; c < SIZE; c++) {
            ctx.fillText(String.fromCharCode(65 + c), pad + c * cell, size - pad * 0.5);
        }
        for (let r = 0; r < SIZE; r++) {
            ctx.fillText(String(r + 1), pad * 0.5, pad + r * cell);
        }

        // 胜利连线（画在棋子下方）
        const winLine = state.engine.winLine;
        if (winLine && winLine.length > 1) {
            const a = winLine[0];
            const b = winLine[winLine.length - 1];
            const x1 = pad + (a % SIZE) * cell;
            const y1 = pad + Math.floor(a / SIZE) * cell;
            const x2 = pad + (b % SIZE) * cell;
            const y2 = pad + Math.floor(b / SIZE) * cell;
            ctx.lineCap = 'round';
            ctx.strokeStyle = 'rgba(0,0,0,0.5)';
            ctx.lineWidth = geo.r * 0.95;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.strokeStyle = palette.brand;
            ctx.lineWidth = geo.r * 0.62;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
            ctx.lineCap = 'butt';
        }

        // 棋子
        for (let i = 0; i < CELLS; i++) {
            const v = board[i];
            if (v) drawStone(i, v, 1);
        }

        // 胜利棋子描金圈，让连线更醒目
        if (winLine && winLine.length > 1) {
            for (let i = 0; i < winLine.length; i++) {
                const idx = winLine[i];
                const wx = pad + (idx % SIZE) * cell;
                const wy = pad + Math.floor(idx / SIZE) * cell;
                ctx.strokeStyle = 'rgba(0,0,0,0.55)';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(wx, wy, geo.r * 1.22, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = palette.brand;
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.arc(wx, wy, geo.r * 1.22, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // 最后一手
        const history = state.engine.history;
        const last = history.length ? history[history.length - 1] : -1;
        if (last >= 0) {
            const lx = pad + (last % SIZE) * cell;
            const ly = pad + Math.floor(last / SIZE) * cell;
            const s = geo.r * 0.58;
            ctx.fillStyle = palette.brand;
            ctx.fillRect(lx - s / 2, ly - s / 2, s, s);
            ctx.strokeStyle = 'rgba(0,0,0,0.85)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(lx - s / 2, ly - s / 2, s, s);
        }

        // “下哪了”高亮
        if (state.flashUntil > now && last >= 0) {
            const lx = pad + (last % SIZE) * cell;
            const ly = pad + Math.floor(last / SIZE) * cell;
            const pulse = 0.45 + 0.4 * Math.sin(now / 110);
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = palette.brand;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(lx, ly, geo.r * 1.45, 0, Math.PI * 2);
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        // 悬停预览
        if (state.hover >= 0 && board[state.hover] === EMPTY && canHumanPlay()) {
            drawStone(state.hover, state.engine.turn, 0.4);
        }

        // 键盘光标
        if (state.cursorActive && !state.engine.winner) {
            const cx = pad + (state.cursor % SIZE) * cell;
            const cy = pad + Math.floor(state.cursor / SIZE) * cell;
            const half = cell * 0.47;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 4;
            ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
            ctx.strokeStyle = palette.brand;
            ctx.lineWidth = 2;
            ctx.strokeRect(cx - half, cy - half, half * 2, half * 2);
        }

        // 提示
        if (state.hint >= 0 && board[state.hint] === EMPTY) {
            const hx = pad + (state.hint % SIZE) * cell;
            const hy = pad + Math.floor(state.hint / SIZE) * cell;
            ctx.strokeStyle = 'rgba(0,0,0,0.75)';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.arc(hx, hy, geo.r * 1.35, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = palette.brand;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(hx, hy, geo.r * 1.35, 0, Math.PI * 2);
            ctx.stroke();
        }
    }

    function resizeCanvas() {
        const rect = canvas.getBoundingClientRect();
        const cssWidth = rect.width;
        if (!cssWidth) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 3);
        const px = Math.max(1, Math.round(cssWidth * dpr));
        if (canvas.width !== px || canvas.height !== px) {
            canvas.width = px;
            canvas.height = px;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        computeGeometry();
        draw();
    }

    /* ------------------------------------------------------------------ *
     * Turn helpers
     * ------------------------------------------------------------------ */

    function playerName(player) {
        return player === BLACK ? '黑方' : '白方';
    }

    function aiColor() {
        return state.side === BLACK ? WHITE : BLACK;
    }

    function canHumanPlay() {
        if (state.thinking) return false;
        if (state.engine.winner || state.engine.draw) return false;
        return state.mode !== 'ai' || state.engine.turn === state.side;
    }

    /* ------------------------------------------------------------------ *
     * AI worker with main-thread fallback
     * ------------------------------------------------------------------ */

    const ai = (function () {
        let worker = null;
        let ready = false;
        let seq = 0;
        let pending = null;
        let guardTimer = 0;

        function spawn() {
            if (typeof Worker !== 'function') return null;
            try {
                const w = new Worker('assets/js/ai-worker.js');
                w.onmessage = function (event) {
                    const data = event.data;
                    if (!data) return;
                    if (data.type === 'ready') {
                        ready = true;
                        return;
                    }
                    if (!pending || data.id !== pending.id) return;
                    const current = pending;
                    pending = null;
                    ready = true;
                    clearTimeout(guardTimer);
                    if (data.type === 'error') {
                        current.cb(runLocal(current.player));
                    } else {
                        current.cb(data);
                    }
                };
                w.onerror = function () {
                    if (worker === w) {
                        worker = null;
                        ready = false;
                    }
                    try {
                        w.terminate();
                    } catch (err) {
                        /* 忽略 */
                    }
                    if (pending) {
                        const current = pending;
                        pending = null;
                        clearTimeout(guardTimer);
                        setTimeout(function () {
                            current.cb(runLocal(current.player));
                        }, 0);
                    }
                };
                return w;
            } catch (err) {
                return null;
            }
        }

        function runLocal(player) {
            try {
                return state.engine.findBestMove(player, state.level);
            } catch (err) {
                return null;
            }
        }

        function ask(player, cb) {
            const level = state.level;
            const cfg = LEVELS[level] || LEVELS.medium;
            const id = ++seq;
            pending = { id, cb, player };

            if (!worker) worker = spawn();
            if (worker) {
                try {
                    worker.postMessage({
                        type: 'search',
                        id: id,
                        board: Array.from(state.engine.board),
                        turn: player,
                        level: level,
                        budget: cfg.budget,
                    });
                } catch (err) {
                    pending = null;
                    worker = null;
                    setTimeout(function () {
                        cb(runLocal(player));
                    }, 0);
                    return;
                }
                clearTimeout(guardTimer);
                guardTimer = setTimeout(function () {
                    if (pending && pending.id === id) {
                        const current = pending;
                        pending = null;
                        if (worker) {
                            try {
                                worker.terminate();
                            } catch (err) {
                                /* 忽略 */
                            }
                            worker = null;
                            ready = false;
                        }
                        setTimeout(function () {
                            current.cb(runLocal(player));
                        }, 0);
                    }
                }, cfg.budget + 4000);
                return;
            }

            // 主线程兜底：先让浏览器把“思考中”画出来
            setTimeout(function () {
                if (!pending || pending.id !== id) return;
                pending = null;
                cb(runLocal(player));
            }, 32);
        }

        function cancel() {
            pending = null;
            clearTimeout(guardTimer);
            if (worker) {
                worker.terminate();
                worker = null;
                ready = false;
            }
        }

        return { ask: ask, cancel: cancel, info: info };

        function info() {
            return { worker: !!worker, ready: ready, pending: !!pending };
        }
    })();

    /* ------------------------------------------------------------------ *
     * UI sync
     * ------------------------------------------------------------------ */

    function updateStatus() {
        const eng = state.engine;
        let main;
        let sub;
        if (eng.winner) {
            main = playerName(eng.winner) + '获胜！';
        } else if (eng.draw) {
            main = '平局！';
        } else if (state.thinking) {
            main = 'AI 思考中…';
        } else if (!eng.history.length) {
            main = '黑方先行';
        } else {
            main = playerName(eng.turn) + '回合';
        }

        if (state.mode === 'ai') {
            sub = '人机对战 · 你执' + (state.side === BLACK ? '黑' : '白') +
                ' · ' + LEVEL_TEXT[state.level].name;
        } else {
            sub = '双人对战 · 黑棋先手';
        }

        statusEl.textContent = main;
        statusSub.textContent = sub;
        turnDot.dataset.player = String(eng.winner || eng.draw ? 0 : eng.turn);

        boardFrame.classList.toggle('is-thinking', state.thinking);
        boardFrame.classList.toggle('is-win', !!eng.winner);
        canvas.classList.toggle('is-waiting', state.thinking);
    }

    function updateMoves() {
        const history = state.engine.history;
        moveCountEl.textContent = history.length + ' 手';
        moveEmptyEl.hidden = history.length > 0;
        copyBtn.disabled = history.length === 0;

        let black = 0;
        const board = state.engine.board;
        for (let i = 0; i < CELLS; i++) {
            if (board[i] === BLACK) black++;
        }
        statMoves.textContent = String(history.length);
        statBlack.textContent = String(black);
        statWhite.textContent = String(history.length - black);

        if (history.length === renderedCount) return;
        renderedCount = history.length;

        const frag = document.createDocumentFragment();
        for (let i = 0; i < history.length; i++) {
            const idx = history[i];
            const player = board[idx] || (i % 2 === 0 ? BLACK : WHITE);
            const li = document.createElement('li');
            li.dataset.player = String(player);
            if (i === history.length - 1) li.className = 'is-latest';

            const no = document.createElement('span');
            no.className = 'move-no';
            no.textContent = String(i + 1);

            const dot = document.createElement('span');
            dot.className = 'move-dot';
            dot.setAttribute('aria-hidden', 'true');

            const coord = document.createElement('span');
            coord.className = 'move-coord';
            coord.textContent = E.coordName(idx);

            li.appendChild(no);
            li.appendChild(dot);
            li.appendChild(coord);
            frag.appendChild(li);
        }
        moveListEl.textContent = '';
        moveListEl.appendChild(frag);
        if (history.length) moveListEl.scrollTop = moveListEl.scrollHeight;
    }

    function updateControls() {
        const eng = state.engine;
        const busy = state.thinking;
        undoBtn.disabled = eng.history.length === 0;
        redoBtn.disabled = state.redo.length === 0;
        hintBtn.disabled = busy || !!eng.winner || !!eng.draw ||
            (state.mode === 'ai' && eng.turn !== state.side);
        lastBtn.disabled = eng.history.length === 0;

        levelHintEl.textContent = LEVEL_TEXT[state.level].hint;

        aiSettings.hidden = state.mode !== 'ai';
        aiMetaEl.hidden = state.mode !== 'ai' || !state.lastAI;
        aiMetaEl.textContent = state.lastAI
            ? '深度 ' + state.lastAI.depth + ' · ' + (state.lastAI.time / 1000).toFixed(2) + 's · ' +
              state.lastAI.nodes + ' 节点'
            : '';

        document.querySelectorAll('[data-mode]').forEach((btn) => {
            const active = btn.dataset.mode === state.mode;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        document.querySelectorAll('[data-level]').forEach((btn) => {
            const active = btn.dataset.level === state.level;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
        document.querySelectorAll('[data-side]').forEach((btn) => {
            const active = (btn.dataset.side === 'black' ? BLACK : WHITE) === state.side;
            btn.classList.toggle('is-active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
    }

    function updateUI() {
        updateStatus();
        updateMoves();
        updateControls();
    }

    /* ------------------------------------------------------------------ *
     * Persistence
     * ------------------------------------------------------------------ */

    function persist() {
        try {
            const payload = {
                v: 1,
                mode: state.mode,
                side: state.side,
                level: state.level,
                sound: state.sound,
                moves: state.engine.history.slice(),
            };
            if (!isSiteShell) {
                payload.theme = state.theme;
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
        } catch (err) {
            /* 隐私模式 / 禁用存储：静默忽略 */
        }
    }

    function restore() {
        let raw = null;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (err) {
            return false;
        }
        if (!raw) return false;
        let data;
        try {
            data = JSON.parse(raw);
        } catch (err) {
            return false;
        }
        if (!data || data.v !== 1) return false;

        if (data.mode === 'ai' || data.mode === 'two') state.mode = data.mode;
        if (data.side === BLACK || data.side === WHITE) state.side = data.side;
        if (LEVELS[data.level]) state.level = data.level;
        if (!isSiteShell && data.theme) {
            state.theme = data.theme === 'dark' ? 'dark' : 'light';
        }
        state.sound = data.sound !== false;
        if (Array.isArray(data.moves) && data.moves.length) {
            state.engine.loadMoves(data.moves);
        }
        return true;
    }

    /* ------------------------------------------------------------------ *
     * Game flow
     * ------------------------------------------------------------------ */

    function commitMove(idx, options) {
        const opts = options || {};
        const result = state.engine.play(idx);
        if (!result.ok) return result;

        if (!opts.keepRedo) state.redo.length = 0;
        state.hint = -1;
        clearTimeout(state.hintTimer);

        audio.place(result.player);

        if (result.win) {
            audio.win();
            state.flashUntil = performance.now() + 1100;
            toast(playerName(result.player) + '五连获胜！', 3200);
            announce(playerName(result.player) + '获胜');
        } else if (result.draw) {
            audio.draw();
            toast('棋盘已满，本局平局。', 2800);
        }

        renderedCount = -1;
        updateUI();
        persist();
        scheduleDraw();

        if (!opts.noAI && !result.win && !result.draw && state.mode === 'ai' && state.engine.turn === aiColor()) {
            setTimeout(scheduleAIMove, 70);
        }
        return result;
    }

    function scheduleAIMove() {
        if (state.thinking) return;
        if (state.engine.winner || state.engine.draw) return;
        if (state.mode !== 'ai' || state.engine.turn !== aiColor()) return;

        state.thinking = true;
        state.hint = -1;
        updateUI();
        scheduleDraw();

        const player = state.engine.turn;
        ai.ask(player, function (res) {
            state.thinking = false;
            if (!res || res.idx == null || res.idx < 0) {
                updateUI();
                scheduleDraw();
                toast('AI 计算失败，请重试。', 2600);
                return;
            }
            state.lastAI = { depth: res.depth, nodes: res.nodes, time: res.time };
            const placed = commitMove(res.idx);
            if (!placed || !placed.ok) {
                updateUI();
                scheduleDraw();
            }
        });
    }

    function humanPlace(idx) {
        if (state.engine.winner || state.engine.draw) {
            toast('本局已结束，按 N 或点“新开一局”。');
            return;
        }
        if (state.thinking) {
            toast('AI 正在思考，请稍候。');
            return;
        }
        if (state.mode === 'ai' && state.engine.turn !== state.side) return;
        if (state.engine.board[idx] !== EMPTY) {
            audio.error();
            toast('这里已经有棋子了。');
            return;
        }
        commitMove(idx);
    }

    function undo() {
        if (!state.engine.history.length) return;
        ai.cancel();
        state.thinking = false;

        const popped = [state.engine.undo()];
        if (state.mode === 'ai') {
            while (state.engine.history.length && state.engine.turn === aiColor()) {
                popped.push(state.engine.undo());
            }
        }
        state.redo.push.apply(state.redo, popped);
        state.hint = -1;
        state.flashUntil = 0;
        state.lastAI = null;
        renderedCount = -1;
        updateUI();
        persist();
        scheduleDraw();
        // 人机模式下若悔棋把回合交回 AI（典型是撤销了 AI 的首手），补一次落子，
        // 否则 humanPlace 的回合守卫会让棋盘再也无法落子。
        setTimeout(scheduleAIMove, 60);
    }

    function redo() {
        if (!state.redo.length) return;
        if (state.thinking) {
            ai.cancel();
            state.thinking = false;
        }
        const idx = state.redo.pop();
        commitMove(idx, { keepRedo: true, noAI: true });
        if (state.mode === 'ai' && state.redo.length &&
            !state.engine.winner && !state.engine.draw &&
            state.engine.turn === aiColor()) {
            commitMove(state.redo.pop(), { keepRedo: true, noAI: true });
        }
        renderedCount = -1;
        updateUI();
        persist();
        scheduleDraw();
        // 重做同样可能把回合交给 AI（撤销了白子再重做），补一次落子避免卡死。
        setTimeout(scheduleAIMove, 60);
    }

    function resetGame(options) {
        const opts = options || {};
        ai.cancel();
        state.thinking = false;
        state.engine.reset();
        state.redo.length = 0;
        state.hint = -1;
        state.hintTimer && clearTimeout(state.hintTimer);
        state.flashUntil = 0;
        state.lastAI = null;
        state.hover = -1;
        state.cursorActive = false;
        renderedCount = -1;
        updateUI();
        persist();
        scheduleDraw();
        if (!opts.silent) toast('新的一局，黑方先行。');
        if (state.mode === 'ai' && state.engine.turn === aiColor()) {
            setTimeout(scheduleAIMove, 220);
        }
    }

    function showLast() {
        const history = state.engine.history;
        if (!history.length) {
            toast('还没有落子。');
            return;
        }
        const last = history[history.length - 1];
        state.cursor = last;
        state.cursorActive = true;
        state.flashUntil = performance.now() + 1500;
        scheduleDraw();
        toast('最后一手：' + E.coordName(last));
        announce('最后一手，' + E.coordName(last));
    }

    function hint() {
        if (state.thinking) return;
        if (state.engine.winner || state.engine.draw) {
            toast('本局已经结束。');
            return;
        }
        if (state.mode === 'ai' && state.engine.turn !== state.side) return;
        const res = state.engine.findBestMove(state.engine.turn, state.level, 260);
        if (!res || res.idx < 0) {
            toast('没有可推荐的位置。');
            return;
        }
        state.hint = res.idx;
        state.cursor = res.idx;
        state.cursorActive = true;
        audio.hint();
        toast('建议下在 ' + E.coordName(res.idx), 2000);
        announce('建议下在 ' + E.coordName(res.idx));
        scheduleDraw();
        clearTimeout(state.hintTimer);
        state.hintTimer = setTimeout(function () {
            state.hint = -1;
            scheduleDraw();
        }, 2800);
    }

    function copyRecord() {
        const history = state.engine.history;
        if (!history.length) {
            toast('还没有棋谱可复制。');
            return;
        }
        const lines = [];
        lines.push(state.mode === 'ai'
            ? '五子棋 · 人机对战（' + LEVEL_TEXT[state.level].name + '，我执' + (state.side === BLACK ? '黑' : '白') + '）'
            : '五子棋 · 双人对战');
        lines.push('');
        for (let i = 0; i < history.length; i += 2) {
            const a = E.coordName(history[i]);
            const b = history[i + 1] != null ? ' ' + E.coordName(history[i + 1]) : '';
            lines.push(String(i / 2 + 1) + '. ' + a + b);
        }
        const text = lines.join('\n');

        const done = function (ok) {
            toast(ok ? '棋谱已复制到剪贴板。' : '复制失败，请手动选择棋谱。', 2200);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                done(true);
            }, function () {
                done(legacyCopy(text));
            });
            return;
        }
        done(legacyCopy(text));
    }

    function legacyCopy(text) {
        const area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.top = '-1000px';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try {
            ok = document.execCommand('copy');
        } catch (err) {
            ok = false;
        }
        area.remove();
        return ok;
    }

    /* ------------------------------------------------------------------ *
     * Theme / sound
     * ------------------------------------------------------------------ */

    function syncThemeFromDocument() {
        state.theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
    }

    function applyTheme() {
        if (isSiteShell) {
            syncThemeFromDocument();
            palette = null;
            readPalette();
            scheduleDraw();
            return;
        }
        root.dataset.theme = state.theme;
        palette = null;
        if (metaTheme) {
            metaTheme.setAttribute('content', state.theme === 'dark' ? '#0d0d0b' : '#FFFA00');
        }
        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', String(state.theme === 'dark'));
            themeToggle.setAttribute('aria-label', state.theme === 'dark' ? '切换浅色模式' : '切换深色模式');
        }
        scheduleDraw();
    }

    function toggleTheme() {
        if (isSiteShell || !themeToggle) return;
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
        persist();
    }

    function toggleSound() {
        state.sound = !state.sound;
        if (soundToggle) {
            soundToggle.setAttribute('aria-pressed', String(state.sound));
            soundToggle.setAttribute('aria-label', state.sound ? '关闭声音' : '开启声音');
        }
        persist();
        if (state.sound) audio.place(state.engine.turn);
        toast(state.sound ? '声音已开启' : '声音已关闭', 1600);
    }

    /* ------------------------------------------------------------------ *
     * Input
     * ------------------------------------------------------------------ */

    function cellAt(event) {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width) return -1;
        const scale = geo.size / rect.width;
        const x = (event.clientX - rect.left) * scale;
        const y = (event.clientY - rect.top) * scale;
        const col = Math.round((x - geo.pad) / geo.cell);
        const row = Math.round((y - geo.pad) / geo.cell);
        if (row < 0 || row >= SIZE || col < 0 || col >= SIZE) return -1;
        return row * SIZE + col;
    }

    canvas.addEventListener('pointerdown', function (event) {
        if (event.button !== 0) return;
        const idx = cellAt(event);
        if (idx < 0) return;
        event.preventDefault();
        canvas.focus({ preventScroll: true });
        state.cursor = idx;
        state.cursorActive = false;
        humanPlace(idx);
    });

    canvas.addEventListener('pointermove', function (event) {
        if (event.pointerType === 'touch') return;
        const idx = cellAt(event);
        if (idx === state.hover) return;
        state.hover = idx;
        scheduleDraw();
    });

    canvas.addEventListener('pointerleave', function () {
        if (state.hover === -1) return;
        state.hover = -1;
        scheduleDraw();
    });

    canvas.addEventListener('keydown', function (event) {
        const key = event.key;
        let row = Math.floor(state.cursor / SIZE);
        let col = state.cursor % SIZE;

        if (key === 'Enter' || key === ' ' || key === 'Spacebar') {
            event.preventDefault();
            humanPlace(state.cursor);
            return;
        }
        if (key === 'Escape') {
            state.cursorActive = false;
            scheduleDraw();
            return;
        }
        if (key === 'Home') {
            row = 7;
            col = 7;
        } else if (key === 'ArrowUp') {
            row = Math.max(0, row - 1);
        } else if (key === 'ArrowDown') {
            row = Math.min(SIZE - 1, row + 1);
        } else if (key === 'ArrowLeft') {
            col = Math.max(0, col - 1);
        } else if (key === 'ArrowRight') {
            col = Math.min(SIZE - 1, col + 1);
        } else {
            return;
        }
        event.preventDefault();
        state.cursor = row * SIZE + col;
        state.cursorActive = true;
        announce('第 ' + (row + 1) + ' 行，' + String.fromCharCode(65 + col) + ' 列');
        scheduleDraw();
    });

    document.addEventListener('keydown', function (event) {
        if (event.metaKey || event.ctrlKey) {
            const key = event.key.toLowerCase();
            if (key === 'z') {
                event.preventDefault();
                if (event.shiftKey) redo();
                else undo();
            } else if (key === 'y') {
                event.preventDefault();
                redo();
            }
            return;
        }
        if (event.altKey) return;
        const target = event.target;
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
            return;
        }
        const key = event.key.toLowerCase();
        if (key === 'u') {
            event.preventDefault();
            undo();
        } else if (key === 'y') {
            event.preventDefault();
            redo();
        } else if (key === 'n') {
            event.preventDefault();
            resetGame();
        } else if (key === 'h') {
            event.preventDefault();
            hint();
        } else if (key === 'l') {
            event.preventDefault();
            showLast();
        } else if (key === 's') {
            event.preventDefault();
            toggleSound();
        } else if (key === 'd') {
            event.preventDefault();
            toggleTheme();
        }
    });

    /* ------------------------------------------------------------------ *
     * Wiring
     * ------------------------------------------------------------------ */

    document.querySelectorAll('[data-mode]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const mode = btn.dataset.mode;
            if (mode === state.mode) return;
            state.mode = mode;
            resetGame({ silent: true });
            toast(mode === 'ai' ? '已切换为人机对战' : '已切换为双人对战', 1800);
        });
    });

    document.querySelectorAll('[data-level]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const level = btn.dataset.level;
            if (!LEVELS[level] || level === state.level) return;
            state.level = level;
            state.lastAI = null;
            updateUI();
            persist();
            toast('AI 难度：' + LEVEL_TEXT[level].name, 1600);
        });
    });

    document.querySelectorAll('[data-side]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const side = btn.dataset.side === 'black' ? BLACK : WHITE;
            if (side === state.side) return;
            state.side = side;
            resetGame({ silent: true });
            toast(side === BLACK ? '你执黑先行' : '你执白后行', 1800);
        });
    });

    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    hintBtn.addEventListener('click', hint);
    lastBtn.addEventListener('click', showLast);
    newBtn.addEventListener('click', function () {
        resetGame();
    });
    copyBtn.addEventListener('click', copyRecord);
    if (soundToggle) soundToggle.addEventListener('click', toggleSound);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

    if (isSiteShell) {
        document.documentElement.addEventListener('noomings:prefs', function () {
            applyTheme();
        });
    }

    canvas.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });


    if (typeof ResizeObserver === 'function') {
        new ResizeObserver(function () {
            resizeCanvas();
        }).observe(boardFrame);
    } else {
        window.addEventListener('resize', resizeCanvas);
    }
    window.addEventListener('orientationchange', function () {
        setTimeout(resizeCanvas, 120);
    });

    /* ------------------------------------------------------------------ *
     * Boot
     * ------------------------------------------------------------------ */

    function boot() {
        if (isSiteShell) syncThemeFromDocument();
        const restored = restore();
        if (isSiteShell) syncThemeFromDocument();
        applyTheme();
        if (soundToggle) {
            soundToggle.setAttribute('aria-pressed', String(state.sound));
            soundToggle.setAttribute('aria-label', state.sound ? '关闭声音' : '开启声音');
        }
        updateUI();
        resizeCanvas();
        scheduleDraw();

        if (restored && state.engine.history.length) {
            toast('已恢复上一局', 2000);
        }
        if (state.mode === 'ai' && state.engine.turn === aiColor() &&
            !state.engine.winner && !state.engine.draw) {
            setTimeout(scheduleAIMove, 320);
        }
    }

    // 便于自动化测试与调试
    window.__gomoku = {
        state: state,
        geo: geo,
        commitMove: commitMove,
        humanPlace: humanPlace,
        undo: undo,
        redo: redo,
        resetGame: resetGame,
        hint: hint,
        showLast: showLast,
        scheduleAIMove: scheduleAIMove,
        updateUI: updateUI,
        redraw: scheduleDraw,
        aiInfo: ai.info,
    };

    try {
        boot();
    } catch (err) {
        statusEl.textContent = '初始化失败';
        toast('初始化失败：' + (err && err.message ? err.message : err), 4000);
        throw err;
    }
})();
