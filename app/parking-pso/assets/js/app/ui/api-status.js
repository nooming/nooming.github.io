(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/api-status.js");

  P.apiOnline = false;

  const STATUS_STATES = ["api-status--pending", "api-status--online", "api-status--offline"];

  function applyApiStatusUi(el, text, state) {
    if (!el) return;
    const label = el.querySelector(".app-topbar__status-label");
    if (label) label.textContent = text;
    else el.textContent = text;
    el.classList.remove(...STATUS_STATES);
    el.classList.add("api-status--" + state);
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
