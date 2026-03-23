/**
 * 小区停车分配 · 前端画布
 * 约定：与 parking_engine / 后端 /api 字段一致；分段注释用「// --- 标题 ---」。
 */
(function () {
  "use strict";

  const mapCanvas = document.getElementById("map");
  const chartCanvas = document.getElementById("chart");
  const ctx = mapCanvas.getContext("2d");
  const cctx = chartCanvas.getContext("2d");
  /** 画布底部为 X 轴标题保留高度（px），避免中文轴标被裁切 */
  const CHART_BOTTOM_AXIS = 28;
  /** 地图 canvas 四边最小留白（CSS px）；地块在可用矩形内居中并取最大 scale */
  const MAP_CANVAS_EDGE = 12;
  /** 地图/图表逻辑尺寸（CSS 像素），与 devicePixelRatio 无关 */
  let mapCssW = 720;
  let mapCssH = 720;
  let mapDpr = 1;
  let chartCssW = 300;
  let chartCssH = 168;
  let chartDpr = 1;
  let lastChartSeries = [];
  let lastChartOptimizer = "pso";

  function syncMapCanvasSize() {
    const r = mapCanvas.getBoundingClientRect();
    const nw = Math.max(320, Math.round(r.width)) || mapCssW;
    const nh = Math.max(320, Math.round(r.height)) || mapCssH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (nw === mapCssW && nh === mapCssH && dpr === mapDpr) return;
    mapCssW = nw;
    mapCssH = nh;
    mapDpr = dpr;
    mapCanvas.width = Math.round(nw * dpr);
    mapCanvas.height = Math.round(nh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function syncChartCanvasSize() {
    const r = chartCanvas.getBoundingClientRect();
    const nw = Math.max(200, Math.round(r.width)) || chartCssW;
    const nh = Math.max(96, Math.round(r.height)) || chartCssH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    if (nw === chartCssW && nh === chartCssH && dpr === chartDpr) return;
    chartCssW = nw;
    chartCssH = nh;
    chartDpr = dpr;
    chartCanvas.width = Math.round(nw * dpr);
    chartCanvas.height = Math.round(nh * dpr);
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cctx.imageSmoothingEnabled = true;
  }

  // --- API 基址：file:// 走本机 Flask；线上静态站走 Zeabur ---
  function apiUrl(path) {
    if (window.location.protocol === "file:") {
      return "http://127.0.0.1:5000" + path;
    }
    const h = window.location.hostname;
    const local =
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "[::1]" ||
      h === "::1";
    const base = local
      ? "http://localhost:5000"
      : "https://noomings-backend.zeabur.app";
    return base + path;
  }

  /**
   * 俯视配色参考公开资料（非贴图）：沥青/路面 #36454F 系、铺装混凝土 #d1d8dc 系、
   * 热熔泊位线黄、混凝土屋面、绿地渐变。可选无缝贴图可自行换用 CC0：
   * https://cc0-textures.com/ （如 Asphalt 010）等，本实现零外链以离线可用。
   */
  const COLORS = {
    lotGradientTop: "#e4e9ef",
    lotGradientBot: "#b9c6d2",
    road: "#3a4352",
    roadEdge: "#2c3340",
    curb: "rgba(255, 255, 255, 0.78)",
    parkingStrip: "rgba(255, 255, 255, 0.38)",
    /** 泊位：略深于地块的沥青感 + 热熔白漆（U 形，口朝行车道） */
    slotAsphalt: "#8b95a3",
    slotPaint: "#f1f5f9",
    /** 居民楼：屋面明暗 + 立面窗格示意 */
    buildingRoofHi: "#c5ced6",
    buildingRoofLo: "#7a8794",
    buildingStroke: "#4a5560",
    buildingShadow: "rgba(25, 30, 38, 0.28)",
    buildingMullion: "rgba(45, 55, 65, 0.42)",
    grassA: "#2d5f3a",
    grassB: "#3a7a4a",
    grassC: "#245232",
    grassEdge: "rgba(12, 35, 18, 0.5)",
    entranceFill: "#d97706",
    entranceStroke: "#292524",
    path: "rgba(80, 86, 96, 0.52)",
    select: "#ea580c",
  };

  /**
   * 俯视绘制（米）：车位 ≈ 标准泊位 5×2.5，与引擎沿路车长/车宽量级一致；
   * 居民楼 bw×bh 与 parking_engine.BUILDING_FOOTPRINT_W/H 一致（步行绕非目的楼障碍用）。
   */
  const B = { bw: 11.0, bh: 7.0, sw: 5.0, sh: 2.5 };
  const HIT_PAD = 0.5;
  /** 与 parking_engine 一致；东西带用 SNAP_INSET_EW，南北带用车宽一半+边距 */
  const SNAP_MARGIN = 0.45;
  const SNAP_INSET_EW = 2.55;

  let scenario = null;
  let selection = null;
  let pendingAdd = null;
  let drag = null;
  let lastResult = null;

  function lotW() {
    return scenario?.lot?.width ?? 100;
  }
  function lotH() {
    return scenario?.lot?.height ?? 100;
  }

  function padScale() {
    const cw = mapCssW;
    const ch = mapCssH;
    const availW = Math.max(1, cw - 2 * MAP_CANVAS_EDGE);
    const availH = Math.max(1, ch - 2 * MAP_CANVAS_EDGE);
    const scale = Math.min(availW / lotW(), availH / lotH());
    const lw = lotW() * scale;
    const lh = lotH() * scale;
    const offsetX = MAP_CANVAS_EDGE + (availW - lw) / 2;
    const offsetY = MAP_CANVAS_EDGE + (availH - lh) / 2;
    return { offsetX, offsetY, scale };
  }

  function worldToScreen(wx, wy) {
    const { offsetX, offsetY, scale } = padScale();
    const sx = offsetX + wx * scale;
    const sy = offsetY + (lotH() - wy) * scale;
    return { sx, sy };
  }

  function screenToWorld(sx, sy) {
    const { offsetX, offsetY, scale } = padScale();
    const wx = (sx - offsetX) / scale;
    const wy = lotH() - (sy - offsetY) / scale;
    return { wx, wy };
  }

  function eventToWorld(ev) {
    const rect = mapCanvas.getBoundingClientRect();
    const sx = ((ev.clientX - rect.left) / rect.width) * mapCssW;
    const sy = ((ev.clientY - rect.top) / rect.height) * mapCssH;
    return screenToWorld(sx, sy);
  }

  function clampWorld(x, y) {
    return {
      wx: Math.max(0, Math.min(lotW(), x)),
      wy: Math.max(0, Math.min(lotH(), y)),
    };
  }

  function uLen() {
    return scenario?.display?.length_unit ?? "m";
  }
  function uTime() {
    return scenario?.display?.time_unit ?? "s";
  }
  function scaleBarWorldM() {
    const v = Number(scenario?.display?.scale_bar_m);
    return v > 0 ? v : 20;
  }

  function ensureDisplay() {
    if (!scenario) return;
    if (!scenario.display) scenario.display = {};
    const d = scenario.display;
    if (!d.length_unit) d.length_unit = "m";
    if (!d.time_unit) d.time_unit = "s";
    if (d.scale_bar_m == null || Number.isNaN(Number(d.scale_bar_m))) d.scale_bar_m = 20;
    if (!d.coord_note) d.coord_note = "平面坐标 1 单位 = 1 m";
  }

  function ensureConstraints() {
    if (!scenario) return;
    if (!scenario.constraints) scenario.constraints = {};
    /* 无开关：始终吸附内环停车带与内环边线（与后端 normalize 一致） */
    scenario.constraints.snap_slots_to_inner_road = true;
    scenario.constraints.snap_entrance_to_inner = true;
    ensureDisplay();
  }

  function ensureVehicleDestinationsArray() {
    if (!scenario) return;
    const n = Math.max(1, parseInt(scenario.n_veh, 10) || 1);
    const nb = scenario.buildings?.length ?? 0;
    if (!Array.isArray(scenario.vehicle_destinations)) {
      scenario.vehicle_destinations = Array.from({ length: n }, (_, i) =>
        nb > 0 ? i % nb : 0
      );
      return;
    }
    while (scenario.vehicle_destinations.length < n) {
      const i = scenario.vehicle_destinations.length;
      scenario.vehicle_destinations.push(nb > 0 ? i % nb : 0);
    }
    if (scenario.vehicle_destinations.length > n) {
      scenario.vehicle_destinations.length = n;
    }
    if (nb > 0) {
      scenario.vehicle_destinations = scenario.vehicle_destinations.map((d) => {
        let v = parseInt(d, 10);
        if (!Number.isFinite(v)) v = 0;
        return Math.max(0, Math.min(nb - 1, v));
      });
    }
  }

  function adjustVehicleDestinationsAfterBuildingRemoved(removedIndex) {
    if (!scenario || !Array.isArray(scenario.vehicle_destinations)) return;
    const nb = scenario.buildings.length;
    scenario.vehicle_destinations = scenario.vehicle_destinations.map((d) => {
      let v = parseInt(d, 10);
      if (!Number.isFinite(v)) v = 0;
      if (v === removedIndex) return Math.max(0, removedIndex - 1);
      if (v > removedIndex) return v - 1;
      return v;
    });
    if (nb > 0) {
      scenario.vehicle_destinations = scenario.vehicle_destinations.map((d) =>
        Math.max(0, Math.min(nb - 1, d))
      );
    }
  }

  function rebuildVehicleTargetsUI() {
    const el = document.getElementById("vehicle-targets-list");
    if (!el || !scenario) return;
    ensureVehicleDestinationsArray();
    const n = Math.max(1, parseInt(scenario.n_veh, 10) || 1);
    const nb = scenario.buildings?.length ?? 0;
    el.innerHTML = "";
    for (let i = 0; i < n; i++) {
      const row = document.createElement("div");
      row.className = "vehicle-target-row";
      const lab = document.createElement("label");
      lab.textContent = "车 " + (i + 1);
      lab.setAttribute("for", "veh-dest-" + i);
      const sel = document.createElement("select");
      sel.id = "veh-dest-" + i;
      if (nb === 0) {
        const opt = document.createElement("option");
        opt.value = "0";
        opt.textContent = "（请先添加居民楼）";
        sel.appendChild(opt);
        sel.disabled = true;
      } else {
        for (let b = 0; b < nb; b++) {
          const opt = document.createElement("option");
          opt.value = String(b);
          opt.textContent = "楼 " + (b + 1);
          sel.appendChild(opt);
        }
        const dest = scenario.vehicle_destinations[i] ?? 0;
        sel.value = String(Math.max(0, Math.min(nb - 1, dest)));
        sel.addEventListener("change", () => {
          const v = parseInt(sel.value, 10);
          scenario.vehicle_destinations[i] = Number.isFinite(v) ? v : 0;
          invalidateOptimizationResult();
        });
      }
      row.appendChild(lab);
      row.appendChild(sel);
      el.appendChild(row);
    }
  }

  function randomizeVehicleDestinations() {
    if (!scenario) return;
    const nb = scenario.buildings?.length ?? 0;
    if (nb === 0) return;
    ensureVehicleDestinationsArray();
    const n = scenario.vehicle_destinations.length;
    for (let i = 0; i < n; i++) {
      scenario.vehicle_destinations[i] = Math.floor(Math.random() * nb);
    }
    rebuildVehicleTargetsUI();
    invalidateOptimizationResult();
  }

  function invalidateOptimizationResult() {
    lastResult = null;
    lastChartSeries = [];
    drawChart([]);
    updateChartCaption("idle");
    draw();
  }

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-18) return { qx: x1, qy: y1 };
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return { qx: x1 + t * dx, qy: y1 + t * dy };
  }

  /** 内环可行驶边界四边，线段 [x1,y1,x2,y2]（与引擎 build_road_segments 几何一致） */
  function innerBoundarySegments(inn) {
    const a = inn.x_min,
      b = inn.x_max,
      c = inn.y_min,
      d = inn.y_max;
    return [
      [a, c, b, c],
      [b, c, b, d],
      [b, d, a, d],
      [a, d, a, c],
    ];
  }

  function snapEntranceToInner(x, y) {
    let bestX = x,
      bestY = y,
      bestD = 1e30;
    for (const [x1, y1, x2, y2] of innerBoundarySegments(scenario.inner)) {
      const q = closestPointOnSegment(x, y, x1, y1, x2, y2);
      const d2 = (x - q.qx) ** 2 + (y - q.qy) ** 2;
      if (d2 < bestD) {
        bestD = d2;
        bestX = q.qx;
        bestY = q.qy;
      }
    }
    return clampWorld(bestX, bestY);
  }

  function snapSlotToRoad(x, y) {
    const inn = scenario.inner;
    const xm = inn.x_min;
    const xM = inn.x_max;
    const ym = inn.y_min;
    const yM = inn.y_max;
    const iw = xM - xm;
    const ih = yM - ym;
    const margin = SNAP_MARGIN;
    if (iw < 2 * margin + 0.2 || ih < 2 * margin + 0.2) {
      return clampWorld(x, y);
    }
    const insetEW = Math.max(0.4, Math.min(SNAP_INSET_EW, iw / 2 - margin - 0.1));
    const insetNS = Math.max(0.4, Math.min(B.sh / 2 + margin, ih / 2 - margin - 0.1));
    const strips = [
      [xm + margin, ym + insetNS, xM - margin, ym + insetNS],
      [xm + margin, yM - insetNS, xM - margin, yM - insetNS],
      [xm + insetEW, ym + margin, xm + insetEW, yM - margin],
      [xM - insetEW, ym + margin, xM - insetEW, yM - margin],
    ];
    let bestX = x;
    let bestY = y;
    let bestD = 1e30;
    for (const s of strips) {
      const q = closestPointOnSegment(x, y, s[0], s[1], s[2], s[3]);
      const d = (x - q.qx) ** 2 + (y - q.qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = q.qx;
        bestY = q.qy;
      }
    }
    return clampWorld(bestX, bestY);
  }

  function applySnapToSlot(i) {
    const s = snapSlotToRoad(scenario.slots[i][0], scenario.slots[i][1]);
    scenario.slots[i][0] = s.wx;
    scenario.slots[i][1] = s.wy;
  }

  function applySnapToAllSlots() {
    if (!scenario?.slots?.length) return;
    scenario.slots.forEach((_, i) => applySnapToSlot(i));
  }

  function parkingStripSegments() {
    const inn = scenario.inner;
    const xm = inn.x_min;
    const xM = inn.x_max;
    const ym = inn.y_min;
    const yM = inn.y_max;
    const iw = xM - xm;
    const ih = yM - ym;
    const margin = SNAP_MARGIN;
    if (iw < 2 * margin + 0.2 || ih < 2 * margin + 0.2) return [];
    const insetEW = Math.max(0.4, Math.min(SNAP_INSET_EW, iw / 2 - margin - 0.1));
    const insetNS = Math.max(0.4, Math.min(B.sh / 2 + margin, ih / 2 - margin - 0.1));
    return [
      [
        [xm + margin, ym + insetNS],
        [xM - margin, ym + insetNS],
      ],
      [
        [xm + margin, yM - insetNS],
        [xM - margin, yM - insetNS],
      ],
      [
        [xm + insetEW, ym + margin],
        [xm + insetEW, yM - margin],
      ],
      [
        [xM - insetEW, ym + margin],
        [xM - insetEW, yM - margin],
      ],
    ];
  }

  function distPointToSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  function hitInnerRoad(wx, wy) {
    let best = Infinity;
    for (const [x1, y1, x2, y2] of innerBoundarySegments(scenario.inner)) {
      const d = distPointToSeg(wx, wy, x1, y1, x2, y2);
      if (d < best) best = d;
    }
    return best <= 1.05;
  }

  function pickAt(wx, wy) {
    const ent = scenario.entrance;
    if (Math.hypot(wx - ent[0], wy - ent[1]) < 1.2) return { kind: "entrance" };

    for (let i = scenario.buildings.length - 1; i >= 0; i--) {
      const [bx, by] = scenario.buildings[i];
      if (
        Math.abs(wx - bx) <= B.bw / 2 + HIT_PAD &&
        Math.abs(wy - by) <= B.bh / 2 + HIT_PAD
      )
        return { kind: "building", index: i };
    }
    for (let i = scenario.slots.length - 1; i >= 0; i--) {
      const [sx, sy] = scenario.slots[i];
      const foot = slotFootprint(sx, sy);
      if (
        Math.abs(wx - sx) <= foot.w / 2 + HIT_PAD &&
        Math.abs(wy - sy) <= foot.h / 2 + HIT_PAD
      )
        return { kind: "slot", index: i };
    }

    const o = scenario.obstacle;
    if (wx >= o.x_min && wx <= o.x_max && wy >= o.y_min && wy <= o.y_max)
      return { kind: "obstacle" };

    if (hitInnerRoad(wx, wy)) return { kind: "inner" };

    return null;
  }

  function drawRoadSegments(segs) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const scale = padScale().scale;
    const lw = Math.max(10, scale * 0.52);
    for (const [[x1, y1], [x2, y2]] of segs) {
      const p1 = worldToScreen(x1, y1);
      const p2 = worldToScreen(x2, y2);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.strokeStyle = COLORS.road;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.strokeStyle = COLORS.roadEdge;
      ctx.lineWidth = Math.max(3, lw * 0.28);
      ctx.stroke();
    }
  }

  function fillRectWorld(xmin, ymin, w, h, fill, stroke, lineWidth) {
    const tl = worldToScreen(xmin, ymin + h);
    const br = worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    if (fill && fill !== "transparent") {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, ww, hh);
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth != null ? lineWidth : 2;
      ctx.strokeRect(x, y, ww, hh);
    }
  }

  /** 距内环哪边最近（泊位开口朝向道路一侧） */
  function nearestInnerCardinal(cx, cy) {
    const inn = scenario.inner;
    const dW = cx - inn.x_min;
    const dE = inn.x_max - cx;
    const dS = cy - inn.y_min;
    const dN = inn.y_max - cy;
    let side = "W";
    let m = dW;
    if (dE < m) {
      m = dE;
      side = "E";
    }
    if (dS < m) {
      m = dS;
      side = "S";
    }
    if (dN < m) {
      side = "N";
    }
    return side;
  }

  /**
   * 沿路车长 5m、垂直路宽 2.5m：东/西停车带上车位长边平行于 y；南/北停车带长边平行于 x。
   */
  function slotFootprint(cx, cy) {
    const open = nearestInnerCardinal(cx, cy);
    if (open === "E" || open === "W") {
      return { xmin: cx - B.sh / 2, ymin: cy - B.sw / 2, w: B.sh, h: B.sw, open };
    }
    return { xmin: cx - B.sw / 2, ymin: cy - B.sh / 2, w: B.sw, h: B.sh, open };
  }

  /** 世界坐标中心点叠字（描边便于压在路面/屋面上） */
  function drawStackedWorldLabels(wx, wy, lines) {
    if (!lines?.length) return;
    const p = worldToScreen(wx, wy);
    const scale = padScale().scale;
    const fs = Math.max(12, Math.min(20, scale * 0.42));
    const lh = fs * 1.08;
    ctx.save();
    ctx.font = `700 ${fs}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const half = ((lines.length - 1) * lh) / 2;
    for (let i = 0; i < lines.length; i++) {
      const yy = p.sy - half + i * lh;
      ctx.lineWidth = Math.max(2.8, scale * 0.1);
      ctx.strokeStyle = "rgba(0,0,0,0.62)";
      ctx.fillStyle = "#ffffff";
      ctx.strokeText(lines[i], p.sx, yy);
      ctx.fillText(lines[i], p.sx, yy);
    }
    ctx.restore();
  }

  function drawVehicleSlotAssignments() {
    const assign = lastResult?.assign;
    const targets = lastResult?.veh_targets;
    if (!assign?.length || !targets?.length || !scenario?.slots?.length) return;
    const n = Math.min(assign.length, targets.length);
    for (let vi = 0; vi < n; vi++) {
      const si = assign[vi];
      if (si < 0 || si >= scenario.slots.length) continue;
      const [cx, cy] = scenario.slots[si];
      const fp = slotFootprint(cx, cy);
      const wx = fp.xmin + fp.w / 2;
      const wy = fp.ymin + fp.h / 2;
      const b1 = (targets[vi] ?? 0) + 1;
      drawStackedWorldLabels(wx, wy, ["车" + (vi + 1), "→楼" + b1]);
    }
  }

  /** 俯视标准泊位：沥青块 + 三面白线，开口朝向距内环最近的一侧（行车道） */
  function drawParkingSlotWorld(cx, cy) {
    const { xmin, ymin, w, h, open } = slotFootprint(cx, cy);
    const tl = worldToScreen(xmin, ymin + h);
    const br = worldToScreen(xmin + w, ymin);
    const rx = tl.sx;
    const ry = tl.sy;
    const rw = br.sx - tl.sx;
    const rh = br.sy - tl.sy;
    ctx.fillStyle = COLORS.slotAsphalt;
    ctx.fillRect(rx, ry, rw, rh);
    const scale = padScale().scale;
    ctx.strokeStyle = COLORS.slotPaint;
    ctx.lineWidth = Math.max(2.2, scale * 0.075);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    const NW = worldToScreen(xmin, ymin + h);
    const NE = worldToScreen(xmin + w, ymin + h);
    const SE = worldToScreen(xmin + w, ymin);
    const SW = worldToScreen(xmin, ymin);
    ctx.beginPath();
    if (open === "W") {
      ctx.moveTo(NW.sx, NW.sy);
      ctx.lineTo(NE.sx, NE.sy);
      ctx.lineTo(SE.sx, SE.sy);
      ctx.lineTo(SW.sx, SW.sy);
    } else if (open === "E") {
      ctx.moveTo(NE.sx, NE.sy);
      ctx.lineTo(NW.sx, NW.sy);
      ctx.lineTo(SW.sx, SW.sy);
      ctx.lineTo(SE.sx, SE.sy);
    } else if (open === "N") {
      ctx.moveTo(NW.sx, NW.sy);
      ctx.lineTo(SW.sx, SW.sy);
      ctx.lineTo(SE.sx, SE.sy);
      ctx.lineTo(NE.sx, NE.sy);
    } else {
      ctx.moveTo(SW.sx, SW.sy);
      ctx.lineTo(NW.sx, NW.sy);
      ctx.lineTo(NE.sx, NE.sy);
      ctx.lineTo(SE.sx, SE.sy);
    }
    ctx.stroke();
  }

  /** 居民楼 footprint：阴影 + 屋面渐变 + 窗格 */
  function drawBuildingWorld(cx, cy) {
    const xmin = cx - B.bw / 2;
    const ymin = cy - B.bh / 2;
    const w = B.bw;
    const h = B.bh;
    const tl = worldToScreen(xmin, ymin + h);
    const br = worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    const scale = padScale().scale;
    const sh = Math.max(2, scale * 0.14);
    ctx.fillStyle = COLORS.buildingShadow;
    ctx.fillRect(x + sh, y + sh, ww, hh);
    const g = ctx.createLinearGradient(x, y, x + ww, y + hh);
    g.addColorStop(0, COLORS.buildingRoofHi);
    g.addColorStop(0.55, COLORS.buildingRoofLo);
    g.addColorStop(1, "#6b7784");
    ctx.fillStyle = g;
    ctx.fillRect(x, y, ww, hh);
    ctx.strokeStyle = COLORS.buildingStroke;
    ctx.lineWidth = Math.max(1.2, scale * 0.055);
    ctx.strokeRect(x, y, ww, hh);
    const cols = Math.max(3, Math.min(8, Math.round(w / 2.2)));
    const rows = Math.max(2, Math.min(6, Math.round(h / 2.4)));
    ctx.strokeStyle = COLORS.buildingMullion;
    ctx.lineWidth = Math.max(0.55, scale * 0.018);
    for (let i = 1; i < cols; i++) {
      const wx = xmin + (i * w) / cols;
      const p1 = worldToScreen(wx, ymin);
      const p2 = worldToScreen(wx, ymin + h);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      const wy = ymin + (j * h) / rows;
      const p1 = worldToScreen(xmin, wy);
      const p2 = worldToScreen(xmin + w, wy);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = Math.max(0.5, scale * 0.012);
    ctx.strokeRect(x + scale * 0.06, y + scale * 0.06, ww - scale * 0.12, hh - scale * 0.12);
  }

  /** 中央绿地/花坛：渐变近似航拍植被，略压深边线 */
  function fillObstacleGrass(xmin, ymin, w, h) {
    const tl = worldToScreen(xmin, ymin + h);
    const br = worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    const g = ctx.createLinearGradient(x, y, x + ww, y + hh);
    g.addColorStop(0, COLORS.grassA);
    g.addColorStop(0.5, COLORS.grassB);
    g.addColorStop(1, COLORS.grassC);
    ctx.fillStyle = g;
    ctx.fillRect(x, y, ww, hh);
    ctx.strokeStyle = COLORS.grassEdge;
    ctx.lineWidth = Math.max(1, padScale().scale * 0.06);
    ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, ww - 1), Math.max(0, hh - 1));
  }

  function draw() {
    if (!scenario) return;
    syncMapCanvasSize();
    const { offsetX, offsetY, scale } = padScale();
    ctx.clearRect(0, 0, mapCssW, mapCssH);
    const lotX = offsetX;
    const lotY = offsetY;
    const lotWp = lotW() * scale;
    const lotHp = lotH() * scale;
    const glot = ctx.createLinearGradient(lotX, lotY, lotX + lotWp, lotY + lotHp);
    glot.addColorStop(0, COLORS.lotGradientTop);
    glot.addColorStop(1, COLORS.lotGradientBot);
    ctx.fillStyle = glot;
    ctx.fillRect(lotX, lotY, lotWp, lotHp);

    const roadSegs =
      lastResult?.road_segments || buildRoadSegmentsLocal(scenario.inner);
    drawRoadSegments(roadSegs);

    const inn = scenario.inner;
    ctx.strokeStyle = COLORS.curb;
    ctx.lineWidth = Math.max(1.5, scale * 0.04);
    const c1 = worldToScreen(inn.x_min, inn.y_min);
    const c3 = worldToScreen(inn.x_max, inn.y_max);
    ctx.strokeRect(c1.sx, c3.sy, c3.sx - c1.sx, c1.sy - c3.sy);

    ctx.save();
    ctx.setLineDash([Math.max(4, scale * 0.1), Math.max(3, scale * 0.08)]);
    ctx.strokeStyle = COLORS.parkingStrip;
    ctx.lineWidth = Math.max(1.2, scale * 0.045);
    for (const [[ax, ay], [bx, by]] of parkingStripSegments()) {
      const p1 = worldToScreen(ax, ay);
      const p2 = worldToScreen(bx, by);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
    ctx.restore();

    const o = scenario.obstacle;
    fillObstacleGrass(o.x_min, o.y_min, o.x_max - o.x_min, o.y_max - o.y_min);

    for (const [x, y] of scenario.slots) {
      drawParkingSlotWorld(x, y);
    }
    for (let bi = 0; bi < scenario.buildings.length; bi++) {
      const [x, y] = scenario.buildings[bi];
      drawBuildingWorld(x, y);
      drawStackedWorldLabels(x, y, [String(bi + 1)]);
    }

    const e = scenario.entrance;
    const ep = worldToScreen(e[0], e[1]);
    const er = Math.max(8, scale * 0.42);
    ctx.beginPath();
    ctx.arc(ep.sx, ep.sy, er, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.entranceFill;
    ctx.fill();
    ctx.strokeStyle = COLORS.entranceStroke;
    ctx.lineWidth = Math.max(1.5, scale * 0.05);
    ctx.stroke();

    if (lastResult?.paths?.length) {
      ctx.lineWidth = Math.max(1, scale * 0.06);
      for (const poly of lastResult.paths) {
        if (poly.length < 2) continue;
        ctx.strokeStyle = COLORS.path;
        ctx.beginPath();
        const p0 = worldToScreen(poly[0][0], poly[0][1]);
        ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < poly.length; i++) {
          const p = worldToScreen(poly[i][0], poly[i][1]);
          ctx.lineTo(p.sx, p.sy);
        }
        ctx.stroke();
      }
    }

    drawVehicleSlotAssignments();
    drawSelectionOutline();
    drawMapOverlays();
  }

  function drawMapOverlays() {
    if (!scenario) return;
    const { offsetX, offsetY, scale } = padScale();
    /** 比例尺世界 y：越小越靠地块底边（屏幕下方）；文字在横线上方，避免裁切 */
    const y0 = 1.25;
    const x0 = 1.15;
    const Lm = scaleBarWorldM();
    const pA = worldToScreen(x0, y0);
    const pB = worldToScreen(x0 + Lm, y0);
    ctx.save();
    ctx.strokeStyle = "#5c6b82";
    ctx.fillStyle = "#b4c2d6";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(pA.sx, pA.sy);
    ctx.lineTo(pB.sx, pB.sy);
    ctx.stroke();
    const tick = Math.max(4, scale * 0.12);
    ctx.beginPath();
    ctx.moveTo(pA.sx, pA.sy - tick);
    ctx.lineTo(pA.sx, pA.sy);
    ctx.moveTo(pB.sx, pB.sy - tick);
    ctx.lineTo(pB.sx, pB.sy);
    ctx.stroke();
    const midX = (pA.sx + pB.sx) / 2;
    const label = Lm + " " + uLen();
    const fsScale = Math.max(12, Math.min(20, scale * 0.42));
    ctx.font = `700 ${fsScale}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    const gap = Math.max(6, fsScale * 0.35);
    const labelY = pA.sy - tick - gap;
    ctx.lineWidth = Math.max(2.8, scale * 0.1);
    ctx.strokeStyle = "rgba(0,0,0,0.62)";
    ctx.fillStyle = "#ffffff";
    ctx.strokeText(label, midX, labelY);
    ctx.fillText(label, midX, labelY);
    const fsAxis = Math.max(11, Math.min(15, scale * 0.32));
    ctx.font = `700 ${fsAxis}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.lineWidth = Math.max(2.2, scale * 0.085);
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    const xAx = offsetX + lotW() * scale - 4;
    const yAx = offsetY + lotH() * scale - 4;
    const xStr = "X → (" + uLen() + ")";
    ctx.strokeText(xStr, xAx, yAx);
    ctx.fillText(xStr, xAx, yAx);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const yStr = "Y ↑ (" + uLen() + ")";
    ctx.strokeText(yStr, offsetX + 6, offsetY + 4);
    ctx.fillText(yStr, offsetX + 6, offsetY + 4);
    ctx.restore();

    const cap = document.getElementById("map-unit-caption");
    if (cap) {
      cap.textContent =
        (scenario.display?.coord_note || "") + " · 比例尺见图中线段";
    }
    const lotHint = document.getElementById("lot-dim-hint");
    if (lotHint) {
      lotHint.textContent =
        "地块范围：0–" +
        lotW() +
        " " +
        uLen() +
        " × 0–" +
        lotH() +
        " " +
        uLen();
    }
  }

  function buildRoadSegmentsLocal(inner) {
    const ix0 = inner.x_min,
      ix1 = inner.x_max,
      iy0 = inner.y_min,
      iy1 = inner.y_max;
    return [
      [[ix0, iy0], [ix1, iy0]],
      [[ix1, iy0], [ix1, iy1]],
      [[ix1, iy1], [ix0, iy1]],
      [[ix0, iy1], [ix0, iy0]],
    ];
  }

  function drawSelectionOutline() {
    if (!selection) return;
    ctx.strokeStyle = COLORS.select;
    ctx.lineWidth = 3;
    if (selection.kind === "entrance") {
      const e = scenario.entrance;
      const ep = worldToScreen(e[0], e[1]);
      ctx.beginPath();
      ctx.arc(ep.sx, ep.sy, padScale().scale * 1.18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (selection.kind === "obstacle") {
      const o = scenario.obstacle;
      fillRectWorld(
        o.x_min,
        o.y_min,
        o.x_max - o.x_min,
        o.y_max - o.y_min,
        "transparent",
        COLORS.select,
        3
      );
    } else if (selection.kind === "inner") {
      const inn = scenario.inner;
      const c1 = worldToScreen(inn.x_min, inn.y_min);
      const c3 = worldToScreen(inn.x_max, inn.y_max);
      ctx.strokeRect(c1.sx, c3.sy, c3.sx - c1.sx, c1.sy - c3.sy);
    } else if (selection.kind === "building") {
      const [x, y] = scenario.buildings[selection.index];
      fillRectWorld(
        x - B.bw / 2,
        y - B.bh / 2,
        B.bw,
        B.bh,
        "transparent",
        COLORS.select,
        3
      );
    } else if (selection.kind === "slot") {
      const [x, y] = scenario.slots[selection.index];
      const foot = slotFootprint(x, y);
      fillRectWorld(foot.xmin, foot.ymin, foot.w, foot.h, "transparent", COLORS.select, 3);
    }
  }

  const propsEmpty = document.getElementById("props-empty");
  const propsForm = document.getElementById("props-form");

  function renderProps() {
    propsForm.innerHTML = "";
    if (!selection) {
      propsEmpty.hidden = false;
      propsForm.hidden = true;
      return;
    }
    propsEmpty.hidden = true;
    propsForm.hidden = false;

    const addNote = (text) => {
      const p = document.createElement("p");
      p.style.gridColumn = "1 / -1";
      p.style.margin = "0 0 0.35rem";
      p.style.fontSize = "0.88rem";
      p.style.color = "var(--muted)";
      p.textContent = text;
      propsForm.appendChild(p);
    };

    const addNum = (label, id, val, onChange) => {
      const l = document.createElement("label");
      l.htmlFor = id;
      l.textContent = label;
      const inp = document.createElement("input");
      inp.type = "number";
      inp.id = id;
      inp.step = "0.1";
      inp.value = val;
      inp.addEventListener("change", onChange);
      propsForm.appendChild(l);
      propsForm.appendChild(inp);
    };

    if (selection.kind === "entrance") {
      addNote(
        "入口为道路上的一点（无单独引道线段）；拖拽松手或改数后会自动贴到内环边线。"
      );
      const e = scenario.entrance;
      const applyEntrance = () => {
        scenario.entrance[0] = parseFloat(document.getElementById("p-ex").value) || 0;
        scenario.entrance[1] = parseFloat(document.getElementById("p-ey").value) || 0;
        const s = snapEntranceToInner(scenario.entrance[0], scenario.entrance[1]);
        scenario.entrance[0] = s.wx;
        scenario.entrance[1] = s.wy;
        renderProps();
        draw();
      };
      addNum("入口 X (" + uLen() + ")", "p-ex", e[0], applyEntrance);
      addNum("入口 Y (" + uLen() + ")", "p-ey", e[1], applyEntrance);
    } else if (selection.kind === "obstacle") {
      const o = scenario.obstacle;
      const olab = {
        x_min: "花坛西界 x",
        x_max: "花坛东界 x",
        y_min: "花坛南界 y",
        y_max: "花坛北界 y",
      };
      ["x_min", "x_max", "y_min", "y_max"].forEach((k) => {
        addNum(olab[k] + " (" + uLen() + ")", "p-o-" + k, o[k], () => {
          scenario.obstacle[k] = parseFloat(document.getElementById("p-o-" + k).value) || 0;
          normalizeObstacleInner();
          draw();
        });
      });
    } else if (selection.kind === "inner") {
      addNote(
        "内环表示可行驶道路边界：不可在画布上拖动，仅可改下列数值；改后会自动将各车位重新吸附到内环停车带。"
      );
      const inn = scenario.inner;
      const ilab = {
        x_min: "内环西界 x",
        x_max: "内环东界 x",
        y_min: "内环南界 y",
        y_max: "内环北界 y",
      };
      ["x_min", "x_max", "y_min", "y_max"].forEach((k) => {
        addNum(ilab[k] + " (" + uLen() + ")", "p-i-" + k, inn[k], () => {
          scenario.inner[k] = parseFloat(document.getElementById("p-i-" + k).value) || 0;
          normalizeObstacleInner();
          const es = snapEntranceToInner(scenario.entrance[0], scenario.entrance[1]);
          scenario.entrance[0] = es.wx;
          scenario.entrance[1] = es.wy;
          applySnapToAllSlots();
          renderProps();
          draw();
        });
      });
    } else if (selection.kind === "building") {
      const [x, y] = scenario.buildings[selection.index];
      addNum("楼中心 X (" + uLen() + ")", "p-bx", x, () => {
        const v = clampWorld(
          parseFloat(document.getElementById("p-bx").value) || 0,
          parseFloat(document.getElementById("p-by").value) || 0
        );
        scenario.buildings[selection.index][0] = v.wx;
        draw();
      });
      addNum("楼中心 Y (" + uLen() + ")", "p-by", y, () => {
        const v = clampWorld(
          parseFloat(document.getElementById("p-bx").value) || 0,
          parseFloat(document.getElementById("p-by").value) || 0
        );
        scenario.buildings[selection.index][1] = v.wy;
        draw();
      });
    } else if (selection.kind === "slot") {
      const [x, y] = scenario.slots[selection.index];
      const idx = selection.index;
      const applySlotFromInputs = () => {
        scenario.slots[idx][0] = parseFloat(document.getElementById("p-sx").value) || 0;
        scenario.slots[idx][1] = parseFloat(document.getElementById("p-sy").value) || 0;
        applySnapToSlot(idx);
        renderProps();
        draw();
      };
      addNum("车位中心 X (" + uLen() + ")", "p-sx", x, applySlotFromInputs);
      addNum("车位中心 Y (" + uLen() + ")", "p-sy", y, applySlotFromInputs);
    }
  }

  function normalizeObstacleInner() {
    const fix = (box) => {
      if (box.x_max < box.x_min) [box.x_min, box.x_max] = [box.x_max, box.x_min];
      if (box.y_max < box.y_min) [box.y_min, box.y_max] = [box.y_max, box.y_min];
    };
    fix(scenario.obstacle);
    fix(scenario.inner);
  }

  function setSelection(sel) {
    selection = sel;
    document.querySelectorAll(".toolbar button").forEach((b) => {
      if (b.id === "btn-add-building") b.classList.toggle("active", pendingAdd === "building");
      if (b.id === "btn-add-slot") b.classList.toggle("active", pendingAdd === "slot");
    });
    renderProps();
    draw();
  }

  function pointerDown(ev) {
    if (!scenario) return;
    const { wx, wy } = eventToWorld(ev);

    if (pendingAdd === "building") {
      const c = clampWorld(wx, wy);
      scenario.buildings.push([c.wx, c.wy]);
      ensureVehicleDestinationsArray();
      rebuildVehicleTargetsUI();
      pendingAdd = null;
      setSelection({ kind: "building", index: scenario.buildings.length - 1 });
      return;
    }
    if (pendingAdd === "slot") {
      const c = clampWorld(wx, wy);
      scenario.slots.push([c.wx, c.wy]);
      const si = scenario.slots.length - 1;
      const snapped = snapSlotToRoad(scenario.slots[si][0], scenario.slots[si][1]);
      scenario.slots[si][0] = snapped.wx;
      scenario.slots[si][1] = snapped.wy;
      pendingAdd = null;
      setSelection({ kind: "slot", index: si });
      return;
    }

    const hit = pickAt(wx, wy);
    if (!hit) {
      setSelection(null);
      return;
    }
    setSelection(hit);

    if (hit.kind === "entrance") {
      drag = {
        kind: "entrance",
        ox: scenario.entrance[0] - wx,
        oy: scenario.entrance[1] - wy,
      };
    } else if (hit.kind === "obstacle") {
      drag = { kind: "obstacle", startW: { wx, wy }, orig: { ...scenario.obstacle } };
    } else if (hit.kind === "inner") {
      /* 内环＝道路几何，禁止拖拽，仅可在侧栏改数值 */
    } else if (hit.kind === "building") {
      const [bx, by] = scenario.buildings[hit.index];
      drag = { kind: "building", index: hit.index, ox: bx - wx, oy: by - wy };
    } else if (hit.kind === "slot") {
      const [sx0, sy0] = scenario.slots[hit.index];
      drag = { kind: "slot", index: hit.index, ox: sx0 - wx, oy: sy0 - wy };
    }
  }

  function pointerMove(ev) {
    if (!drag || !scenario) return;
    let { wx, wy } = eventToWorld(ev);
    const cw = clampWorld(wx, wy);
    wx = cw.wx;
    wy = cw.wy;

    if (drag.kind === "entrance") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      scenario.entrance[0] = c.wx;
      scenario.entrance[1] = c.wy;
    } else if (drag.kind === "building") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      scenario.buildings[drag.index][0] = c.wx;
      scenario.buildings[drag.index][1] = c.wy;
    } else if (drag.kind === "slot") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      scenario.slots[drag.index][0] = c.wx;
      scenario.slots[drag.index][1] = c.wy;
    } else if (drag.kind === "obstacle") {
      const dx = wx - drag.startW.wx;
      const dy = wy - drag.startW.wy;
      const o = scenario.obstacle;
      const r = drag.orig;
      o.x_min = r.x_min + dx;
      o.x_max = r.x_max + dx;
      o.y_min = r.y_min + dy;
      o.y_max = r.y_max + dy;
      normalizeObstacleInner();
    }
    renderProps();
    draw();
  }

  function pointerUp() {
    const d = drag;
    drag = null;
    if (!scenario) return;
    let changed = false;
    if (d?.kind === "entrance") {
      const s = snapEntranceToInner(scenario.entrance[0], scenario.entrance[1]);
      scenario.entrance[0] = s.wx;
      scenario.entrance[1] = s.wy;
      changed = true;
      renderProps();
    }
    if (d?.kind === "slot") {
      applySnapToSlot(d.index);
      changed = true;
      renderProps();
    }
    if (changed) draw();
  }

  function deleteSelected() {
    if (!selection) return;
    if (selection.kind === "building") {
      const ri = selection.index;
      scenario.buildings.splice(ri, 1);
      adjustVehicleDestinationsAfterBuildingRemoved(ri);
      rebuildVehicleTargetsUI();
      setSelection(null);
    } else if (selection.kind === "slot") {
      scenario.slots.splice(selection.index, 1);
      setSelection(null);
    }
    invalidateOptimizationResult();
  }

  function updateChartCaption(mode) {
    const el = document.getElementById("chart-caption");
    if (!el) return;
    const tu = scenario ? uTime() : "s";
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

  function chartDrawAxisDecor(w, h) {
    cctx.fillStyle = "#d0dce8";
    cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    cctx.textAlign = "center";
    cctx.textBaseline = "bottom";
    cctx.fillText("迭代（次）", w / 2, h - 3);
    cctx.save();
    cctx.translate(16, (h - CHART_BOTTOM_AXIS) / 2 + 4);
    cctx.rotate(-Math.PI / 2);
    cctx.textAlign = "center";
    cctx.textBaseline = "middle";
    cctx.fillText("时间（" + uTime() + "）", 0, 0);
    cctx.restore();
  }

  /** 匈牙利/精确最优仅一个标量：无迭代曲线，画水平参考线 + 圆点 + 数值 */
  function chartDrawAxisDecorExact(w, h) {
    cctx.fillStyle = "#d0dce8";
    cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    cctx.textAlign = "center";
    cctx.textBaseline = "bottom";
    cctx.fillText("横轴：无迭代（单步全局最优）", w / 2, h - 3);
    cctx.save();
    cctx.translate(16, (h - CHART_BOTTOM_AXIS) / 2 + 4);
    cctx.rotate(-Math.PI / 2);
    cctx.textAlign = "center";
    cctx.textBaseline = "middle";
    cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
    cctx.fillText("最优总时间（" + uTime() + "）", 0, 0);
    cctx.restore();
  }

  function drawChart(series, optimizerKind) {
    syncChartCanvasSize();
    const w = chartCssW;
    const h = chartCssH;
    const kind = optimizerKind || "pso";
    lastChartSeries = Array.isArray(series) ? series.slice() : [];
    lastChartOptimizer = kind;
    const pad = 8;
    const plotH = Math.max(h - pad - CHART_BOTTOM_AXIS - 4, 24);
    const plotTop = pad + 4;
    cctx.clearRect(0, 0, w, h);
    cctx.fillStyle = "#0f1419";
    cctx.fillRect(0, 0, w, h);
    if (!series.length) {
      cctx.fillStyle = "#94a3b8";
      cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      cctx.textAlign = "center";
      cctx.textBaseline = "middle";
      cctx.fillText("运行优化后显示：精确为单点，PSO 为收敛曲线", w / 2, (plotTop + plotH / 2) | 0);
      chartDrawAxisDecor(w, h);
      return;
    }
    const v0 = Number(series[0]);
    if (series.length === 1 && kind === "exact" && Number.isFinite(v0)) {
      const span = Math.max(Math.abs(v0) * 0.06, 8);
      const lo = v0 - span;
      const hi = v0 + span;
      const y = plotTop + (1 - (v0 - lo) / (hi - lo)) * plotH;
      const cx = (w - 2 * pad) * 0.55 + pad;
      cctx.strokeStyle = "rgba(56,189,248,0.4)";
      cctx.lineWidth = 1;
      cctx.setLineDash([5, 5]);
      cctx.beginPath();
      cctx.moveTo(pad, y);
      cctx.lineTo(w - pad, y);
      cctx.stroke();
      cctx.setLineDash([]);
      cctx.fillStyle = "#38bdf8";
      cctx.beginPath();
      cctx.arc(cx, y, 6, 0, Math.PI * 2);
      cctx.fill();
      cctx.strokeStyle = "#0ea5e9";
      cctx.lineWidth = 1.5;
      cctx.stroke();
      cctx.fillStyle = "#f1f5f9";
      cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      cctx.textAlign = "left";
      cctx.textBaseline = "bottom";
      const label = v0.toFixed(2) + " " + uTime();
      cctx.fillText(label, Math.min(cx + 10, w - pad - 2), y - 4);
      cctx.textAlign = "center";
      cctx.textBaseline = "top";
      cctx.fillStyle = "#b8c9dc";
      cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
      cctx.fillText("匈牙利：全局最优（非迭代算法）", w / 2, pad + 2);
      chartDrawAxisDecorExact(w, h);
      return;
    }
    let lo = Math.min(...series);
    let hi = Math.max(...series);
    if (hi === lo) {
      hi = lo + 1;
    }
    cctx.strokeStyle = "#38bdf8";
    cctx.lineWidth = 2;
    cctx.beginPath();
    for (let i = 0; i < series.length; i++) {
      const t = series.length > 1 ? i / (series.length - 1) : 0;
      const x = pad + t * (w - 2 * pad);
      const y = plotTop + (1 - (series[i] - lo) / (hi - lo)) * plotH;
      if (i === 0) cctx.moveTo(x, y);
      else cctx.lineTo(x, y);
    }
    cctx.stroke();
    if (series.length === 1) {
      const t = 0;
      const x = pad + t * (w - 2 * pad);
      const y = plotTop + (1 - (series[0] - lo) / (hi - lo)) * plotH;
      cctx.fillStyle = "#38bdf8";
      cctx.beginPath();
      cctx.arc(x, y, 5, 0, Math.PI * 2);
      cctx.fill();
    }
    if (series.length >= 2) {
      cctx.fillStyle = "#a8b8cc";
      cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
      cctx.textBaseline = "top";
      cctx.textAlign = "left";
      cctx.fillText("0", pad, h - CHART_BOTTOM_AXIS + 2);
      cctx.textAlign = "right";
      cctx.fillText(String(series.length - 1), w - pad, h - CHART_BOTTOM_AXIS + 2);
    }
    chartDrawAxisDecor(w, h);
  }

  async function runOptimize() {
    const btn = document.getElementById("btn-run");
    const status = document.getElementById("result-status");
    const gbestEl = document.getElementById("result-gbest");
    const methodEl = document.getElementById("optimizer-method");
    const method = methodEl && methodEl.value ? methodEl.value : "exact";
    btn.disabled = true;
    status.textContent = "计算中…（总时间单位：" + uTime() + "）";
    gbestEl.style.display = "none";
    try {
      const res = await fetch(apiUrl("/api/optimize"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario, method }),
      });
      const rawText = await res.text();
      let data = null;
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch (_) {
        status.textContent =
          "服务器返回非 JSON（多为 500）。请查看运行 web_app 的终端报错，改代码后需重启服务。";
        invalidateOptimizationResult();
        return;
      }
      if (!res.ok) {
        status.textContent = data.error || "请求失败（HTTP " + res.status + "）";
        invalidateOptimizationResult();
        return;
      }
      lastResult = data;
      scenario = data.scenario;
      ensureConstraints();
      ensureVehicleDestinationsArray();
      nVehInput.value = scenario.n_veh ?? 12;
      rebuildVehicleTargetsUI();
      const opt = data.optimizer || method;
      status.textContent =
        (opt === "exact" ? "全局最优总时间" : "PSO 最优总时间") +
        "（行车 + 步行）/ " +
        uTime() +
        "：";
      gbestEl.style.display = "block";
      gbestEl.textContent =
        Number(data.gbest_value).toFixed(2) + " " + uTime();
      updateChartCaption(opt === "exact" ? "exact" : undefined);
      drawChart(data.history_best || [], opt);
      draw();
    } catch (e) {
      status.textContent = "网络错误";
      console.error(e);
    } finally {
      btn.disabled = false;
    }
  }

  mapCanvas.addEventListener("pointerdown", (e) => {
    mapCanvas.setPointerCapture(e.pointerId);
    pointerDown(e);
  });
  mapCanvas.addEventListener("pointermove", pointerMove);
  mapCanvas.addEventListener("pointerup", pointerUp);
  mapCanvas.addEventListener("pointercancel", pointerUp);

  function wireAddModeToggle(btnId, mode) {
    document.getElementById(btnId).addEventListener("click", () => {
      pendingAdd = pendingAdd === mode ? null : mode;
      document.getElementById("btn-add-building").classList.toggle("active", pendingAdd === "building");
      document.getElementById("btn-add-slot").classList.toggle("active", pendingAdd === "slot");
    });
  }
  wireAddModeToggle("btn-add-building", "building");
  wireAddModeToggle("btn-add-slot", "slot");
  document.getElementById("btn-delete").addEventListener("click", deleteSelected);
  document.getElementById("btn-random-dest").addEventListener("click", randomizeVehicleDestinations);
  document.getElementById("btn-run").addEventListener("click", runOptimize);

  window.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (document.activeElement?.tagName === "INPUT") return;
      deleteSelected();
    }
  });

  const nVehInput = document.getElementById("n-veh");
  nVehInput.addEventListener("change", () => {
    if (!scenario) return;
    let n = parseInt(nVehInput.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    scenario.n_veh = n;
    ensureVehicleDestinationsArray();
    rebuildVehicleTargetsUI();
    invalidateOptimizationResult();
  });

  async function loadDefault() {
    try {
      const res = await fetch(apiUrl("/api/default"));
      if (!res.ok) throw new Error("HTTP " + res.status);
      scenario = await res.json();
      ensureConstraints();
      ensureVehicleDestinationsArray();
      rebuildVehicleTargetsUI();
      lastResult = null;
      nVehInput.value = scenario.n_veh ?? 12;
      setSelection(null);
      document.getElementById("result-status").textContent =
        "尚未运行（总时间单位：" + uTime() + "）";
      document.getElementById("result-gbest").style.display = "none";
      drawChart([]);
      updateChartCaption("idle");
      draw();
    } catch (e) {
      document.getElementById("result-status").textContent =
        "无法连接后端：本地请运行 noomings_backend 的 Flask（python citywalk.py），并用 localhost:5000 打开；线上需已部署含 numpy/scipy 的后端。";
      console.error(e);
    }
  }

  const fileHint = document.getElementById("file-protocol-hint");
  if (fileHint && window.location.protocol === "file:") {
    fileHint.style.display = "block";
  }

  let resizeChartTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeChartTimer);
    resizeChartTimer = setTimeout(() => {
      syncMapCanvasSize();
      syncChartCanvasSize();
      if (scenario) draw();
      drawChart(lastChartSeries, lastChartOptimizer);
    }, 80);
  });

  loadDefault();
})();
