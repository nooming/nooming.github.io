(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/chart.js");

P.updateChartCaption = function (mode) {
    const el = document.getElementById("chart-caption");
    if (!el) return;
    const tu = P.scenario ? P.uTime() : "s";
    if (mode === "exact") {
      el.textContent =
        "精确最优：上图横虚线为最优总时间参考，圆点为全局最优值（匈牙利无迭代，故无下降曲线）。";
      return;
    }
    if (mode === "idle") {
      el.textContent =
        "精确最优 = 全局最小总时间（" +
        tu +
        "）；PSO = 近似解并显示迭代曲线。运行后见上图。";
      return;
    }
    el.textContent = "横轴：迭代次数（次）；纵轴：最优总时间（" + tu + "）";
  }

P.chartDrawAxisDecor = function (w, h) {
    P.cctx.fillStyle = P.CHART_THEME.axisText;
    P.cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    P.cctx.textAlign = "center";
    P.cctx.textBaseline = "bottom";
    P.cctx.fillText("迭代（次）", w / 2, h - 3);
    P.cctx.save();
    P.cctx.translate(16, (h - P.CHART_BOTTOM_AXIS) / 2 + 4);
    P.cctx.rotate(-Math.PI / 2);
    P.cctx.textAlign = "center";
    P.cctx.textBaseline = "middle";
    P.cctx.fillText("时间（" + P.uTime() + "）", 0, 0);
    P.cctx.restore();
  }

  /** 匈牙利/精确最优仅一个标量：无迭代曲线，画水平参考线 + 圆点 + 数值 */

P.chartDrawAxisDecorExact = function (w, h) {
    P.cctx.fillStyle = P.CHART_THEME.axisText;
    P.cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    P.cctx.textAlign = "center";
    P.cctx.textBaseline = "bottom";
    P.cctx.fillText("横轴：无迭代（单步全局最优）", w / 2, h - 3);
    P.cctx.save();
    P.cctx.translate(16, (h - P.CHART_BOTTOM_AXIS) / 2 + 4);
    P.cctx.rotate(-Math.PI / 2);
    P.cctx.textAlign = "center";
    P.cctx.textBaseline = "middle";
    P.cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    P.cctx.fillText("最优总时间（" + P.uTime() + "）", 0, 0);
    P.cctx.restore();
  }

P.drawChart = function (series, optimizerKind) {
    P.syncChartCanvasSize();
    const w = P.chartCssW;
    const h = P.chartCssH;
    const kind = optimizerKind || "pso";
    P.lastChartSeries = Array.isArray(series) ? series.slice() : [];
    P.lastChartOptimizer = kind;
    const pad = 8;
    const plotH = Math.max(h - pad - P.CHART_BOTTOM_AXIS - 4, 24);
    const plotTop = pad + 4;
    P.cctx.clearRect(0, 0, w, h);
    P.cctx.fillStyle = P.CHART_THEME.bg;
    P.cctx.fillRect(0, 0, w, h);
    if (!series.length) {
      P.cctx.fillStyle = P.CHART_THEME.helperText;
      P.cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      P.cctx.textAlign = "center";
      P.cctx.textBaseline = "middle";
      P.cctx.fillText("运行优化后显示：精确为单点，PSO 为收敛曲线", w / 2, (plotTop + plotH / 2) | 0);
      P.chartDrawAxisDecor(w, h);
      return;
    }
    const v0 = Number(series[0]);
    if (series.length === 1 && kind === "exact" && Number.isFinite(v0)) {
      const span = Math.max(Math.abs(v0) * 0.06, 8);
      const lo = v0 - span;
      const hi = v0 + span;
      const y = plotTop + (1 - (v0 - lo) / (hi - lo)) * plotH;
      const cx = (w - 2 * pad) * 0.55 + pad;
      P.cctx.strokeStyle = P.CHART_THEME.lineSoft;
      P.cctx.lineWidth = 1;
      P.cctx.setLineDash([5, 5]);
      P.cctx.beginPath();
      P.cctx.moveTo(pad, y);
      P.cctx.lineTo(w - pad, y);
      P.cctx.stroke();
      P.cctx.setLineDash([]);
      P.cctx.fillStyle = P.CHART_THEME.line;
      P.cctx.beginPath();
      P.cctx.arc(cx, y, 6, 0, Math.PI * 2);
      P.cctx.fill();
      P.cctx.strokeStyle = P.CHART_THEME.dotStroke;
      P.cctx.lineWidth = 1.5;
      P.cctx.stroke();
      P.cctx.fillStyle = P.CHART_THEME.labelText;
      P.cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      P.cctx.textAlign = "left";
      P.cctx.textBaseline = "bottom";
      const label = v0.toFixed(2) + " " + P.uTime();
      P.cctx.fillText(label, Math.min(cx + 10, w - pad - 2), y - 4);
      P.cctx.textAlign = "center";
      P.cctx.textBaseline = "top";
      P.cctx.fillStyle = P.CHART_THEME.helperText;
      P.cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
      P.cctx.fillText("匈牙利：全局最优（非迭代算法）", w / 2, pad + 2);
      P.chartDrawAxisDecorExact(w, h);
      return;
    }
    let lo = Math.min(...series);
    let hi = Math.max(...series);
    if (hi === lo) {
      hi = lo + 1;
    }
    P.cctx.strokeStyle = P.CHART_THEME.line;
    P.cctx.lineWidth = 2;
    P.cctx.beginPath();
    for (let i = 0; i < series.length; i++) {
      const t = series.length > 1 ? i / (series.length - 1) : 0;
      const x = pad + t * (w - 2 * pad);
      const y = plotTop + (1 - (series[i] - lo) / (hi - lo)) * plotH;
      if (i === 0) P.cctx.moveTo(x, y);
      else P.cctx.lineTo(x, y);
    }
    P.cctx.stroke();
    if (series.length === 1) {
      const t = 0;
      const x = pad + t * (w - 2 * pad);
      const y = plotTop + (1 - (series[0] - lo) / (hi - lo)) * plotH;
      P.cctx.fillStyle = P.CHART_THEME.line;
      P.cctx.beginPath();
      P.cctx.arc(x, y, 5, 0, Math.PI * 2);
      P.cctx.fill();
    }
    if (series.length >= 2) {
      P.cctx.fillStyle = P.CHART_THEME.axisText;
      P.cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
      P.cctx.textBaseline = "top";
      P.cctx.textAlign = "left";
      P.cctx.fillText("0", pad, h - P.CHART_BOTTOM_AXIS + 2);
      P.cctx.textAlign = "right";
      P.cctx.fillText(String(series.length - 1), w - pad, h - P.CHART_BOTTOM_AXIS + 2);
    }
    P.chartDrawAxisDecor(w, h);
  }
})();
