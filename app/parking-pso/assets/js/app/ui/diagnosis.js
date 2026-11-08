(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/diagnosis.js");

  function issue(text, level, action, actionLabel) {
    return { text, level, action, actionLabel };
  }

  P.renderDiagnosis = function () {
    const list = document.getElementById("diagnosis-list");
    const scoreEl = document.getElementById("diagnosis-score");
    if (!list) return;
    const s = P.scenario;
    if (!s) {
      list.innerHTML = "";
      if (scoreEl) scoreEl.textContent = "—";
      return;
    }
    const slots = s.slots?.length || 0;
    const entrances = s.entrances?.length || 0;
    const buildings = s.buildings?.length || 0;
    const roadPts = s.road?.centerline?.length || 0;
    const nVeh = Math.max(1, parseInt(s.n_veh, 10) || 1);
    const issues = [];
    let score = 0;

    if (roadPts >= 2) score += 20;
    else issues.push(issue("还没有完整道路，先画一条道路。", "high", "scene", "去画道路"));
    if (entrances >= 1) score += 20;
    else issues.push(issue("没有入口，车辆无法进场。", "high", "entrance", "加入口"));
    if (buildings >= 1) score += 20;
    else issues.push(issue("还没有居民楼，无法分配目的地。", "high", "building", "加居民楼"));
    if (slots >= nVeh) score += 20;
    else {
      const miss = nVeh - slots;
      score += Math.round(20 * Math.min(1, slots / nVeh));
      issues.push(issue(`车位 ${slots} / 车辆 ${nVeh}，还差 ${miss} 个。`, "high", "slots", "自动补位"));
    }
    const hasResult = !!(P.lastResult && (P.lastResult.assign?.length || P.lastResult.gbest_value != null));
    if (hasResult) score += 20;
    else issues.push(issue("还没有运行优化，先算出车 → 楼分配。", "medium", "optimize", "运行优化"));

    if (slots > nVeh * 2 && slots - nVeh >= 6) {
      issues.push(issue(`车位比车辆多 ${slots - nVeh} 个，可能造成空间冗余。`, "info", "slots", "调整布位"));
    }
    if (entrances > 4) {
      issues.push(issue(`入口 ${entrances} 个，仿真时车流会被分散；可对照单入口方案。`, "info", null, ""));
    }
    if (hasResult && P.lastResult?.vehicle_breakdown?.length) {
      const bd = P.lastResult.vehicle_breakdown;
      const avg = bd.reduce((sum, item) => sum + (Number(item.total_time) || 0), 0) / Math.max(1, bd.length);
      if (avg > 900) {
        issues.push(issue(`优化后平均总时长约 ${Math.round(avg)} s，可调整入口或车位位置再算。`, "info", "result", "查看结果"));
      }
    }

    list.innerHTML = "";
    if (!issues.length) {
      const li = document.createElement("li");
      li.className = "diagnosis-item diagnosis-item--ok";
      li.textContent = hasResult ? "场景完整，优化结果已生成。" : "场景完整，可以直接运行优化。";
      list.appendChild(li);
    }
    issues.forEach((item) => {
      const li = document.createElement("li");
      li.className = "diagnosis-item diagnosis-item--" + item.level;
      const text = document.createElement("span");
      text.textContent = item.text;
      li.appendChild(text);
      if (item.action) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = item.actionLabel || "处理";
        btn.addEventListener("click", () => runAction(item.action));
        li.appendChild(btn);
      }
      list.appendChild(li);
    });

    if (scoreEl) {
      scoreEl.textContent = score + " / 100";
      scoreEl.className = "diagnosis-score " + (score >= 80 ? "is-good" : score >= 50 ? "is-warn" : "is-bad");
    }
  };

  function runAction(action) {
    if (action === "scene" || action === "entrance" || action === "building") {
      P.switchTab?.("scene");
      const id = action === "entrance"
        ? "btn-add-entrance"
        : action === "building"
          ? "btn-add-building"
          : "btn-add-road";
      const btn = document.getElementById(id);
      if (btn) {
        btn.scrollIntoView({ block: "center", behavior: "smooth" });
        btn.focus({ preventScroll: true });
      }
      return;
    }
    if (action === "slots") {
      P.switchTab?.("scene");
      const count = document.getElementById("auto-slot-count");
      const n = Math.max(1, parseInt(P.scenario?.n_veh, 10) || 1);
      if (count) count.value = String(n);
      const btn = document.getElementById("btn-auto-slots");
      if (btn) {
        btn.scrollIntoView({ block: "center", behavior: "smooth" });
        btn.focus({ preventScroll: true });
      }
      return;
    }
    if (action === "optimize") {
      P.switchTab?.("overview");
      document.querySelector(".js-run-optimize")?.click();
      return;
    }
    if (action === "result") {
      P.switchTab?.("simulate");
    }
  }

  P.copyPlanSummary = async function () {
    const s = P.scenario;
    if (!s) return;
    const r = P.lastResult;
    const bd = Array.isArray(r?.vehicle_breakdown) ? r.vehicle_breakdown : [];
    const sum = (key) => bd.reduce((n, item) => n + (Number(item?.[key]) || 0), 0);
    const lines = [
      "停车方案摘要",
      `地块：${Math.round(P.lotW?.() ?? s.lot?.width ?? 0)} × ${Math.round(P.lotH?.() ?? s.lot?.height ?? 0)} m`,
      `车辆：${s.n_veh ?? 0} · 车位：${s.slots?.length || 0} · 入口：${s.entrances?.length || 0} · 居民楼：${s.buildings?.length || 0}`,
    ];
    if (r) {
      lines.push(`优化：${r.optimizer || "exact"} · 总时间：${Number(r.gbest_value ?? 0).toFixed(1)} s`);
      if (bd.length) {
        lines.push(`行车：${sum("drive_time").toFixed(1)} s · 步行：${sum("walk_time").toFixed(1)} s · 平均：${(sum("total_time") / bd.length).toFixed(1)} s`);
      }
    } else {
      lines.push("优化：尚未运行");
    }
    lines.push(`时间：${new Date().toLocaleString()}`);
    const text = lines.join("\n");
    let copied = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        copied = true;
      }
    } catch (_) { /* fallback below */ }
    if (!copied) {
      try {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        copied = document.execCommand("copy");
        area.remove();
      } catch (_) {
        copied = false;
      }
    }
    if (copied) {
      P.showWorkspaceMessage?.("方案摘要已复制，可直接粘贴到消息或文档。", { level: "info" });
    } else {
      P.showWorkspaceMessage?.("当前浏览器不允许自动复制，请用「导出 JSON」备份。", { level: "warn" });
    }
  };
})();
