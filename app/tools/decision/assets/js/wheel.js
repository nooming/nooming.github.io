// ========== 转盘 · Canvas 绘制、旋转与记录 ==========

(function () {
    'use strict';

    var ENTRIES_KEY = 'wheelEntries';
    var HISTORY_KEY = 'wheelHistory';
    var MAX_ENTRIES = 24;
    var MAX_HISTORY = 12;
    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var PALETTE = [
        '#ffe066', '#ffd6a5', '#caffbf', '#9bf6ff',
        '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fdffb6',
        '#ffadad', '#c7f9cc', '#bde0fe', '#e4c1f9'
    ];

    var DEFAULT_ENTRIES = ['火锅', '烤肉', '寿司', '麻辣烫', '炒饭', '沙拉', '面', '饺子'];

    var PRESETS = {
        food: ['火锅', '烤肉', '寿司', '麻辣烫', '炒饭', '沙拉', '面', '饺子'],
        who: ['我来', '你来', '猜拳决定', '一起'],
        abcd: ['A', 'B', 'C', 'D'],
        numbers: ['1', '2', '3', '4', '5', '6']
    };

    var panel = document.querySelector('.wheel-panel');
    var wrap = document.getElementById('wheel-canvas-wrap');
    var canvas = document.getElementById('wheel-canvas');
    var ctx = canvas.getContext('2d');
    var spinBtn = document.getElementById('wheel-spin');
    var hub = document.getElementById('wheel-hub');
    var expandBtn = document.getElementById('wheel-expand');
    var exitBtn = document.getElementById('wheel-exit');
    var copyBtn = document.getElementById('wheel-copy');
    var resultEl = document.getElementById('wheel-result');
    var textarea = document.getElementById('wheel-entries');
    var countEl = document.getElementById('wheel-count');
    var shuffleBtn = document.getElementById('wheel-shuffle');
    var clearBtn = document.getElementById('wheel-clear');
    var historyList = document.getElementById('wheel-history-list');
    var historyEmpty = document.getElementById('wheel-history-empty');
    var historyClear = document.getElementById('wheel-history-clear');

    var view = 0;
    var rotation = 0;
    var spinning = false;
    var spinningList = null;
    var currentResult = '';
    var history = loadHistory();
    var saveTimer = 0;

    function isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }

    function loadHistory() {
        try {
            var raw = localStorage.getItem(HISTORY_KEY);
            if (!raw) return [];
            var parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(function (item) {
                return item && typeof item.text === 'string' && Number.isFinite(item.t);
            }).slice(-MAX_HISTORY);
        } catch (err) {
            return [];
        }
    }

    function saveHistory() {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        } catch (err) {
            // 隐私模式下降级
        }
    }

    function saveEntries() {
        try {
            localStorage.setItem(ENTRIES_KEY, textarea.value);
        } catch (err) {
            // 同上
        }
    }

    function parseEntries() {
        return textarea.value
            .split('\n')
            .map(function (line) { return line.trim(); })
            .filter(Boolean);
    }

    function visibleEntries(list) {
        return list.slice(0, MAX_ENTRIES);
    }

    function randomIndex(length) {
        if (window.crypto && window.crypto.getRandomValues && length > 0) {
            var max = Math.floor(0xFFFFFFFF / length) * length;
            var buffer = new Uint32Array(1);
            do {
                window.crypto.getRandomValues(buffer);
            } while (buffer[0] >= max);
            return buffer[0] % length;
        }
        return Math.floor(Math.random() * length);
    }

    function truncate(text, limit) {
        return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
    }

    function resizeCanvas() {
        var size = Math.round(wrap.clientWidth || 520);
        if (!size) return;

        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(size * dpr);
        canvas.height = Math.round(size * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        view = size;
        draw();
    }

    function draw() {
        if (!view) return;

        var size = view;
        var center = size / 2;
        var radius = center - 12;
        var list = visibleEntries(spinningList || parseEntries());
        var dark = isDark();

        ctx.clearRect(0, 0, size, size);

        if (!list.length) {
            ctx.beginPath();
            ctx.arc(center, center, radius, 0, Math.PI * 2);
            ctx.fillStyle = dark ? '#1a1a17' : '#ffffff';
            ctx.fill();
            ctx.strokeStyle = dark ? 'rgba(255,255,255,.3)' : 'rgba(0,0,0,.22)';
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.fillStyle = dark ? 'rgba(244,242,228,.6)' : 'rgba(0,0,0,.45)';
            ctx.font = '600 15px -apple-system, "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('在右侧写入选项', center, center);
            return;
        }

        var seg = (Math.PI * 2) / list.length;
        var fontSize = Math.max(12, Math.min(19, size / 28));
        var rotationRad = (rotation * Math.PI) / 180;

        ctx.save();
        ctx.translate(center, center);
        ctx.rotate(rotationRad);

        for (var i = 0; i < list.length; i++) {
            var start = -Math.PI / 2 + i * seg;
            var end = start + seg;

            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, end);
            ctx.closePath();
            ctx.fillStyle = PALETTE[i % PALETTE.length];
            ctx.fill();
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        ctx.restore();

        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#1a1a17';

        if (list.length <= 12) {
            // 少量选项：文字始终保持水平，跟着扇区位置排布
            ctx.textAlign = 'center';
            ctx.font = '600 ' + Math.max(12, fontSize - 1).toFixed(1) + 'px -apple-system, "Microsoft YaHei", sans-serif';
            var horizontalLimit = list.length <= 6 ? 6 : (size < 380 ? 3 : 4);

            for (var h = 0; h < list.length; h++) {
                var hAng = rotationRad - Math.PI / 2 + (h + 0.5) * seg;
                var hx = center + Math.cos(hAng) * radius * 0.62;
                var hy = center + Math.sin(hAng) * radius * 0.62;
                ctx.fillText(truncate(list[h], horizontalLimit), hx, hy);
            }
        } else {
            // 选项较多：沿半径排布，避免互相重叠
            for (var j = 0; j < list.length; j++) {
                var mid = -Math.PI / 2 + (j + 0.5) * seg;
                var label = truncate(list[j], 8);

                ctx.save();
                ctx.rotate(rotationRad + mid);
                ctx.font = '600 ' + fontSize.toFixed(1) + 'px -apple-system, "Microsoft YaHei", sans-serif';

                if (Math.cos(mid) < 0) {
                    ctx.rotate(Math.PI);
                    ctx.textAlign = 'left';
                    ctx.fillText(label, -(radius * 0.88), 0);
                } else {
                    ctx.textAlign = 'right';
                    ctx.fillText(label, radius * 0.88, 0);
                }
                ctx.restore();
            }
        }

        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.strokeStyle = dark ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.25)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    function updateCount() {
        var all = parseEntries();
        var shown = Math.min(all.length, MAX_ENTRIES);
        countEl.textContent = shown + ' / ' + MAX_ENTRIES + ' 项';
        countEl.classList.toggle('is-warn', all.length > MAX_ENTRIES);
        draw();
    }

    function renderHistory() {
        historyList.replaceChildren();

        history.slice().reverse().forEach(function (item) {
            var row = document.createElement('li');

            var text = document.createElement('strong');
            text.textContent = item.text;

            var time = document.createElement('time');
            time.dateTime = new Date(item.t).toISOString();
            time.textContent = new Date(item.t).toLocaleTimeString('zh-CN', { hour12: false });

            row.appendChild(text);
            row.appendChild(time);
            historyList.appendChild(row);
        });

        historyEmpty.hidden = history.length > 0;
        historyClear.disabled = history.length === 0;
    }

    function addHistory(text) {
        history.push({ t: Date.now(), text: text });
        if (history.length > MAX_HISTORY) history.shift();
        saveHistory();
        renderHistory();
    }

    function setResult(text) {
        currentResult = text;
        resultEl.textContent = '抽中：' + text;
        resultEl.classList.remove('is-empty');
        copyBtn.disabled = false;
    }

    function spin() {
        if (spinning) return;

        var list = visibleEntries(parseEntries());
        if (list.length < 2) {
            if (typeof showToast === 'function') showToast('至少写两项再转。', 'error');
            textarea.focus();
            return;
        }

        saveEntries();

        spinning = true;
        spinningList = list.slice();
        textarea.disabled = true;
        spinBtn.disabled = true;
        hub.disabled = true;

        var winner = randomIndex(list.length);
        var segDeg = 360 / list.length;
        var centerDeg = (winner + 0.5) * segDeg;
        var target = 360 * 5 + (360 - centerDeg);
        while (target < rotation + 360 * 3) target += 360;

        var start = rotation;
        var duration = REDUCED ? 180 : 3200;
        var startedAt = performance.now();

        function frame(now) {
            var progress = Math.min(1, (now - startedAt) / duration);
            var eased = 1 - Math.pow(1 - progress, 3);
            rotation = start + (target - start) * eased;
            draw();

            if (progress < 1) {
                window.requestAnimationFrame(frame);
                return;
            }

            rotation = target % 360;
            spinning = false;
            spinningList = null;
            textarea.disabled = false;
            spinBtn.disabled = false;
            hub.disabled = false;
            draw();

            setResult(list[winner]);
            addHistory(list[winner]);

            if (typeof showToast === 'function') {
                showToast('抽中：' + list[winner], 'success');
            }
        }

        window.requestAnimationFrame(frame);
    }

    function copyResult() {
        if (!currentResult) return;
        if (typeof copyToClipboard === 'function') {
            copyToClipboard(currentResult, '结果已复制');
        }
    }

    function shuffle() {
        if (spinning) return;
        var list = parseEntries();
        for (var i = list.length - 1; i > 0; i--) {
            var j = randomIndex(i + 1);
            var temp = list[i];
            list[i] = list[j];
            list[j] = temp;
        }
        textarea.value = list.join('\n');
        saveEntries();
        updateCount();
    }

    function clearEntries() {
        if (spinning) return;
        if (parseEntries().length && !window.confirm('清空全部选项？')) return;
        textarea.value = '';
        saveEntries();
        updateCount();
        resultEl.textContent = '还没开始';
        resultEl.classList.add('is-empty');
        currentResult = '';
        copyBtn.disabled = true;
    }

    function applyPreset(key) {
        if (spinning) return;
        var list = PRESETS[key];
        if (!list) return;
        textarea.value = list.join('\n');
        saveEntries();
        updateCount();
    }

    function clearHistory() {
        if (!history.length) return;
        history = [];
        saveHistory();
        renderHistory();
        if (typeof showToast === 'function') showToast('已清空记录', 'info');
    }

    function setFullscreen(on) {
        panel.classList.toggle('is-fullscreen', on);
        document.body.classList.toggle('wheel-fullscreen', on);
        window.setTimeout(resizeCanvas, 60);
    }

    spinBtn.addEventListener('click', spin);
    hub.addEventListener('click', spin);
    document.getElementById('wheel-copy').addEventListener('click', copyResult);
    shuffleBtn.addEventListener('click', shuffle);
    clearBtn.addEventListener('click', clearEntries);
    historyClear.addEventListener('click', clearHistory);
    expandBtn.addEventListener('click', function () { setFullscreen(true); });
    exitBtn.addEventListener('click', function () { setFullscreen(false); });

    Array.prototype.forEach.call(document.querySelectorAll('.wheel-preset'), function (button) {
        button.addEventListener('click', function () {
            applyPreset(button.dataset.preset);
        });
    });

    textarea.addEventListener('input', function () {
        updateCount();
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(saveEntries, 200);
    });

    if (window.ResizeObserver) {
        new ResizeObserver(resizeCanvas).observe(wrap);
    } else {
        window.addEventListener('resize', resizeCanvas);
    }

    if (window.MutationObserver) {
        new MutationObserver(function () { draw(); }).observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });
    }

    var savedEntries = null;
    try {
        savedEntries = localStorage.getItem(ENTRIES_KEY);
    } catch (err) {
        savedEntries = null;
    }
    textarea.value = savedEntries || DEFAULT_ENTRIES.join('\n');

    renderHistory();
    updateCount();
    window.requestAnimationFrame(resizeCanvas);
})();
