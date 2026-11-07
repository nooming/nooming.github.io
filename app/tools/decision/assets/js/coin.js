// ========== 抛硬币 · 翻面、统计与本地记录 ==========

(function () {
    'use strict';

    var STORAGE_KEY = 'coinFlipStats';
    var MAX_HISTORY = 12;
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var coin = document.getElementById('coin');
    var flipBtn = document.getElementById('flip-btn');
    var copyBtn = document.getElementById('copy-btn');
    var resetBtn = document.getElementById('reset-btn');
    var statusEl = document.getElementById('coin-status');
    var headsEl = document.getElementById('stat-heads');
    var tailsEl = document.getElementById('stat-tails');
    var totalEl = document.getElementById('stat-total');
    var probEl = document.getElementById('coin-prob');
    var historyList = document.getElementById('coin-history-list');
    var historyEmpty = document.getElementById('coin-history-empty');

    var state = load();
    var rotation = 0;
    var flipping = false;
    var lastResult = '';

    function emptyState() {
        return { heads: 0, tails: 0, history: [] };
    }

    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return emptyState();
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return emptyState();

            return {
                heads: Number.isFinite(parsed.heads) && parsed.heads >= 0 ? Math.floor(parsed.heads) : 0,
                tails: Number.isFinite(parsed.tails) && parsed.tails >= 0 ? Math.floor(parsed.tails) : 0,
                history: Array.isArray(parsed.history)
                    ? parsed.history.filter(function (item) {
                        return item && (item.face === 'heads' || item.face === 'tails') && Number.isFinite(item.t);
                    }).slice(-MAX_HISTORY)
                    : []
            };
        } catch (err) {
            return emptyState();
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            // 隐私模式下本次会话仍可用
        }
    }

    function randomFace() {
        if (window.crypto && window.crypto.getRandomValues) {
            var buffer = new Uint32Array(1);
            window.crypto.getRandomValues(buffer);
            return buffer[0] % 2 === 0 ? 'heads' : 'tails';
        }
        return Math.random() < 0.5 ? 'heads' : 'tails';
    }

    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });
    }

    function renderStats() {
        var total = state.heads + state.tails;
        headsEl.textContent = state.heads;
        tailsEl.textContent = state.tails;
        totalEl.textContent = total;
        resetBtn.disabled = total === 0;

        if (total === 0) {
            probEl.textContent = '还没有抛过。';
            return;
        }

        var headPercent = Math.round((state.heads / total) * 100);
        probEl.textContent = '正面 ' + headPercent + '% · 反面 ' + (100 - headPercent) + '%';
    }

    function renderHistory() {
        historyList.replaceChildren();

        state.history.slice().reverse().forEach(function (item) {
            var chip = document.createElement('li');
            chip.className = 'coin-chip' + (item.face === 'tails' ? ' coin-chip--tails' : '');
            chip.textContent = item.face === 'heads' ? '正' : '反';
            chip.title = formatTime(item.t) + ' · ' + (item.face === 'heads' ? '正面' : '反面');
            historyList.appendChild(chip);
        });

        historyEmpty.hidden = state.history.length > 0;
    }

    function setStatus(text, face) {
        statusEl.textContent = text;
        statusEl.classList.toggle('is-heads', face === 'heads');
        statusEl.classList.toggle('is-tails', face === 'tails');
    }

    function flip() {
        if (flipping) return;

        flipping = true;
        flipBtn.disabled = true;
        setStatus('抛出中…', '');

        var face = randomFace();
        var faceDeg = face === 'tails' ? 180 : 0;

        var next = rotation - (rotation % 360) + 360 * 4 + faceDeg;
        while (next < rotation + 360 * 4) next += 360;
        rotation = next;
        coin.style.transform = 'rotateY(' + rotation + 'deg)';

        window.setTimeout(function () {
            state[face] += 1;
            state.history.push({ t: Date.now(), face: face });
            if (state.history.length > MAX_HISTORY) state.history.shift();
            save();

            lastResult = face;
            renderStats();
            renderHistory();
            setStatus(face === 'heads' ? '正面' : '反面', face);

            copyBtn.disabled = false;
            flipBtn.disabled = false;
            flipping = false;
        }, REDUCED ? 80 : 1200);
    }

    function copyResult() {
        if (!lastResult) return;
        var text = lastResult === 'heads' ? '正面' : '反面';
        if (typeof copyToClipboard === 'function') {
            copyToClipboard(text, '结果已复制');
        }
    }

    function reset() {
        if (flipping) return;
        if (state.heads + state.tails === 0 && state.history.length === 0) return;
        if (!window.confirm('清空统计与最近记录？')) return;

        state = emptyState();
        lastResult = '';
        save();
        renderStats();
        renderHistory();
        setStatus('准备好了就抛一次', '');
        copyBtn.disabled = true;
        flipBtn.disabled = false;
        flipping = false;

        coin.style.transform = 'rotateY(0deg)';
        if (typeof showToast === 'function') showToast('已清空统计', 'info');
    }

    flipBtn.addEventListener('click', flip);
    copyBtn.addEventListener('click', copyResult);
    resetBtn.addEventListener('click', reset);

    // 首次进入时把硬币摆到正面
    coin.style.transform = 'rotateY(0deg)';
    renderStats();
    renderHistory();
})();
