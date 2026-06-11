(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/bootstrap.js");

  P.wireAddModeToggle = function (btnId, mode) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (P.pendingAdd === "obstacle" && mode !== "obstacle") P.cancelObstacleDraft();
      if (P.pendingAdd === "road" && mode !== "road") P.cancelRoadDraft();
      P.pendingAdd = P.pendingAdd === mode ? null : mode;
      if (P.pendingAdd !== "obstacle") P.cancelObstacleDraft();
      if (P.pendingAdd !== "road") P.cancelRoadDraft();
      if (P.pendingAdd === "road") {
        const shapeSel = document.getElementById("road-shape-mode");
        P.roadDraftClosed = shapeSel
          ? shapeSel.value !== "open"
          : P.scenario?.road?.closed !== false;
      }
      document.getElementById("btn-add-building").classList.toggle("active", P.pendingAdd === "building");
      document.getElementById("btn-add-slot").classList.toggle("active", P.pendingAdd === "slot");
      const addEnt = document.getElementById("btn-add-entrance");
      const addObs = document.getElementById("btn-add-obstacle");
      const addRoad = document.getElementById("btn-add-road");
      if (addEnt) addEnt.classList.toggle("active", P.pendingAdd === "entrance");
      if (addObs) addObs.classList.toggle("active", P.pendingAdd === "obstacle");
      if (addRoad) addRoad.classList.toggle("active", P.pendingAdd === "road");
      P.draw();
    });
  };

  P.mapCanvas.addEventListener("pointerdown", (e) => {
    P.mapCanvas.setPointerCapture(e.pointerId);
    P.pointerDown(e);
  });
  P.mapCanvas.addEventListener("pointermove", P.pointerMove);
  P.mapCanvas.addEventListener("pointerup", P.pointerUp);
  P.mapCanvas.addEventListener("pointercancel", P.pointerUp);
  P.mapCanvas.addEventListener("pointerleave", () => {
    if (P.hoverTarget) {
      P.hoverTarget = null;
      P.draw();
    }
  });

  P.wireAddModeToggle("btn-add-building", "building");
  P.wireAddModeToggle("btn-add-slot", "slot");
  P.wireAddModeToggle("btn-add-entrance", "entrance");
  P.wireAddModeToggle("btn-add-obstacle", "obstacle");
  P.wireAddModeToggle("btn-add-road", "road");
  document.getElementById("btn-delete").addEventListener("click", P.deleteSelected);
  document.getElementById("btn-random-dest").addEventListener("click", P.randomizeVehicleDestinations);
  document.getElementById("btn-reset-scenario")?.addEventListener("click", P.resetScenario);
  document.getElementById("btn-run").addEventListener("click", P.runOptimize);
  document.getElementById("btn-export-scenario")?.addEventListener("click", P.exportScenarioToFile);
  document.getElementById("btn-save-snapshot")?.addEventListener("click", P.saveSnapshot);
  document.getElementById("btn-load-snapshot")?.addEventListener("click", P.loadSnapshot);
  document.getElementById("btn-run-benchmark")?.addEventListener("click", P.runBenchmark);
  document.getElementById("btn-recommend-params")?.addEventListener("click", P.recommendParams);
  document.querySelectorAll(".side-tab").forEach((btn) => {
    btn.addEventListener("click", () => P.switchTab(btn.dataset.tab));
  });
  document.getElementById("btn-veh-page-prev")?.addEventListener("click", () => {
    P.vehiclePage = Math.max(0, P.vehiclePage - 1);
    P.rebuildVehicleTargetsUI();
  });
  document.getElementById("btn-veh-page-next")?.addEventListener("click", () => {
    P.vehiclePage += 1;
    P.rebuildVehicleTargetsUI();
  });
  document.getElementById("btn-legend-toggle")?.addEventListener("click", (e) => {
    const legend = document.querySelector(".map-legend");
    if (!legend) return;
    const compact = legend.classList.toggle("is-compact");
    e.target.textContent = compact ? "展开完整图例" : "收起扩展图例";
  });
  document.getElementById("btn-add-entrance")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("btn-add-obstacle")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("btn-add-road")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("road-shape-mode")?.addEventListener("change", (e) => {
    P.roadDraftClosed = e.target.value !== "open";
  });
  document.getElementById("btn-add-building")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("btn-add-slot")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("entrance-mode")?.addEventListener("change", (e) => {
    P.scenario.entrance_mode = e.target.value === "fixed" ? "fixed" : "auto";
    P.rebuildVehicleTargetsUI();
    P.invalidateOptimizationResult();
  });
  document.getElementById("btn-import-scenario")?.addEventListener("click", () => P.importInput?.click());
  P.importInput?.addEventListener("change", async () => {
    try {
      if (P.importInput.files && P.importInput.files[0]) {
        await P.importScenarioFromFile(P.importInput.files[0]);
      }
    } catch (e) {
      console.error(e);
      document.getElementById("result-status").textContent = "导入场景失败，请检查 JSON 格式。";
    } finally {
      P.importInput.value = "";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (P.pendingAdd === "obstacle" && P.obstacleDraftPoints?.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        P.cancelObstacleDraft();
        P.pendingAdd = null;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        P.finalizeObstacleDraft();
        return;
      }
    }
    if (P.pendingAdd === "road" && P.roadDraftPoints?.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        P.cancelRoadDraft();
        P.pendingAdd = null;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        P.finalizeRoadDraft();
        return;
      }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (document.activeElement?.tagName === "INPUT") return;
      P.deleteSelected();
    }
  });
  window.addEventListener("beforeunload", () => P.persistCurrentStateNow());

  P.nVehInput?.addEventListener("change", () => {
    if (!P.scenario) return;
    let n = parseInt(P.nVehInput.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    P.scenario.n_veh = n;
    P.vehiclePage = 0;
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    P.rebuildVehicleTargetsUI();
    P.invalidateOptimizationResult();
  });

  window.addEventListener("resize", () => {
    clearTimeout(P.resizeChartTimer);
    P.resizeChartTimer = setTimeout(() => {
      P.syncMapCanvasSize();
      P.syncChartCanvasSize();
      if (P.scenario) P.draw();
      P.drawChart(P.lastChartSeries, P.lastChartOptimizer);
    }, 80);
  });

  P.loadDefault();
})();
