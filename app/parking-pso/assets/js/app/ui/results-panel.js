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
      drive_paths: [],
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
    out.vehicle_breakdown = Array.isArray(out.vehicle_breakdown) ? out.vehicle_breakdown : [];
    out.paths = Array.isArray(out.paths) ? out.paths : [];
    out.drive_paths = Array.isArray(raw.drive_paths) ? raw.drive_paths : [];
    out.road_segments = Array.isArray(out.road_segments) ? out.road_segments : [];
    out.pso_stats =
      raw.pso_stats && typeof raw.pso_stats === "object" ? raw.pso_stats : out.pso_stats || null;
    out.history_assign_samples = Array.isArray(raw.history_assign_samples)
      ? raw.history_assign_samples
      : out.history_assign_samples || [];
    out.exact_reference =
      raw.exact_reference != null && Number.isFinite(Number(raw.exact_reference))
        ? Number(raw.exact_reference)
        : out.exact_reference != null
          ? out.exact_reference
          : null;
    return out;
  };

P.renderBreakdownSummary = function () {
    const el = document.getElementById("result-breakdown");
    const driveEl = document.getElementById("metric-drive");
    const walkEl = document.getElementById("metric-walk");
    const totalEl = document.getElementById("metric-total");

    if (driveEl) driveEl.textContent = "--";
    if (walkEl) walkEl.textContent = "--";
    if (totalEl) totalEl.textContent = "--";
    if (el) el.textContent = "";
    const mismatchEl = document.getElementById("metric-mismatch");
    if (mismatchEl) mismatchEl.textContent = "--";

    const items = P.lastResult?.vehicle_breakdown;
    if (!Array.isArray(items) || !items.length) return;

    const totals = items.reduce(
      (acc, it) => {
        acc.drive += Number(it.drive_time || 0);
        acc.walk += Number(it.walk_time || 0);
        acc.penalty += Number(it.penalty || 0);
        if (Number(it.penalty || 0) > 0) acc.mismatch += 1;
        return acc;
      },
      { drive: 0, walk: 0, penalty: 0, mismatch: 0 }
    );

    if (driveEl) driveEl.textContent = totals.drive.toFixed(1);
    if (walkEl) walkEl.textContent = totals.walk.toFixed(1);
    if (totalEl) totalEl.textContent = (totals.drive + totals.walk + totals.penalty).toFixed(1);
    if (mismatchEl) mismatchEl.textContent = String(totals.mismatch);

    if (el) {
      const violators = items.filter((it) => Number(it.penalty || 0) > 0);
      if (violators.length) {
        const lines = violators.map(
          (it) =>
            "车 " +
            (Number(it.vehicle_index) + 1) +
            " → 车位 " +
            (Number(it.slot_index) + 1) +
            "，罚分 " +
            Number(it.penalty).toFixed(2) +
            " " +
            P.uTime()
        );
        el.innerHTML = lines.map((t) => "<div class=\"breakdown-violation\">" + t + "</div>").join("");
      } else if (totals.penalty > 0) {
        el.textContent = "含约束罚分 " + totals.penalty.toFixed(2) + " " + P.uTime();
      } else {
        el.textContent = "无类型违约";
      }
    }
  };

P.renderResultTip = function (text) {
    const el = document.getElementById("result-tip");
    if (!el) return;
    el.textContent = text || "";
  };

P.setRunProgressLabel = function (text) {
    const label = document.getElementById("run-progress-label");
    if (label) label.textContent = text || "";
};

P.normalizeBenchmarkRuns = function (rawRuns) {
    if (P.analysisTools?.normalizeRuns) return P.analysisTools.normalizeRuns(rawRuns);
    const parsed = Number.parseInt(rawRuns, 10);
    const safeRuns = Number.isFinite(parsed) ? parsed : 6;
    return Math.max(1, Math.min(P.MAX_BENCHMARK_RUNS, safeRuns));
  };

  let optimizeRunId = 0;

P.runOptimize = async function () {
    const gate = P.canRunOptimize?.();
    if (gate && !gate.ok) {
      P.showWorkspaceMessage?.(gate.reason, { level: "warn" });
      return;
    }
    const runId = ++optimizeRunId;
    const runBtns = document.querySelectorAll(".js-run-optimize");
    const progressEl = document.getElementById("run-progress");
    const status = document.getElementById("result-status");
    const gbestEl = document.getElementById("result-gbest");
    const methodEl = document.getElementById("optimizer-method");
    const seedEl = document.getElementById("pso-seed");
    const method = methodEl && methodEl.value ? methodEl.value : "exact";
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : null;
    const roadPts = P.scenario?.road?.centerline?.length || 0;
    if (roadPts < 2) {
      P.switchTab?.("overview");
      P.updateWorkflowGuide?.();
    }
    P.stopPsoReplay?.();
    runBtns.forEach((btn) => {
      btn.disabled = true;
      btn.classList.add("is-loading");
    });
    if (progressEl) {
      progressEl.hidden = false;
      progressEl.setAttribute("aria-hidden", "false");
    }
    const canLocal = !!(P.optimizer && typeof P.optimizer.runOptimize === "function");
    const canAsync = !!(P.optimizer && typeof P.optimizer.runOptimizeAsync === "function");
    const statusPrefix =
      method === "exact"
        ? "本地计算中…（匈牙利全局最优）"
        : "本地 PSO 计算中…";
    status.textContent = statusPrefix + "（总时间单位：" + P.uTime() + "）";
    P.setRunProgressLabel(method === "exact" ? "构建代价矩阵…" : "初始化粒子群…");
    gbestEl.style.display = "none";
    let chartThrottle = 0;
    try {
      if (!canLocal && !P.api?.optimize) {
        status.textContent = "本地优化模块未加载（assets/js/optimizer/）。";
        P.invalidateOptimizationResult();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      let raw = null;
      if (canLocal) {
        if (method === "pso" && canAsync) {
          raw = await P.optimizer.runOptimizeAsync(P.scenario, {
            method,
            seed,
            onIteration: (ev) => {
              if (runId !== optimizeRunId) return;
              P.setRunProgressLabel("PSO 迭代 " + ev.it + "/" + ev.nIter);
              const now = performance.now();
              if (now - chartThrottle > 48) {
                chartThrottle = now;
                P.drawChart(ev.historyBest || [], "pso", {
                  exactReference: ev.exactReference,
                  zoomConvergence: P.getChartDrawOpts?.().zoomConvergence,
                  showExactRef: P.getChartDrawOpts?.().showExactRef,
                });
              }
            },
          });
        } else {
          raw = P.optimizer.runOptimize(P.scenario, { method, seed });
        }
      } else if (P.api?.optimize) {
        try {
          const apiRes = await P.api.optimize(P.scenario, method, seed);
          raw = apiRes.result;
        } catch (apiErr) {
          console.warn("API optimize fallback failed", apiErr);
        }
      }
      if (runId !== optimizeRunId) return;
      const data = P.normalizeOptimizeResult(raw, method, P.scenario);
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
      const chartOpts = {
        exactReference: data.exact_reference,
        zoomConvergence: P.getChartDrawOpts?.().zoomConvergence,
        showExactRef: P.getChartDrawOpts?.().showExactRef,
      };
      P.drawChart(data.history_best || [], opt, chartOpts);
      P.renderChartMeta?.(data);
      P.renderBreakdownSummary();
      P.updateWorkflowGuide?.();
      if (opt === "exact") {
        P.renderResultTip("当前为全局最优解，可将其作为 PSO 调参与精度对照基线。");
      } else {
        let tip = "建议：若偏差较高，可提高粒子数或迭代上限，或使用「参数推荐」。";
        const ref = data.exact_reference;
        if (ref != null && Number.isFinite(ref) && Number.isFinite(data.gbest_value)) {
          const gap = ((data.gbest_value - ref) / Math.max(1e-6, ref)) * 100;
          tip =
            "相对 exact 偏差：" +
            gap.toFixed(2) +
            "%。 " +
            (gap <= 2
              ? "当前参数已较优，优先关注耗时。"
              : "建议先使用「参数推荐」或「精度优先」预设。");
        } else {
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
                  : "建议先使用「参数推荐」获取更稳妥配置。");
            }
          } catch (_) {
            // ignore
          }
        }
        P.renderResultTip(tip);
      }
      P.switchTab("simulate");
      P.draw();
      P.clearWorkspaceMessage?.();
      P.updateActionGates?.();
      P.updateRunBarSummary?.();
    } catch (e) {
      status.textContent = "计算失败";
      console.error(e);
      P.renderResultTip("");
    } finally {
      if (runId === optimizeRunId) {
        runBtns.forEach((btn) => {
          btn.disabled = false;
          btn.classList.remove("is-loading");
        });
        if (progressEl) {
          progressEl.hidden = true;
          progressEl.setAttribute("aria-hidden", "true");
        }
        P.setRunProgressLabel("");
      }
      P.updateActionGates?.();
      P.updateRunBarSummary?.();
    }
  };
})();
