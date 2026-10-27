(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/pso-lab-panel.js");

  const PRESETS = {
    speed: { label: "速度优先", n_particles: 18, n_iter: 180 },
    balanced: { label: "平衡", n_particles: 30, n_iter: 320 },
    accuracy: { label: "精度优先", n_particles: 45, n_iter: 650 },
  };

  const PSO_STATS_KEY = "parking-pso-lab-stats-v1";

  P.PSO_PRESETS = PRESETS;

  P.readPsoFromScenario = function () {
    const pso = P.scenario?.pso || {};
    const def = P.scenarioSource?.defaultScenario?.()?.pso || {};
    return {
      n_particles: Number(pso.n_particles) || def.n_particles || 40,
      n_iter: Number(pso.n_iter) || def.n_iter || 600,
      w: Number(pso.w ?? def.w ?? 0.7),
      c1: Number(pso.c1 ?? def.c1 ?? 1.5),
      c2: Number(pso.c2 ?? def.c2 ?? 1.5),
      v_max: Number(pso.v_max ?? def.v_max ?? 0.25),
    };
  };

  P.writePsoToScenario = function (patch) {
    if (!P.scenario) return;
    P.scenario.pso = { ...P.readPsoFromScenario(), ...patch };
    P.persistCurrentStateNow?.();
  };

  P.syncPsoLabInputsFromScenario = function () {
    const cfg = P.readPsoFromScenario();
    const np = document.getElementById("pso-n-particles");
    const ni = document.getElementById("pso-n-iter");
    const w = document.getElementById("pso-w");
    const c1 = document.getElementById("pso-c1");
    const c2 = document.getElementById("pso-c2");
    const vmax = document.getElementById("pso-vmax");
    if (np) np.value = String(cfg.n_particles);
    if (ni) ni.value = String(cfg.n_iter);
    if (w) w.value = String(cfg.w);
    if (c1) c1.value = String(cfg.c1);
    if (c2) c2.value = String(cfg.c2);
    if (vmax) vmax.value = String(cfg.v_max);
    P.updatePsoRangeLabels?.();
    P.detectActivePsoPreset?.();
  };

  P.updatePsoRangeLabels = function () {
    const pairs = [
      ["pso-w", "pso-w-val"],
      ["pso-c1", "pso-c1-val"],
      ["pso-c2", "pso-c2-val"],
      ["pso-vmax", "pso-vmax-val"],
    ];
    for (const [id, lid] of pairs) {
      const el = document.getElementById(id);
      const lab = document.getElementById(lid);
      if (el && lab) lab.textContent = el.value;
    }
  };

  P.detectActivePsoPreset = function () {
    const cfg = P.readPsoFromScenario();
    let active = null;
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (cfg.n_particles === preset.n_particles && cfg.n_iter === preset.n_iter) active = key;
    }
    document.querySelectorAll(".pso-preset-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.preset === active);
    });
  };

  P.applyPsoPreset = function (presetKey) {
    const preset = PRESETS[presetKey];
    if (!preset) return;
    P.writePsoToScenario({ n_particles: preset.n_particles, n_iter: preset.n_iter });
    P.syncPsoLabInputsFromScenario();
    P.invalidateOptimizationResult?.();
  };

  P.persistPsoLabStats = function (stats) {
    try {
      localStorage.setItem(PSO_STATS_KEY, JSON.stringify({ ...stats, at: Date.now() }));
    } catch (_) {
      // ignore
    }
    P.renderPsoLabLastStats?.();
  };

  P.loadPsoLabStats = function () {
    try {
      const raw = localStorage.getItem(PSO_STATS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  };

  P.renderPsoLabLastStats = function () {
    const el = document.getElementById("pso-lab-last-stats");
    if (!el) return;
    const saved = P.loadPsoLabStats();
    if (!saved) {
      el.textContent = "";
      return;
    }
    const parts = [];
    if (Number.isFinite(saved.gapPct)) parts.push("上次 Benchmark 平均偏差 " + saved.gapPct.toFixed(2) + "%");
    if (Number.isFinite(saved.psoMs)) parts.push("PSO 耗时约 " + saved.psoMs.toFixed(0) + " ms");
    el.textContent = parts.join(" · ");
  };

  P.togglePsoLabVisibility = function () {
    const methodEl = document.getElementById("optimizer-method");
    const panel = document.getElementById("pso-lab-panel");
    const hint = document.getElementById("optimizer-method-hint");
    const isPso = methodEl?.value === "pso";
    if (panel) panel.hidden = !isPso;
    if (hint) {
      hint.textContent = isPso
        ? "PSO 为启发式近似解，可与匈牙利结果对比偏差；下方实验室可调粒子数与迭代。"
        : "车辆数较少时优先匈牙利（全局最优、无迭代曲线）。";
    }
    if (isPso) P.syncPsoLabInputsFromScenario();
  };

  P.wirePsoLabPanel = function () {
    const methodEl = document.getElementById("optimizer-method");
    methodEl?.addEventListener("change", () => {
      P.togglePsoLabVisibility();
      P.updateRunBarSummary?.();
    });

    document.querySelectorAll(".pso-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        P.applyPsoPreset(btn.dataset.preset);
      });
    });

    const bindNum = (id, key) => {
      document.getElementById(id)?.addEventListener("change", () => {
        const el = document.getElementById(id);
        if (!el || !P.scenario) return;
        const v = Number(el.value);
        if (!Number.isFinite(v)) return;
        P.writePsoToScenario({ [key]: v });
        P.detectActivePsoPreset();
        P.invalidateOptimizationResult?.();
      });
    };
    bindNum("pso-n-particles", "n_particles");
    bindNum("pso-n-iter", "n_iter");

    const bindRange = (id, key) => {
      document.getElementById(id)?.addEventListener("input", () => {
        const el = document.getElementById(id);
        if (!el) return;
        P.updatePsoRangeLabels();
        P.writePsoToScenario({ [key]: Number(el.value) });
        P.detectActivePsoPreset();
      });
    };
    bindRange("pso-w", "w");
    bindRange("pso-c1", "c1");
    bindRange("pso-c2", "c2");
    bindRange("pso-vmax", "v_max");

    document.getElementById("btn-pso-reset-params")?.addEventListener("click", () => {
      const def = P.scenarioSource?.defaultScenario?.()?.pso;
      if (def) P.writePsoToScenario({ ...def });
      else P.applyPsoPreset("balanced");
      P.syncPsoLabInputsFromScenario();
      P.invalidateOptimizationResult?.();
    });

    document.getElementById("btn-apply-recommend")?.addEventListener("click", () => {
      const best = P.lastRecommendBest;
      if (!best) return;
      P.writePsoToScenario({ n_particles: best.n_particles, n_iter: best.n_iter });
      P.syncPsoLabInputsFromScenario();
      P.showWorkspaceMessage?.("已应用「" + best.label + "」配置，请点击运行优化。", { level: "info" });
    });

    ["chart-zoom-convergence", "chart-show-exact-ref"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        P.drawChart(P.lastChartSeries, P.lastChartOptimizer, P.lastChartDrawOpts);
      });
    });

    document.getElementById("btn-pso-replay")?.addEventListener("click", () => P.togglePsoReplay?.());

    P.togglePsoLabVisibility();
    P.renderPsoLabLastStats();
  };

  P.stopPsoReplay = function () {
    if (P.psoReplay?.timerId) {
      clearInterval(P.psoReplay.timerId);
    }
    P.psoReplay = null;
    const btn = document.getElementById("btn-pso-replay");
    if (btn) btn.textContent = "播放分配收敛";
    P.draw();
  };

  P.togglePsoReplay = function () {
    const samples = P.lastResult?.history_assign_samples;
    if (!Array.isArray(samples) || samples.length < 2) return;
    if (P.psoReplay?.timerId) {
      P.stopPsoReplay();
      return;
    }
    const btn = document.getElementById("btn-pso-replay");
    if (btn) btn.textContent = "停止回放";
    let idx = 0;
    P.psoReplay = {
      samples,
      frameIndex: 0,
      timerId: setInterval(() => {
        idx = (idx + 1) % samples.length;
        P.psoReplay.frameIndex = idx;
        P.draw();
      }, 420),
    };
    P.draw();
  };
})();
