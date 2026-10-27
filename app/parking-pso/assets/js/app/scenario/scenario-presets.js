(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/scenario-presets.js");

  const MANIFEST_URL = "assets/data/scenario-presets.json";

  P.scenarioPresets = P.scenarioPresets || [];

  P.loadScenarioPresetsManifest = async function () {
    if (P.scenarioPresets.length) return P.scenarioPresets;
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      P.scenarioPresets = Array.isArray(data.presets) ? data.presets : [];
    } catch (e) {
      console.warn("scenario presets manifest failed", e);
      P.scenarioPresets = [
        {
          id: "default",
          label: "默认 · 双入口均衡",
          file: "default-scenario.json",
          hint: "",
        },
      ];
    }
    return P.scenarioPresets;
  };

  P.fetchScenarioPresetJson = async function (preset) {
    const file = preset?.file || "default-scenario.json";
    const url =
      file.indexOf("/") >= 0 || file.indexOf("\\") >= 0
        ? "assets/data/" + file.replace(/^\//, "")
        : "assets/data/" + file;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  };

  P.applyScenarioFromSource = function (sourceScenario) {
    if (!P.optimizer?.normalizeScenario) throw new Error("optimizer missing");
    P.scenario = P.optimizer.normalizeScenario(sourceScenario);
    P.ensureConstraints();
    P.ensureScenarioCollections();
    P.syncMapCanvasSize();
    P.sanitizeScenarioGeometry();
    P.fitViewToContent?.(12);
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    P.rebuildVehicleTargetsUI();
    P.lastResult = null;
    P.autoEntrancePreview = null;
    P.arrivalCompare = null;
    P.hideArrivalCompareSection?.();
    P.simState.timeline = null;
    P._simulationRan = false;
    P.resetSimStepSession?.();
    P.schedulePrecomputeWarmup?.();
    if (P.nVehInput) P.nVehInput.value = P.scenario.n_veh ?? 12;
    P.setSelection(null);
    const rs = document.getElementById("result-status");
    if (rs) rs.textContent = "尚未运行（总时间单位：" + P.uTime() + "）";
    const rg = document.getElementById("result-gbest");
    if (rg) rg.style.display = "none";
    P.drawChart([]);
    P.updateChartCaption("idle");
    P.renderBreakdownSummary();
    P.renderResultTip("");
    P.roadDraftClosed = P.scenario?.road?.closed !== false;
    const roadShapeMode = document.getElementById("road-shape-mode");
    if (roadShapeMode) roadShapeMode.value = P.roadDraftClosed ? "closed" : "open";
    P.scheduleAutoEntrancePreviewRefresh();
    P.schedulePersistCurrentState();
    P.syncLotInputsFromScenario?.();
    P.updateActionGates?.();
    P.updateRunBarSummary?.();
    P.syncPsoLabInputsFromScenario?.();
    P.clearWorkspaceMessage?.();
    P.draw();
    P.updateWorkflowGuide?.();
  };

  P.applyScenarioPreset = async function (presetId) {
    await P.loadScenarioPresetsManifest();
    const preset = P.scenarioPresets.find((p) => p.id === presetId);
    if (!preset) throw new Error("未知预设");
    const raw = await P.fetchScenarioPresetJson(preset);
    P.applyScenarioFromSource(raw);
    P.activeScenarioPresetId = presetId;
    const hintEl = document.getElementById("scenario-preset-hint");
    if (hintEl) hintEl.textContent = preset.hint || "";
    P.showWorkspaceMessage?.("已加载预设：「" + preset.label + "」", {
      level: "info",
      alsoResult: false,
    });
  };

  P.confirmAndApplyScenarioPreset = async function (presetId) {
    const ok = window.confirm("加载预设将覆盖当前未导出的场景编辑，是否继续？");
    if (!ok) return false;
    try {
      await P.applyScenarioPreset(presetId);
      return true;
    } catch (e) {
      console.warn("apply preset failed", e);
      P.showWorkspaceMessage?.("预设加载失败：" + (e.message || e), {
        level: "error",
        alsoResult: false,
      });
      return false;
    }
  };

  P.initScenarioPresetsUI = async function () {
    const select = document.getElementById("scenario-preset-select");
    if (!select) return;
    const presets = await P.loadScenarioPresetsManifest();
    select.innerHTML = "";
    for (const p of presets) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.label;
      select.appendChild(opt);
    }
    const active = P.activeScenarioPresetId || "default";
    if (presets.some((p) => p.id === active)) select.value = active;
    const hintEl = document.getElementById("scenario-preset-hint");
    const syncHint = () => {
      const p = presets.find((x) => x.id === select.value);
      if (hintEl) hintEl.textContent = p?.hint || "";
    };
    syncHint();
    let applying = false;
    select.addEventListener("change", async () => {
      syncHint();
      if (applying) return;
      applying = true;
      const prev = P.activeScenarioPresetId || "default";
      const id = select.value;
      const ok = await P.confirmAndApplyScenarioPreset(id);
      if (!ok && presets.some((p) => p.id === prev)) select.value = prev;
      syncHint();
      applying = false;
    });
  };
})();
