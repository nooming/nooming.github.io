(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/scenario-library.js");

  const LIB_KEY = "parking-pso-named-plans-v1";

  P.namedPlans = P.namedPlans || [];
  P.plansMode = "offline";

  P.loadNamedPlans = function () {
    try {
      const raw = localStorage.getItem(LIB_KEY);
      P.namedPlans = raw ? JSON.parse(raw) : [];
    } catch (_) {
      P.namedPlans = [];
    }
    return P.namedPlans;
  };

  P.persistNamedPlans = function () {
    localStorage.setItem(LIB_KEY, JSON.stringify(P.namedPlans || []));
  };

  P.computePlanMetrics = function (result) {
    const breakdown = result?.vehicle_breakdown || [];
    const gbest = Number(result?.gbest_value);
    const nVeh = breakdown.length || P.scenario?.n_veh || 0;
    const nSlot = P.scenario?.slots?.length || 0;
    let worst = 0;
    let walkSum = 0;
    let mismatch = 0;
    for (const it of breakdown) {
      worst = Math.max(worst, Number(it.total_time) || 0);
      walkSum += Number(it.walk_time) || 0;
      if ((Number(it.penalty) || 0) > 0) mismatch++;
    }
    let gap_to_exact = null;
    const ref = result?.exact_reference;
    if (ref != null && Number.isFinite(ref) && Number.isFinite(gbest)) {
      gap_to_exact = ((gbest - ref) / Math.max(1e-6, ref)) * 100;
    }
    return {
      gbest_value: Number.isFinite(gbest) ? gbest : null,
      worst_vehicle_time: worst || null,
      avg_walk_time: breakdown.length ? walkSum / breakdown.length : null,
      slot_utilization: nSlot ? nVeh / nSlot : 0,
      type_match_rate: nVeh ? 1 - mismatch / nVeh : 1,
      mismatch_count: mismatch,
      optimizer: result?.optimizer || null,
      gap_to_exact,
      pso_elapsed_ms: result?.pso_stats?.elapsed_ms ?? null,
    };
  };

  P.loadPlanEntry = function (plan) {
    if (!plan?.scenario) return;
    P.scenario = JSON.parse(JSON.stringify(plan.scenario));
    P.lastResult = plan.result ? JSON.parse(JSON.stringify(plan.result)) : null;
    P.ensureConstraints();
    P.ensureScenarioCollections();
    P.sanitizeScenarioGeometry();
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    if (P.nVehInput) P.nVehInput.value = P.scenario.n_veh ?? 12;
    P.rebuildVehicleTargetsUI();
    P.renderBreakdownSummary?.();
    P.draw();
    P.switchTab("scene");
  };

  P.saveNamedPlan = async function (name, override) {
    const scenario = override?.scenario || P.scenario;
    if (!scenario) return;
    const label = (name || "").trim() || "方案 " + (P.namedPlans.length + 1);
    const result = override?.result !== undefined ? override.result : P.lastResult;
    const metrics =
      override?.metrics || (result ? P.computePlanMetrics(result) : {});
    const entry = {
      id: "local-" + Date.now(),
      name: label,
      scenario: JSON.parse(JSON.stringify(scenario)),
      result: result ? JSON.parse(JSON.stringify(result)) : null,
      metrics,
      updated_at: new Date().toISOString(),
      remote: false,
    };
    if (P.apiOnline && P.api?.saveScenario) {
      try {
        const res = await P.api.saveScenario(label, entry.scenario, metrics);
        if (res.scenario?.id) {
          entry.id = res.scenario.id;
          entry.remote = true;
        }
      } catch (e) {
        console.warn("remote save failed", e);
      }
    }
    const idx = P.namedPlans.findIndex((p) => p.id === entry.id);
    if (idx >= 0) P.namedPlans[idx] = entry;
    else P.namedPlans.unshift(entry);
    P.persistNamedPlans();
    P.renderScenarioLibrary();
    P.updateWorkflowGuide?.();
  };

  P.deleteNamedPlan = async function (planId) {
    P.namedPlans = P.namedPlans.filter((p) => p.id !== planId);
    P.persistNamedPlans();
    if (planId && !String(planId).startsWith("local-") && P.apiOnline && P.api?.deleteScenario) {
      try {
        await P.api.deleteScenario(planId);
      } catch (e) {
        console.warn("remote delete failed", e);
      }
    }
    P.renderScenarioLibrary();
  };

  P.loadPlans = async function () {
    const cache = P.loadNamedPlans();
    const cacheById = {};
    for (const p of cache) cacheById[p.id] = p;

    if (!(await P.refreshApiStatus?.())) {
      P.plansMode = "offline";
      P.renderScenarioLibrary();
      return;
    }

    try {
      const res = await P.api.listScenarios();
      const remote = res.scenarios || [];
      const merged = [];
      for (const r of remote) {
        const cached = cacheById[r.id];
        let scenario = cached?.scenario;
        if (!scenario && P.api.getScenario) {
          const full = await P.api.getScenario(r.id);
          scenario = full.scenario?.scenario;
        }
        if (!scenario) continue;
        merged.push({
          id: r.id,
          name: r.name,
          scenario,
          result: cached?.result || null,
          metrics: r.metrics || cached?.metrics || {},
          updated_at: r.updated_at,
          remote: true,
        });
      }
      for (const p of cache) {
        if (String(p.id).startsWith("local-") && !merged.some((m) => m.id === p.id)) {
          merged.push(p);
        }
      }
      P.namedPlans = merged;
      P.plansMode = "online";
      P.persistNamedPlans();
    } catch (e) {
      console.warn("loadPlans remote failed", e);
      P.namedPlans = cache;
      P.plansMode = "offline";
    }
    P.renderScenarioLibrary();
  };

  P.renderScenarioLibrary = function () {
    const list = document.getElementById("plan-library-list");
    if (!list) return;
    list.innerHTML = "";
    const modeEl = document.createElement("p");
    modeEl.className = "panel-note plan-lib-mode";
    modeEl.textContent =
      P.plansMode === "online" ? "方案库：云端（SQLite）" : "方案库：离线（本机缓存）";
    list.appendChild(modeEl);
    if (!P.namedPlans.length) {
      const empty = document.createElement("p");
      empty.className = "panel-note";
      empty.textContent = "尚无命名方案。编辑场景并运行优化后，点击「保存到方案库」。";
      list.appendChild(empty);
      return;
    }
    for (const plan of P.namedPlans) {
      const card = document.createElement("div");
      card.className = "plan-card";
      const m = plan.metrics || {};
      card.innerHTML =
        "<strong>" +
        plan.name +
        "</strong>" +
        '<div class="plan-card-metrics">' +
        (m.gbest_value != null ? "总时间 " + m.gbest_value.toFixed(1) + " s · " : "") +
        (m.slot_utilization != null ? "利用率 " + Math.round(m.slot_utilization * 100) + "%" : "") +
        (plan.remote ? " · 云端" : " · 本地") +
        "</div>";
      const actions = document.createElement("div");
      actions.className = "toolbar";
      const loadBtn = document.createElement("button");
      loadBtn.type = "button";
      loadBtn.textContent = "加载";
      loadBtn.addEventListener("click", () => P.loadPlanEntry(plan));
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "danger";
      delBtn.textContent = "删除";
      delBtn.addEventListener("click", () => P.deleteNamedPlan(plan.id));
      const cmpChk = document.createElement("input");
      cmpChk.type = "checkbox";
      cmpChk.className = "plan-compare-chk";
      cmpChk.dataset.planId = plan.id;
      cmpChk.title = "加入对比";
      cmpChk.addEventListener("change", () => P.renderComparePanel?.());
      actions.appendChild(loadBtn);
      actions.appendChild(delBtn);
      actions.appendChild(cmpChk);
      card.appendChild(actions);
      list.appendChild(card);
    }
  };
})();
