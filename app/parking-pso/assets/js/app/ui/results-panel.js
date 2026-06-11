(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/results-panel.js");

P.normalizeOptimizeResult = function (raw, method, fallbackScenario) {
    const fallback = {
      scenario: fallbackScenario,
      gbest_value: null,
      history_best: [],
      assign: [],
      veh_targets: [],
      veh_entrances: [],
      vehicle_breakdown: [],
      paths: [],
      road_segments: [],
      optimizer: method || "exact",
      error: "优化结果结构无效",
    };
    if (!raw || typeof raw !== "object") return fallback;
    const out = {};
    for (const key of P.RESULT_KEYS) {
      out[key] = raw[key];
    }
    out.error = typeof raw.error === "string" ? raw.error : null;
    out.optimizer = out.optimizer === "pso" ? "pso" : "exact";
    out.scenario = out.scenario && typeof out.scenario === "object" ? out.scenario : fallbackScenario;
    out.gbest_value = Number.isFinite(Number(out.gbest_value))
      ? Number(out.gbest_value)
      : null;
    out.history_best = Array.isArray(out.history_best)
      ? out.history_best.map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [];
    out.assign = Array.isArray(out.assign)
      ? out.assign.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [];
    out.veh_targets = Array.isArray(out.veh_targets)
      ? out.veh_targets.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [];
    out.veh_entrances = Array.isArray(raw.veh_entrances)
      ? raw.veh_entrances.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [];
    out.vehicle_breakdown = Array.isArray(raw.vehicle_breakdown) ? raw.vehicle_breakdown : [];
    out.paths = Array.isArray(out.paths) ? out.paths : [];
    out.road_segments = Array.isArray(out.road_segments) ? out.road_segments : [];
    return out;
  }

  /**
   * 俯视配色参考公开资料（非贴图）：沥青/路面 #36454F 系、铺装混凝土 #d1d8dc 系、
   * 热熔泊位线黄、混凝土屋面、绿地渐变。可选无缝贴图可自行换用 CC0：
   * https://cc0-textures.com/ （如 Asphalt 010）等，本实现零外链以离线可用。
   */
P.renderBreakdownSummary = function () {
    const el = document.getElementById("result-breakdown");
    const driveEl = document.getElementById("metric-drive");
    const walkEl = document.getElementById("metric-walk");
    const totalEl = document.getElementById("metric-total");

    if (driveEl) driveEl.textContent = "--";
    if (walkEl) walkEl.textContent = "--";
    if (totalEl) totalEl.textContent = "--";
    if (el) el.textContent = "";

    const items = P.lastResult?.vehicle_breakdown;
    if (!Array.isArray(items) || !items.length) return;

    const totals = items.reduce(
      (acc, it) => {
        acc.drive += Number(it.drive_time || 0);
        acc.walk += Number(it.walk_time || 0);
        acc.penalty += Number(it.penalty || 0);
        return acc;
      },
      { drive: 0, walk: 0, penalty: 0 }
    );

    if (driveEl) driveEl.textContent = totals.drive.toFixed(1);
    if (walkEl) walkEl.textContent = totals.walk.toFixed(1);
    if (totalEl) totalEl.textContent = (totals.drive + totals.walk + totals.penalty).toFixed(1);

    if (el && totals.penalty > 0) {
      el.textContent = "含约束罚分 " + totals.penalty.toFixed(2) + " " + P.uTime();
    }
  }

P.renderResultTip = function (text) {
    const el = document.getElementById("result-tip");
    if (!el) return;
    el.textContent = text || "";
  }

P.normalizeBenchmarkRuns = function (rawRuns) {
    if (P.analysisTools?.normalizeRuns) return P.analysisTools.normalizeRuns(rawRuns);
    const parsed = Number.parseInt(rawRuns, 10);
    const safeRuns = Number.isFinite(parsed) ? parsed : 6;
    return Math.max(1, Math.min(P.MAX_BENCHMARK_RUNS, safeRuns));
  }

P.runOptimize = async function () {
    const btn = document.getElementById("btn-run");
    const status = document.getElementById("result-status");
    const gbestEl = document.getElementById("result-gbest");
    const methodEl = document.getElementById("optimizer-method");
    const seedEl = document.getElementById("pso-seed");
    const method = methodEl && methodEl.value ? methodEl.value : "exact";
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : null;
    btn.disabled = true;
    status.textContent = "计算中…（总时间单位：" + P.uTime() + "）";
    gbestEl.style.display = "none";
    try {
      if (!P.optimizer || typeof P.optimizer.runOptimize !== "function") {
        status.textContent = "本地优化模块未加载（assets/js/optimizer/）。";
        P.invalidateOptimizationResult();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      const data = P.normalizeOptimizeResult(
        P.optimizer.runOptimize(P.scenario, { method, seed }),
        method,
        P.scenario
      );
      if (data.error) {
        status.textContent = data.error;
        P.invalidateOptimizationResult();
        return;
      }
      P.lastResult = data;
      P.autoEntrancePreview = Array.isArray(data.veh_entrances) ? data.veh_entrances.slice() : null;
      P.scenario = data.scenario;
      P.ensureConstraints();
      P.ensureScenarioCollections();
      P.sanitizeScenarioGeometry();
      P.ensureVehicleDestinationsArray();
      P.ensureVehicleEntrancesArray();
      P.nVehInput.value = P.scenario.n_veh ?? 12;
      P.rebuildVehicleTargetsUI();
      const opt = data.optimizer || method;
      status.textContent =
        (opt === "exact" ? "全局最优总时间" : "PSO 最优总时间") +
        "（行车 + 步行）/ " +
        P.uTime() +
        "：";
      gbestEl.style.display = "block";
      gbestEl.textContent =
        Number(data.gbest_value ?? 0).toFixed(2) + " " + P.uTime();
      P.updateChartCaption(opt === "exact" ? "exact" : undefined);
      P.drawChart(data.history_best || [], opt);
      P.renderBreakdownSummary();
      if (opt === "exact") {
        P.renderResultTip("当前为全局最优解，可将其作为 PSO 调参与精度对照基线。");
      } else {
        let tip = "建议：若偏差较高，可提高 n_particles 或 n_iter，再重新对比 Benchmark。";
        try {
          const exactBase = P.normalizeOptimizeResult(
            P.optimizer.runOptimize(JSON.parse(JSON.stringify(P.scenario)), { method: "exact" }),
            "exact",
            P.scenario
          );
          if (Number.isFinite(exactBase.gbest_value) && Number.isFinite(data.gbest_value)) {
            const gap =
              ((data.gbest_value - exactBase.gbest_value) /
                Math.max(1e-6, exactBase.gbest_value)) *
              100;
            tip =
              "相对 exact 偏差：" +
              gap.toFixed(2) +
              "%。 " +
              (gap <= 2
                ? "当前参数已较优，优先关注耗时。"
                : "建议先使用“参数推荐”获取更稳妥配置。");
          }
        } catch (_) {
          // ignore exact baseline failures in tip rendering
        }
        P.renderResultTip(tip);
      }
      P.switchTab("result");
      P.draw();
    } catch (e) {
      status.textContent = "网络错误";
      console.error(e);
      P.renderResultTip("");
    } finally {
      btn.disabled = false;
    }
  }
})();
