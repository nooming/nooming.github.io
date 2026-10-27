(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/compare-panel.js");

  const METRIC_KEYS = [
    { key: "gbest_value", label: "总优化时间", lowerBetter: true },
    { key: "optimizer", label: "求解方式", lowerBetter: false, text: true },
    { key: "gap_to_exact", label: "相对精确偏差", lowerBetter: true, suffix: "%" },
    { key: "pso_elapsed_ms", label: "PSO 耗时", lowerBetter: true, suffix: " ms" },
    { key: "worst_vehicle_time", label: "最坏单车时间", lowerBetter: true },
    { key: "avg_walk_time", label: "平均步行", lowerBetter: true },
    { key: "slot_utilization", label: "车位利用率", lowerBetter: false },
    { key: "type_match_rate", label: "类型匹配率", lowerBetter: false },
  ];

  P.renderComparePanel = async function () {
    const table = document.getElementById("compare-table");
    const canvas = document.getElementById("compare-radar");
    if (!table) return;
    table.innerHTML = '<p class="panel-note">加载对比数据…</p>';

    const checked = Array.from(document.querySelectorAll(".plan-compare-chk:checked"));
    const ids = checked.map((el) => el.dataset.planId).filter(Boolean);
    P.loadNamedPlans();

    let plans = [];

    const remoteIds = ids.filter((id) => id && !String(id).startsWith("local-"));
    const localIds = ids.filter((id) => String(id).startsWith("local-"));

    if (remoteIds.length >= 2 && P.apiOnline && P.api?.compareScenarioIds) {
      try {
        const res = await P.api.compareScenarioIds(remoteIds);
        plans = (res.scenarios || []).map((s) => ({
          id: s.id,
          name: s.name,
          metrics: s.metrics || {},
        }));
      } catch (e) {
        console.warn("remote compare failed", e);
      }
    }

    if (plans.length < 2) {
      const localPlans = P.namedPlans.filter((p) => localIds.includes(p.id) || ids.includes(p.id));
      if (localPlans.length) plans = localPlans;
    } else if (localIds.length) {
      const localPlans = P.namedPlans.filter((p) => localIds.includes(p.id));
      plans = plans.concat(localPlans);
    }

    if (plans.length < 2 && P.lastResult) {
      plans = [
        {
          name: "当前方案",
          metrics: P.computePlanMetrics(P.lastResult),
        },
        ...plans,
      ];
    }

    if (plans.length < 2) {
      table.innerHTML =
        '<p class="panel-note">请先在方案库勾选至少 2 个方案，或保存当前优化结果后再对比。</p>';
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    plans = plans.slice(0, 4);
    let html = '<table class="compare-data"><thead><tr><th>指标</th>';
    for (const p of plans) html += "<th>" + p.name + "</th>";
    html += "</tr></thead><tbody>";
    for (const mk of METRIC_KEYS) {
      html += "<tr><td>" + mk.label + "</td>";
      for (const p of plans) {
        const v = p.metrics?.[mk.key];
        let text = "--";
        if (v != null) {
          if (mk.text) {
            text = v === "pso" ? "PSO" : v === "exact" ? "匈牙利" : String(v);
          } else if (mk.suffix) {
            text = Number(v).toFixed(mk.key === "gap_to_exact" ? 2 : 1) + mk.suffix;
          } else if (mk.key.includes("rate") || mk.key.includes("utilization")) {
            text = (v * 100).toFixed(0) + "%";
          } else {
            text = Number(v).toFixed(2);
          }
        }
        html += "<td>" + text + "</td>";
      }
      html += "</tr>";
    }
    html += "</tbody></table>";
    table.innerHTML = html;
    P.drawCompareRadar(canvas, plans);
    P.updateWorkflowGuide?.();
  };

  P.exportCompareReport = async function () {
    const table = document.getElementById("compare-table");
    const canvas = document.getElementById("compare-radar");
    if (!table) return;
    const hasTable = table.querySelector("table.compare-data");
    if (!hasTable) await P.renderComparePanel();
    const tableHtml = table.innerHTML;
    if (!table.querySelector("table.compare-data")) {
      alert("请先在方案库勾选至少 2 个方案并刷新对比后再导出。");
      return;
    }
    let radarImg = "";
    if (canvas) {
      try {
        radarImg = canvas.toDataURL("image/png");
      } catch (_) {
        radarImg = "";
      }
    }
    const planNames = Array.from(table.querySelectorAll("thead th"))
      .slice(1)
      .map((th) => th.textContent.trim())
      .filter(Boolean);
    const title = "停车方案对比报告";
    const now = new Date();
    const timeStr = now.toLocaleString("zh-CN");
    const html =
      "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"utf-8\"/>" +
      "<title>" +
      title +
      "</title>" +
      "<style>body{font-family:\"Segoe UI\",\"Microsoft YaHei\",sans-serif;margin:24px;color:#1e293b;}" +
      "h1{font-size:1.35rem;margin:0 0 8px;} .meta{color:#64748b;font-size:0.9rem;margin-bottom:20px;}" +
      "table{border-collapse:collapse;width:100%;max-width:720px;margin:16px 0;}" +
      "th,td{border:1px solid #cbd5e1;padding:8px 10px;text-align:center;}" +
      "th{background:#f1f5f9;} td:first-child,th:first-child{text-align:left;}" +
      "img{max-width:100%;height:auto;margin-top:12px;}" +
      "@media print{body{margin:12mm;}}</style></head><body>" +
      "<h1>" +
      title +
      "</h1>" +
      "<p class=\"meta\">生成时间：" +
      timeStr +
      (planNames.length ? " · 对比方案：" + planNames.join("、") : "") +
      "</p>" +
      tableHtml +
      (radarImg ? "<h2>雷达图</h2><img src=\"" + radarImg + "\" alt=\"对比雷达图\"/>" : "") +
      "<p class=\"meta\">提示：浏览器「打印 → 另存为 PDF」可保存为 PDF。</p>" +
      "</body></html>";
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = now.toISOString().slice(0, 10);
    a.href = url;
    a.download = "parking-compare-report-" + stamp + ".html";
    a.click();
    URL.revokeObjectURL(url);
  };

  P.drawCompareRadar = function (canvas, plans) {
    if (!canvas) return;
    P.syncCompareRadarSize?.();
    const ctx = canvas.getContext("2d");
    const w = P.compareRadarCssW;
    const h = P.compareRadarCssH;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.35;
    const n = METRIC_KEYS.length;
    const vals = plans.map((p) =>
      METRIC_KEYS.map((mk) => {
        const v = Number(p.metrics?.[mk.key]);
        return Number.isFinite(v) ? v : 0;
      })
    );
    const maxPerKey = METRIC_KEYS.map((_, ki) => Math.max(1e-6, ...vals.map((row) => row[ki])));
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    for (let level = 1; level <= 4; level++) {
      ctx.beginPath();
      const r = (R * level) / 4;
      for (let i = 0; i <= n; i++) {
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const x = cx + r * Math.cos(ang);
        const y = cy + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const colors = ["#3b82f6", "#f59e0b", "#10b981", "#ef4444"];
    plans.forEach((plan, pi) => {
      ctx.strokeStyle = colors[pi % colors.length];
      ctx.fillStyle = colors[pi % colors.length] + "33";
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const ki = i % n;
        const raw = vals[pi][ki] / maxPerKey[ki];
        const norm = METRIC_KEYS[ki].lowerBetter ? 1 - Math.min(1, raw) : Math.min(1, raw);
        const ang = (Math.PI * 2 * i) / n - Math.PI / 2;
        const x = cx + R * norm * Math.cos(ang);
        const y = cy + R * norm * Math.sin(ang);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  };
})();
