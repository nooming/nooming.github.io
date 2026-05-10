(function () {
  "use strict";

  const MAX_BENCHMARK_RUNS = 50;

  function normalizeRuns(rawRuns) {
    const parsed = Number.parseInt(rawRuns, 10);
    const safeRuns = Number.isFinite(parsed) ? parsed : 6;
    return Math.max(1, Math.min(MAX_BENCHMARK_RUNS, safeRuns));
  }

  function benchmarkText(stats, timeUnit) {
    if (!stats) return "";
    return (
      "Benchmark（" +
      stats.runs +
      " 次）\n" +
      "Exact 平均: " +
      stats.exactAvg.toFixed(2) +
      " " +
      timeUnit +
      "\nPSO 平均: " +
      stats.psoAvg.toFixed(2) +
      " " +
      timeUnit +
      "\n平均偏差: " +
      stats.gapPct.toFixed(2) +
      "%\nPSO 平均耗时: " +
      stats.psoMs.toFixed(1) +
      " ms"
    );
  }

  function runBenchmark(deps) {
    const {
      scenario,
      optimizer,
      normalizeOptimizeResult,
      runs,
      baseSeed,
      outputEl,
      timeUnit,
    } = deps;
    if (!scenario || !optimizer) return null;
    const exactVals = [];
    const psoVals = [];
    const psoMs = [];
    const safeRuns = normalizeRuns(runs);
    for (let i = 0; i < safeRuns; i++) {
      const base = JSON.parse(JSON.stringify(scenario));
      const exact = normalizeOptimizeResult(optimizer.runOptimize(base, { method: "exact" }), "exact", scenario);
      const t0 = performance.now();
      const pso = normalizeOptimizeResult(
        optimizer.runOptimize(base, { method: "pso", seed: baseSeed + i }),
        "pso",
        scenario
      );
      const t1 = performance.now();
      if (Number.isFinite(exact.gbest_value) && Number.isFinite(pso.gbest_value)) {
        exactVals.push(exact.gbest_value);
        psoVals.push(pso.gbest_value);
        psoMs.push(t1 - t0);
      }
    }
    if (!exactVals.length) return null;
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stats = {
      runs: exactVals.length,
      exactAvg: avg(exactVals),
      psoAvg: avg(psoVals),
      gapPct: ((avg(psoVals) - avg(exactVals)) / Math.max(1e-6, avg(exactVals))) * 100,
      psoMs: avg(psoMs),
    };
    if (outputEl) outputEl.textContent = benchmarkText(stats, timeUnit);
    return stats;
  }

  function recommendParams(deps) {
    const {
      scenario,
      optimizer,
      normalizeOptimizeResult,
      seed,
      outputEl,
      timeUnit,
    } = deps;
    if (!scenario || !optimizer) return null;
    const exact = normalizeOptimizeResult(
      optimizer.runOptimize(JSON.parse(JSON.stringify(scenario)), { method: "exact" }),
      "exact",
      scenario
    );
    if (!Number.isFinite(exact.gbest_value)) return null;
    const candidates = [
      { label: "速度优先", n_particles: 18, n_iter: 180 },
      { label: "平衡", n_particles: 30, n_iter: 320 },
      { label: "精度优先", n_particles: 45, n_iter: 650 },
    ];
    const rows = candidates.map((cfg, idx) => {
      const base = JSON.parse(JSON.stringify(scenario));
      base.pso = {
        ...base.pso,
        n_particles: cfg.n_particles,
        n_iter: cfg.n_iter,
      };
      const t0 = performance.now();
      const res = normalizeOptimizeResult(
        optimizer.runOptimize(base, { method: "pso", seed: seed + idx }),
        "pso",
        scenario
      );
      const dt = performance.now() - t0;
      const gap = ((res.gbest_value - exact.gbest_value) / Math.max(1e-6, exact.gbest_value)) * 100;
      return { ...cfg, val: res.gbest_value, gap, ms: dt };
    });
    const best = rows.slice().sort((a, b) => a.gap - b.gap || a.ms - b.ms)[0];
    if (outputEl) {
      outputEl.textContent = rows
        .map(
          (r) =>
            r.label +
            ": " +
            r.val.toFixed(2) +
            " " +
            timeUnit +
            "，偏差 " +
            r.gap.toFixed(2) +
            "%，耗时 " +
            r.ms.toFixed(1) +
            " ms"
        )
        .join("\n") + "\n建议：默认使用「" + best.label + "」配置。";
    }
    return { rows, best };
  }

  window.ParkingAnalysis = {
    MAX_BENCHMARK_RUNS,
    normalizeRuns,
    benchmarkText,
    runBenchmark,
    recommendParams,
  };
})();
