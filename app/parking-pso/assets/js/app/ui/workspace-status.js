(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/workspace-status.js");

  P.showWorkspaceMessage = function (text, options) {
    const opts = options || {};
    const level = opts.level === "error" || opts.level === "warn" ? opts.level : "info";
    const alsoResult = opts.alsoResult !== false;
    const el = document.getElementById("workspace-status");
    if (el) {
      const msg = String(text || "").trim();
      if (msg) {
        el.textContent = msg;
        el.hidden = false;
        el.className =
          "workspace-status workspace-status--message workspace-status--" + level;
      } else {
        P.clearWorkspaceMessage();
      }
    }
    if (alsoResult) {
      const resultEl = document.getElementById("result-status");
      if (resultEl && text) resultEl.textContent = String(text);
    }
  };

  P.clearWorkspaceMessage = function () {
    const el = document.getElementById("workspace-status");
    if (el) {
      el.textContent = "";
      el.hidden = true;
      el.className = "workspace-status workspace-status--message";
    }
  };

  P.updateRunBarSummary = function () {
    const el = document.getElementById("run-bar-summary");
    if (!el) return;
    const nVehEl = document.getElementById("n-veh");
    const methodEl = document.getElementById("optimizer-method");
    const n = nVehEl && nVehEl.value !== "" ? parseInt(nVehEl.value, 10) : P.scenario?.n_veh;
    const method = methodEl?.value === "pso" ? "pso" : "exact";
    const nSafe = Number.isFinite(n) && n > 0 ? n : "--";
    el.textContent = nSafe + " 辆 · " + method;
  };

  P.syncDeleteButton = function () {
    const btn = document.getElementById("btn-delete");
    if (!btn) return;
    btn.disabled = !P.selection;
  };

  P.clearPendingAddMode = function () {
    if (P.pendingAdd === "obstacle") P.cancelObstacleDraft?.();
    if (P.pendingAdd === "road") P.cancelRoadDraft?.();
    P.pendingAdd = null;
    document.getElementById("btn-add-building")?.classList.remove("active");
    document.getElementById("btn-add-slot")?.classList.remove("active");
    document.getElementById("btn-add-entrance")?.classList.remove("active");
    document.getElementById("btn-add-obstacle")?.classList.remove("active");
    document.getElementById("btn-add-road")?.classList.remove("active");
    P.draw();
  };
})();
