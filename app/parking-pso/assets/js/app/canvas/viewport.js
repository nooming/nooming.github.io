(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/viewport.js");

P.syncMapCanvasSize = function () {
    const r = P.mapCanvas.getBoundingClientRect();
    const nw = Math.max(320, Math.round(r.width)) || P.mapCssW;
    const nh = Math.max(320, Math.round(r.height)) || P.mapCssH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (nw === P.mapCssW && nh === P.mapCssH && dpr === P.mapDpr) return;
    P.mapCssW = nw;
    P.mapCssH = nh;
    P.mapDpr = dpr;
    P.mapCanvas.width = Math.round(nw * dpr);
    P.mapCanvas.height = Math.round(nh * dpr);
    P.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.ctx.imageSmoothingEnabled = true;
  }

P.syncChartCanvasSize = function () {
    const r = P.chartCanvas.getBoundingClientRect();
    const nw = Math.max(200, Math.round(r.width)) || P.chartCssW;
    const nh = Math.max(96, Math.round(r.height)) || P.chartCssH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (nw === P.chartCssW && nh === P.chartCssH && dpr === P.chartDpr) return;
    P.chartCssW = nw;
    P.chartCssH = nh;
    P.chartDpr = dpr;
    P.chartCanvas.width = Math.round(nw * dpr);
    P.chartCanvas.height = Math.round(nh * dpr);
    P.cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P.cctx.imageSmoothingEnabled = true;
  }

P.lotW = function () {
    return P.scenario?.lot?.width ?? 100;
  }

P.lotH = function () {
    return P.scenario?.lot?.height ?? 100;
  }

P.translateScene = function (dx, dy) {
    if (!P.scenario) return;
    if (Array.isArray(P.scenario.entrances)) {
      P.scenario.entrances = P.scenario.entrances.map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]);
      P.scenario.entrance = P.scenario.entrances[0];
    }
    if (Array.isArray(P.scenario.buildings)) {
      P.scenario.buildings = P.scenario.buildings.map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]);
    }
    if (Array.isArray(P.scenario.slots)) {
      P.scenario.slots = P.scenario.slots
        .map((s) => P.normalizeSlotEntry(s))
        .filter((s) => !!s)
        .map((p) => [Number(p[0]) + dx, Number(p[1]) + dy, Number(p[2])]);
    }
    if (Array.isArray(P.scenario.obstacles)) {
      P.scenario.obstacles = P.scenario.obstacles.map((o) => ({
        ...o,
        points: (o.points || []).map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]),
      }));
    }
    if (P.scenario.road?.centerline) {
      P.scenario.road.centerline = P.scenario.road.centerline.map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]);
    }
    if (P.scenario.inner) {
      P.scenario.inner = {
        x_min: Number(P.scenario.inner.x_min) + dx,
        x_max: Number(P.scenario.inner.x_max) + dx,
        y_min: Number(P.scenario.inner.y_min) + dy,
        y_max: Number(P.scenario.inner.y_max) + dy,
      };
    }
  }

P.fitLotToMapAspect = function () {
    if (!P.scenario?.lot) return false;
    const w = Number(P.scenario.lot.width);
    const h = Number(P.scenario.lot.height);
    if (!(w > 0 && h > 0)) return false;
    const targetRatio = Math.max(0.2, P.mapCssW / Math.max(1, P.mapCssH));
    const curRatio = w / h;
    if (Math.abs(curRatio - targetRatio) < 1e-6) return false;
    if (curRatio < targetRatio) {
      const newW = Math.round(h * targetRatio * 10) / 10;
      const dx = (newW - w) / 2;
      P.translateScene(dx, 0);
      P.scenario.lot.width = newW;
    } else {
      const newH = Math.round((w / targetRatio) * 10) / 10;
      const dy = (newH - h) / 2;
      P.translateScene(0, dy);
      P.scenario.lot.height = newH;
    }
    return true;
  }

P.padScale = function () {
    const cw = P.mapCssW;
    const ch = P.mapCssH;
    const availW = Math.max(1, cw - 2 * P.MAP_CANVAS_EDGE);
    const availH = Math.max(1, ch - 2 * P.MAP_CANVAS_EDGE);
    const scale = Math.min(availW / P.lotW(), availH / P.lotH());
    const lw = P.lotW() * scale;
    const lh = P.lotH() * scale;
    const offsetX = P.MAP_CANVAS_EDGE + (availW - lw) / 2;
    const offsetY = P.MAP_CANVAS_EDGE + (availH - lh) / 2;
    return { offsetX, offsetY, scale };
  }

P.worldToScreen = function (wx, wy) {
    const { offsetX, offsetY, scale } = P.padScale();
    const sx = offsetX + wx * scale;
    const sy = offsetY + (P.lotH() - wy) * scale;
    return { sx, sy };
  }

P.screenToWorld = function (sx, sy) {
    const { offsetX, offsetY, scale } = P.padScale();
    const wx = (sx - offsetX) / scale;
    const wy = P.lotH() - (sy - offsetY) / scale;
    return { wx, wy };
  }

P.eventToWorld = function (ev) {
    const rect = P.mapCanvas.getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * P.mapCssW;
    const sy = ((ev.clientY - rect.top) / rect.height) * P.mapCssH;
    return P.screenToWorld(sx, sy);
  }

P.clampWorld = function (x, y) {
    return {
      wx: Math.max(0, Math.min(P.lotW(), x)),
      wy: Math.max(0, Math.min(P.lotH(), y)),
    };
  }

P.clampBuildingCenter = function (x, y) {
    const halfW = P.B.bw / 2;
    const halfH = P.B.bh / 2;
    return {
      wx: Math.max(halfW, Math.min(P.lotW() - halfW, x)),
      wy: Math.max(halfH, Math.min(P.lotH() - halfH, y)),
    };
  }

P.uLen = function () {
    return P.scenario?.display?.length_unit ?? "m";
  }

P.uTime = function () {
    return P.scenario?.display?.time_unit ?? "s";
  }

P.metersPerUnit = function () {
    const v = Number(P.scenario?.display?.meters_per_unit);
    return v > 0 ? v : 2;
  }

P.scaleBarWorldM = function () {
    const v = Number(P.scenario?.display?.scale_bar_m);
    const meters = v > 0 ? v : 20;
    return meters / P.metersPerUnit();
  }

P.fmtDim = function (v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    const s = n.toFixed(2);
    return s.replace(/\.?0+$/, "");
  }

P.ensureDisplay = function () {
    if (!P.scenario) return;
    if (!P.scenario.display) P.scenario.display = {};
    const d = P.scenario.display;
    if (!d.length_unit) d.length_unit = "m";
    if (!d.time_unit) d.time_unit = "s";
    if (d.meters_per_unit == null || Number.isNaN(Number(d.meters_per_unit))) d.meters_per_unit = 2;
    if (d.scale_bar_m == null || Number.isNaN(Number(d.scale_bar_m))) d.scale_bar_m = 20;
    if (!d.coord_note) d.coord_note = "平面坐标 1 单位 = 2 m";
  }

P.ensureConstraints = function () {
    if (!P.scenario) return;
    if (!P.scenario.constraints) P.scenario.constraints = {};
    /* 无开关：始终吸附道路停车带与道路中心线（与本地优化内核 normalize 一致） */
    P.scenario.constraints.snap_slots_to_inner_road = true;
    P.scenario.constraints.snap_entrance_to_inner = true;
    P.ensureDisplay();
  }
})();
