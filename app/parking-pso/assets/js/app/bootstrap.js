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
      P.syncDeleteButton?.();
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
  P.mapCanvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const { sx, sy } = P.eventToScreen(e);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      P.zoomAtScreen(sx, sy, factor);
    },
    { passive: false }
  );
  P.mapCanvas.addEventListener("dblclick", (e) => {
    if (!P.scenario || P.pendingAdd) return;
    const { wx, wy } = P.eventToWorld(e);
    if (!P.pickAt(wx, wy)) P.fitViewToLot();
  });
  P.mapCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.getElementById("btn-fit-lot-view")?.addEventListener("click", () => P.fitViewToLot?.());
  document.getElementById("btn-fit-content-view")?.addEventListener("click", () => P.fitViewToContent?.());

  P.wireAddModeToggle("btn-add-building", "building");
  P.wireAddModeToggle("btn-add-slot", "slot");
  P.wireAddModeToggle("btn-add-entrance", "entrance");
  P.wireAddModeToggle("btn-add-obstacle", "obstacle");
  P.wireAddModeToggle("btn-add-road", "road");
  document.getElementById("btn-delete").addEventListener("click", P.deleteSelected);
  document.getElementById("btn-random-dest").addEventListener("click", P.randomizeVehicleDestinations);
  document.getElementById("btn-reset-scenario")?.addEventListener("click", P.resetScenario);
  document.getElementById("btn-export-scenario")?.addEventListener("click", P.exportScenarioToFile);
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
      P.showWorkspaceMessage?.("导入场景失败，请检查 JSON 格式。", { level: "error" });
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
        P.syncDeleteButton?.();
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
        P.syncDeleteButton?.();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        P.finalizeRoadDraft();
        return;
      }
    }
    if (e.key === "Escape" && P.pendingAdd) {
      e.preventDefault();
      P.clearPendingAddMode?.();
      P.syncDeleteButton?.();
      return;
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
    P.ensureVehicleArrivalSecArray?.();
    P.rebuildVehicleTargetsUI();
    P.renderSimVehicleQueue?.();
    P.invalidateOptimizationResult();
    P.scheduleAutoEntrancePreviewRefresh?.();
    P.updateRunBarSummary?.();
    P.updateActionGates?.();
  });


  window.addEventListener("resize", () => {
    clearTimeout(P.resizeChartTimer);
    P.resizeChartTimer = setTimeout(() => {
      P.syncMapCanvasSize();
      P.syncChartCanvasSize();
      P.syncCompareRadarSize?.();
      P.syncSimQueueChartSize?.();
      if (P.scenario) P.draw();
      P.drawChart(P.lastChartSeries, P.lastChartOptimizer);
      P.redrawAuxCharts?.();
    }, 80);
  });

  P.wireWorkflowGuide?.();

  document.getElementById("btn-auto-slots")?.addEventListener("click", () => P.runAutoSlots?.());
  document.getElementById("sim-arrival-mode")?.addEventListener("change", () => {
    P.syncSimArrivalFields?.();
  });
  document.getElementById("sim-step-prev")?.addEventListener("click", () => P.goSimStepVehicle?.(-1));
  document.getElementById("sim-step-next")?.addEventListener("click", () => P.goSimStepVehicle?.(1));
  document.getElementById("sim-step-run-mode")?.addEventListener("change", () => P.syncSimStepRunModeDesc?.());
  document.getElementById("veh-arrival-mode")?.addEventListener("change", () => {
    P.rebuildVehicleTargetsUI?.();
  });
  document.getElementById("btn-run-sim")?.addEventListener("click", () => P.runSimulation?.());
  document.getElementById("btn-run-arrival-compare")?.addEventListener("click", () =>
    P.runArrivalCompare?.()
  );
  document.getElementById("btn-monte-carlo")?.addEventListener("click", () =>
    P.runMonteCarloRolling?.()
  );
  document.getElementById("arrival-compare-export")?.addEventListener("click", () =>
    P.exportArrivalCompareJson?.()
  );
  document.getElementById("btn-sim-play")?.addEventListener("click", () => P.toggleSimPlay?.());
  document.getElementById("sim-scrub")?.addEventListener("input", (e) => {
    P.simState.frameIndex = parseInt(e.target.value, 10) || 0;
    P.updateSimTimeLabel?.();
    P.updateSimStats?.();
    P.updateSimLiveStatus?.();
    P.draw();
  });

  (async function initPlansAndApi() {
    await P.refreshApiStatus?.();
    P.schedulePrecomputeWarmup?.();
    P.updateWorkflowGuide?.();
    await P.initScenarioPresetsUI?.();
  })();

  P.bindLotPanel?.();

  P.loadDefault();
  P.syncSimModeHint?.();
  P.syncSimArrivalFields?.();
  P.updateWorkflowGuide?.();
  P.syncDeleteButton?.();
  P.updateRunBarSummary?.();
  P.updateActionGates?.();
})();
