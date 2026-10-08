// ========== 灯牌 ==========
document.addEventListener('DOMContentLoaded', function () {
    var STORAGE_KEY = 'noomings.light-board';
    var THEME_REST = '#FFFA00';
    var FONTS = {
        hei: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
        song: '"Songti SC", "SimSun", serif',
        mono: 'var(--font-mono)'
    };

    var boardText = document.getElementById('boardText');
    var textColor = document.getElementById('textColor');
    var bgColor = document.getElementById('bgColor');
    var speed = document.getElementById('speed');
    var size = document.getElementById('size');
    var speedField = document.getElementById('speedField');
    var contrastHint = document.getElementById('contrastHint');
    var goBtn = document.getElementById('goBtn');
    var pageHeader = document.getElementById('pageHeader');
    var setup = document.getElementById('setup');
    var pageFooter = document.getElementById('pageFooter');
    var stage = document.getElementById('stage');
    var stageView = document.getElementById('stageView');
    var stageLine = document.getElementById('stageLine');
    var stageBar = document.getElementById('stageBar');
    var exitBtn = document.getElementById('exitBtn');
    var barText = document.getElementById('barText');
    var barTextColor = document.getElementById('barTextColor');
    var barBgColor = document.getElementById('barBgColor');
    var barFont = document.getElementById('barFont');
    var barSize = document.getElementById('barSize');
    var barSpeed = document.getElementById('barSpeed');
    var barSpeedWrap = document.getElementById('barSpeedWrap');
    var barContrast = document.getElementById('barContrast');
    var themeColor = document.getElementById('themeColor');

    var stageOpen = false;
    var scrollAnim = null;
    var wakeLock = null;
    var wakeGen = 0;
    var paintGen = 0;
    var resizeTimer = 0;

    var state = {
        text: '加油',
        font: 'hei',
        color: '#fffa00',
        bg: '#0a0a0a',
        mode: 'scroll',
        size: 40,
        speed: 30
    };

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function clampNum(value, min, max, fallback) {
        var n = Number(value);
        if (!isFinite(n)) return fallback;
        return clamp(n, min, max);
    }

    function normalizeHex(value, fallback) {
        if (typeof value !== 'string') return fallback;
        var v = value.trim();
        if (/^#[0-9a-fA-F]{3}$/.test(v)) {
            v = '#' + v.charAt(1) + v.charAt(1) + v.charAt(2) + v.charAt(2) + v.charAt(3) + v.charAt(3);
        }
        if (!/^#[0-9a-fA-F]{6}$/.test(v)) return fallback;
        return v.toLowerCase();
    }

    function prefersReducedMotion() {
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch (e) {
            return false;
        }
    }

    function loadSaved() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    function applySaved(data) {
        state.text = typeof data.text === 'string' ? data.text : state.text;
        state.font = FONTS[data.font] ? data.font : state.font;
        state.color = normalizeHex(data.color, state.color);
        state.bg = normalizeHex(data.bg, state.bg);
        state.mode = data.mode === 'static' || data.mode === 'scroll' ? data.mode : state.mode;
        state.size = clampNum(data.size, 0, 100, state.size);
        state.speed = clampNum(data.speed, 0, 100, state.speed);
    }

    function persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
    }

    function oneLine(text) {
        return String(text || '').replace(/[\r\n]+/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
    }

    function channel(c) {
        var s = c / 255;
        return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    }

    function luminance(hex) {
        var h = normalizeHex(hex, '#000000');
        var r = parseInt(h.slice(1, 3), 16);
        var g = parseInt(h.slice(3, 5), 16);
        var b = parseInt(h.slice(5, 7), 16);
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }

    function contrastRatio(a, b) {
        var l1 = luminance(a);
        var l2 = luminance(b);
        var lighter = Math.max(l1, l2);
        var darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    // 字号用 vw，横屏手机更宽，字会更大；上限贴近屏高。
    function fontSizeCss(value) {
        var t = clampNum(value, 0, 100, 40) / 100;
        var vw = (12 + t * 168).toFixed(2);
        return 'min(' + vw + 'vw, 86svh)';
    }

    // 速度按像素/秒。路程含字宽，时长跟着变，长句不会因固定时长变慢。
    function pxPerSec(value) {
        return 40 + (clampNum(value, 0, 100, 30) / 100) * 220;
    }

    function setPressed(root, attr, value) {
        if (!root) return;
        var buttons = root.querySelectorAll('button');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute(attr) === value ? 'true' : 'false');
        }
    }

    function setControl(el, value) {
        if (el.value !== value) el.value = value;
    }

    function syncForm() {
        setControl(boardText, state.text);
        setControl(barText, oneLine(state.text));
        setControl(textColor, state.color);
        setControl(bgColor, state.bg);
        setControl(barTextColor, state.color);
        setControl(barBgColor, state.bg);
        setControl(size, String(state.size));
        setControl(barSize, String(state.size));
        setControl(speed, String(state.speed));
        setControl(barSpeed, String(state.speed));
        setControl(barFont, state.font);
        setPressed(document.getElementById('fontSeg'), 'data-font', state.font);
        setPressed(document.getElementById('modeSeg'), 'data-mode', state.mode);
        setPressed(document.getElementById('barModeSeg'), 'data-mode', state.mode);
        var scrolling = state.mode === 'scroll';
        speedField.hidden = !scrolling;
        barSpeedWrap.hidden = !scrolling;
        var low = contrastRatio(state.color, state.bg) < 3;
        contrastHint.hidden = !low;
        barContrast.hidden = !low;
    }

    function paintStage() {
        var scrolling = state.mode === 'scroll';
        stageLine.textContent = scrolling ? oneLine(state.text) : state.text;
        stageLine.style.fontFamily = FONTS[state.font] || FONTS.hei;
        stageLine.style.fontWeight = '800';
        stageLine.style.color = state.color;
        stageLine.style.fontSize = fontSizeCss(state.size);
        stage.style.backgroundColor = state.bg;
        document.body.style.setProperty('--lb-bg', state.bg);
        stageView.classList.toggle('is-scroll', scrolling);
        stageView.classList.toggle('is-static', !scrolling);
        stopScroll();
        var gen = ++paintGen;
        if (scrolling) {
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    if (gen !== paintGen) return;
                    startScroll();
                });
            });
        }
    }

    function stopScroll() {
        if (scrollAnim) {
            scrollAnim.cancel();
            scrollAnim = null;
        }
        stageLine.style.transform = '';
    }

    function startScroll() {
        if (!stageOpen || state.mode !== 'scroll') return;
        stopScroll();
        var textWidth = stageLine.offsetWidth;
        var viewWidth = stageView.clientWidth;
        var distance = textWidth + viewWidth;
        var speedPx = pxPerSec(state.speed);
        var duration = (distance / speedPx) * 1000;
        if (!isFinite(duration) || duration < 16) duration = 16;
        if (typeof stageLine.animate !== 'function') return;
        scrollAnim = stageLine.animate([
            { transform: 'translate3d(' + viewWidth + 'px,0,0)' },
            { transform: 'translate3d(' + (-textWidth) + 'px,0,0)' }
        ], {
            duration: duration,
            iterations: Infinity,
            easing: 'linear'
        });
        if (document.hidden) scrollAnim.pause();
    }

    function setInert(on) {
        var nodes = [pageHeader, setup, pageFooter];
        for (var i = 0; i < nodes.length; i++) {
            if (!nodes[i]) continue;
            if (on) nodes[i].setAttribute('inert', '');
            else nodes[i].removeAttribute('inert');
        }
    }

    function setTheme(color) {
        if (themeColor) themeColor.setAttribute('content', color);
    }

    function requestWake() {
        if (!navigator.wakeLock || typeof navigator.wakeLock.request !== 'function') return;
        var gen = ++wakeGen;
        navigator.wakeLock.request('screen').then(function (lock) {
            if (!stageOpen || gen !== wakeGen) {
                lock.release().catch(function () {});
                return;
            }
            wakeLock = lock;
        }).catch(function () {});
    }

    function releaseWake() {
        if (!wakeLock) return;
        var lock = wakeLock;
        wakeLock = null;
        lock.release().catch(function () {});
    }

    function requestFs() {
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) return;
        try {
            var result = req.call(el);
            if (result && typeof result.catch === 'function') result.catch(function () {});
        } catch (e) {}
    }

    function exitFs() {
        var exit = document.exitFullscreen || document.webkitExitFullscreen;
        var active = document.fullscreenElement || document.webkitFullscreenElement;
        if (!exit || !active) return;
        try {
            var result = exit.call(document);
            if (result && typeof result.catch === 'function') result.catch(function () {});
        } catch (e) {}
    }

    function setBar(open) {
        stageBar.hidden = !open;
        stage.classList.toggle('is-bar', open);
    }

    function openStage() {
        if (document.activeElement && document.activeElement.blur) {
            document.activeElement.blur();
        }
        stageOpen = true;
        stage.hidden = false;
        setBar(false);
        document.body.classList.add('lb-live');
        setInert(true);
        setTheme(state.bg);
        paintStage();
        requestWake();
        requestFs();
    }

    function closeStage() {
        stageOpen = false;
        stopScroll();
        setBar(false);
        stage.hidden = true;
        document.body.classList.remove('lb-live');
        document.body.style.removeProperty('--lb-bg');
        setInert(false);
        setTheme(THEME_REST);
        releaseWake();
        exitFs();
    }

    function commit(repaint) {
        syncForm();
        persist();
        if (repaint && stageOpen) paintStage();
    }

    var saved = loadSaved();
    if (saved) {
        applySaved(saved);
    } else if (prefersReducedMotion()) {
        state.mode = 'static';
    }
    syncForm();

    boardText.addEventListener('input', function () {
        state.text = boardText.value;
        commit(true);
    });

    barText.addEventListener('input', function () {
        state.text = barText.value;
        commit(true);
    });

    var chips = document.querySelectorAll('.lb-chip');
    for (var c = 0; c < chips.length; c++) {
        chips[c].addEventListener('click', function () {
            state.text = this.getAttribute('data-text') || '';
            commit(true);
        });
    }

    document.getElementById('fontSeg').addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var font = btn.getAttribute('data-font');
        if (!FONTS[font]) return;
        state.font = font;
        commit(true);
    });

    barFont.addEventListener('change', function () {
        if (!FONTS[barFont.value]) return;
        state.font = barFont.value;
        commit(true);
    });

    function onColor(which, value) {
        state[which] = normalizeHex(value, state[which]);
        commit(true);
    }

    textColor.addEventListener('input', function () { onColor('color', textColor.value); });
    barTextColor.addEventListener('input', function () { onColor('color', barTextColor.value); });
    bgColor.addEventListener('input', function () {
        onColor('bg', bgColor.value);
        if (stageOpen) setTheme(state.bg);
    });
    barBgColor.addEventListener('input', function () {
        onColor('bg', barBgColor.value);
        if (stageOpen) setTheme(state.bg);
    });

    function onModeClick(e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        var mode = btn.getAttribute('data-mode');
        if (mode !== 'scroll' && mode !== 'static') return;
        state.mode = mode;
        commit(true);
    }

    document.getElementById('modeSeg').addEventListener('click', onModeClick);
    document.getElementById('barModeSeg').addEventListener('click', onModeClick);

    function onSpeed(value) {
        state.speed = clampNum(value, 0, 100, state.speed);
        syncForm();
        persist();
        if (stageOpen && state.mode === 'scroll') startScroll();
    }

    function onSize(value) {
        state.size = clampNum(value, 0, 100, state.size);
        commit(true);
    }

    speed.addEventListener('input', function () { onSpeed(speed.value); });
    barSpeed.addEventListener('input', function () { onSpeed(barSpeed.value); });
    size.addEventListener('input', function () { onSize(size.value); });
    barSize.addEventListener('input', function () { onSize(barSize.value); });

    goBtn.addEventListener('click', function () {
        persist();
        openStage();
    });

    exitBtn.addEventListener('click', closeStage);

    stageView.addEventListener('click', function () {
        if (!stageOpen) return;
        setBar(stageBar.hidden);
    });

    document.addEventListener('visibilitychange', function () {
        if (!stageOpen) return;
        if (document.hidden) {
            if (scrollAnim) scrollAnim.pause();
            return;
        }
        if (state.mode === 'scroll' && scrollAnim) scrollAnim.play();
        requestWake();
    });

    window.addEventListener('resize', function () {
        if (!stageOpen || state.mode !== 'scroll') return;
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(startScroll, 80);
    });
});
