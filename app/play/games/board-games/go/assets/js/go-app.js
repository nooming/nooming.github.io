/*!
 * go-app.js — 围棋独立版的界面与交互
 * 依赖 go-engine.js（window.GoEngine）
 */
(function () {
    'use strict';

    var Go = window.GoEngine;
    if (!Go) {
        console.error('GoEngine 未加载');
        return;
    }

    var BLACK = Go.BLACK;
    var WHITE = Go.WHITE;
    var DEFAULT_HUMAN = BLACK;
    var STORAGE_KEY = 'go.standalone.v2';
    var LETTERS = 'ABCDEFGHJKLMNOPQRST';

    function $(id) {
        return document.getElementById(id);
    }

    var el = {
        canvas: $('board'),
        boardFrame: $('boardFrame'),
        boardNote: $('boardNote'),
        statusText: $('statusText'),
        turnDot: $('turnDot'),
        hint: $('hint'),
        moveCount: $('moveCount'),
        blackCaptures: $('blackCaptures'),
        whiteCaptures: $('whiteCaptures'),
        komiValue: $('komiValue'),
        undoBtn: $('undoBtn'),
        passBtn: $('passBtn'),
        resignBtn: $('resignBtn'),
        whereBtn: $('whereBtn'),
        exportBtn: $('exportBtn'),
        newBtn: $('newBtn'),
        modeGroup: $('modeGroup'),
        sizeGroup: $('sizeGroup'),
        colorGroup: $('colorGroup'),
        difficultyGroup: $('difficultyGroup'),
        difficultyRow: $('difficultyRow'),
        resultDialog: $('resultDialog'),
        resultKicker: $('resultKicker'),
        resultTitle: $('resultTitle'),
        resultDetail: $('resultDetail'),
        resultContinue: $('resultContinue'),
        resultNew: $('resultNew')
    };

    var state = {
        size: 19,
        mode: 'two',
        difficulty: 'medium',
        humanColor: DEFAULT_HUMAN,
        gameId: 0,
        aiToken: 0,
        aiThinking: false,
        hover: -1,
        cursor: -1,
        highlightUntil: 0,
        rafId: 0,
        hintTimer: 0,
        resignArmed: false,
        resignTimer: 0,
        resultShown: false
    };

    var game = new Go.GoGame({ size: state.size, komi: Go.DEFAULT_KOMI });

    /* ------------------------------------------------------------------ *
     * 渲染
     * ------------------------------------------------------------------ */

    var view = {
        canvas: el.canvas,
        ctx: el.canvas.getContext('2d'),
        css: 0,
        dpr: 1,
        cell: 28,
        pad: 28,
        layer: document.createElement('canvas'),
        sprites: { 1: null, 2: null },
        spriteSize: 0
    };

    function formatNumber(value) {
        return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
    }

    function stoneName(color) {
        return color === BLACK ? '黑方' : '白方';
    }

    /** 计算并同步画布分辨率（HiDPI），必要时重建棋盘的静态图层与棋子贴图。 */
    function syncCanvas(force) {
        var rect = view.canvas.getBoundingClientRect();
        if (!rect.width) return;

        var css = Math.round(rect.width);
        var dpr = Math.min(window.devicePixelRatio || 1, 3);
        if (!force && css === view.css && dpr === view.dpr) return;

        view.css = css;
        view.dpr = dpr;
        view.cell = css / (game.size + 1);
        view.pad = view.cell;

        var pixels = Math.round(css * dpr);
        view.canvas.width = pixels;
        view.canvas.height = pixels;
        view.layer.width = pixels;
        view.layer.height = pixels;

        buildBoardLayer();
        buildStoneSprites();
        draw();
    }

    function buildBoardLayer() {
        var g = view.layer.getContext('2d');
        var size = view.css;
        var cell = view.cell;
        var pad = view.pad;
        var n = game.size;

        g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        g.clearRect(0, 0, size, size);

        // 木纹底色
        var wood = g.createLinearGradient(0, 0, size, size);
        wood.addColorStop(0, '#e9cc97');
        wood.addColorStop(0.5, '#dfb881');
        wood.addColorStop(1, '#d2a468');
        g.fillStyle = wood;
        g.fillRect(0, 0, size, size);

        // 细微木纹
        g.save();
        g.globalAlpha = 0.05;
        g.strokeStyle = '#5b3a12';
        g.lineWidth = 1;
        var lines = 24;
        for (var i = 0; i < lines; i++) {
            var y = (i + 0.5) * size / lines;
            g.beginPath();
            for (var x = 0; x <= size; x += 10) {
                var yy = y + Math.sin(x * 0.018 + i * 1.7) * (1.2 + i % 3);
                if (x === 0) g.moveTo(x, yy);
                else g.lineTo(x, yy);
            }
            g.stroke();
        }
        g.restore();

        // 网格
        var end = pad + (n - 1) * cell;
        g.strokeStyle = 'rgba(30, 20, 8, 0.82)';
        g.lineWidth = Math.max(0.8, cell * 0.028);
        g.beginPath();
        for (var k = 0; k < n; k++) {
            var p = pad + k * cell;
            g.moveTo(pad, p);
            g.lineTo(end, p);
            g.moveTo(p, pad);
            g.lineTo(p, end);
        }
        g.stroke();

        // 外框略粗
        g.lineWidth = Math.max(1.2, cell * 0.05);
        g.strokeRect(pad, pad, end - pad, end - pad);

        // 星位
        g.fillStyle = 'rgba(25, 16, 6, 0.88)';
        var starRadius = Math.max(2, cell * 0.1);
        var stars = Go.hoshiPoints(n);
        for (var s = 0; s < stars.length; s++) {
            var idx = stars[s];
            var sr = (idx / n) | 0;
            var sc = idx - sr * n;
            g.beginPath();
            g.arc(pad + sc * cell, pad + sr * cell, starRadius, 0, Math.PI * 2);
            g.fill();
        }

        // 坐标（左侧数字、底部字母，沿用围棋跳过 I 的惯例）
        var fontSize = Math.max(9, Math.min(cell * 0.42, 15));
        g.font = '600 ' + fontSize + 'px system-ui, -apple-system, "Segoe UI", sans-serif';
        g.fillStyle = 'rgba(70, 46, 14, 0.58)';
        g.textAlign = 'center';
        g.textBaseline = 'middle';

        for (var c = 0; c < n; c++) {
            g.fillText(LETTERS[c], pad + c * cell, size - cell * 0.5);
        }
        for (var r = 0; r < n; r++) {
            g.fillText(String(n - r), cell * 0.5, pad + r * cell);
        }
    }

    function buildStoneSprites() {
        var radius = view.cell * 0.44;
        var margin = Math.max(2, radius * 0.4);
        var size = (radius + margin) * 2;
        var pixels = Math.ceil(size * view.dpr);

        view.spriteSize = size;

        [BLACK, WHITE].forEach(function (color) {
            var canvas = document.createElement('canvas');
            canvas.width = pixels;
            canvas.height = pixels;
            var g = canvas.getContext('2d');
            g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

            var cx = size / 2;
            var cy = size / 2;

            var gradient = g.createRadialGradient(
                cx - radius * 0.34, cy - radius * 0.38, radius * 0.06,
                cx, cy, radius * 1.04
            );
            if (color === BLACK) {
                gradient.addColorStop(0, '#707070');
                gradient.addColorStop(0.32, '#303030');
                gradient.addColorStop(1, '#050505');
            } else {
                gradient.addColorStop(0, '#ffffff');
                gradient.addColorStop(0.55, '#f4f2ec');
                gradient.addColorStop(1, '#ccc8bf');
            }

            g.save();
            g.shadowColor = 'rgba(0, 0, 0, 0.32)';
            g.shadowBlur = radius * 0.32;
            g.shadowOffsetY = radius * 0.14;
            g.beginPath();
            g.arc(cx, cy, radius, 0, Math.PI * 2);
            g.fillStyle = gradient;
            g.fill();
            g.restore();

            g.beginPath();
            g.arc(cx, cy, radius - 0.35, 0, Math.PI * 2);
            g.strokeStyle = color === BLACK
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(0, 0, 0, 0.16)';
            g.lineWidth = Math.max(0.6, radius * 0.05);
            g.stroke();

            view.sprites[color] = canvas;
        });
    }

    function pointX(idx) {
        return view.pad + (idx % game.size) * view.cell;
    }

    function pointY(idx) {
        return view.pad + Math.floor(idx / game.size) * view.cell;
    }

    function drawStone(idx, color, alpha) {
        var sprite = view.sprites[color];
        if (!sprite) return;

        var half = view.spriteSize / 2;
        var ctx = view.ctx;
        if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
        ctx.drawImage(sprite, pointX(idx) - half, pointY(idx) - half, view.spriteSize, view.spriteSize);
        if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
    }

    function draw() {
        if (!view.css) return;
        var ctx = view.ctx;
        var size = view.css;

        ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(view.layer, 0, 0, size, size);

        var board = game.board;
        for (var i = 0; i < board.length; i++) {
            if (board[i] !== 0) drawStone(i, board[i]);
        }

        // 最后一手标记
        var last = game.lastMove;
        if (last >= 0 && board[last] !== 0) {
            var lx = pointX(last);
            var ly = pointY(last);
            ctx.beginPath();
            ctx.arc(lx, ly, view.cell * 0.085, 0, Math.PI * 2);
            ctx.fillStyle = board[last] === BLACK ? 'rgba(245, 245, 245, 0.92)' : 'rgba(20, 20, 20, 0.85)';
            ctx.fill();
        }

        // 悬停预览
        if (state.hover >= 0 && board[state.hover] === 0 && canHumanAct()) {
            drawStone(state.hover, game.toPlay, 0.38);
        }

        // “下哪了”高亮
        var now = performance.now();
        if (state.highlightUntil > now && last >= 0 && board[last] !== 0) {
            var pulse = 0.5 + 0.5 * Math.sin(now / 190);
            ctx.save();
            ctx.beginPath();
            ctx.arc(lx, ly, view.cell * (0.5 + pulse * 0.04), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 205, 0, ' + (0.55 + pulse * 0.35) + ')';
            ctx.lineWidth = Math.max(2, view.cell * 0.08);
            ctx.shadowColor = '#ffcd00';
            ctx.shadowBlur = view.cell * 0.45;
            ctx.stroke();
            ctx.restore();
        }

        // 键盘落子光标
        if (state.cursor >= 0 && document.activeElement === view.canvas) {
            var cx = pointX(state.cursor);
            var cy = pointY(state.cursor);
            var d = view.cell * 0.42;
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(cx - d, cy - d, d * 2, d * 2);
            ctx.strokeStyle = '#ffcd00';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx - d + 1.5, cy - d + 1.5, d * 2 - 3, d * 2 - 3);
            ctx.restore();
        }
    }

    function ensureAnimation() {
        if (state.rafId) return;
        state.rafId = requestAnimationFrame(function tick() {
            state.rafId = 0;
            draw();
            if (performance.now() < state.highlightUntil) ensureAnimation();
        });
    }

    /* ------------------------------------------------------------------ *
     * 状态与提示
     * ------------------------------------------------------------------ */

    function canHumanAct() {
        return !game.ended && !state.aiThinking &&
            (state.mode === 'two' || game.toPlay === state.humanColor);
    }

    function showHint(text, kind) {
        el.hint.textContent = text;
        el.hint.classList.toggle('is-error', kind !== 'info');
        clearTimeout(state.hintTimer);
        if (text) {
            state.hintTimer = setTimeout(function () {
                el.hint.textContent = '';
                el.hint.classList.remove('is-error');
            }, 2800);
        }
    }

    function clearHint() {
        clearTimeout(state.hintTimer);
        el.hint.textContent = '';
        el.hint.classList.remove('is-error');
    }

    function pulseError() {
        var frame = el.boardFrame;
        frame.classList.remove('is-invalid');
        // 触发重排以重启动画
        void frame.offsetWidth;
        frame.classList.add('is-invalid');
        setTimeout(function () { frame.classList.remove('is-invalid'); }, 420);
    }

    function setSegmented(group, attribute, value) {
        if (!group) return;
        var buttons = group.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            var on = buttons[i].getAttribute('data-' + attribute) === String(value);
            buttons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
        }
    }

    function updateUI() {
        setSegmented(el.modeGroup, 'mode', state.mode);
        setSegmented(el.sizeGroup, 'size', state.size);
        setSegmented(el.colorGroup, 'color', state.humanColor === BLACK ? 'black' : 'white');
        setSegmented(el.difficultyGroup, 'difficulty', state.difficulty);
        el.difficultyRow.hidden = state.mode !== 'ai';

        el.moveCount.textContent = String(game.moveNumber);
        el.blackCaptures.textContent = String(game.captures[BLACK]);
        el.whiteCaptures.textContent = String(game.captures[WHITE]);
        el.komiValue.textContent = formatNumber(game.komi);

        var ended = game.ended;
        el.turnDot.classList.toggle('is-white', !ended && game.toPlay === WHITE);
        el.turnDot.classList.toggle('is-ended', ended);

        el.statusText.classList.toggle('is-thinking', state.aiThinking && !ended);
        if (ended) {
            var result = game.result || {};
            if (result.winner === 0) {
                el.statusText.textContent = '对局结束 · 和棋';
            } else if (result.reason === 'resign') {
                el.statusText.textContent = '对局结束 · ' + stoneName(result.winner) + '中盘胜';
            } else {
                el.statusText.textContent = '对局结束 · ' + stoneName(result.winner) +
                    '胜 ' + formatNumber(result.margin) + ' 目';
            }
        } else if (state.aiThinking) {
            el.statusText.textContent = 'AI 思考中';
        } else {
            el.statusText.textContent = stoneName(game.toPlay) + '行棋';
        }

        var humanCanAct = canHumanAct();
        el.passBtn.disabled = !humanCanAct;
        el.resignBtn.disabled = !humanCanAct;
        el.undoBtn.disabled = state.mode === 'ai'
            ? !hasHumanHistory()
            : game.history.length === 0;
        el.whereBtn.disabled = game.lastMove < 0;
        el.exportBtn.disabled = game.history.length === 0;

        view.canvas.setAttribute('aria-busy', state.aiThinking ? 'true' : 'false');
        if (state.mode === 'ai') {
            el.boardNote.textContent = (state.humanColor === BLACK ? '你执黑' : '你执白') +
                ' · 点击交叉点落子 · 方向键移动、回车落子';
        } else {
            el.boardNote.textContent = '点击交叉点落子 · 方向键移动、回车落子';
        }
    }

    /* ------------------------------------------------------------------ *
     * 终局结果
     * ------------------------------------------------------------------ */

    function openDialog() {
        if (el.resultDialog.open) return;
        if (typeof el.resultDialog.showModal === 'function') {
            el.resultDialog.showModal();
        } else {
            el.resultDialog.setAttribute('open', '');
        }
    }

    function closeDialog() {
        if (el.resultDialog.open) {
            if (typeof el.resultDialog.close === 'function') el.resultDialog.close();
            else el.resultDialog.removeAttribute('open');
        }
    }

    function fillResult() {
        var result = game.result;
        if (!result) return;

        if (result.winner === 0) {
            el.resultKicker.textContent = '终局';
            el.resultTitle.textContent = '和棋';
            el.resultDetail.textContent = '黑 ' + formatNumber(result.blackScore) +
                ' · 白 ' + formatNumber(result.whiteScore) + '（含贴目 ' +
                formatNumber(result.komi) + '）';
            el.resultContinue.textContent = '继续对局';
            return;
        }

        var winner = stoneName(result.winner);
        var loser = stoneName(3 - result.winner);

        if (result.reason === 'resign') {
            el.resultKicker.textContent = '对方认输';
            el.resultTitle.textContent = winner + '中盘胜';
            el.resultDetail.textContent = '第 ' + game.moveNumber + ' 手，' + loser +
                '认输。可点“悔棋续弈”继续这盘棋。';
            el.resultContinue.textContent = '悔棋续弈';
        } else {
            el.resultKicker.textContent = '双方连续弃权 · 终局点目';
            el.resultTitle.textContent = winner + '胜 ' + formatNumber(result.margin) + ' 目';
            el.resultDetail.textContent = '黑 ' + formatNumber(result.blackScore) +
                '（' + result.blackStones + ' 子 + ' + result.blackTerritory + ' 空） · 白 ' +
                formatNumber(result.whiteScore) +
                '（' + result.whiteStones + ' 子 + ' + result.whiteTerritory +
                ' 空 + 贴目 ' + formatNumber(result.komi) + '）';
            el.resultContinue.textContent = '继续对局';
        }
    }

    function syncResult() {
        if (game.ended) {
            if (!state.resultShown) {
                fillResult();
                state.resultShown = true;
                openDialog();
            }
        } else if (state.resultShown) {
            state.resultShown = false;
            closeDialog();
        }
    }

    /* ------------------------------------------------------------------ *
     * 持久化
     * ------------------------------------------------------------------ */

    function persist() {
        try {
            var moves = game.history.map(function (record) {
                if (record.type === 'pass') return 'p';
                if (record.type === 'resign') return 'r';
                return record.index;
            });
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                v: 2,
                size: state.size,
                mode: state.mode,
                difficulty: state.difficulty,
                humanColor: state.humanColor,
                komi: game.komi,
                moves: moves
            }));
        } catch (error) {
            // localStorage 在隐私模式 / 某些 file:// 环境下不可用，忽略即可
        }
    }

    function restore() {
        var raw;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (error) {
            return false;
        }
        if (!raw) return false;

        var data;
        try {
            data = JSON.parse(raw);
        } catch (error) {
            return false;
        }
        if (!data || data.v !== 2) return false;

        var size = Go.SIZES.indexOf(data.size) >= 0 ? data.size : 19;
        var mode = data.mode === 'ai' ? 'ai' : 'two';
        var difficulty = ['easy', 'medium', 'hard'].indexOf(data.difficulty) >= 0
            ? data.difficulty
            : 'medium';
        var komi = typeof data.komi === 'number' ? data.komi : Go.DEFAULT_KOMI;
        var humanColor = data.humanColor === WHITE ? WHITE : BLACK;
        var moves = Array.isArray(data.moves) ? data.moves : [];

        var restored = new Go.GoGame({ size: size, komi: komi });
        for (var i = 0; i < moves.length; i++) {
            var move = moves[i];
            if (move === 'p') {
                if (!restored.pass().ok) return false;
            } else if (move === 'r') {
                if (!restored.resign().ok) return false;
            } else if (Number.isInteger(move)) {
                if (!restored.playIndex(move).ok) return false;
            } else {
                return false;
            }
        }

        game = restored;
        state.size = size;
        state.mode = mode;
        state.difficulty = difficulty;
        state.humanColor = humanColor;
        return true;
    }

    /* ------------------------------------------------------------------ *
     * 流程
     * ------------------------------------------------------------------ */

    function cancelAI() {
        state.aiToken++;
        state.aiThinking = false;
    }

    function scheduleAI() {
        if (state.mode !== 'ai' || game.ended || game.toPlay === state.humanColor || state.aiThinking) {
            return;
        }

        state.aiThinking = true;
        var token = ++state.aiToken;
        var gameId = state.gameId;
        var moveNumber = game.moveNumber;
        updateUI();

        // 先让浏览器绘制“思考中”，再进行同步搜索
        setTimeout(function () {
            if (token !== state.aiToken || gameId !== state.gameId ||
                game.moveNumber !== moveNumber || game.ended) {
                return;
            }

            var result = null;
            var options = {
                board: game.board,
                size: game.size,
                toPlay: game.toPlay,
                komi: game.komi,
                difficulty: state.difficulty,
                koPoint: game.koPoint,
                lastMove: game.lastMove,
                lastWasPass: game.consecutivePasses > 0
            };
            try {
                result = Go.chooseMove(options);
            } catch (error) {
                console.error('AI 计算失败', error);
            }

            if (token !== state.aiToken || gameId !== state.gameId ||
                game.moveNumber !== moveNumber || game.ended) {
                return;
            }

            state.aiThinking = false;

            if (!result || result.pass) {
                game.pass();
            } else {
                var played = game.playIndex(result.index);
                if (!played.ok) {
                    // 极少数全局同形再现：排除该点后重算一次，仍不合法则弃权
                    var retry = null;
                    try {
                        options.forbidden = new Set([result.index]);
                        retry = Go.chooseMove(options);
                    } catch (error) {
                        console.error('AI 重算失败', error);
                    }
                    if (retry && !retry.pass) played = game.playIndex(retry.index);
                    if (!played.ok) game.pass();
                }
            }
            refresh();
        }, 60);
    }

    function refresh() {
        draw();
        updateUI();
        persist();
        syncResult();
        if (!game.ended) scheduleAI();
    }

    function newGame() {
        cancelAI();
        disarmResign();
        state.gameId++;
        game = new Go.GoGame({ size: state.size, komi: Go.DEFAULT_KOMI });
        state.hover = -1;
        state.cursor = -1;
        state.highlightUntil = 0;
        state.resultShown = false;
        clearHint();
        closeDialog();
        syncCanvas(true);
        refresh();
    }

    function hasHumanHistory() {
        for (var i = 0; i < game.history.length; i++) {
            if (game.history[i].color === state.humanColor) return true;
        }
        return false;
    }

    function undoMove() {
        disarmResign();
        if (game.history.length === 0) return;
        if (state.mode === 'ai' && !hasHumanHistory()) return;

        // 确认有可撤销的内容后再取消 AI，避免执白开局时把 AI 的思考取消掉
        cancelAI();
        game.undo();
        if (state.mode === 'ai') {
            while (game.history.length > 0 && game.toPlay !== state.humanColor) game.undo();
        }

        state.highlightUntil = 0;
        state.resultShown = false;
        closeDialog();
        clearHint();
        refresh();
    }

    function passTurn() {
        if (!canHumanAct()) return;
        disarmResign();
        var result = game.pass();
        if (!result.ok) {
            showHint(result.message);
            return;
        }
        state.highlightUntil = 0;
        clearHint();
        refresh();
    }

    function disarmResign() {
        state.resignArmed = false;
        clearTimeout(state.resignTimer);
        el.resignBtn.textContent = '认输';
        el.resignBtn.classList.remove('is-armed');
    }

    function resignGame() {
        if (!canHumanAct()) return;

        if (!state.resignArmed) {
            state.resignArmed = true;
            el.resignBtn.textContent = '确认认输';
            el.resignBtn.classList.add('is-armed');
            clearTimeout(state.resignTimer);
            state.resignTimer = setTimeout(disarmResign, 3200);
            return;
        }

        disarmResign();
        game.resign();
        state.highlightUntil = 0;
        refresh();
    }

    function showLastMove() {
        if (game.lastMove < 0) {
            showHint('还没有落子', 'info');
            return;
        }
        state.highlightUntil = performance.now() + 2400;
        ensureAnimation();
    }

    function exportSGF() {
        if (game.history.length === 0) {
            showHint('还没有可导出的棋谱', 'info');
            return;
        }
        try {
            var blob = new Blob([game.toSGF()], { type: 'application/x-go-sgf;charset=utf-8' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = 'go-' + new Date().toISOString().slice(0, 10) + '.sgf';
            document.body.appendChild(link);
            link.click();
            link.remove();
            setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
            showHint('棋谱已导出（SGF）', 'info');
        } catch (error) {
            showHint('导出失败：当前浏览器不支持下载');
        }
    }

    function activatePoint(idx) {
        if (idx < 0) return;

        if (game.ended) {
            showHint('对局已结束，可悔棋续弈或开始新局');
            return;
        }
        if (state.aiThinking || (state.mode === 'ai' && game.toPlay !== state.humanColor)) {
            showHint('请等待 AI 落子');
            return;
        }
        if (game.board[idx] !== 0) {
            if (idx === game.lastMove) {
                state.highlightUntil = performance.now() + 2400;
                ensureAnimation();
            } else {
                showHint('此处已有棋子');
            }
            return;
        }

        var result = game.playIndex(idx);
        if (!result.ok) {
            showHint(result.message);
            pulseError();
            return;
        }

        disarmResign();
        state.hover = -1;
        state.highlightUntil = 0;
        state.resultShown = false;
        clearHint();
        refresh();
    }

    function pointerToIndex(event) {
        var rect = view.canvas.getBoundingClientRect();
        if (!rect.width) return -1;
        var x = (event.clientX - rect.left) * (view.css / rect.width);
        var y = (event.clientY - rect.top) * (view.css / rect.height);
        var n = game.size;
        var col = Math.round((x - view.pad) / view.cell);
        var row = Math.round((y - view.pad) / view.cell);
        if (row < 0 || row >= n || col < 0 || col >= n) return -1;

        var cx = view.pad + col * view.cell;
        var cy = view.pad + row * view.cell;
        var dx = x - cx;
        var dy = y - cy;
        var tolerance = view.cell * 0.62;
        if (dx * dx + dy * dy > tolerance * tolerance) return -1;
        return row * n + col;
    }

    /* ------------------------------------------------------------------ *
     * 事件绑定
     * ------------------------------------------------------------------ */

    function bindSegmented(group, attribute, apply) {
        if (!group) return;
        group.addEventListener('click', function (event) {
            var button = event.target.closest('button[data-' + attribute + ']');
            if (!button || !group.contains(button)) return;
            apply(button.getAttribute('data-' + attribute));
        });
    }

    function setMode(mode) {
        if (mode !== 'ai' && mode !== 'two') return;
        if (state.mode === mode) return;
        state.mode = mode;
        state.resultShown = false;
        newGame();
    }

    function setSize(rawSize) {
        var size = parseInt(rawSize, 10);
        if (Go.SIZES.indexOf(size) < 0 || state.size === size) return;
        state.size = size;
        state.resultShown = false;
        newGame();
    }

    function setHumanColor(value) {
        var color = value === 'white' ? WHITE : BLACK;
        if (state.humanColor === color) return;
        state.humanColor = color;
        state.resultShown = false;
        newGame();
    }

    function setDifficulty(difficulty) {
        if (['easy', 'medium', 'hard'].indexOf(difficulty) < 0) return;
        state.difficulty = difficulty;
        updateUI();
        persist();
    }

    function bindEvents() {
        el.canvas.addEventListener('pointerdown', function (event) {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            var idx = pointerToIndex(event);
            if (idx >= 0) {
                event.preventDefault();
                activatePoint(idx);
            }
        });

        el.canvas.addEventListener('pointermove', function (event) {
            if (event.pointerType !== 'mouse') return;
            var idx = pointerToIndex(event);
            if (idx !== state.hover) {
                state.hover = idx;
                draw();
            }
        });

        el.canvas.addEventListener('pointerleave', function () {
            if (state.hover !== -1) {
                state.hover = -1;
                draw();
            }
        });

        bindSegmented(el.modeGroup, 'mode', setMode);
        bindSegmented(el.sizeGroup, 'size', setSize);
        bindSegmented(el.colorGroup, 'color', setHumanColor);
        bindSegmented(el.difficultyGroup, 'difficulty', setDifficulty);

        el.undoBtn.addEventListener('click', undoMove);
        el.passBtn.addEventListener('click', passTurn);
        el.resignBtn.addEventListener('click', resignGame);
        el.whereBtn.addEventListener('click', showLastMove);
        el.exportBtn.addEventListener('click', exportSGF);
        el.newBtn.addEventListener('click', newGame);

        el.resultContinue.addEventListener('click', function () {
            closeDialog();
            state.resultShown = false;
            undoMove();
        });

        el.resultNew.addEventListener('click', function () {
            closeDialog();
            state.resultShown = false;
            newGame();
        });

        if (typeof ResizeObserver === 'function') {
            var observer = new ResizeObserver(function () { syncCanvas(false); });
            observer.observe(el.canvas);
        }
        window.addEventListener('resize', function () { syncCanvas(false); });
    }

    /* ------------------------------------------------------------------ *
     * 启动
     * ------------------------------------------------------------------ */

    function boot() {
        restore();
        bindEvents();
        syncCanvas(true);
        updateUI();

        if (game.ended) {
            state.resultShown = false;
            syncResult();
            draw();
            persist();
        } else {
            refresh();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
