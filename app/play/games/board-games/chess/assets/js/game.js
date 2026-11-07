/*
 * 对局控制层
 * ------------------------------------------------------------
 * 负责：规则引擎（xiangqi.js）状态、玩家输入、AI 调度、棋谱、音效与界面同步。
 */
(function () {
    'use strict';

    const XQ = window.XQ || (window.XQ = {});
    const STORAGE_KEY = 'xq:prefs';
    const COLOR_NAME = { r: '红方', b: '黑方' };
    const REASON_TEXT = {
        checkmate: '将死',
        stalemate: '困毙 · 无子可动',
        draw: '自然限着或三次重复局面'
    };

    const els = {};
    let game = null;
    let view = null;
    let XiangqiCtor = null;

    const state = {
        mode: 'two',
        difficulty: 'medium',
        sound: true,
        selected: null,
        legal: [],
        history: [],
        lastMove: null,
        check: null,
        hint: null,
        gameOver: false,
        result: null,
        thinking: false
    };

    let aiToken = 0;
    let resizePending = false;
    let lastAnnouncement = '';
    let sound = null;

    // ------------------------------------------------------------ 音效
    function createSound() {
        let ctx = null;
        let noiseBuffer = null;
        let enabled = true;
        let unlocked = false; // 浏览器要求先有用户手势才能播放

        function ensureContext() {
            if (ctx) {
                if (ctx.state === 'suspended') ctx.resume();
                return ctx;
            }
            const AudioCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtor) return null;
            try {
                ctx = new AudioCtor();
            } catch (err) {
                return null;
            }
            const length = Math.floor(ctx.sampleRate * 0.09);
            noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
            const data = noiseBuffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2);
            }
            return ctx;
        }

        function noise(duration, frequency, volume) {
            if (!ctx) return;
            const source = ctx.createBufferSource();
            source.buffer = noiseBuffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = frequency;
            filter.Q.value = 0.9;
            const gain = ctx.createGain();
            const start = ctx.currentTime;
            gain.gain.setValueAtTime(volume, start);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            source.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            source.start(start);
            source.stop(start + duration);
        }

        function tone(frequency, duration, volume, delay, type) {
            if (!ctx) return;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = ctx.currentTime + (delay || 0);
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.02);
        }

        return {
            unlock: function () {
                unlocked = true;
                if (enabled) ensureContext();
            },
            setEnabled: function (value) {
                enabled = value;
                if (value && unlocked) ensureContext();
            },
            play: function (kind) {
                if (!enabled || !unlocked) return;
                if (!ensureContext()) return;
                switch (kind) {
                    case 'move':
                        noise(0.055, 1500, 0.14);
                        tone(220, 0.09, 0.09, 0, 'triangle');
                        break;
                    case 'capture':
                        noise(0.1, 900, 0.2);
                        tone(140, 0.14, 0.14, 0, 'triangle');
                        break;
                    case 'check':
                        tone(880, 0.11, 0.1, 0);
                        tone(1240, 0.13, 0.09, 0.09);
                        break;
                    case 'win':
                        tone(660, 0.18, 0.1, 0, 'triangle');
                        tone(880, 0.18, 0.1, 0.12, 'triangle');
                        tone(1320, 0.26, 0.1, 0.24, 'triangle');
                        break;
                    case 'draw':
                        tone(520, 0.2, 0.09, 0);
                        tone(392, 0.28, 0.09, 0.14);
                        break;
                    case 'undo':
                        tone(330, 0.08, 0.07, 0, 'triangle');
                        break;
                    default:
                        break;
                }
            }
        };
    }

    // ------------------------------------------------------------ 工具
    function $(id) {
        return document.getElementById(id);
    }

    function colorOfTurn() {
        return game && game.turn() === 'b' ? 'b' : 'r';
    }

    function kingSquare(color) {
        const board = game.board();
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = board[row][col];
                if (piece && piece.type.toLowerCase() === 'k' && piece.color === color) {
                    return String.fromCharCode(97 + col) + (9 - row);
                }
            }
        }
        return null;
    }

    function loadPrefs() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const prefs = JSON.parse(raw);
            if (prefs.mode === 'ai' || prefs.mode === 'two') state.mode = prefs.mode;
            if (['easy', 'medium', 'hard'].indexOf(prefs.difficulty) >= 0) state.difficulty = prefs.difficulty;
            if (typeof prefs.sound === 'boolean') state.sound = prefs.sound;
        } catch (err) {
            /* 隐私模式下忽略 */
        }
    }

    function savePrefs() {
        try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                mode: state.mode,
                difficulty: state.difficulty,
                sound: state.sound
            }));
        } catch (err) {
            /* 忽略写入失败 */
        }
    }

    function announce(text) {
        if (!text || text === lastAnnouncement) return;
        lastAnnouncement = text;
        if (els.live) els.live.textContent = text;
    }

    // ------------------------------------------------------------ 视图同步
    function syncView() {
        if (!view) return;
        view.setState({
            board: game.board(),
            selected: state.selected,
            legal: state.legal,
            lastMove: state.lastMove,
            check: state.check,
            hint: state.hint
        });
        view.invalidate();
    }

    function updateStatus() {
        const turn = colorOfTurn();
        els.turnDot.dataset.turn = turn;

        if (state.gameOver && state.result) {
            els.statusText.textContent = state.result.title;
            els.statusBadge.hidden = !state.result.badge;
            els.statusBadge.textContent = state.result.badge || '';
        } else {
            els.statusText.textContent = COLOR_NAME[turn] + '行棋';
            const inCheck = !!state.check;
            els.statusBadge.hidden = !inCheck;
            els.statusBadge.textContent = inCheck ? '将军' : '';
        }

        els.canvas.setAttribute('aria-label',
            (state.gameOver && state.result
                ? state.result.title + '。'
                : COLOR_NAME[turn] + '行棋' + (state.check ? '，将军。' : '。')) +
            '方向键移动光标，回车选子或落子。');
    }

    function updateButtons() {
        els.undoBtn.disabled = state.history.length === 0;
        els.hintBtn.disabled = state.gameOver || state.thinking;
        els.resetBtn.disabled = false;
    }

    function renderHistory() {
        const list = els.moveList;
        const wasNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
        const rows = Math.ceil(state.history.length / 2);
        const fragment = document.createDocumentFragment();

        for (let i = 0; i < rows; i++) {
            const li = document.createElement('li');
            li.className = 'move-row';
            const red = state.history[i * 2];
            const black = state.history[i * 2 + 1];

            const index = document.createElement('span');
            index.className = 'idx';
            index.textContent = (i + 1) + '.';
            li.appendChild(index);

            const redSpan = document.createElement('span');
            redSpan.className = 'red';
            redSpan.textContent = red ? red.notation : '—';
            li.appendChild(redSpan);

            const blackSpan = document.createElement('span');
            blackSpan.className = 'black';
            blackSpan.textContent = black ? black.notation : '—';
            li.appendChild(blackSpan);

            if (i === rows - 1) li.classList.add('is-current');
            fragment.appendChild(li);
        }

        list.textContent = '';
        list.appendChild(fragment);
        els.moveEmpty.hidden = state.history.length > 0;
        els.moveCount.textContent = state.history.length + ' 步';

        if (wasNearBottom) list.scrollTop = list.scrollHeight;
    }

    function updateAll() {
        updateStatus();
        renderHistory();
        updateButtons();
        syncView();
    }

    // ------------------------------------------------------------ 对局状态
    function evaluateGameState() {
        const turn = colorOfTurn();
        if (!game.moves().length) {
            const winner = turn === 'r' ? 'b' : 'r';
            const reason = game.in_check() ? 'checkmate' : 'stalemate';
            return { over: true, winner: winner, reason: reason, draw: false };
        }
        if (game.in_threefold_repetition() || game.in_draw()) {
            return { over: true, draw: true, reason: 'draw' };
        }
        return { over: false, check: game.in_check() };
    }

    function applyResult(gs) {
        state.gameOver = true;
        if (gs.draw) {
            state.result = { title: '和棋', detail: REASON_TEXT.draw, badge: '' };
        } else {
            state.result = {
                title: COLOR_NAME[gs.winner] + '胜',
                detail: REASON_TEXT[gs.reason] || '',
                badge: gs.reason === 'checkmate' ? '将死' : gs.reason === 'stalemate' ? '困毙' : ''
            };
        }
        state.check = gs.reason === 'checkmate' ? kingSquare(gs.winner === 'r' ? 'b' : 'r') : state.check;
    }

    function showResultOverlay() {
        if (!state.result) return;
        els.resultKicker.textContent = state.result.badge ? '对局结束 · ' + state.result.badge : '对局结束';
        els.resultTitle.textContent = state.result.title;
        els.resultDetail.textContent = state.result.detail || '';
        els.resultOverlay.hidden = false;
        els.playAgainBtn.focus({ preventScroll: true });
    }

    function hideResultOverlay() {
        if (els.resultOverlay.hidden) return;
        els.resultOverlay.hidden = true;
        els.canvas.focus({ preventScroll: true });
    }

    function clearSelection() {
        state.selected = null;
        state.legal = [];
        syncView();
    }

    function selectSquare(square) {
        const piece = game.get(square);
        if (!piece || piece.color !== game.turn()) {
            clearSelection();
            return;
        }
        state.selected = square;
        const moves = game.moves({ square: square, verbose: true });
        state.legal = moves.map(function (move) {
            return { to: move.to, capture: !!game.get(move.to) };
        });
        syncView();
        if (state.legal.length) {
            announce(COLOR_NAME[piece.color] + '选中 ' + square.toUpperCase() + '，共 ' + state.legal.length + ' 种走法');
        } else {
            announce('该子无处可走');
        }
    }

    function playMove(from, to) {
        if (!from || !to) return false;
        const boardBefore = game.board();
        const fromRow = 9 - Number(from.charAt(1));
        const fromCol = from.charCodeAt(0) - 97;
        const toRow = 9 - Number(to.charAt(1));
        const toCol = to.charCodeAt(0) - 97;
        const movingPiece = boardBefore[fromRow][fromCol];
        const capturedPiece = boardBefore[toRow][toCol];
        if (!movingPiece) return false;

        const move = game.move({ from: from, to: to });
        if (!move) return false;

        const notation = XQ.Notation.toChinese(boardBefore, move);
        state.history.push({ notation: notation, color: move.color, iccs: move.iccs });
        state.selected = null;
        state.legal = [];
        state.lastMove = { from: from, to: to };
        state.hint = null;

        const gs = evaluateGameState();
        state.check = null;
        if (gs.over) {
            applyResult(gs);
        } else if (gs.check) {
            state.check = kingSquare(colorOfTurn());
        }

        updateAll();

        if (sound) {
            if (state.gameOver) sound.play(gs.draw ? 'draw' : 'win');
            else if (gs.check) sound.play('check');
            else if (capturedPiece) sound.play('capture');
            else sound.play('move');
        }

        announce(COLOR_NAME[move.color] + ' ' + notation + '。' +
            (state.gameOver && state.result ? state.result.title : COLOR_NAME[colorOfTurn()] + '行棋' + (state.check ? '，将军' : '')));

        if (view) {
            view.playMove({
                from: from,
                to: to,
                piece: movingPiece,
                captured: capturedPiece
            }, function () {
                if (state.gameOver) {
                    showResultOverlay();
                } else if (state.mode === 'ai' && game.turn() === 'b') {
                    scheduleAI();
                }
            });
        } else if (state.mode === 'ai' && game.turn() === 'b') {
            scheduleAI();
        }

        return true;
    }

    // ------------------------------------------------------------ AI
    function cancelAI() {
        aiToken++;
        if (state.thinking) {
            state.thinking = false;
            els.thinking.hidden = true;
        }
    }

    function scheduleAI() {
        if (!XQ.Engine) return;
        const token = ++aiToken;
        state.thinking = true;
        els.thinking.hidden = false;
        updateButtons();

        // 两帧之后再开始计算，保证「思考中」先完成绘制
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                if (token !== aiToken) return;
                let result = null;
                try {
                    result = XQ.Engine.chooseMove(game, state.difficulty);
                } catch (err) {
                    console.error('AI 计算失败', err);
                }
                if (token !== aiToken) return;
                state.thinking = false;
                els.thinking.hidden = true;
                updateButtons();
                if (!result) return;
                playMove(result.from, result.to);
            });
        });
    }

    // ------------------------------------------------------------ 玩家操作
    function handleSquare(square) {
        if (!square || state.gameOver || state.thinking) return;
        if (state.mode === 'ai' && game.turn() === 'b') return;

        if (state.selected === square) {
            clearSelection();
            return;
        }
        if (state.selected) {
            const legal = state.legal.some(function (move) { return move.to === square; });
            if (legal) {
                playMove(state.selected, square);
                return;
            }
            const piece = game.get(square);
            if (piece && piece.color === game.turn()) {
                selectSquare(square);
            } else {
                clearSelection();
            }
            return;
        }
        selectSquare(square);
    }

    function handlePointer(clientX, clientY) {
        if (!view) return;
        const square = view.squareAt(clientX, clientY);
        if (!square) return;
        handleSquare(square);
    }

    function undo() {
        if (!state.history.length) return;
        cancelAI();
        if (view) view.cancelMove();
        hideResultOverlay();

        const targetTurn = state.mode === 'ai' ? 'r' : null;
        let undone = 0;
        do {
            const move = game.undo();
            if (!move) break;
            state.history.pop();
            undone++;
        } while (targetTurn && game.turn() !== targetTurn && state.history.length);

        state.gameOver = false;
        state.result = null;
        state.selected = null;
        state.legal = [];
        state.hint = null;
        state.check = game.in_check() ? kingSquare(game.turn()) : null;
        state.lastMove = state.history.length
            ? { from: state.history[state.history.length - 1].iccs.substring(0, 2), to: state.history[state.history.length - 1].iccs.substring(2, 4) }
            : null;

        if (sound && undone) sound.play('undo');
        updateAll();
        announce('已悔棋，' + COLOR_NAME[game.turn()] + '行棋');
    }

    function resetGame() {
        cancelAI();
        if (view) view.cancelMove();
        if (XQ.Engine && XQ.Engine.resetTT) XQ.Engine.resetTT();
        game.reset();
        state.selected = null;
        state.legal = [];
        state.history = [];
        state.lastMove = null;
        state.check = null;
        state.hint = null;
        state.gameOver = false;
        state.result = null;
        hideResultOverlay();
        updateAll();
        announce('新局开始，红方先行');
    }

    function requestHint() {
        if (!XQ.Engine || state.gameOver || state.thinking) return;
        if (state.mode === 'ai' && game.turn() === 'b') return;
        const previous = els.hintBtn.textContent;
        els.hintBtn.disabled = true;
        els.hintBtn.textContent = '计算中';
        requestAnimationFrame(function () {
            setTimeout(function () {
                let result = null;
                try {
                    result = XQ.Engine.chooseMove(game, state.difficulty === 'easy' ? 'medium' : 'hard');
                } catch (err) {
                    console.error('提示计算失败', err);
                }
                els.hintBtn.textContent = previous;
                els.hintBtn.disabled = state.gameOver || state.thinking;
                if (result) {
                    state.hint = { from: result.from, to: result.to };
                    syncView();
                    announce('提示：' + result.from.toUpperCase() + ' 到 ' + result.to.toUpperCase());
                }
            }, 30);
        });
    }

    // ------------------------------------------------------------ 界面
    function setMode(mode) {
        if (mode === state.mode) return;
        state.mode = mode;
        document.querySelectorAll('.seg[data-mode]').forEach(function (btn) {
            btn.setAttribute('aria-pressed', String(btn.dataset.mode === mode));
        });
        els.difficultyGroup.hidden = mode !== 'ai';
        if (els.aiDifficultyPanel) {
            els.aiDifficultyPanel.hidden = mode !== 'ai';
        }
        savePrefs();
        resetGame();
    }

    function setDifficulty(difficulty) {
        state.difficulty = difficulty;
        document.querySelectorAll('.seg[data-difficulty]').forEach(function (btn) {
            btn.setAttribute('aria-pressed', String(btn.dataset.difficulty === difficulty));
        });
        savePrefs();
        // 若是 AI 回合，立即按新难度重算
        if (!state.gameOver && state.mode === 'ai' && game.turn() === 'b') {
            cancelAI();
            scheduleAI();
        }
    }

    function setSound(enabled) {
        state.sound = enabled;
        if (els.soundBtn) {
            els.soundBtn.setAttribute('aria-pressed', String(enabled));
        }
        if (sound) sound.setEnabled(enabled);
        savePrefs();
    }

    function bindEvents() {
        els.canvas.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            event.preventDefault();
            handlePointer(event.clientX, event.clientY);
        });

        els.canvas.addEventListener('contextmenu', function (event) {
            event.preventDefault();
        });

        document.querySelectorAll('.seg[data-mode]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setMode(btn.dataset.mode);
            });
        });

        document.querySelectorAll('.seg[data-difficulty]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                setDifficulty(btn.dataset.difficulty);
            });
        });

        els.undoBtn.addEventListener('click', undo);
        els.resetBtn.addEventListener('click', resetGame);
        els.hintBtn.addEventListener('click', requestHint);
        if (els.soundBtn) {
            els.soundBtn.addEventListener('click', function () {
                setSound(!state.sound);
                if (state.sound) sound.play('move');
            });
        }
        els.playAgainBtn.addEventListener('click', resetGame);
        els.reviewBtn.addEventListener('click', undo);

        window.addEventListener('resize', scheduleResize);

        if (typeof ResizeObserver === 'function') {
            const observer = new ResizeObserver(scheduleResize);
            observer.observe(els.canvas.parentElement || els.canvas);
        }

        // 首次交互解锁音频
        const unlock = function () {
            if (sound) sound.unlock();
            document.removeEventListener('pointerdown', unlock);
            document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('pointerdown', unlock);
        document.addEventListener('keydown', unlock);
    }

    function scheduleResize() {
        if (resizePending) return;
        resizePending = true;
        requestAnimationFrame(function () {
            resizePending = false;
            if (view) view.resize();
        });
    }

    // ------------------------------------------------------------ 启动
    function cacheElements() {
        els.canvas = $('board');
        if (!els.canvas) console.error('[象棋] 未找到 #board');
        els.turnDot = $('turnDot');
        els.statusText = $('statusText');
        els.statusBadge = $('statusBadge');
        els.difficultyGroup = $('difficultyGroup');
        els.aiDifficultyPanel = $('aiDifficultyPanel');
        els.thinking = $('thinking');
        els.resultOverlay = $('resultOverlay');
        els.resultKicker = $('resultKicker');
        els.resultTitle = $('resultTitle');
        els.resultDetail = $('resultDetail');
        els.playAgainBtn = $('playAgainBtn');
        els.reviewBtn = $('reviewBtn');
        els.undoBtn = $('undoBtn');
        els.hintBtn = $('hintBtn');
        els.resetBtn = $('resetBtn');
        els.soundBtn = $('soundBtn');
        els.moveList = $('moveList');
        els.moveEmpty = $('moveEmpty');
        els.moveCount = $('moveCount');
        els.live = $('live');
    }

    function boot() {
        cacheElements();
        // xiangqi.min.js 用 `const` 声明，属于全局词法绑定而非 window 属性
        XiangqiCtor = typeof Xiangqi !== 'undefined' ? Xiangqi : window.Xiangqi;
        if (typeof XiangqiCtor !== 'function' || !XQ.createBoardView || !XQ.Notation) {
            els.statusText.textContent = '资源加载失败';
            els.statusBadge.hidden = false;
            els.statusBadge.textContent = '错误';
            return;
        }

        game = new XiangqiCtor();
        view = XQ.createBoardView(els.canvas);
        sound = createSound();
        loadPrefs();

        setSound(state.sound);
        document.querySelectorAll('.seg[data-mode]').forEach(function (btn) {
            btn.setAttribute('aria-pressed', String(btn.dataset.mode === state.mode));
        });
        document.querySelectorAll('.seg[data-difficulty]').forEach(function (btn) {
            btn.setAttribute('aria-pressed', String(btn.dataset.difficulty === state.difficulty));
        });
        const showAi = state.mode === 'ai';
        els.difficultyGroup.hidden = !showAi;
        if (els.aiDifficultyPanel) {
            els.aiDifficultyPanel.hidden = !showAi;
        }

        bindEvents();
        updateAll();
        view.loadImages();
        requestAnimationFrame(function () {
            if (view) view.resize();
        });
        announce('新局开始，红方先行');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
