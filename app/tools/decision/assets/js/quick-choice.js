// ========== 多选随机 · 抽取、历史与持久化 ==========

(function () {
    'use strict';

    var INPUT_KEY = 'quickChoiceInput';
    var HISTORY_KEY = 'quickChoiceHistory';
    var MAX_HISTORY = 10;

    var input = document.getElementById('qc-input');
    var drawBtn = document.getElementById('qc-draw');
    var resultBox = document.getElementById('qc-result');
    var resultValue = document.getElementById('qc-result-value');
    var copyBtn = document.getElementById('qc-copy');
    var historyList = document.getElementById('qc-history-list');
    var historyEmpty = document.getElementById('qc-history-empty');
    var clearBtn = document.getElementById('qc-clear');

    var currentResult = '';
    var history = loadHistory();
    var saveTimer = 0;

    var PRESETS = {
        abcd: 'A\nB\nC\nD',
        numbers: '1\n2\n3\n4',
        food: '火锅\n烤肉\n寿司\n麻辣烫\n炒饭\n沙拉',
        yesno: '是\n否'
    };

    function parseOptions(text) {
        return text
            .split('\n')
            .map(function (line) {
                return line.replace(/^\s*(?:[-*•]\s+|\d+[.)、]\s*)\s*/, '').trim();
            })
            .filter(Boolean)
            .slice(0, 500);
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
            // 隐私模式：本次会话仍可见
        }
    }

    function saveInput() {
        try {
            localStorage.setItem(INPUT_KEY, input.value);
        } catch (err) {
            // 同上
        }
    }

    function formatTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('zh-CN', { hour12: false });
    }

    function renderHistory() {
        historyList.replaceChildren();

        history.slice().reverse().forEach(function (item) {
            var row = document.createElement('li');

            var text = document.createElement('strong');
            text.textContent = item.text;

            var time = document.createElement('time');
            time.dateTime = new Date(item.t).toISOString();
            time.textContent = formatTime(item.t);

            row.appendChild(text);
            row.appendChild(time);
            historyList.appendChild(row);
        });

        historyEmpty.hidden = history.length > 0;
        clearBtn.disabled = history.length === 0;
    }

    function showResult(text, animate) {
        currentResult = text;
        resultValue.textContent = text;
        resultValue.classList.remove('is-empty');
        copyBtn.disabled = false;

        if (animate) {
            resultBox.classList.remove('is-pop');
            void resultBox.offsetWidth;
            resultBox.classList.add('is-pop');
            if (window.SoundFX) window.SoundFX.play('reveal');
        }
    }

    function addHistory(text) {
        history.push({ t: Date.now(), text: text });
        if (history.length > MAX_HISTORY) history.shift();
        saveHistory();
        renderHistory();
    }

    function draw() {
        var options = parseOptions(input.value);

        if (!options.length) {
            if (typeof showToast === 'function') {
                showToast('至少写一项再抽。', 'error');
            }
            if (window.SoundFX) window.SoundFX.play('error');
            input.focus();
            return;
        }

        var picked = options[randomIndex(options.length)];
        showResult(picked, true);
        addHistory(picked);
    }

    function copyResult() {
        if (!currentResult) return;
        if (typeof copyToClipboard === 'function') {
            copyToClipboard(currentResult, '结果已复制');
        }
        if (window.SoundFX) window.SoundFX.play('click');
    }

    function clearHistory() {
        if (!history.length) return;
        history = [];
        saveHistory();
        renderHistory();
        if (typeof showToast === 'function') showToast('已清空记录', 'info');
    }

    function applyPreset(key) {
        var text = PRESETS[key];
        if (!text) return;
        input.value = text;
        saveInput();
        input.focus();
    }

    input.addEventListener('input', function () {
        window.clearTimeout(saveTimer);
        saveTimer = window.setTimeout(saveInput, 200);
    });

    drawBtn.addEventListener('click', draw);
    copyBtn.addEventListener('click', copyResult);
    clearBtn.addEventListener('click', clearHistory);

    Array.prototype.forEach.call(document.querySelectorAll('.qc-chip'), function (chip) {
        chip.addEventListener('click', function () {
            applyPreset(chip.dataset.preset);
        });
    });

    try {
        var savedInput = localStorage.getItem(INPUT_KEY);
        if (savedInput) input.value = savedInput;
    } catch (err) {
        // 忽略
    }

    renderHistory();
})();
