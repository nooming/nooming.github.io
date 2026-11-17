(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/simulate-panel.js");

  P.simState = P.simState || { playing: false, frameIndex: 0, timeline: null, raf: null };

  P.getSimArrivalProcessMode = function () {
    const v = document.getElementById("sim-arrival-mode")?.value || "burst";
    return v;
  };

  P.syncSimStepRunModeDesc = function () {
    const desc = document.getElementById("sim-step-run-mode-desc");
    const wrap = document.getElementById("sim-step-run-mode-wrap");
    if (!desc || !wrap) return;
    const step = P.getSimArrivalProcessMode() === "step";
    if (!step || wrap.hidden) {
      desc.hidden = true;
      return;
    }
    const mode = P.getSimStepRunMode?.() || "cumulative";
    const texts = {
      cumulative: "从车 1 重算到当前车。",
      incremental: "锁定前缀，只算当前车（需按序跑过）。",
      isolated: "只算当前车，不占位。",
    };
    desc.textContent = texts[mode] || "";
    desc.hidden = !desc.textContent;
  };

  P.simUsesVehicleQueue = function () {
    const m = P.getSimArrivalProcessMode();
    return m === "step" || m === "explicit";
  };

  P.buildSimSchedule = function (extra) {
    const modeEl = document.getElementById("sim-arrival-mode");
    let mode = modeEl ? modeEl.value : "uniform";
    const durEl = document.getElementById("sim-duration-min");
    const duration_min = durEl ? parseFloat(durEl.value) || 20 : 20;
    const entrance_capacity = 1;
    const realEl = document.getElementById("sim-realistic");
    const realistic = realEl ? !!realEl.checked : true;
    const count = P.lastResult?.assign?.length || P.scenario?.n_veh || 0;
    const schedule = { mode, duration_min, count, entrance_capacity, realistic };
    if (mode === "burst") schedule.burst_gap_sec = 2;
    if (mode === "explicit" || mode === "step") {
      schedule.mode = "explicit";
      P.ensureVehicleArrivalSecArray?.();
      schedule.arrivals_sec =
        P.getVehicleArrivalMode?.() === "gap"
          ? P.resolveVehicleArrivalsSec?.() || []
          : (P.scenario.vehicle_arrival_sec || []).map((v) => Math.max(0, Number(v) || 0));
    }
    const dwellMin = parseFloat(document.getElementById("sim-dwell-min")?.value);
    if (Number.isFinite(dwellMin) && dwellMin > 0) schedule.dwell_min = dwellMin;
    if (mode === "poisson" || mode === "normal_gap") {
      const seedRaw = document.getElementById("sim-arrival-seed")?.value;
      schedule.seed = seedRaw === "" || seedRaw == null ? 42 : parseInt(seedRaw, 10) || 42;
      if (mode === "poisson") {
        schedule.lambda = parseFloat(document.getElementById("sim-poisson-lambda")?.value) || 0.04;
      }
      if (mode === "normal_gap") {
        schedule.mean_gap_sec = parseFloat(document.getElementById("sim-normal-mean-gap")?.value) || 30;
        schedule.sigma_gap_sec = parseFloat(document.getElementById("sim-normal-sigma-gap")?.value) || 10;
      }
    }
    const wEnt = (parseInt(document.getElementById("sim-weight-entrance")?.value, 10) || 0) / 100;
    const wFair = (parseInt(document.getElementById("sim-weight-fairness")?.value, 10) || 0) / 100;
    schedule.objective_weights = { entrance_balance: wEnt, fairness_range: wFair };
    if (P.scenario) {
      P.scenario.soft_constraints = P.scenario.soft_constraints || {};
      P.scenario.soft_constraints.objective_weights = { ...schedule.objective_weights };
    }
    if (extra && typeof extra === "object") Object.assign(schedule, extra);
    return schedule;
  };

  P._localRng = function (seed) {
    let state = (Number(seed) || 42) >>> 0;
    return function () {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  P.buildLocalArrivals = function (n, schedule) {
    const count = Math.max(0, Number(n) || 0);
    if (!count) return [];
    const sched = schedule || {};
    const mode = String(sched.mode || "uniform").toLowerCase();
    if (mode === "explicit") {
      const raw = Array.isArray(sched.arrivals_sec) && sched.arrivals_sec.length
        ? sched.arrivals_sec
        : (P.resolveVehicleArrivalsSec?.() || []);
      const out = [];
      for (let i = 0; i < count; i++) {
        const v = Number(raw[i]);
        out.push(Number.isFinite(v) ? Math.max(0, v) : i * 60);
      }
      return out;
    }
    if (mode === "burst") {
      const gap = Number(sched.burst_gap_sec) || 2;
      return Array.from({ length: count }, (_, i) => i * gap);
    }
    if (mode === "poisson") {
      const rng = P._localRng(sched.seed);
      const rate = Math.max(1e-6, Number(sched.lambda) || 0.04);
      let t = 0;
      return Array.from({ length: count }, () => {
        t += -Math.log(Math.max(1e-9, 1 - rng())) / rate;
        return Math.round(t * 1000) / 1000;
      });
    }
    if (mode === "normal_gap") {
      const rng = P._localRng(sched.seed);
      const mean = Number(sched.mean_gap_sec) || 30;
      const sigma = Math.max(0, Number(sched.sigma_gap_sec) || 10);
      const gauss = () => {
        const u = Math.max(1e-9, rng());
        const v = Math.max(1e-9, rng());
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      };
      let t = 0;
      const out = [0];
      for (let i = 1; i < count; i++) {
        t += Math.max(0.5, mean + sigma * gauss());
        out.push(Math.round(t * 1000) / 1000);
      }
      return out;
    }
    const duration = (Number(sched.duration_min) || 20) * 60;
    return Array.from({ length: count }, (_, i) => i * (duration / Math.max(1, count)));
  };

  P._objectiveWeights = function (schedule, scenario) {
    const raw =
      (schedule && schedule.objective_weights) ||
      (scenario && scenario.soft_constraints && scenario.soft_constraints.objective_weights) ||
      {};
    return {
      entrance_balance: Math.max(0, Number(raw.entrance_balance) || 0),
      fairness_range: Math.max(0, Number(raw.fairness_range) || 0),
    };
  };

  P._entrancePenalty = function (entranceIndex, counts, entranceCount, assignedSoFar) {
    if (entranceCount <= 1 || assignedSoFar <= 0) return 0;
    const target = (assignedSoFar + 1) / entranceCount;
    const projected = (counts[entranceIndex] || 0) + 1;
    return Math.max(0, projected - target) ** 2;
  };

  P._objectiveMetrics = function (breakdown) {
    if (!breakdown.length) {
      return { total_time: 0, fairness_walk_range: 0, entrance_load_variance: 0 };
    }
    const total = breakdown.reduce((sum, b) => sum + Number(b.total_time || 0), 0);
    const byBuilding = new Map();
    for (const b of breakdown) {
      const bi = Number(b.destination_index) || 0;
      if (!byBuilding.has(bi)) byBuilding.set(bi, []);
      byBuilding.get(bi).push(Number(b.walk_time) || 0);
    }
    const averages = [...byBuilding.values()].map(
      (arr) => arr.reduce((a, b) => a + b, 0) / Math.max(1, arr.length)
    );
    const fairness = averages.length >= 2 ? Math.max(...averages) - Math.min(...averages) : 0;
    const entCounts = new Map();
    for (const b of breakdown) {
      const ei = Number(b.entrance_index) || 0;
      entCounts.set(ei, (entCounts.get(ei) || 0) + 1);
    }
    const counts = [...entCounts.values()];
    const mean = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const variance = counts.length
      ? counts.reduce((sum, c) => sum + (c - mean) ** 2, 0) / counts.length
      : 0;
    return { total_time: total, fairness_walk_range: fairness, entrance_load_variance: variance };
  };

  P.runRollingLocal = function (schedule) {
    const sched = { ...(schedule || {}) };
    const ctx = P.optimizer?.buildCostContext?.(P.scenario);
    if (!ctx?.ok) {
      return { success: false, message: "场景无效", timeline: { frames: [], stats: {}, duration: 0 } };
    }
    const nVeh = ctx.nVeh;
    const nSlot = ctx.nSlot;
    const arrivals = P.buildLocalArrivals(nVeh, sched);
    sched.arrivals_sec = arrivals;
    const dwellS = Math.max(0, Number(sched.dwell_min) || 0) * 60;
    const weights = P._objectiveWeights(sched, ctx.s);
    const entranceCount = Math.max(1, ctx.prep.entrancesPos.length || 1);
    const entranceCounts = new Array(entranceCount).fill(0);
    let assignedSoFar = 0;
    const free = new Set(Array.from({ length: nSlot }, (_, i) => i));
    const slotFreeAt = new Array(nSlot).fill(0);
    const assign = new Array(nVeh).fill(-1);
    const prefix = sched.prefix_assign;
    if (Array.isArray(prefix)) {
      for (let i = 0; i < Math.min(prefix.length, nVeh); i++) {
        const j = Number(prefix[i]);
        if (Number.isInteger(j) && j >= 0 && j < nSlot && free.has(j)) {
          assign[i] = j;
          free.delete(j);
          const ei = ctx.resolveDrive(j, i).entranceIndex;
          if (ei >= 0 && ei < entranceCount) entranceCounts[ei] += 1;
          assignedSoFar += 1;
          if (dwellS > 0) {
            const drive = ctx.resolveDrive(j, i);
            const walk = ctx.prep.walkMat[j][ctx.vehTargets[i]] / ctx.vWalk;
            slotFreeAt[j] = arrivals[i] + drive.driveTime + walk + dwellS;
          }
        }
      }
    }

    const order = Array.from({ length: nVeh }, (_, i) => i).sort(
      (a, b) => arrivals[a] - arrivals[b] || a - b
    );
    const log = [];
    for (const vi of order) {
      if (assign[vi] >= 0) {
        log.push({ vehicle_index: vi, arrival: arrivals[vi], slot_index: assign[vi], status: "prefixed" });
        continue;
      }
      let bestJ = -1;
      let bestC = Infinity;
      let bestEi = 0;
      for (let j = 0; j < nSlot; j++) {
        if (dwellS > 0) {
          if (slotFreeAt[j] > arrivals[vi] + 1e-6) continue;
        } else if (!free.has(j)) {
          continue;
        }
        const drive = ctx.resolveDrive(j, vi);
        const balancePenalty =
          weights.entrance_balance *
          P._entrancePenalty(drive.entranceIndex, entranceCounts, entranceCount, assignedSoFar);
        const c = ctx.cost[vi][j] + balancePenalty;
        if (c < bestC) {
          bestC = c;
          bestJ = j;
          bestEi = drive.entranceIndex;
        }
      }
      if (bestJ < 0) {
        log.push({ vehicle_index: vi, arrival: arrivals[vi], status: "rejected_no_slot" });
        continue;
      }
      assign[vi] = bestJ;
      if (bestEi >= 0 && bestEi < entranceCount) entranceCounts[bestEi] += 1;
      assignedSoFar += 1;
      if (dwellS > 0) {
        const drive = ctx.resolveDrive(bestJ, vi);
        const walk = ctx.prep.walkMat[bestJ][ctx.vehTargets[vi]] / ctx.vWalk;
        slotFreeAt[bestJ] = arrivals[vi] + drive.driveTime + walk + dwellS;
      } else {
        free.delete(bestJ);
      }
      log.push({
        vehicle_index: vi,
        arrival: arrivals[vi],
        slot_index: bestJ,
        status: "assigned",
        marginal_cost: bestC,
      });
    }
    if (assign.some((j) => j < 0)) {
      return {
        success: false,
        message: "车位不足，无法为全部到达车辆分配",
        assignment_log: log,
        timeline: { frames: [], stats: {}, duration: 0 },
      };
    }

    const breakdown = [];
    const bestEntrances = [];
    let total = 0;
    for (let i = 0; i < nVeh; i++) {
      const j = assign[i];
      const drive = ctx.resolveDrive(j, i);
      const walk = ctx.prep.walkMat[j][ctx.vehTargets[i]] / ctx.vWalk;
      const penalty = Number(ctx.s.soft_constraints?.type_mismatch_penalty || 0) &&
        (ctx.s.vehicle_requirements?.[i] || "normal") !== (ctx.s.slot_types?.[j] || "normal")
        ? Number(ctx.s.soft_constraints?.type_mismatch_penalty || 0)
        : 0;
      total += drive.driveTime + walk + penalty;
      bestEntrances.push(drive.entranceIndex);
      breakdown.push({
        vehicle_index: i,
        slot_index: j,
        destination_index: ctx.vehTargets[i],
        entrance_index: drive.entranceIndex,
        drive_time: drive.driveTime,
        walk_time: walk,
        penalty,
        total_time: drive.driveTime + walk + penalty,
      });
    }

    const pack = window.ParkingOptimizerPack?.packResult;
    if (typeof pack !== "function") {
      return { success: false, message: "本地结果打包模块未加载", timeline: { frames: [], stats: {}, duration: 0 } };
    }
    const objectiveMetrics = P._objectiveMetrics(breakdown);
    const compositeCost =
      objectiveMetrics.total_time +
      weights.fairness_range * objectiveMetrics.fairness_walk_range +
      weights.entrance_balance * objectiveMetrics.entrance_load_variance * 10;
    const result = pack(ctx.s, {
      gbestValue: total,
      historyBest: [total],
      bestAssign: assign,
      bestEntrances,
      vehicleBreakdown: breakdown,
      slotsPos: ctx.prep.slotsPos,
      buildingsPos: ctx.prep.buildingsPos,
      obstacles: ctx.s.obstacles,
      vehTargets: ctx.vehTargets,
      boxesByBi: ctx.prep.boxesByBi,
      navByBi: ctx.prep.navByBi,
      lot: ctx.s.lot,
      road: ctx.road,
      optimizer: "rolling",
    });
    return {
      success: true,
      result,
      timeline: P.runSimulationLocal(result, sched),
      assignment_log: log,
      rolling_total_cost: total,
      objective_metrics: objectiveMetrics,
      objective_weights: weights,
      composite_cost: compositeCost,
      policy: "rolling_fifo_greedy",
      schedule_realized: { mode: sched.mode || "uniform", arrivals_sec: arrivals, seed: sched.seed },
    };
  };

  P.syncSimToolbarVisibility = function () {
    const mode = P.getSimArrivalProcessMode();
    const step = mode === "step";
    const stochastic = mode === "poisson" || mode === "normal_gap";
    const hasTimeline = !!(P.simState?.timeline?.frames?.length);
    const toolbar = document.querySelector(".toolbar--simulate");
    const batchBar = document.getElementById("sim-toolbar-batch");
    if (batchBar) batchBar.hidden = step;
    if (toolbar) {
      toolbar.classList.toggle("toolbar--simulate-step", step);
      toolbar.classList.toggle("toolbar--simulate-has-play", step && hasTimeline);
    }
    const mcBtn = document.getElementById("btn-monte-carlo");
    if (mcBtn) mcBtn.hidden = !stochastic;
    const compareBtn = document.getElementById("btn-run-arrival-compare");
    if (compareBtn) compareBtn.hidden = false;
    const playSim = document.getElementById("btn-sim-play");
    if (playSim) {
      playSim.hidden = step && !hasTimeline;
      playSim.disabled = !hasTimeline;
    }
  };

  P.renderSimSampleArrivals = function (realized) {
    const el = document.getElementById("sim-sample-arrivals");
    if (!el) return;
    const arr = realized?.arrivals_sec;
    if (!arr?.length) {
      el.hidden = true;
      el.textContent = "";
      return;
    }
    el.hidden = false;
    const parts = arr.map((t, i) => "车" + (i + 1) + "=" + Number(t).toFixed(1));
    let txt = "本次采样到达(s)：" + parts.join(" · ");
    if (realized.seed != null && realized.seed !== "") txt += " · seed=" + realized.seed;
    el.textContent = txt;
  };

  P.formatSimJobProgressDetail = function (progress) {
    if (!progress) return "";
    const label = progress.label || progress.phase || "";
    if (progress.pct != null && Number.isFinite(Number(progress.pct))) {
      const pct = Math.round(Number(progress.pct) * 100);
      return label ? label + " " + pct + "%" : pct + "%";
    }
    return label;
  };

  P.syncSimJobProgressUi = function (progress) {
    const bar = document.getElementById("sim-job-progress");
    if (!bar) return;
    if (!progress || progress.pct == null) {
      bar.hidden = true;
      bar.removeAttribute("value");
      return;
    }
    const pct = Math.max(0, Math.min(100, Math.round(Number(progress.pct) * 100)));
    bar.hidden = false;
    bar.value = String(pct);
  };

  P.formatSimWaitStatus = function (rolling, elapsedSec, detail, progress) {
    const base = rolling ? "在线滚动仿真计算中" : "仿真计算中";
    const prog = P.formatSimJobProgressDetail(progress);
    const detailText = prog || detail || "";
    const slow =
      rolling && elapsedSec >= 8 && !prog ? "（预计算中，二次运行更快）" : "";
    const tail = detailText ? " · " + detailText : "";
    return base + slow + " · 已等待 " + elapsedSec + " 秒" + tail;
  };

  P.simJobStatusDetail = function (job, rolling) {
    if (!job) return rolling ? "运行" : "";
    if (job.status === "pending") return "排队";
    return P.formatSimJobProgressDetail(job.progress) || "运行";
  };

  P.pollSimJobUntilDone = async function (jobId, st, rolling, maxMsOverride) {
    const maxMs = maxMsOverride ?? (rolling ? 240000 : 120000);
    const t0 = Date.now();
    let i = 0;
    while (Date.now() - t0 < maxMs) {
      const elapsed = Math.floor((Date.now() - t0) / 1000);
      await new Promise((r) => setTimeout(r, Math.min(1000, 350 + i * 8)));
      i += 1;
      const res = await P.api.getJob(jobId);
      const job = res?.job;
      if (!job) break;
      if (job.status === "completed") {
        const resolved = P._resolveJobOutcome(job, rolling);
        if (resolved?.type === "rolling") return { kind: "rolling", out: resolved.out };
        if (resolved?.timeline) return { kind: "timeline", timeline: resolved.timeline };
        return { kind: "raw", raw: job.result };
      }
      if (job.status === "failed") throw new Error(job.error || "job failed");
      if (job.status === "missing") throw new Error("仿真任务不存在或已过期，请重新运行");
      P.syncSimJobProgressUi?.(job.progress);
      if (st) {
        st.textContent = P.formatSimWaitStatus(
          rolling,
          elapsed,
          null,
          job.progress
        );
      }
    }
    P.syncSimJobProgressUi?.(null);
    throw new Error("仿真超时（超过 " + Math.round(maxMs / 1000) + " 秒），请重试");
  };

  P.syncSimModeHint = function () {
    const st = document.getElementById("sim-status");
    if (!st || P.simState?.timeline?.frames?.length) return;
    if (!st.textContent || st.textContent.indexOf("失败") < 0) st.textContent = "";
  };

  P.syncSimArrivalFields = function () {
    const mode = P.getSimArrivalProcessMode();
    if (P._simArrivalFieldsMode === "step" && mode !== "step") {
      P.syncSimVehicleRowFromDom?.(P.clampSimStepVehicleIndex?.());
    }
    P._simArrivalFieldsMode = mode;
    const uniform = mode === "uniform";
    const step = mode === "step";
    const sequence = mode === "explicit";
    const label = document.getElementById("sim-duration-label");
    const input = document.getElementById("sim-duration-min");
    if (label) label.hidden = !uniform;
    if (input) {
      input.hidden = !uniform;
      input.disabled = !uniform;
    }
    const queueSec = document.getElementById("sim-vehicle-queue-section");
    if (queueSec) queueSec.hidden = !step && !sequence;
    const queueTitle = document.getElementById("sim-vehicle-queue-title");
    if (queueTitle) {
      queueTitle.textContent = step ? "当前车辆 · 到达 · 楼 · 入口" : "逐车：到达 · 楼 · 入口";
    }
    const stepNav = document.getElementById("sim-step-nav");
    if (stepNav) stepNav.hidden = !step;
    const stepRunMode = document.getElementById("sim-step-run-mode-wrap");
    if (stepRunMode) stepRunMode.hidden = !step;
    P.syncSimStepRunModeDesc?.();
    const batchOpts = document.getElementById("sim-batch-options");
    if (batchOpts) batchOpts.hidden = step;
    const advanced = document.getElementById("sim-rolling-advanced");
    if (advanced) advanced.hidden = step;
    const stochastic = mode === "poisson" || mode === "normal_gap";
    const stochBox = document.getElementById("sim-stochastic-fields");
    if (stochBox) stochBox.hidden = !stochastic;
    const poLab = document.getElementById("sim-poisson-lambda-label");
    const poIn = document.getElementById("sim-poisson-lambda");
    const nmLab = document.getElementById("sim-normal-mean-label");
    const nmIn = document.getElementById("sim-normal-mean-gap");
    const nsLab = document.getElementById("sim-normal-sigma-label");
    const nsIn = document.getElementById("sim-normal-sigma-gap");
    const poShow = mode === "poisson";
    const ngShow = mode === "normal_gap";
    if (poLab) poLab.hidden = !poShow;
    if (poIn) poIn.hidden = !poShow;
    if (nmLab) nmLab.hidden = !ngShow;
    if (nmIn) nmIn.hidden = !ngShow;
    if (nsLab) nsLab.hidden = !ngShow;
    if (nsIn) nsIn.hidden = !ngShow;
    const samplePre = document.getElementById("sim-sample-arrivals");
    if (samplePre && !stochastic) {
      samplePre.hidden = true;
      samplePre.textContent = "";
    }
    P.syncSimToolbarVisibility?.();
    if (step) P.hideArrivalCompareSection?.();
    if ((step || sequence) && P.scenario) {
      P.scenario.entrance_mode = "fixed";
      const em = document.getElementById("entrance-mode");
      if (em) em.value = "fixed";
      const vam = document.getElementById("veh-arrival-mode");
      if (vam) vam.value = "absolute";
    }
    P.renderSimVehicleQueue?.();
    P.updateActionGates?.();
  };

  P.clampSimStepVehicleIndex = function () {
    const n = Math.max(1, parseInt(P.scenario?.n_veh, 10) || 1);
    if (typeof P.simStepVehicleIndex !== "number" || !Number.isFinite(P.simStepVehicleIndex)) {
      P.simStepVehicleIndex = 0;
    }
    P.simStepVehicleIndex = Math.min(Math.max(0, P.simStepVehicleIndex), n - 1);
    return P.simStepVehicleIndex;
  };

  P.syncSimStepNavUi = function () {
    if (P.getSimArrivalProcessMode() !== "step" || !P.scenario) return;
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const i = P.clampSimStepVehicleIndex();
    const ind = document.getElementById("sim-step-indicator");
    if (ind) ind.textContent = "车 " + (i + 1) + " / " + n;
    const prev = document.getElementById("sim-step-prev");
    const next = document.getElementById("sim-step-next");
    if (prev) prev.disabled = i <= 0;
    if (next) next.disabled = i >= n - 1;
  };

  P.goSimStepVehicle = function (delta) {
    if (P.getSimArrivalProcessMode() !== "step" || !P.scenario) return;
    const cur = P.clampSimStepVehicleIndex();
    P.syncSimVehicleRowFromDom?.(cur);
    P.simStepVehicleIndex = cur + (parseInt(delta, 10) || 0);
    P.clampSimStepVehicleIndex();
    P.renderSimVehicleQueue?.();
  };

  P.appendSimVehicleQueueRow = function (list, i, step) {
    const nb = P.scenario.buildings?.length ?? 0;
    const ne = Math.max(1, P.scenario.entrances?.length ?? 1);
    const row = document.createElement("div");
    row.className =
      "vehicle-target-row sim-vehicle-queue-row" + (step ? " sim-vehicle-queue-row--step" : "");
    const head = document.createElement("span");
    head.className = "sim-vehicle-queue-head";
    head.textContent = "车 " + (i + 1);
    row.appendChild(head);
    const alab = document.createElement("label");
    alab.textContent = "到达(s)";
    alab.setAttribute("for", "sim-veh-arr-" + i);
    const aIn = document.createElement("input");
    aIn.type = "number";
    aIn.id = "sim-veh-arr-" + i;
    aIn.min = "0";
    aIn.step = "0.5";
    aIn.value = String(Number(P.scenario.vehicle_arrival_sec[i]) || i * 2);
      aIn.addEventListener("change", () => {
        const v = parseFloat(aIn.value);
        P.scenario.vehicle_arrival_sec[i] = Number.isFinite(v) ? Math.max(0, v) : 0;
        P.truncateSimStepSession?.(i);
        P.schedulePersistCurrentState?.();
      });
    row.appendChild(alab);
    row.appendChild(aIn);
    const dlab = document.createElement("label");
    dlab.textContent = "目的楼";
    dlab.setAttribute("for", "sim-veh-dest-" + i);
    const dSel = document.createElement("select");
    dSel.id = "sim-veh-dest-" + i;
    if (nb === 0) {
      const opt = document.createElement("option");
      opt.textContent = "（无居民楼）";
      dSel.appendChild(opt);
      dSel.disabled = true;
    } else {
      for (let b = 0; b < nb; b++) {
        const opt = document.createElement("option");
        opt.value = String(b);
        opt.textContent = "楼 " + (b + 1);
        dSel.appendChild(opt);
      }
      dSel.value = String(P.scenario.vehicle_destinations[i] ?? 0);
        dSel.addEventListener("change", () => {
          P.scenario.vehicle_destinations[i] = parseInt(dSel.value, 10) || 0;
          P.truncateSimStepSession?.(i);
          P.invalidateOptimizationResult?.();
          P.schedulePersistCurrentState?.();
        });
    }
    row.appendChild(dlab);
    row.appendChild(dSel);
    const elab = document.createElement("label");
    elab.textContent = "入口";
    elab.setAttribute("for", "sim-veh-ent-" + i);
    const eSel = document.createElement("select");
    eSel.id = "sim-veh-ent-" + i;
    for (let ei = 0; ei < ne; ei++) {
      const opt = document.createElement("option");
      opt.value = String(ei);
      opt.textContent = P.entranceDisplayName?.(ei) || "入口 " + (ei + 1);
      eSel.appendChild(opt);
    }
    eSel.value = String(P.scenario.vehicle_entrances[i] ?? 0);
      eSel.addEventListener("change", () => {
        P.scenario.vehicle_entrances[i] = parseInt(eSel.value, 10) || 0;
        P.scenario.entrance_mode = "fixed";
        P.truncateSimStepSession?.(i);
        P.invalidateOptimizationResult?.();
        P.schedulePersistCurrentState?.();
      });
    row.appendChild(elab);
    row.appendChild(eSel);
    if (step) {
      const runBtn = document.createElement("button");
      runBtn.type = "button";
      runBtn.className = "sim-vehicle-run-one primary";
      runBtn.textContent = "运行此车";
      runBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        P.syncSimVehicleRowFromDom?.(i);
        P.runSingleVehicleSimulation(i);
      });
      row.appendChild(runBtn);
    }
    list.appendChild(row);
  };

  P.renderSimVehicleQueue = function () {
    const section = document.getElementById("sim-vehicle-queue-section");
    const list = document.getElementById("sim-vehicle-queue-list");
    if (!list || !P.scenario) return;
    const mode = P.getSimArrivalProcessMode();
    const step = mode === "step";
    if (section) section.hidden = !P.simUsesVehicleQueue();
    if (!P.simUsesVehicleQueue()) return;
    P.ensureVehicleDestinationsArray?.();
    P.ensureVehicleEntrancesArray?.();
    P.ensureVehicleArrivalSecArray?.();
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    list.classList.toggle("sim-vehicle-queue-list--step-single", step);
    list.innerHTML = "";
    if (step) {
      const i = P.clampSimStepVehicleIndex();
      P.appendSimVehicleQueueRow(list, i, true);
      P.syncSimStepNavUi?.();
    } else {
      for (let i = 0; i < n; i++) P.appendSimVehicleQueueRow(list, i, false);
    }
  };

  P.syncSimVehicleRowFromDom = function (i) {
    if (!P.scenario) return;
    const aIn = document.getElementById("sim-veh-arr-" + i);
    const dSel = document.getElementById("sim-veh-dest-" + i);
    const eSel = document.getElementById("sim-veh-ent-" + i);
    if (aIn) {
      const v = parseFloat(aIn.value);
      P.scenario.vehicle_arrival_sec[i] = Number.isFinite(v) ? Math.max(0, v) : 0;
    }
    if (dSel && !dSel.disabled) {
      P.scenario.vehicle_destinations[i] = parseInt(dSel.value, 10) || 0;
    }
    if (eSel) {
      P.scenario.vehicle_entrances[i] = parseInt(eSel.value, 10) || 0;
      P.scenario.entrance_mode = "fixed";
    }
  };

  /** 逐车调试：从车 1 到第 i 辆（含）累积滚动，先前车辆仍占用车位。 */
  P.buildStepScenarioThroughIndex = function (vehicleIndex) {
    const s = P.scenario;
    const i = Math.max(0, parseInt(vehicleIndex, 10) || 0);
    const n = Math.min(i + 1, Math.max(1, parseInt(s.n_veh, 10) || 1));
    const one = JSON.parse(JSON.stringify(s));
    one.n_veh = n;
    one.entrance_mode = "fixed";
    one.vehicle_destinations = (s.vehicle_destinations || []).slice(0, n);
    one.vehicle_entrances = (s.vehicle_entrances || []).slice(0, n);
    one.vehicle_requirements = (s.vehicle_requirements || []).slice(0, n);
    while (one.vehicle_requirements.length < n) one.vehicle_requirements.push("normal");
    P.ensureVehicleArrivalSecArray?.();
    const arrivals = (s.vehicle_arrival_sec || []).slice(0, n).map((v, idx) => {
      const t = Number(v);
      return Number.isFinite(t) ? Math.max(0, t) : idx * 2;
    });
    while (arrivals.length < n) arrivals.push(arrivals.length * 2);
    one.vehicle_arrival_sec = arrivals;
    return { scenario: one, arrivals_sec: arrivals, throughIndex: i, vehicleCount: n };
  };

  P.buildIsolatedStepScenario = function (vehicleIndex) {
    const s = P.scenario;
    const i = Math.max(0, parseInt(vehicleIndex, 10) || 0);
    const one = JSON.parse(JSON.stringify(s));
    one.n_veh = 1;
    one.entrance_mode = "fixed";
    one.vehicle_destinations = [s.vehicle_destinations[i] ?? 0];
    one.vehicle_entrances = [s.vehicle_entrances[i] ?? 0];
    one.vehicle_requirements = [(s.vehicle_requirements || [])[i] || "normal"];
    const arr = Math.max(0, Number(s.vehicle_arrival_sec[i]) || 0);
    one.vehicle_arrival_sec = [arr];
    return { scenario: one, arrivals_sec: [arr], throughIndex: i, vehicleCount: 1 };
  };

  P.runRollingSimulation = async function (scenario, schedule, st, statusPrefix) {
    if (st && statusPrefix) st.textContent = statusPrefix + P.formatSimWaitStatus(true, 0).replace(/^在线滚动仿真计算中/, "计算中");
    else if (st) st.textContent = P.formatSimWaitStatus(true, 0);
    if (!P.api?.simulateRolling) {
      if (st) st.textContent = "在线滚动需连接后端 API。";
      return false;
    }
    const res = await P.api.simulateRolling(scenario, schedule, true);
    if (res.timeline && res.success !== false) {
      P.applyRollingSimOutcome(res, st);
      return true;
    }
    if (res.job_id) {
      await P.watchSimJob(res.job_id, st, true);
      return true;
    }
    return false;
  };

  P.runSingleVehicleSimulation = async function (vehicleIndex) {
    const st = document.getElementById("sim-status");
    if (P.getSimArrivalProcessMode() !== "step") {
      if (st) st.textContent = "单车试跑请在「到达过程」中选择「逐车调试」。";
      return;
    }
    const gate = P.canRunRollingSimulation?.();
    if (gate && !gate.ok) {
      P.showWorkspaceMessage?.(gate.reason, { level: "warn", alsoResult: false });
      if (st) st.textContent = gate.reason;
      return;
    }
    const i = parseInt(vehicleIndex, 10);
    const n = parseInt(P.scenario?.n_veh, 10) || 0;
    if (!Number.isFinite(i) || i < 0 || i >= n) return;
    P.syncSimVehicleRowFromDom(i);
    let runMode = P.getSimStepRunMode?.() || "cumulative";
    let built;
    if (runMode === "isolated") {
      built = P.buildIsolatedStepScenario(i);
    } else {
      built = P.buildStepScenarioThroughIndex(i);
    }
    const schedule = {
      mode: "explicit",
      arrivals_sec: built.arrivals_sec,
      count: built.vehicleCount,
      entrance_capacity: 1,
      realistic: document.getElementById("sim-realistic")?.checked !== false,
    };
    if (runMode === "incremental" && i > 0) {
      const pa = (P.simStepSession?.assign || []).slice(0, i);
      const ok =
        pa.length >= i && pa.every((slot, k) => k < i && Number.isFinite(Number(slot)) && Number(slot) >= 0);
      if (ok) {
        schedule.prefix_assign = pa;
      } else if (st) {
        st.textContent = "增量模式需先按顺序跑完前面车辆；本次改为累积重算。";
        runMode = "cumulative";
      }
    }
    P._simTimelineSeekEnd = runMode !== "isolated";
    let statusPrefix = "车 " + (i + 1) + " · ";
    if (runMode === "isolated") statusPrefix = "车 " + (i + 1) + " 单车预览 · ";
    else if (runMode === "incremental" && schedule.prefix_assign) {
      statusPrefix = "车 " + (i + 1) + " 增量 · ";
    } else if (built.vehicleCount > 1) {
      statusPrefix = "车 1–" + (i + 1) + " 累积 · ";
    }
    try {
      await P.runRollingSimulation(built.scenario, schedule, st, statusPrefix);
    } catch (e) {
      console.warn("single vehicle sim failed", e);
      if (st) st.textContent = "单车仿真失败：" + (e.message || e);
    }
    P.updateActionGates?.();
  };

  P.countSimFrameStates = function (frame) {
    const vehicles = frame?.vehicles || [];
    let arrived = 0;
    let pending = 0;
    let queued = 0;
    let driving = 0;
    let walking = 0;
    let done = 0;
    for (const v of vehicles) {
      if (v.state === "pending") pending += 1;
      else {
        arrived += 1;
        if (v.state === "queued") queued += 1;
        else if (v.state === "driving") driving += 1;
        else if (v.state === "walking") walking += 1;
        else if (v.state === "parked") done += 1;
        else if (v.state === "departed") done += 1;
        else if (v.state === "done") done += 1;
      }
    }
    return {
      total: vehicles.length,
      arrived,
      pending,
      queued,
      driving,
      walking,
      done,
    };
  };

  P.updateSimLiveStatus = function () {
    const el = document.getElementById("sim-live-status");
    const frame = P.simState.timeline?.frames?.[P.simState.frameIndex];
    if (!el) return;
    if (!frame) {
      el.textContent = "尚未运行";
      el.classList.remove("sim-live-status--active");
      return;
    }
    el.classList.add("sim-live-status--active");
    const c = P.countSimFrameStates(frame);
    el.textContent =
      "已到达 " +
      c.arrived +
      " / " +
      c.total +
      " 辆 · 入口排队 " +
      (Number(frame.queue) || 0) +
      " · 驶入 " +
      c.driving +
      " · 步行 " +
      c.walking +
      " · 已完成 " +
      c.done;
  };

  P.updateSimTimeLabel = function () {
    const el = document.getElementById("sim-time-label");
    const frame = P.simState.timeline?.frames?.[P.simState.frameIndex];
    if (!el) return;
    const t = frame?.t;
    el.textContent =
      "回放时间：" + (Number.isFinite(Number(t)) ? Number(t).toFixed(1) : "0.0") + " s";
    P.updateSimLiveStatus?.();
  };

  P.applySimTimeline = function (timeline, st, label) {
    P.simState.timeline = timeline;
    const frames = timeline?.frames;
    if (P._simTimelineSeekEnd && frames?.length) {
      P.simState.frameIndex = frames.length - 1;
      P._simTimelineSeekEnd = false;
    } else {
      P.simState.frameIndex = 0;
    }
    P._simulationRan = true;
    P._syncSimScrubMax();
    P.drawSimQueueChart?.(timeline);
    if (st) st.textContent = label || "仿真就绪";
    P.updateWorkflowGuide?.();
    P.updateSimStats?.();
    P.updateSimTimeLabel?.();
    P.updateActionGates?.();
    P.draw();
  };

  P.applyRollingSimOutcome = function (out, st) {
    if (out?.result) {
      P.lastResult = out.result;
      P.syncResultToScenario?.();
      P.updateResultsPanel?.();
    }
    let label = P.apiOnline ? "在线滚动仿真就绪" : "本地滚动仿真就绪";
    if (out?.rolling_total_cost != null && out?.static_reference_value != null) {
      const gap = out.rolling_total_cost - out.static_reference_value;
      label +=
        " · 代价 " +
        out.rolling_total_cost.toFixed(1) +
        " / 全信息 " +
        out.static_reference_value.toFixed(1) +
        "（+" +
        gap.toFixed(1) +
        "）";
    }
    P.applySimTimeline(out.timeline, st, label);
    P.renderSimSampleArrivals?.(out.schedule_realized);
    P.syncSimJobProgressUi?.(null);
    if (P.getSimArrivalProcessMode?.() === "step" && out?.result?.assign?.length) {
      P.simStepSession = P.simStepSession || { assign: [] };
      P.simStepSession.assign = out.result.assign.slice();
    }
  };

  P.fetchSimApiPayload = async function (initialRes, rolling, st) {
    if (!initialRes) return null;
    if (initialRes.timeline?.frames || initialRes.frames) {
      return rolling ? initialRes : { timeline: initialRes.timeline || initialRes };
    }
    if (initialRes.job_id && P.api?.getJob) {
      const done = await P.pollSimJobUntilDone(initialRes.job_id, st, rolling);
      if (done.kind === "rolling") return done.out;
      if (done.kind === "timeline") return { timeline: done.timeline };
      return done.raw;
    }
    return initialRes;
  };

  P.ensureStaticOptimizeResult = async function () {
    const isExact = String(P.lastResult?.optimizer || "").toLowerCase() === "exact";
    if (P.lastResult?.assign?.length && isExact) return P.lastResult;
    if (!P.apiOnline && P.optimizer?.runOptimize) {
      const raw = P.optimizer.runOptimize(JSON.parse(JSON.stringify(P.scenario)), {
        method: "exact",
      });
      P.lastResult = P.normalizeOptimizeResult(raw, "exact", P.scenario);
      P.syncResultToScenario?.();
      P.updateResultsPanel?.();
      return P.lastResult;
    }
    if (!P.api?.optimize) throw new Error("无 optimize API");
    const methodEl = document.getElementById("optimizer-method");
    const method = methodEl?.value === "pso" ? "pso" : "exact";
    const seedEl = document.getElementById("pso-seed");
    const seed = seedEl?.value ? parseInt(seedEl.value, 10) : undefined;
    const res = await P.api.optimize(P.scenario, method, seed);
    if (res?.assign || res?.gbest_value != null) {
      P.lastResult = res;
      P.syncResultToScenario?.();
      P.updateResultsPanel?.();
      return res;
    }
    throw new Error("优化未返回有效结果");
  };

  P.hideArrivalCompareSection = function () {
    const section = document.getElementById("arrival-compare-section");
    const exp = document.getElementById("arrival-compare-export");
    if (section) section.hidden = true;
    if (exp) exp.hidden = true;
    P.lastSimExportPayload = null;
  };

  P.syncArrivalCompareExport = function (payload, kind) {
    P.lastSimExportPayload = payload ? { kind: kind || "compare", exported_at: new Date().toISOString(), ...payload } : null;
    const exp = document.getElementById("arrival-compare-export");
    if (exp) exp.hidden = !P.lastSimExportPayload;
  };

  P.exportArrivalCompareJson = function () {
    if (!P.lastSimExportPayload) return;
    const blob = new Blob([JSON.stringify(P.lastSimExportPayload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "parking-sim-" + (P.lastSimExportPayload.kind || "export") + ".json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  P.renderArrivalCompareTable = function (rollingOut, staticTimeline, staticResult) {
    const host = document.getElementById("arrival-compare-table");
    const section = document.getElementById("arrival-compare-section");
    const title = document.getElementById("arrival-compare-title");
    if (title) title.textContent = "策略对照";
    if (!host) return;
    const rs = rollingOut?.timeline?.stats || {};
    const ss = staticTimeline?.stats || {};
    const rollCost = rollingOut?.rolling_total_cost;
    const staticCost =
      rollingOut?.static_reference_value ??
      staticResult?.gbest_value ??
      staticResult?.gbestValue;
    const fmt = (v, digits) =>
      v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(digits ?? 1);
    const gap =
      rollCost != null && staticCost != null ? Number(rollCost) - Number(staticCost) : null;
    host.innerHTML =
      '<table class="compare-data arrival-compare-data"><thead><tr>' +
      "<th>指标</th><th>在线滚动</th><th>全信息基准</th></tr></thead><tbody>" +
      "<tr><td>总代价 (s)</td><td>" +
      fmt(rollCost) +
      "</td><td>" +
      fmt(staticCost) +
      "</td></tr>" +
      "<tr><td>相对全信息 Δ</td><td colspan=\"2\">" +
      (gap != null ? (gap >= 0 ? "+" : "") + gap.toFixed(1) + " s" : "—") +
      "</td></tr>" +
      "<tr><td>峰值排队 (辆)</td><td>" +
      fmt(rs.peak_queue, 0) +
      "</td><td>" +
      fmt(ss.peak_queue, 0) +
      "</td></tr>" +
      "<tr><td>平均等入口 (s)</td><td>" +
      fmt(rs.avg_wait_until_drive) +
      "</td><td>" +
      fmt(ss.avg_wait_until_drive) +
      "</td></tr>" +
      "<tr><td>P95 总耗时 (s)</td><td>" +
      fmt(rs.p95_total_time) +
      "</td><td>" +
      fmt(ss.p95_total_time) +
      "</td></tr>";
    const om = rollingOut?.objective_metrics || {};
    if (om.fairness_walk_range != null || om.entrance_load_variance != null) {
      host.innerHTML +=
        "<tr><td>楼间步行极差 (s)</td><td colspan=\"2\">" +
        fmt(om.fairness_walk_range) +
        "</td></tr>" +
        "<tr><td>入口负载方差</td><td colspan=\"2\">" +
        fmt(om.entrance_load_variance, 2) +
        "</td></tr>" +
        "<tr><td>加权综合代价</td><td colspan=\"2\">" +
        fmt(rollingOut.composite_cost) +
        "</td></tr>";
    }
    host.innerHTML += "</tbody></table>";
    if (section) section.hidden = false;
    P.syncArrivalCompareExport?.(
      {
        schedule: P.arrivalCompare?.schedule,
        rolling: {
          rolling_total_cost: rollCost,
          composite_cost: rollingOut?.composite_cost,
          objective_metrics: rollingOut?.objective_metrics,
          stats: rs,
        },
        static: { gbest_value: staticCost, stats: ss },
      },
      "compare"
    );
  };

  P.renderMonteCarloSummary = function (out) {
    const host = document.getElementById("arrival-compare-table");
    const section = document.getElementById("arrival-compare-section");
    const title = document.getElementById("arrival-compare-title");
    if (title) title.textContent = "随机抽样摘要";
    if (!host || !out) return;
    const fmt = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : Number(v).toFixed(1));
    host.innerHTML =
      '<table class="compare-data arrival-compare-data"><thead><tr><th>Monte Carlo</th><th>值</th></tr></thead><tbody>' +
      "<tr><td>完成次数</td><td>" +
      (out.runs_completed ?? "—") +
      "/" +
      (out.runs_requested ?? "—") +
      "</td></tr>" +
      "<tr><td>滚动代价均值 (s)</td><td>" +
      fmt(out.rolling_cost_mean) +
      "</td></tr>" +
      "<tr><td>滚动代价 P95 (s)</td><td>" +
      fmt(out.rolling_cost_p95) +
      "</td></tr>" +
      "<tr><td>Δ 全信息均值 (s)</td><td>" +
      fmt(out.delta_mean) +
      "</td></tr>" +
      "<tr><td>Δ 全信息 P95 (s)</td><td>" +
      fmt(out.delta_p95) +
      "</td></tr>" +
      "</tbody></table>";
    if (section) section.hidden = false;
    if (out.samples?.[0]?.arrivals_sec) P.renderSimSampleArrivals?.({ arrivals_sec: out.samples[0].arrivals_sec, seed: out.base_seed });
    P.syncArrivalCompareExport?.({ monte_carlo: out, schedule: P.buildSimSchedule?.() }, "monte_carlo");
  };

  P.runMonteCarloRolling = async function () {
    const st = document.getElementById("sim-status");
    const mode = P.getSimArrivalProcessMode();
    if (mode !== "poisson" && mode !== "normal_gap") {
      if (st) st.textContent = "Monte Carlo 仅用于 Poisson / 正态间隔到达。";
      return;
    }
    const schedule = P.buildSimSchedule();
    if (st) st.textContent = "随机抽样中…";
    try {
      if (!P.apiOnline) {
        const runs = 20;
        const baseSeed = Number.isFinite(Number(schedule.seed)) ? Number(schedule.seed) : 42;
        const staticResult = await P.ensureStaticOptimizeResult();
        const staticCost = Number(staticResult?.gbest_value ?? staticResult?.gbestValue ?? 0);
        const rollCosts = [];
        const deltas = [];
        const samples = [];
        for (let r = 0; r < runs; r++) {
          if (st) st.textContent = "本地抽样 " + (r + 1) + "/" + runs + "…";
          await new Promise((resolve) => setTimeout(resolve, 0));
          const out = P.runRollingLocal({ ...schedule, seed: baseSeed + r });
          if (!out?.success) throw new Error(out?.message || "本地滚动失败");
          const rc = Number(out.rolling_total_cost) || 0;
          rollCosts.push(rc);
          deltas.push(rc - staticCost);
          samples.push({
            run: r,
            seed: baseSeed + r,
            arrivals_sec: out.schedule_realized?.arrivals_sec || [],
            rolling_total_cost: rc,
          });
        }
        const pct = (arr) => {
          const sorted = arr.slice().sort((a, b) => a - b);
          return sorted.length ? sorted[Math.floor(0.95 * (sorted.length - 1))] : 0;
        };
        const mean = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const summary = {
          success: true,
          runs_requested: runs,
          runs_completed: runs,
          base_seed: baseSeed,
          rolling_cost_mean: mean(rollCosts),
          rolling_cost_p95: pct(rollCosts),
          delta_mean: mean(deltas),
          delta_p95: pct(deltas),
          static_cost: staticCost,
          samples,
        };
        P.renderMonteCarloSummary(summary);
        if (st) st.textContent = "本地抽样完成 · 均值 " + summary.rolling_cost_mean.toFixed(1) + " s";
        return;
      }
      const init = await P.api.monteCarloRolling(P.scenario, schedule, 20, schedule.seed ?? 42, true);
      let out = init;
      if (init.job_id) {
        const done = await P.pollSimJobUntilDone(init.job_id, st, false, 600000);
        out = done.raw || done;
      }
      if (out && out.success !== false) {
        P.renderMonteCarloSummary(out);
        if (st) st.textContent = "抽样完成 · 均值 " + (out.rolling_cost_mean?.toFixed?.(1) ?? "—") + " s";
      } else throw new Error(out?.message || "Monte Carlo 失败");
    } catch (e) {
      if (st) st.textContent = "Monte Carlo 失败：" + (e.message || e);
    }
  };

  P.runArrivalCompare = async function () {
    const st = document.getElementById("sim-status");
    const gate = P.canRunRollingSimulation?.();
    if (gate && !gate.ok) {
      P.showWorkspaceMessage?.(gate.reason, { level: "warn", alsoResult: false });
      if (st) st.textContent = gate.reason;
      return;
    }
    const schedule = P.buildSimSchedule({ include_static_reference: true });
    if (st) st.textContent = "本地对照计算中…";
    try {
      if (!P.apiOnline) {
        const rollingOut = P.runRollingLocal(schedule);
        if (!rollingOut?.success || !rollingOut?.timeline?.frames?.length) {
          throw new Error(rollingOut?.message || "本地滚动仿真无时间轴");
        }
        const staticResult = await P.ensureStaticOptimizeResult();
        const staticTimeline = P.runSimulationLocal(staticResult, schedule);
        P.arrivalCompare = { schedule, rollingOut, staticTimeline, staticResult };
        P.renderArrivalCompareTable(rollingOut, staticTimeline, staticResult);
        P.applyRollingSimOutcome(rollingOut, st);
        P.syncSimModeHint?.();
        P.updateActionGates?.();
        return;
      }
      const rollInit = await P.api.simulateRolling(P.scenario, schedule, true);
      const rollingOut = await P.fetchSimApiPayload(rollInit, true, st);
      if (!rollingOut?.timeline?.frames?.length) {
        throw new Error(rollingOut?.message || "滚动仿真无时间轴");
      }
      const staticResult = await P.ensureStaticOptimizeResult();
      const staticInit = await P.api.simulate(staticResult, schedule, true);
      const staticPack = await P.fetchSimApiPayload(staticInit, false, st);
      const staticTimeline = staticPack?.timeline || staticPack;
      P.arrivalCompare = { schedule, rollingOut, staticTimeline, staticResult };
      P.renderArrivalCompareTable(rollingOut, staticTimeline, staticResult);
      P.applyRollingSimOutcome(rollingOut, st);
      P.syncSimModeHint?.();
    } catch (e) {
      console.warn("arrival compare failed", e);
      if (st) st.textContent = "对照失败：" + (e.message || e);
      P.showWorkspaceMessage?.("对照失败：" + (e.message || e), { level: "error", alsoResult: false });
    }
    P.updateActionGates?.();
  };

  P.runSimulation = async function () {
    if (!P.scenario) {
      const st = document.getElementById("sim-status");
      if (st) st.textContent = "缺少场景。";
      return;
    }
    if (P.getSimArrivalProcessMode() === "step") {
      const st = document.getElementById("sim-status");
      return;
    }
    const gate = P.canRunRollingSimulation?.();
    if (gate && !gate.ok) {
      P.showWorkspaceMessage?.(gate.reason, { level: "warn", alsoResult: false });
      const st = document.getElementById("sim-status");
      if (st) st.textContent = gate.reason;
      return;
    }
    const st = document.getElementById("sim-status");
    const schedule = P.buildSimSchedule();
    if (!P.apiOnline) {
      if (st) st.textContent = "本地滚动计算中…";
      await new Promise((resolve) => setTimeout(resolve, 20));
      try {
        const out = P.runRollingLocal(schedule);
        if (!out?.success) {
          if (st) st.textContent = out?.message || "本地滚动仿真失败";
          return;
        }
        P.applyRollingSimOutcome(out, st);
      } catch (e) {
        if (st) st.textContent = "本地滚动仿真失败：" + (e.message || e);
      }
      return;
    }
    try {
      await P.runRollingSimulation(P.scenario, schedule, st, "");
    } catch (e) {
      console.warn("api simulate failed", e);
      if (st) st.textContent = "仿真失败：" + (e.message || e);
    }
  };

  P._syncSimScrubMax = function () {
    const slider = document.getElementById("sim-scrub");
    const n = P.simState.timeline?.frames?.length || 0;
    if (slider && n > 0) {
      slider.max = String(n - 1);
      slider.value = String(P.simState.frameIndex || 0);
    }
    P.updateSimTimeLabel?.();
  };

  P._resolveJobOutcome = function (job, rolling) {
    const raw = job?.result;
    if (!raw) return null;
    if (rolling && raw.timeline) return { type: "rolling", out: raw };
    if (raw.frames) return { type: "timeline", timeline: raw };
    if (raw.timeline?.frames) return { type: "timeline", timeline: raw.timeline };
    return null;
  };

  P.watchSimJob = async function (jobId, st, rolling) {
    const t0 = Date.now();
    try {
      if (P.api?.watchJob) {
        const data = await P.api.watchJob(jobId, (msg) => {
          P.syncSimJobProgressUi?.(msg.progress);
          if (!st) return;
          const elapsed = Math.floor((Date.now() - t0) / 1000);
          st.textContent = P.formatSimWaitStatus(rolling, elapsed, null, msg.progress);
        });
        if (data?.result) {
          const resolved = P._resolveJobOutcome({ result: data.result }, rolling);
          if (resolved?.type === "rolling") {
            P.applyRollingSimOutcome(resolved.out, st);
            return;
          }
          if (resolved?.timeline) {
            P.applySimTimeline(resolved.timeline, st, "仿真就绪");
            return;
          }
        }
      }
    } catch (e) {
      console.warn("websocket job watch failed, fallback to poll", e);
    }
    try {
      const done = await P.pollSimJobUntilDone(jobId, st, rolling);
      if (done.kind === "rolling") {
        P.applyRollingSimOutcome(done.out, st);
        return;
      }
      if (done.kind === "timeline") {
        P.applySimTimeline(done.timeline, st, "仿真就绪");
        return;
      }
    } catch (e) {
      if (st) st.textContent = "仿真失败：" + (e.message || e);
    }
  };

  P.runSimulationLocal = function (result, schedule) {
    const breakdown = result.vehicle_breakdown || [];
    const n = breakdown.length;
    const arrivals = P.buildLocalArrivals(n, schedule);
    const drive_durations = breakdown.map((bd) => Number(bd.drive_time || 0));
    const cap = Math.max(1, schedule.entrance_capacity || 1);
    const realistic = schedule.realistic !== false;
    const liveScenario = result.scenario || P.scenario || {};
    let drive_starts = arrivals.slice();
    if (realistic) {
      let nEnt = Math.max(1, P.scenario?.entrances?.length || 1);
      for (const bd of breakdown) {
        nEnt = Math.max(nEnt, (Number(bd.entrance_index) || 0) + 1);
      }
      const freeAt = Array.from({ length: nEnt }, () => 0);
      const order = arrivals.map((_, i) => i).sort((a, b) => arrivals[a] - arrivals[b] || a - b);
      drive_starts = arrivals.slice();
      for (const i of order) {
        const ei = Math.max(
          0,
          Math.min(nEnt - 1, Number(breakdown[i]?.entrance_index) || 0)
        );
        const arr = arrivals[i];
        const start = Math.max(arr, freeAt[ei]);
        drive_starts[i] = start;
        freeAt[ei] = start + drive_durations[i];
      }
    }

    const events = breakdown.map((bd, i) => {
      const arr = arrivals[i] ?? i * 5;
      const drive_t = drive_durations[i];
      const walk_t = Number(bd.walk_time || 0);
      const ds = drive_starts[i];
      const ei = Number(bd.entrance_index || 0);
      const ent = (liveScenario.entrances || [[0, 0]])[ei] || [0, 0];
      const si = Number(bd.slot_index ?? 0);
      const slot = (liveScenario.slots || [])[si] || [0, 0];
      const parkAt = [slot[0], slot[1]];
      const dpRaw = result.drive_paths?.[i];
      const drive_path =
        Array.isArray(dpRaw) && dpRaw.length >= 2
          ? dpRaw.map((p) => [Number(p[0]), Number(p[1])])
          : [ent, parkAt];
      return {
        arrival: arr,
        drive_start: ds,
        drive_end: ds + drive_t,
        walk_end: ds + drive_t + walk_t,
        entrance: ent,
        park_at: parkAt,
        drive_path,
        path: result.paths?.[i] || [ent, parkAt],
      };
    });

    const endT = events.length ? Math.max(...events.map((e) => e.walk_end)) : 0;
    const frames = [];
    let queue_len_peak = 0;
    const wait_samples = [];

    for (let t = 0; t <= endT + 0.5; t += 0.5) {
      const vehicles = [];
      let queue = 0;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        let state = "waiting";
        let x = ev.entrance[0];
        let y = ev.entrance[1];
        if (t < ev.arrival) {
          state = "pending";
        } else if (t < ev.drive_start) {
          state = "queued";
          queue += 1;
          wait_samples.push(t - ev.arrival);
        } else if (t < ev.drive_end) {
          state = "driving";
          const prog = (t - ev.drive_start) / Math.max(1e-6, ev.drive_end - ev.drive_start);
          const pt = P._interpPolylineAtProgress(ev.drive_path, prog);
          x = pt[0];
          y = pt[1];
        } else if (t < ev.walk_end) {
          state = "walking";
          const prog = (t - ev.drive_end) / Math.max(1e-6, ev.walk_end - ev.drive_end);
          const pt = P._interpPolylineAtProgress(ev.path, prog);
          x = pt[0];
          y = pt[1];
        } else {
          state = "done";
          const path = ev.path;
          x = path?.length ? path[path.length - 1][0] : ev.park_at[0];
          y = path?.length ? path[path.length - 1][1] : ev.park_at[1];
        }
        vehicles.push({ index: i, state, x, y });
      }
      queue_len_peak = Math.max(queue_len_peak, queue);
      frames.push({ t: Math.round(t * 100) / 100, vehicles, queue, occupied_count: 0 });
    }

    const total_times = events.map((e) => e.walk_end - e.arrival);
    total_times.sort((a, b) => a - b);
    const p95 = total_times.length
      ? total_times[Math.floor(0.95 * (total_times.length - 1))]
      : 0;
    const wait_until = events.map((e) => e.drive_start - e.arrival);

    return {
      frames,
      duration: endT,
      stats: {
        peak_queue: queue_len_peak,
        avg_wait: wait_samples.length ? wait_samples.reduce((a, b) => a + b, 0) / wait_samples.length : 0,
        avg_wait_until_drive: wait_until.length ? wait_until.reduce((a, b) => a + b, 0) / wait_until.length : 0,
        p95_total_time: p95,
        vehicle_count: n,
        realistic,
        entrance_capacity: cap,
      },
    };
  };

  P._polylineLen = function (pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return d;
  };

  P._interpPolylineAtProgress = function (pts, prog) {
    const path = Array.isArray(pts) ? pts : [];
    if (path.length < 2) {
      const p = path[0] || [0, 0];
      return [Number(p[0]) || 0, Number(p[1]) || 0];
    }
    const plen = P._polylineLen(path);
    if (plen < 1e-6) {
      return [Number(path[0][0]), Number(path[0][1])];
    }
    const dist = Math.max(0, Math.min(1, prog)) * plen;
    let remain = dist;
    for (let k = 1; k < path.length; k++) {
      const seg = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
      if (remain <= seg || k === path.length - 1) {
        const u = seg < 1e-9 ? 0 : remain / seg;
        return [
          path[k - 1][0] + (path[k][0] - path[k - 1][0]) * Math.min(1, u),
          path[k - 1][1] + (path[k][1] - path[k - 1][1]) * Math.min(1, u),
        ];
      }
      remain -= seg;
    }
    const last = path[path.length - 1];
    return [Number(last[0]), Number(last[1])];
  };

  P.drawSimQueueChart = function (timeline) {
    const canvas = document.getElementById("sim-queue-chart");
    if (!canvas) return;
    P.syncSimQueueChartSize?.();
    const ctx = canvas.getContext("2d");
    const w = P.simQueueCssW;
    const h = P.simQueueCssH;
    ctx.clearRect(0, 0, w, h);
    const frames = timeline?.frames || [];
    if (frames.length < 2) return;
    const padL = 36;
    const padR = 8;
    const padT = 10;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const t0 = frames[0].t;
    const t1 = frames[frames.length - 1].t || t0 + 1;
    let qMax = 1;
    for (const f of frames) qMax = Math.max(qMax, Number(f.queue) || 0);
    ctx.fillStyle = "#64748b";
    ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(qMax), padL - 4, padT + 4);
    ctx.fillText("0", padL - 4, padT + plotH);
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    frames.forEach((f, i) => {
      const x = padL + ((f.t - t0) / Math.max(1e-6, t1 - t0)) * plotW;
      const y = padT + plotH - ((Number(f.queue) || 0) / qMax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("时间 (s)", padL + plotW / 2, h - padB + 4);
    ctx.textAlign = "left";
    ctx.fillText("排队长度", 4, padT + 2);
  };

  P.toggleSimPlay = function () {
    P.simState.playing = !P.simState.playing;
    if (P.simState.playing) P.simTick();
    else if (P.simState.raf) cancelAnimationFrame(P.simState.raf);
  };

  P.simTick = function () {
    if (!P.simState.playing || !P.simState.timeline?.frames?.length) return;
    P.simState.frameIndex = (P.simState.frameIndex + 1) % P.simState.timeline.frames.length;
    const slider = document.getElementById("sim-scrub");
    if (slider) slider.value = String(P.simState.frameIndex);
    P.updateSimTimeLabel?.();
    P.updateSimStats();
    P.updateSimLiveStatus?.();
    P.draw();
    P.simState.raf = requestAnimationFrame(() => {
      setTimeout(P.simTick, 80);
    });
  };

  P.updateSimStats = function () {
    const el = document.getElementById("sim-stats");
    const stats = P.simState.timeline?.stats;
    const frame = P.simState.timeline?.frames?.[P.simState.frameIndex];
    if (!el) return;
    if (!stats && !frame) {
      el.textContent = "";
      return;
    }
    let txt = "当前排队: " + (frame?.queue ?? "—") + " 辆";
    txt +=
      " · 峰值排队: " +
      (stats?.peak_queue ?? "—") +
      " · 车辆数: " +
      (stats?.vehicle_count ?? P.countSimFrameStates(frame).total);
    if (stats?.avg_wait_until_drive != null) {
      txt += " · 平均等入口: " + stats.avg_wait_until_drive.toFixed(1) + " s";
    }
    if (stats?.p95_total_time != null) {
      txt += " · P95总耗时: " + stats.p95_total_time.toFixed(1) + " s";
    }
    el.textContent = txt;
  };

  P.drawSimulationOverlay = function (scale) {
    const tl = P.simState.timeline;
    if (!tl?.frames?.length || P.activeTab !== "simulate") return;
    const frame = tl.frames[P.simState.frameIndex] || tl.frames[0];
    for (const v of frame.vehicles || []) {
      if (v.state === "pending") continue;
      const p = P.worldToScreen(v.x, v.y);
      P.ctx.beginPath();
      P.ctx.arc(p.sx, p.sy, Math.max(5, scale * 0.28), 0, Math.PI * 2);
      const stCol =
        v.state === "driving"
          ? "#2563eb"
          : v.state === "walking"
            ? "#0d9488"
            : v.state === "parked"
              ? "#64748b"
              : v.state === "departed"
                ? "#cbd5e1"
                : "#94a3b8";
      P.ctx.fillStyle = stCol;
      P.ctx.fill();
      P.ctx.strokeStyle = "#fff";
      P.ctx.lineWidth = 1.5;
      P.ctx.stroke();
    }
  };
})();
