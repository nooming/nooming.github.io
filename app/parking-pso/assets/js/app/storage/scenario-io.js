(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/storage/scenario-io.js");

P.readCurrentState = function () {
    return P.currentStateStore?.readState ? P.currentStateStore.readState() : null;
  }

P.persistCurrentStateNow = function () {
    if (!P.scenario || !P.optimizer || typeof P.optimizer.normalizeScenario !== "function") return;
    const payload = {
      scenario: P.scenario,
      activeTab: P.activeTab,
      vehiclePage: P.vehiclePage,
      savedAt: Date.now(),
    };
    P.currentStateStore?.persistNow?.(payload);
  }

P.schedulePersistCurrentState = function () {
    P.currentStateStore?.schedule?.(() => ({
      scenario: P.scenario,
      activeTab: P.activeTab,
      vehiclePage: P.vehiclePage,
      savedAt: Date.now(),
    }));
  }

P.clearPersistedCurrentState = function () {
    P.currentStateStore?.clear?.();
  }

P.exportScenarioToFile = function () {
    if (!P.scenario) return;
    const payload = JSON.stringify(P.scenario, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "parking-scenario-" + ts + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

P.readSnapshots = function () {
    return P.snapshotStore?.readItems ? P.snapshotStore.readItems() : [];
  }

P.writeSnapshots = function (items) {
    if (!P.snapshotStore?.writeItems) return false;
    const result = P.snapshotStore.writeItems(items);
    if (result && typeof result === "object" && result.ok === false) {
      const status = document.getElementById("result-status");
      if (status) {
        status.textContent =
          "保存快照失败：本地存储空间不足或不可用，请清理浏览器存储后重试。";
      }
      return false;
    }
    return true;
  }

P.isSnapshotScenarioValid = function (candidate) {
    if (!candidate || typeof candidate !== "object") return false;
    const lot = candidate.lot;
    const lotW = Number(lot?.width);
    const lotH = Number(lot?.height);
    if (!Number.isFinite(lotW) || !Number.isFinite(lotH) || lotW <= 0 || lotH <= 0) return false;
    if (!Array.isArray(candidate.slots) || !Array.isArray(candidate.buildings)) return false;
    const nVeh = Number.parseInt(candidate.n_veh, 10);
    if (!Number.isFinite(nVeh) || nVeh < 0) return false;
    return true;
  }

P.refreshSnapshotSelect = function () {
    const sel = document.getElementById("snapshot-select");
    if (!sel) return;
    const items = P.readSnapshots();
    sel.innerHTML = "";
    if (!items.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "（暂无快照）";
      sel.appendChild(opt);
      return;
    }
    items.forEach((it) => {
      const opt = document.createElement("option");
      opt.value = String(it.id);
      opt.textContent = it.name;
      sel.appendChild(opt);
    });
  }

P.saveSnapshot = function () {
    if (!P.scenario) return;
    const items = P.readSnapshots();
    const id = Date.now();
    const name = new Date(id).toLocaleString();
    items.unshift({ id, name, scenario: JSON.parse(JSON.stringify(P.scenario)) });
    if (P.writeSnapshots(items)) {
      P.refreshSnapshotSelect();
    }
  }

P.loadSnapshot = function () {
    const sel = document.getElementById("snapshot-select");
    if (!sel || !sel.value) return;
    const items = P.readSnapshots();
    const hit = items.find((it) => String(it.id) === String(sel.value));
    if (!hit) return;
    if (!P.isSnapshotScenarioValid(hit.scenario)) {
      document.getElementById("result-status").textContent = "快照数据结构无效，无法加载。";
      return;
    }
    try {
      const normalized = P.optimizer.normalizeScenario(hit.scenario);
      if (!P.isSnapshotScenarioValid(normalized)) {
        throw new Error("normalized snapshot invalid");
      }
      P.scenario = normalized;
      P.ensureConstraints();
      P.ensureScenarioCollections();
      P.sanitizeScenarioGeometry();
      P.ensureVehicleDestinationsArray();
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.invalidateOptimizationResult();
      P.setSelection(null);
    } catch (error) {
      document.getElementById("result-status").textContent =
        "加载快照失败：数据损坏或与当前版本不兼容。";
      console.error(error);
    }
  }

P.importScenarioFromFile = async function (file) {
    if (!file) return;
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    P.scenario = P.optimizer.normalizeScenario(parsed);
    P.ensureConstraints();
    P.ensureScenarioCollections();
    P.sanitizeScenarioGeometry();
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    P.rebuildVehicleTargetsUI();
    P.nVehInput.value = P.scenario.n_veh ?? 12;
    P.invalidateOptimizationResult();
    P.setSelection(null);
  }

P.runBenchmark = function () {
    if (!P.scenario || !P.optimizer || !P.analysisTools?.runBenchmark) return;
    const out = document.getElementById("benchmark-output");
    const runsEl = document.getElementById("benchmark-runs");
    const seedEl = document.getElementById("pso-seed");
    const runs = P.normalizeBenchmarkRuns(runsEl?.value || "6");
    if (runsEl) runsEl.value = String(runs);
    const baseSeed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : 1;
    P.benchmarkResult = P.analysisTools.runBenchmark({
      scenario: P.scenario,
      optimizer: P.optimizer,
      normalizeOptimizeResult: P.normalizeOptimizeResult,
      runs,
      baseSeed,
      outputEl: out,
      timeUnit: P.uTime(),
    });
    if (out && runs >= P.MAX_BENCHMARK_RUNS) {
      out.textContent += "\n已触发上限：" + P.MAX_BENCHMARK_RUNS + " 次（防止页面卡顿）。";
    }
  }

P.recommendParams = function () {
    if (!P.scenario || !P.optimizer || !P.analysisTools?.recommendParams) return;
    const out = document.getElementById("recommend-output");
    const seedEl = document.getElementById("pso-seed");
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : 1;
    P.analysisTools.recommendParams({
      scenario: P.scenario,
      optimizer: P.optimizer,
      normalizeOptimizeResult: P.normalizeOptimizeResult,
      seed,
      outputEl: out,
      timeUnit: P.uTime(),
    });
  }
})();
