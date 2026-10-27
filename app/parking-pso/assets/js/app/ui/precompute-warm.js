(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/precompute-warm.js");

  P.simStepSession = P.simStepSession || { assign: [] };

  P.resetSimStepSession = function () {
    P.simStepSession = { assign: [] };
  };

  P.truncateSimStepSession = function (fromIndex) {
    const i = Math.max(0, parseInt(fromIndex, 10) || 0);
    if (!P.simStepSession?.assign?.length) return;
    P.simStepSession.assign = P.simStepSession.assign.slice(0, i);
  };

  P.getSimStepRunMode = function () {
    const v = document.getElementById("sim-step-run-mode")?.value || "cumulative";
    return v;
  };

  P._precomputeWarmTimer = null;
  P._precomputeWarmGen = 0;
  P._precomputeWarmJobId = null;

  P.syncSimWarmStatus = function (text, hidden) {
    const el = document.getElementById("sim-warm-status");
    if (!el) return;
    if (hidden) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    if (text) el.textContent = text;
  };

  P.schedulePrecomputeWarmup = function () {
    if (!P.apiOnline || !P.scenario || !P.api?.precomputeWarm) return;
    clearTimeout(P._precomputeWarmTimer);
    P._precomputeWarmGen += 1;
    const gen = P._precomputeWarmGen;
    P._precomputeWarmTimer = setTimeout(() => P.runPrecomputeWarmup(gen), 900);
  };

  P.runPrecomputeWarmup = async function (gen) {
    if (gen !== P._precomputeWarmGen || !P.scenario || !P.api?.precomputeWarm) return;
    P.syncSimWarmStatus("后台预计算路径中…", false);
    try {
      const res = await P.api.precomputeWarm(P.scenario, true);
      if (gen !== P._precomputeWarmGen) return;
      if (res.job_id) {
        P._precomputeWarmJobId = res.job_id;
        await P.pollPrecomputeWarmJob(res.job_id, gen);
        return;
      }
      if (res.warmed) P.syncSimWarmStatus("路径已预热，首次仿真会更快", false);
    } catch (e) {
      if (gen === P._precomputeWarmGen) P.syncSimWarmStatus("", true);
      console.warn("precompute warm failed", e);
    }
  };

  P.pollPrecomputeWarmJob = async function (jobId, gen) {
    const maxMs = 240000;
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < maxMs) {
      if (gen !== P._precomputeWarmGen) return;
      await new Promise((r) => setTimeout(r, Math.min(800, 400 + i * 10)));
      i += 1;
      const res = await P.api.getJob(jobId);
      const job = res?.job;
      if (!job) break;
      if (job.status === "completed") {
        P.syncSimWarmStatus("路径已预热，首次仿真会更快", false);
        return;
      }
      if (job.status === "failed") throw new Error(job.error || "warm failed");
      const detail = P.formatSimJobProgressDetail?.(job.progress) || "预热";
      P.syncSimWarmStatus("后台预计算：" + detail, false);
    }
  };
})();
