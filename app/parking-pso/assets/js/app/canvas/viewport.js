(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/viewport.js");

P._syncCanvasToBag = function (canvas, bag, minW, minH, defaultW, defaultH) {
    if (!canvas) return false;
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(minW, Math.round(r.width)) || defaultW;
    const nh = Math.max(minH, Math.round(r.height)) || defaultH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (nw === bag.cssW && nh === bag.cssH && dpr === bag.dpr) return false;
    bag.cssW = nw;
    bag.cssH = nh;
    bag.dpr = dpr;
    canvas.width = Math.round(nw * dpr);
    canvas.height = Math.round(nh * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
    return true;
  };

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
    const bag = {
      get cssW() { return P.chartCssW; },
      set cssW(v) { P.chartCssW = v; },
      get cssH() { return P.chartCssH; },
      set cssH(v) { P.chartCssH = v; },
      get dpr() { return P.chartDpr; },
      set dpr(v) { P.chartDpr = v; },
    };
    P._syncCanvasToBag(P.chartCanvas, bag, 200, 96, P.chartCssW, P.chartCssH);
    P.cctx.setTransform(P.chartDpr, 0, 0, P.chartDpr, 0, 0);
    P.cctx.imageSmoothingEnabled = true;
  };

P.compareRadarCssW = 280;
P.compareRadarCssH = 200;
P.compareRadarDpr = 1;
P.simQueueCssW = 280;
P.simQueueCssH = 120;
P.simQueueDpr = 1;

P.syncCompareRadarSize = function () {
    const canvas = document.getElementById("compare-radar");
    if (!canvas) return;
    const bag = {
      get cssW() { return P.compareRadarCssW; },
      set cssW(v) { P.compareRadarCssW = v; },
      get cssH() { return P.compareRadarCssH; },
      set cssH(v) { P.compareRadarCssH = v; },
      get dpr() { return P.compareRadarDpr; },
      set dpr(v) { P.compareRadarDpr = v; },
    };
    P._syncCanvasToBag(canvas, bag, 160, 120, P.compareRadarCssW, P.compareRadarCssH);
  };

P.syncSimQueueChartSize = function () {
    const canvas = document.getElementById("sim-queue-chart");
    if (!canvas) return;
    const bag = {
      get cssW() { return P.simQueueCssW; },
      set cssW(v) { P.simQueueCssW = v; },
      get cssH() { return P.simQueueCssH; },
      set cssH(v) { P.simQueueCssH = v; },
      get dpr() { return P.simQueueDpr; },
      set dpr(v) { P.simQueueDpr = v; },
    };
    P._syncCanvasToBag(canvas, bag, 160, 80, P.simQueueCssW, P.simQueueCssH);
  };

P.redrawAuxCharts = function () {
    if (P.activeTab === "simulate" && P.simState?.timeline) {
      P.syncSimQueueChartSize();
      P.drawSimQueueChart?.(P.simState.timeline);
    }
    if (P.activeTab === "schemes" && P.renderComparePanel) {
      P.syncCompareRadarSize();
      P.renderComparePanel();
    }
  };

P.lotW = function () {
    return P.scenario?.lot?.width ?? 100;
  }

P.lotH = function () {
    return P.scenario?.lot?.height ?? 100;
  }

P.lotX0 = function () {
    return Number(P.scenario?.lot?.x_min ?? 0);
  }

P.lotY0 = function () {
    return Number(P.scenario?.lot?.y_min ?? 0);
  }

P.lotX1 = function () {
    return P.lotX0() + P.lotW();
  }

P.lotY1 = function () {
    return P.lotY0() + P.lotH();
  }

P.ensureLotOrigin = function () {
    if (!P.scenario?.lot) return;
    if (P.scenario.lot.x_min == null) P.scenario.lot.x_min = 0;
    if (P.scenario.lot.y_min == null) P.scenario.lot.y_min = 0;
  }

P.computeContentBounds = function (padding = 0) {
    if (!P.scenario) return { xMin: NaN, xMax: NaN, yMin: NaN, yMax: NaN };
    const pad = Math.max(0, Number(padding) || 0);
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    const addPt = (x, y) => {
      const nx = Number(x);
      const ny = Number(y);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      xMin = Math.min(xMin, nx);
      xMax = Math.max(xMax, nx);
      yMin = Math.min(yMin, ny);
      yMax = Math.max(yMax, ny);
    };
    const addHalf = (x, y, hw, hh) => {
      addPt(x - hw, y - hh);
      addPt(x + hw, y + hh);
    };
    (P.scenario.entrances || []).forEach((p) => addPt(p[0], p[1]));
    (P.scenario.buildings || []).forEach((p) => addHalf(p[0], p[1], P.B.bw / 2, P.B.bh / 2));
    (P.scenario.slots || []).forEach((p) => addHalf(p[0], p[1], P.B.sw / 2, P.B.sh / 2));
    (P.scenario.obstacles || []).forEach((o) => (o.points || []).forEach((pt) => addPt(pt[0], pt[1])));
    (P.scenario.road?.centerline || []).forEach((p) => addPt(p[0], p[1]));
    const inner = P.scenario.inner;
    if (inner) {
      addPt(inner.x_min, inner.y_min);
      addPt(inner.x_max, inner.y_max);
    }
    if (!Number.isFinite(xMin)) return { xMin: NaN, xMax: NaN, yMin: NaN, yMax: NaN };
    return { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad };
  }

P.computeSceneBounds = function (padding = 0) {
    if (!P.scenario) return { xMin: NaN, xMax: NaN, yMin: NaN, yMax: NaN };
    const pad = Math.max(0, Number(padding) || 0);
    let xMin = Infinity;
    let xMax = -Infinity;
    let yMin = Infinity;
    let yMax = -Infinity;
    const addPt = (x, y) => {
      const nx = Number(x);
      const ny = Number(y);
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
      xMin = Math.min(xMin, nx);
      xMax = Math.max(xMax, nx);
      yMin = Math.min(yMin, ny);
      yMax = Math.max(yMax, ny);
    };
    const addHalf = (x, y, hw, hh) => {
      addPt(x - hw, y - hh);
      addPt(x + hw, y + hh);
    };
    (P.scenario.entrances || []).forEach((p) => addPt(p[0], p[1]));
    (P.scenario.buildings || []).forEach((p) => addHalf(p[0], p[1], P.B.bw / 2, P.B.bh / 2));
    (P.scenario.slots || []).forEach((p) => addHalf(p[0], p[1], P.B.sw / 2, P.B.sh / 2));
    (P.scenario.obstacles || []).forEach((o) => (o.points || []).forEach((pt) => addPt(pt[0], pt[1])));
    (P.scenario.road?.centerline || []).forEach((p) => addPt(p[0], p[1]));
    const inner = P.scenario.inner;
    if (inner) {
      addPt(inner.x_min, inner.y_min);
      addPt(inner.x_max, inner.y_max);
    }
    addPt(P.lotX0(), P.lotY0());
    addPt(P.lotX1(), P.lotY1());
    if (!Number.isFinite(xMin)) return { xMin: NaN, xMax: NaN, yMin: NaN, yMax: NaN };
    return { xMin: xMin - pad, xMax: xMax + pad, yMin: yMin - pad, yMax: yMax + pad };
  }

P.expandLotToFitScene = function (padding = 8) {
    if (!P.scenario?.lot) return false;
    P.ensureLotOrigin();
    const before = {
      x_min: P.lotX0(),
      y_min: P.lotY0(),
      width: P.lotW(),
      height: P.lotH(),
    };
    const midSx = P.mapCssW / 2;
    const midSy = P.mapCssH / 2;
    const anchorWorld = P.screenToWorld(midSx, midSy);
    const b = P.computeContentBounds(padding);
    if (!Number.isFinite(b.xMin)) return false;
    let x0 = P.lotX0();
    let y0 = P.lotY0();
    let x1 = P.lotX1();
    let y1 = P.lotY1();
    const eps = 0.05;
    let changed = false;
    if (b.xMin < x0 - eps) {
      x0 = b.xMin;
      changed = true;
    }
    if (b.yMin < y0 - eps) {
      y0 = b.yMin;
      changed = true;
    }
    if (b.xMax > x1 + eps) {
      x1 = b.xMax;
      changed = true;
    }
    if (b.yMax > y1 + eps) {
      y1 = b.yMax;
      changed = true;
    }
    const newW = x1 - x0;
    const newH = y1 - y0;
    if (newW > P.MAX_LOT_SPAN || newH > P.MAX_LOT_SPAN) {
      P.showWorkspaceMessage?.(
        "地块已达上限（" + P.MAX_LOT_SPAN + " 单位），请缩小场景或拆分方案。",
        { level: "warn" }
      );
      return false;
    }
    if (changed) {
      P.scenario.lot.x_min = Math.round(x0 * 10) / 10;
      P.scenario.lot.y_min = Math.round(y0 * 10) / 10;
      P.scenario.lot.width = Math.round(newW * 10) / 10;
      P.scenario.lot.height = Math.round(newH * 10) / 10;
      P.compensateViewForLotChange(before, anchorWorld, midSx, midSy);
    }
    return changed;
  }

P.compensateViewForLotChange = function (before, anchorWorld, midSx, midSy) {
    const edge = P.MAP_CANVAS_EDGE;
    const availW = Math.max(1, P.mapCssW - 2 * edge);
    const availH = Math.max(1, P.mapCssH - 2 * edge);
    const oldW = Math.max(1e-6, Number(before.width) || 1);
    const oldH = Math.max(1e-6, Number(before.height) || 1);
    const oldBase = Math.min(availW / oldW, availH / oldH);
    const newBase = Math.min(availW / P.lotW(), availH / P.lotH());
    if (newBase > 1e-9) {
      P.viewZoom = Math.max(0.15, Math.min(8, (P.viewZoom ?? 1) * (oldBase / newBase)));
    }
    const ax = Number(anchorWorld?.wx);
    const ay = Number(anchorWorld?.wy);
    if (Number.isFinite(ax) && Number.isFinite(ay)) {
      const afterScreen = P.worldToScreen(ax, ay);
      P.viewPanX = (P.viewPanX ?? 0) + (midSx - afterScreen.sx);
      P.viewPanY = (P.viewPanY ?? 0) + (midSy - afterScreen.sy);
    }
  }

P.commitSceneGeometry = function () {
    P.schedulePersistCurrentState?.();
    P.updateActionGates?.();
    return false;
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

P.fitViewToLot = function () {
    P.viewPanX = 0;
    P.viewPanY = 0;
    P.viewZoom = 1;
    P.draw();
  }

P.fitViewToContent = function (padding = 8) {
    const b = P.computeSceneBounds(padding);
    if (!Number.isFinite(b.xMin)) {
      P.fitViewToLot();
      return;
    }
    const cw = P.mapCssW;
    const ch = P.mapCssH;
    const availW = Math.max(1, cw - 2 * P.MAP_CANVAS_EDGE);
    const availH = Math.max(1, ch - 2 * P.MAP_CANVAS_EDGE);
    const bw = Math.max(1e-6, b.xMax - b.xMin);
    const bh = Math.max(1e-6, b.yMax - b.yMin);
    const baseScale = Math.min(availW / P.lotW(), availH / P.lotH());
    const fitScale = Math.min(availW / bw, availH / bh);
    P.viewZoom = Math.max(0.15, Math.min(8, fitScale / baseScale));
    const scale = baseScale * P.viewZoom;
    const cx = (b.xMin + b.xMax) / 2;
    const cy = (b.yMin + b.yMax) / 2;
    const midSx = P.MAP_CANVAS_EDGE + availW / 2;
    const midSy = P.MAP_CANVAS_EDGE + availH / 2;
    const centerOffX = P.MAP_CANVAS_EDGE + (availW - P.lotW() * scale) / 2;
    const centerOffY = P.MAP_CANVAS_EDGE + (availH - P.lotH() * scale) / 2;
    const contentSx = centerOffX + (cx - P.lotX0()) * scale;
    const contentSy = centerOffY + (P.lotY0() + P.lotH() - cy) * scale;
    P.viewPanX = midSx - contentSx;
    P.viewPanY = midSy - contentSy;
    P.draw();
  }

P.zoomAtScreen = function (sx, sy, factor) {
    const world = P.screenToWorld(sx, sy);
    P.viewZoom = Math.max(0.15, Math.min(8, (P.viewZoom ?? 1) * factor));
    const cw = P.mapCssW;
    const ch = P.mapCssH;
    const availW = Math.max(1, cw - 2 * P.MAP_CANVAS_EDGE);
    const availH = Math.max(1, ch - 2 * P.MAP_CANVAS_EDGE);
    const baseScale = Math.min(availW / P.lotW(), availH / P.lotH());
    const scale = baseScale * P.viewZoom;
    const centerOffX = P.MAP_CANVAS_EDGE + (availW - P.lotW() * scale) / 2;
    const centerOffY = P.MAP_CANVAS_EDGE + (availH - P.lotH() * scale) / 2;
    P.viewPanX = sx - centerOffX - (world.wx - P.lotX0()) * scale;
    P.viewPanY = sy - centerOffY - (P.lotY0() + P.lotH() - world.wy) * scale;
    P.draw();
  }

P.fitLotToMapAspect = function () {
    return false;
  }

P.padScale = function () {
    const cw = P.mapCssW;
    const ch = P.mapCssH;
    const availW = Math.max(1, cw - 2 * P.MAP_CANVAS_EDGE);
    const availH = Math.max(1, ch - 2 * P.MAP_CANVAS_EDGE);
    const baseScale = Math.min(availW / P.lotW(), availH / P.lotH());
    const scale = baseScale * (P.viewZoom ?? 1);
    const lw = P.lotW() * scale;
    const lh = P.lotH() * scale;
    const offsetX = P.MAP_CANVAS_EDGE + (availW - lw) / 2 + (P.viewPanX ?? 0);
    const offsetY = P.MAP_CANVAS_EDGE + (availH - lh) / 2 + (P.viewPanY ?? 0);
    return { offsetX, offsetY, scale, baseScale };
  }

P.worldToScreen = function (wx, wy) {
    const { offsetX, offsetY, scale } = P.padScale();
    const sx = offsetX + (wx - P.lotX0()) * scale;
    const sy = offsetY + (P.lotY0() + P.lotH() - wy) * scale;
    return { sx, sy };
  }

P.screenToWorld = function (sx, sy) {
    const { offsetX, offsetY, scale } = P.padScale();
    const wx = P.lotX0() + (sx - offsetX) / scale;
    const wy = P.lotY0() + P.lotH() - (sy - offsetY) / scale;
    return { wx, wy };
  }

P.eventToScreen = function (ev) {
    const rect = P.mapCanvas.getBoundingClientRect();
    return {
      sx: ((ev.clientX - rect.left) / rect.width) * P.mapCssW,
      sy: ((ev.clientY - rect.top) / rect.height) * P.mapCssH,
    };
  }

P.eventToWorld = function (ev) {
    const rect = P.mapCanvas.getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * P.mapCssW;
    const sy = ((ev.clientY - rect.top) / rect.height) * P.mapCssH;
    return P.screenToWorld(sx, sy);
  }

P.lotBounds = function (margin = 0) {
    const m = Math.max(0, Number(margin) || 0);
    return {
      x0: P.lotX0() + m,
      x1: P.lotX1() - m,
      y0: P.lotY0() + m,
      y1: P.lotY1() - m,
    };
  }

P.pointInLot = function (x, y, margin = 0) {
    const b = P.lotBounds(margin);
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return false;
    if (b.x1 < b.x0 || b.y1 < b.y0) return false;
    return nx >= b.x0 - 1e-6 && nx <= b.x1 + 1e-6 && ny >= b.y0 - 1e-6 && ny <= b.y1 + 1e-6;
  }

P.pointsFitInLot = function (points, margin = 0) {
    if (!Array.isArray(points) || !points.length) return true;
    for (const p of points) {
      if (!P.pointInLot(p?.[0], p?.[1], margin)) return false;
    }
    return true;
  }

P.slotFitsInLot = function (cx, cy, theta) {
    const poly = P.slotPolygonAt?.(cx, cy, theta);
    if (!poly?.length) return P.pointInLot(cx, cy, 0);
    return P.pointsFitInLot(poly, 0);
  }

P.roadFitsInLot = function (road) {
    const pts = road?.centerline || [];
    if (!pts.length) return true;
    const margin = Math.max(0, Number(road?.width || P.DEFAULT_ROAD_WIDTH) / 2);
    return P.pointsFitInLot(pts, margin);
  }

P.clampWorld = function (x, y, margin = 0) {
    const b = P.lotBounds(margin);
    const nx = Number(x);
    const ny = Number(y);
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) return { wx: nx, wy: ny };
    if (b.x1 < b.x0 || b.y1 < b.y0) return { wx: nx, wy: ny };
    return {
      wx: Math.max(b.x0, Math.min(b.x1, nx)),
      wy: Math.max(b.y0, Math.min(b.y1, ny)),
    };
  }

P.clampBuildingCenter = function (x, y) {
    const halfW = P.B.bw / 2;
    const halfH = P.B.bh / 2;
    return {
      wx: Math.max(P.lotX0() + halfW, Math.min(P.lotX1() - halfW, x)),
      wy: Math.max(P.lotY0() + halfH, Math.min(P.lotY1() - halfH, y)),
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
    P.scenario.constraints.snap_slots_to_inner_road = true;
    P.scenario.constraints.snap_entrance_to_inner = true;
    if (!P.scenario.soft_constraints) P.scenario.soft_constraints = {};
    if (!Number(P.scenario.soft_constraints.type_mismatch_penalty)) {
      P.scenario.soft_constraints.type_mismatch_penalty = 30;
    }
    const nSlot = P.scenario.slots?.length || 0;
    const nVeh = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    if (!Array.isArray(P.scenario.slot_types)) {
      P.scenario.slot_types = Array.from({ length: nSlot }, () => "normal");
    }
    while (P.scenario.slot_types.length < nSlot) P.scenario.slot_types.push("normal");
    if (!Array.isArray(P.scenario.vehicle_requirements)) {
      P.scenario.vehicle_requirements = Array.from({ length: nVeh }, () => "normal");
    }
    while (P.scenario.vehicle_requirements.length < nVeh) P.scenario.vehicle_requirements.push("normal");
    P.ensureDisplay();
  }
})();
