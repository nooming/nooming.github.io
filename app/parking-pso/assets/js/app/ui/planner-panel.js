(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/planner-panel.js");

  P.applySuggestedPlan = function (plan) {
    if (!plan?.scenario) return;
    P.scenario = JSON.parse(JSON.stringify(plan.scenario));
    P.lastResult = plan.result
      ? P.normalizeOptimizeResult(plan.result, plan.result.optimizer || "exact", P.scenario)
      : null;
    P.ensureConstraints();
    P.ensureScenarioCollections();
    P.sanitizeScenarioGeometry();
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    if (P.nVehInput) P.nVehInput.value = P.scenario.n_veh ?? 12;
    P.rebuildVehicleTargetsUI();
    P.renderBreakdownSummary?.();
    P.updateWorkflowGuide?.();
    P.draw();
    P.switchTab("scene");
  };

  P.saveSuggestedPlan = async function (plan) {
    if (!plan?.scenario) return;
    const label = (plan.title || "候选方案").trim();
    await P.saveNamedPlan?.(label, {
      scenario: plan.scenario,
      result: plan.result || null,
      metrics: plan.metrics || (plan.result ? P.computePlanMetrics(plan.result) : {}),
    });
  };

  P.showAutoSlotsFeedback = function (stats) {
    const el = document.getElementById("auto-slots-status");
    if (!el || !stats) return;
    const req = Number(stats.requested) || 0;
    const placed = Number(stats.placed) || 0;
    const skipped = Number(stats.skipped) || Math.max(0, req - placed);
    if (!req) {
      el.textContent = "请先绘制道路后再自动布位。";
      return;
    }
    if (placed >= req) {
      el.textContent = "请求 " + req + " 个，成功放置 " + placed + " 个。";
    } else {
      el.textContent =
        "请求 " +
        req +
        " 个，成功放置 " +
        placed +
        " 个，跳过 " +
        skipped +
        " 个（与建筑/花坛/道路冲突）。";
    }
  };

  P.applyAutoSlotsLocal = function (count) {
    if (!P.generateSlotsAlongStrips) return { slots: [], requested: 0, placed: 0, skipped: 0 };
    return P.generateSlotsAlongStrips(count);
  };

  P.runAutoSlots = async function () {
    if (!P.scenario) return;
    const countEl = document.getElementById("auto-slot-count");
    const count = countEl ? parseInt(countEl.value, 10) : P.scenario.n_veh;
    const requested = Math.max(1, Number.isFinite(count) ? count : P.scenario.n_veh || 12);
    let stats = { requested, placed: 0, skipped: requested };

    try {
      if (P.api?.autoSlots) {
        const res = await P.api.autoSlots(P.scenario, requested);
        if (res.slots?.length) {
          const before = res.slots.length;
          P.scenario.slots = res.slots;
          P.scenario.slot_types = res.slots.map(() => "normal");
          P.ensureScenarioCollections();
          P.sanitizeScenarioGeometry();
          const after = P.scenario.slots.length;
          const meta = res.meta || {};
          stats = {
            requested: meta.requested ?? requested,
            placed: meta.placed ?? after,
            skipped: meta.skipped ?? Math.max(0, (meta.requested ?? requested) - after),
          };
          if (before > after) {
            stats.skipped = Math.max(stats.skipped, before - after);
          }
          P.showAutoSlotsFeedback(stats);
          P.invalidateOptimizationResult();
          P.commitSceneGeometry?.();
          P.updateWorkflowGuide?.();
          P.draw();
          return;
        }
      }
    } catch (e) {
      console.warn("api auto-slots failed, local fallback", e);
    }

    const local = P.applyAutoSlotsLocal(requested);
    if (local.slots?.length) {
      P.scenario.slots = local.slots;
      P.scenario.slot_types = local.slots.map(() => "normal");
      P.ensureScenarioCollections();
      P.sanitizeScenarioGeometry();
      stats = {
        requested: local.requested,
        placed: P.scenario.slots.length,
        skipped: local.skipped + Math.max(0, local.placed - P.scenario.slots.length),
      };
      P.showAutoSlotsFeedback(stats);
      P.invalidateOptimizationResult();
      P.commitSceneGeometry?.();
      P.updateWorkflowGuide?.();
      P.draw();
    } else {
      P.showAutoSlotsFeedback(local);
    }
  };

  P.renderSuggestPlans = function (plans) {
    const list = document.getElementById("suggest-plans-list");
    if (!list) return;
    list.innerHTML = "";
    if (!plans?.length) {
      list.innerHTML = '<p class="panel-note">无候选方案。</p>';
      return;
    }
    for (const plan of plans) {
      const card = document.createElement("div");
      card.className = "suggest-plan-card";
      const gbest = plan.metrics?.gbest_value ?? plan.result?.gbest_value;
      const head = document.createElement("div");
      head.className = "suggest-plan-card__head";
      head.innerHTML =
        "<strong>" +
        (plan.title || "候选") +
        "</strong>" +
        (gbest != null ? '<span class="suggest-plan-card__gbest">' + Number(gbest).toFixed(1) + " s</span>" : "");
      const desc = document.createElement("p");
      desc.className = "panel-note";
      desc.textContent = plan.description || "";
      const actions = document.createElement("div");
      actions.className = "toolbar";
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.textContent = "应用到画布";
      applyBtn.addEventListener("click", () => P.applySuggestedPlan(plan));
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.textContent = "保存到方案库";
      saveBtn.addEventListener("click", () => P.saveSuggestedPlan(plan));
      actions.appendChild(applyBtn);
      actions.appendChild(saveBtn);
      card.appendChild(head);
      card.appendChild(desc);
      card.appendChild(actions);
      list.appendChild(card);
    }
  };

  P.runSuggestPlans = async function () {
    const list = document.getElementById("suggest-plans-list");
    if (!list || !P.scenario) return;
    list.innerHTML = '<p class="panel-note">生成候选方案中…</p>';
    if (!P.apiOnline) await P.refreshApiStatus?.();
    try {
      if (P.api?.suggestPlans && P.apiOnline) {
        const res = await P.api.suggestPlans(P.scenario);
        const plans = (res.plans || []).map((p) => ({
          ...p,
          metrics: p.metrics || (p.result ? P.computePlanMetrics(p.result) : {}),
        }));
        P._lastSuggestPlans = plans;
        P.renderSuggestPlans(plans);
        return;
      }
    } catch (e) {
      console.warn("suggest plans failed", e);
    }
    list.innerHTML =
      '<p class="panel-note">后端不可用。请启动 <code>noomings_backend</code>（<code>python app.py</code>）并配置 <code>PARKING_API_BASE</code> 后重试。</p>';
  };
})();
