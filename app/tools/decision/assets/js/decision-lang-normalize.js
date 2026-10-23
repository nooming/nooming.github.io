/**
 * spin.min.js / coin.min.js 仅识别 "zh" | "en" | "es"，与 html lang="zh-CN" 等不兼容。
 * 须在上述脚本之前同步执行。
 */
(function () {
    var el = document.documentElement;
    var raw = (el.getAttribute("lang") || "en").toLowerCase();
    if (raw.indexOf("zh") === 0) {
        el.setAttribute("lang", "zh");
    } else if (raw.indexOf("es") === 0) {
        el.setAttribute("lang", "es");
    } else if (raw.indexOf("en") === 0) {
        el.setAttribute("lang", "en");
    } else {
        el.setAttribute("lang", "en");
    }
})();
