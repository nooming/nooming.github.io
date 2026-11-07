/**
 * 全站偏好：深色主题 + 声音开关（localStorage + 顶栏 UI）
 */
(function () {
    var THEME_KEY = "noomings_theme";
    var SOUND_KEY = "noomings_sound";
    var GOMOKU_KEY = "gomoku.standalone.v1";

    var themeMigrated = false;
    var soundMigrated = false;

    function readGomokuField(field) {
        try {
            var raw = localStorage.getItem(GOMOKU_KEY);
            if (!raw) return undefined;
            var data = JSON.parse(raw);
            if (!data || data.v !== 1) return undefined;
            return data[field];
        } catch (e) {
            return undefined;
        }
    }

    function getTheme() {
        try {
            var stored = localStorage.getItem(THEME_KEY);
            if (stored === "dark" || stored === "light") return stored;
        } catch (e) {
            /* ignore */
        }
        if (!themeMigrated) {
            themeMigrated = true;
            var legacy = readGomokuField("theme");
            if (legacy === "dark" || legacy === "light") {
                setTheme(legacy, { silent: true });
                return legacy;
            }
        }
        return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    }

    function getSound() {
        try {
            var stored = localStorage.getItem(SOUND_KEY);
            if (stored === "0" || stored === "false") return false;
            if (stored === "1" || stored === "true") return true;
        } catch (e) {
            /* ignore */
        }
        if (!soundMigrated) {
            soundMigrated = true;
            var legacy = readGomokuField("sound");
            if (legacy === true || legacy === false) {
                setSound(legacy, { silent: true });
                return legacy;
            }
        }
        return true;
    }

    function updateMetaThemeColor(theme) {
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute("content", theme === "dark" ? "#0d0d0b" : "#FFFA00");
        }
    }

    function emit() {
        document.documentElement.dispatchEvent(
            new CustomEvent("noomings:prefs", {
                bubbles: false,
                detail: {
                    theme: getTheme(),
                    sound: getSound(),
                },
            })
        );
    }

    function applyTheme(theme) {
        var t = theme === "dark" ? "dark" : "light";
        document.documentElement.dataset.theme = t;
        document.documentElement.style.colorScheme = t;
        updateMetaThemeColor(t);
    }

    function syncUi() {
        var soundBtn = document.getElementById("shellSoundToggle");
        var themeBtn = document.getElementById("shellThemeToggle");
        var sound = getSound();
        var theme = getTheme();
        if (soundBtn) {
            soundBtn.setAttribute("aria-pressed", String(sound));
            soundBtn.setAttribute(
                "aria-label",
                sound ? "关闭声音" : "开启声音"
            );
            soundBtn.title = sound ? "声音（S）" : "声音已关（S）";
        }
        if (themeBtn) {
            var dark = theme === "dark";
            themeBtn.setAttribute("aria-pressed", String(dark));
            themeBtn.setAttribute(
                "aria-label",
                dark ? "切换浅色模式" : "切换深色模式"
            );
            themeBtn.title = dark ? "浅色模式（D）" : "深色模式（D）";
        }
    }

    function setTheme(theme, options) {
        var opts = options || {};
        var t = theme === "dark" ? "dark" : "light";
        try {
            localStorage.setItem(THEME_KEY, t);
        } catch (e) {
            /* ignore */
        }
        applyTheme(t);
        syncUi();
        if (!opts.silent) emit();
        return t;
    }

    function toggleTheme() {
        return setTheme(getTheme() === "dark" ? "light" : "dark");
    }

    function setSound(on, options) {
        var opts = options || {};
        var val = !!on;
        try {
            localStorage.setItem(SOUND_KEY, val ? "1" : "0");
        } catch (e) {
            /* ignore */
        }
        syncUi();
        if (!opts.silent) emit();
        return val;
    }

    function toggleSound() {
        return setSound(!getSound());
    }

    function wireTopBar() {
        var soundBtn = document.getElementById("shellSoundToggle");
        var themeBtn = document.getElementById("shellThemeToggle");
        if (soundBtn) {
            soundBtn.addEventListener("click", function () {
                toggleSound();
            });
        }
        if (themeBtn) {
            themeBtn.addEventListener("click", function () {
                toggleTheme();
            });
        }
        applyTheme(getTheme());
        syncUi();
    }

    window.noomingsPrefs = {
        getTheme: getTheme,
        setTheme: setTheme,
        toggleTheme: toggleTheme,
        getSound: getSound,
        setSound: setSound,
        toggleSound: toggleSound,
        applyTheme: applyTheme,
        syncUi: syncUi,
        wireTopBar: wireTopBar,
    };
})();
