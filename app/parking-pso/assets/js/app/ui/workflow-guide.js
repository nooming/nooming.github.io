(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/workflow-guide.js");

  const STEPS = [
    {
      id: "layout",
      title: "画场地",
      desc: "绘制道路、入口与居民楼",
      tab: "scene",
      action: "scene",
    },
    {
      id: "slots",
      title: "自动布位",
      desc: "沿道路生成车位",
      tab: "scene",
      action: "auto-slots",
    },
    {
      id: "simulate",
      title: "陆续到达仿真",
      desc: "滚动分配与回放",
      tab: "simulate",
      action: "simulate",
    },
  ];

  P.workflowStepDone = function (stepId) {
    const s = P.scenario;
    if (!s) return false;
    switch (stepId) {
      case "layout":
        return (s.road?.centerline?.length || 0) >= 2 && (s.entrances?.length || 0) >= 1;
      case "slots":
        return (s.slots?.length || 0) >= Math.max(1, parseInt(s.n_veh, 10) || 1);
      case "optimize":
        return Number.isFinite(Number(P.lastResult?.gbest_value));
      case "compare":
        return (
          (P.namedPlans?.length || 0) >= 2 ||
          !!document.querySelector("#compare-table table.compare-data")
        );
      case "simulate":
        return !!(P.simState?.timeline?.frames?.length || P._simulationRan);
      default:
        return false;
    }
  };

  P.workflowCurrentStepId = function () {
    for (const step of STEPS) {
      if (!P.workflowStepDone(step.id)) return step.id;
    }
    return STEPS[STEPS.length - 1].id;
  };

  P.goToWorkflowStep = function (action) {
    switch (action) {
      case "scene":
        P.switchTab("scene");
        break;
      case "auto-slots":
        P.switchTab("scene");
        document.getElementById("btn-auto-slots")?.scrollIntoView({ block: "nearest" });
        break;
      case "optimize":
        document.querySelector(".js-run-optimize")?.click();
        break;
      case "simulate":
        P.switchTab("simulate");
        break;
      default:
        break;
    }
  };

  P.updateWorkflowGuide = function () {
    const list = document.getElementById("workflow-steps");
    if (!list) return;
    const current = P.workflowCurrentStepId();
    const currentIdx = STEPS.findIndex((s) => s.id === current);
    const allDone = STEPS.every((s) => P.workflowStepDone(s.id));
    const doneCount = STEPS.filter((s) => P.workflowStepDone(s.id)).length;
    list.className = "workflow-steps workflow-steps--compact";
    list.dataset.doneSummary =
      doneCount > 0 && !allDone ? "已完成 " + doneCount + " / " + STEPS.length + " 步" : "";
    list.innerHTML = "";
    STEPS.forEach((step, idx) => {
      const done = P.workflowStepDone(step.id);
      const isCurrent = step.id === current && !done;
      let hideCompact = false;
      if (!allDone) {
        hideCompact = idx < currentIdx || idx > currentIdx + 1;
      } else {
        hideCompact = idx < STEPS.length - 1;
      }
      const li = document.createElement("li");
      li.className =
        "workflow-step" +
        (done ? " workflow-step--done" : "") +
        (isCurrent ? " workflow-step--current" : "") +
        (hideCompact ? " workflow-step--collapsed" : "");
      const badge = done ? "已完成" : isCurrent ? "当前" : "待完成";
      li.innerHTML =
        '<div class="workflow-step__head">' +
        '<span class="workflow-step__index">' +
        (idx + 1) +
        "</span>" +
        "<strong>" +
        step.title +
        "</strong>" +
        '<span class="workflow-step__badge">' +
        badge +
        "</span>" +
        "</div>" +
        '<p class="workflow-step__desc">' +
        step.desc +
        "</p>";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "workflow-step__go";
      btn.textContent = "前往";
      btn.addEventListener("click", () => P.goToWorkflowStep(step.action));
      li.appendChild(btn);
      list.appendChild(li);
    });

    const banner = document.getElementById("workflow-first-hint");
    if (banner && !localStorage.getItem("parking_workflow_seen")) {
      banner.hidden = false;
    }
    P.updateActionGates?.();
  };

  P.wireWorkflowGuide = function () {
    document.getElementById("btn-workflow-dismiss")?.addEventListener("click", () => {
      localStorage.setItem("parking_workflow_seen", "1");
      const banner = document.getElementById("workflow-first-hint");
      if (banner) banner.hidden = true;
    });
    P.updateWorkflowGuide();
    P.updateActionGates?.();
  };

  P.canRunOptimize = function () {
    const s = P.scenario;
    if (!s) return { ok: false, reason: "无场景" };
    if ((s.road?.centerline?.length || 0) < 2) {
      return { ok: false, reason: "道路未就绪（至少 2 个顶点）" };
    }
    if (!(s.entrances?.length >= 1)) return { ok: false, reason: "至少 1 个入口" };
    if (!(s.buildings?.length >= 1)) return { ok: false, reason: "至少 1 栋居民楼" };
    const nSlot = s.slots?.length || 0;
    const nVeh = Math.min(parseInt(s.n_veh, 10) || 0, nSlot);
    if (nVeh < 1 || nSlot < 1) return { ok: false, reason: "车位与车辆数不足" };
    return { ok: true, reason: "" };
  };

  P.canRunSimulation = function () {
    if (!P.lastResult?.assign?.length) return { ok: false, reason: "需先运行全信息优化（静态回放）" };
    return { ok: true, reason: "" };
  };

  P.isRollingSimMode = function () {
    return true;
  };

  P.canRunRollingSimulation = function () {
    return P.canRunOptimize?.() || { ok: false, reason: "场景未就绪" };
  };

  P.simulationRunGate = function () {
    if (P.isRollingSimMode?.()) return P.canRunRollingSimulation?.() || { ok: false, reason: "" };
    return P.canRunSimulation?.() || { ok: false, reason: "" };
  };

  P.updateActionGates = function () {
    const opt = P.canRunOptimize?.() || { ok: true, reason: "" };
    document.querySelectorAll(".js-run-optimize").forEach((btn) => {
      btn.disabled = !opt.ok;
      btn.title = opt.ok ? "" : opt.reason;
    });
    const sim = P.simulationRunGate?.() || { ok: false, reason: "" };
    const runSim = document.getElementById("btn-run-sim");
    const playSim = document.getElementById("btn-sim-play");
    const compareBtn = document.getElementById("btn-run-arrival-compare");
    const hasTimeline = !!(P.simState?.timeline?.frames?.length);
    const simStep = P.getSimArrivalProcessMode?.() === "step";
    if (runSim) {
      runSim.disabled = simStep || !sim.ok;
      runSim.title = simStep ? "逐车调试模式请用「运行此车」" : sim.ok ? "" : sim.reason;
    }
    if (compareBtn) {
      const cmpOk =
        !simStep &&
        !!P.apiOnline &&
        (P.canRunRollingSimulation?.()?.ok || false) &&
        !!(P.api?.simulateRolling && P.api?.simulate);
      compareBtn.disabled = !cmpOk;
      compareBtn.title = simStep
        ? "逐车调试下不可用"
        : cmpOk
          ? "对比滚动与全信息基准"
          : "需联网且场景就绪";
    }
    if (playSim) {
      playSim.disabled = !hasTimeline;
      playSim.title = hasTimeline ? "" : "需先运行仿真";
    }
    P.syncSimToolbarVisibility?.();
  };
})();
