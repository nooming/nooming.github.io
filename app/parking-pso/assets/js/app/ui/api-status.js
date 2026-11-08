(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/api-status.js");

  P.apiOnline = false;

  const STATUS_STATES = ["api-status--pending", "api-status--online", "api-status--offline"];
  const MOBILE_QUERY = "(max-width: 600px)";
  let lastText = "检查 API…";
  let lastState = "pending";

  function isMobile() {
    return typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
  }

  function compactText(text) {
    if (!text) return text;
    if (text.indexOf("检查") === 0) return "检查中";
    if (text.indexOf("离线") === 0) return "离线";
    if (text === "在线") return "在线";
    return text;
  }

  function applyApiStatusUi(el, text, state) {
    if (!el) return;
    lastText = text;
    lastState = state;
    const label = el.querySelector(".app-topbar__status-label");
    const shown = isMobile() ? compactText(text) : text;
    if (label) label.textContent = shown;
    else el.textContent = shown;
    el.title = text;
    el.classList.remove(...STATUS_STATES);
    el.classList.add("api-status--" + state);
  }

  function repaintApiStatus() {
    const el = document.getElementById("api-status");
    if (el) applyApiStatusUi(el, lastText, lastState);
  }

  if (typeof window.matchMedia === "function") {
    const mq = window.matchMedia(MOBILE_QUERY);
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", repaintApiStatus);
    else if (typeof mq.addListener === "function") mq.addListener(repaintApiStatus);
  }

  P.refreshApiStatus = async function () {
    const el = document.getElementById("api-status");
    applyApiStatusUi(el, "检查 API…", "pending");
    if (!P.api?.health) {
      P.apiOnline = false;
      applyApiStatusUi(el, "离线 · 本地", "offline");
      return false;
    }
    try {
      const res = await P.api.health();
      P.apiOnline = !!(res && res.ok);
      if (P.apiOnline) {
        applyApiStatusUi(el, "在线", "online");
      } else {
        applyApiStatusUi(el, "离线 · 本地", "offline");
      }
      return P.apiOnline;
    } catch (_) {
      P.apiOnline = false;
      const base = P.api.apiBase();
      applyApiStatusUi(
        el,
        base ? "离线 · " + base.replace(/^https?:\/\//, "") : "离线 · 未配置 API",
        "offline"
      );
      return false;
    }
  };
})();
