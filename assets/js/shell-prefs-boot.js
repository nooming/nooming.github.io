/**
 * 同步应用已存主题，减少深色模式首屏闪烁。须在 head 内阻塞加载。
 */
(function () {
    var THEME_KEY = "noomings_theme";
    var GOMOKU_KEY = "gomoku.standalone.v1";
    var theme = "light";
    try {
        var stored = localStorage.getItem(THEME_KEY);
        if (stored === "dark" || stored === "light") {
            theme = stored;
        } else {
            var raw = localStorage.getItem(GOMOKU_KEY);
            if (raw) {
                var data = JSON.parse(raw);
                if (data && data.theme === "dark") theme = "dark";
            }
        }
    } catch (e) {
        theme = "light";
    }
    document.documentElement.dataset.theme = theme;
})();
