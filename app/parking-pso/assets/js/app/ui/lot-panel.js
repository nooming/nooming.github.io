(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/lot-panel.js");

  const MIN_LOT_DIM = 40;

  P.applyLotDimensions = function (w, h) {
    if (!P.scenario?.lot) return false;
    const nw = Math.round(Number(w) * 10) / 10;
    const nh = Math.round(Number(h) * 10) / 10;
    if (!Number.isFinite(nw) || !Number.isFinite(nh)) return false;
    if (nw < MIN_LOT_DIM || nh < MIN_LOT_DIM) return false;
    if (nw > P.MAX_LOT_SPAN || nh > P.MAX_LOT_SPAN) return false;
    P.ensureLotOrigin();
    P.scenario.lot.width = nw;
    P.scenario.lot.height = nh;
    P.invalidateOptimizationResult();
    P.persistCurrentStateNow?.();
    P.draw();
    return true;
  };

  P.syncLotInputsFromScenario = function () {
    const wEl = document.getElementById("lot-width");
    const hEl = document.getElementById("lot-height");
    if (!wEl || !hEl || !P.scenario?.lot) return;
    wEl.value = String(P.lotW());
    hEl.value = String(P.lotH());
  };

  P.bindLotPanel = function () {
    const wEl = document.getElementById("lot-width");
    const hEl = document.getElementById("lot-height");
    if (!wEl || !hEl) return;

    const onChange = () => {
      const ok = P.applyLotDimensions(
        parseFloat(wEl.value),
        parseFloat(hEl.value)
      );
      P.syncLotInputsFromScenario();
      if (!ok) {
        P.showWorkspaceMessage?.(
          "地块尺寸无效（" + MIN_LOT_DIM + "–" + P.MAX_LOT_SPAN + " " + P.uLen() + "）。",
          { level: "error" }
        );
      }
    };

    wEl.addEventListener("change", onChange);
    hEl.addEventListener("change", onChange);
  };
})();
