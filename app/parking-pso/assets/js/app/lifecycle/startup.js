(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/lifecycle/startup.js");

  P.getDefaultScenarioSource = async function () {
    if (!P.scenarioSource?.getDefaultScenarioSource) {
      return P.optimizer.defaultScenario();
    }
    return P.scenarioSource.getDefaultScenarioSource(() => P.optimizer.defaultScenario());
  };

  P.loadDefault = async function (options = {}) {
    try {
      if (!P.optimizer || typeof P.optimizer.normalizeScenario !== "function") {
        throw new Error("optimizer module missing");
      }
      const forceDefault = options.forceDefault === true;
      let sourceScenario = null;
      let restored = false;
      if (!forceDefault) {
        const cached = P.readCurrentState();
        if (cached && cached.scenario) {
          sourceScenario = cached.scenario;
          restored = true;
          P.activeTab = String(cached.activeTab || "overview");
          P.vehiclePage = Number.isFinite(Number(cached.vehiclePage))
            ? Math.max(0, parseInt(cached.vehiclePage, 10))
            : 0;
        }
      }
      if (!sourceScenario) {
        sourceScenario = await P.getDefaultScenarioSource();
        P.activeTab = "overview";
        P.vehiclePage = 0;
      }
      P.scenario = P.optimizer.normalizeScenario(sourceScenario);
      P.ensureConstraints();
      P.ensureScenarioCollections();
      P.syncMapCanvasSize();
      P.fitLotToMapAspect();
      P.sanitizeScenarioGeometry();
      P.ensureVehicleDestinationsArray();
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.lastResult = null;
      P.autoEntrancePreview = null;
      P.nVehInput.value = P.scenario.n_veh ?? 12;
      P.setSelection(null);
      document.getElementById("result-status").textContent =
        "尚未运行（总时间单位：" + P.uTime() + "）";
      document.getElementById("result-gbest").style.display = "none";
      P.drawChart([]);
      P.updateChartCaption("idle");
      P.refreshSnapshotSelect();
      P.renderBreakdownSummary();
      P.renderResultTip("");
      const legend = document.querySelector(".map-legend");
      const legendBtn = document.getElementById("btn-legend-toggle");
      const roadShapeMode = document.getElementById("road-shape-mode");
      if (legend) legend.classList.add("is-compact");
      if (legendBtn) legendBtn.textContent = "展开完整图例";
      P.roadDraftClosed = P.scenario?.road?.closed !== false;
      if (roadShapeMode) roadShapeMode.value = P.roadDraftClosed ? "closed" : "open";
      P.switchTab(restored ? P.activeTab : "overview");
      P.scheduleAutoEntrancePreviewRefresh();
      P.schedulePersistCurrentState();
      P.draw();
    } catch (e) {
      document.getElementById("result-status").textContent =
        "默认场景加载失败，请检查 assets/data/default-scenario.json 或 optimizer 模块是否可访问。";
      console.error(e);
    }
  };

  P.resetScenario = async function () {
    const ok = window.confirm("确定重置为默认场景吗？当前未导出的改动将丢失。");
    if (!ok) return;
    P.clearPersistedCurrentState();
    await P.loadDefault({ forceDefault: true });
  };
})();
