/**
 * 小区停车分配 · 前端画布
 * 约定：与 optimizer.js 结果字段一致；分段注释用「// --- 标题 ---」。
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

  const optimizer = window.ParkingOptimizer || null;
  const geometry = window.ParkingGeometry || null;
  const coreConstants = window.ParkingCoreConstants || null;
  const tabUtils = window.ParkingTabUtils || null;
  const storageFactory = window.ParkingAppStorage || null;
  const scenarioSource = window.ParkingScenarioSource || null;
  const analysisTools = window.ParkingAnalysis || null;
  const RESULT_KEYS = coreConstants?.RESULT_KEYS || optimizer?.RESULT_KEYS || [
    "scenario",
    "gbest_value",
    "history_best",
    "assign",
    "veh_targets",
    "veh_entrances",
    "vehicle_breakdown",
    "paths",
    "road_segments",
    "optimizer",
  ];

  function normalizeOptimizeResult(raw, method, fallbackScenario) {
    const fallback = {
      scenario: fallbackScenario,
      gbest_value: null,
      history_best: [],
      assign: [],
      veh_targets: [],
      veh_entrances: [],
      vehicle_breakdown: [],
      paths: [],
      road_segments: [],
      optimizer: method || "exact",
      error: "优化结果结构无效",
    };
    if (!raw || typeof raw !== "object") return fallback;
    const out = {};
    for (const key of RESULT_KEYS) {
      out[key] = raw[key];
    }
    out.error = typeof raw.error === "string" ? raw.error : null;
    out.optimizer = out.optimizer === "pso" ? "pso" : "exact";
    out.scenario = out.scenario && typeof out.scenario === "object" ? out.scenario : fallbackScenario;
    out.gbest_value = Number.isFinite(Number(out.gbest_value))
      ? Number(out.gbest_value)
      : null;
    out.history_best = Array.isArray(out.history_best)
      ? out.history_best.map((v) => Number(v)).filter((v) => Number.isFinite(v))
      : [];
    out.assign = Array.isArray(out.assign)
      ? out.assign.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [];
    out.veh_targets = Array.isArray(out.veh_targets)
      ? out.veh_targets.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [];
    out.veh_entrances = Array.isArray(raw.veh_entrances)
      ? raw.veh_entrances.map((v) => parseInt(v, 10)).filter((v) => Number.isFinite(v))
      : [];
    out.vehicle_breakdown = Array.isArray(raw.vehicle_breakdown) ? raw.vehicle_breakdown : [];
    out.paths = Array.isArray(out.paths) ? out.paths : [];
    out.road_segments = Array.isArray(out.road_segments) ? out.road_segments : [];
    return out;
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
    path: "rgba(17, 24, 39, 0.92)",
    pathGlow: "rgba(56, 189, 248, 0.55)",
    pathEnd: "#0ea5e9",
    select: "#ea580c",
  };

  function entranceDisplayName(index) {
    const safeIndex = Math.max(0, Number(index) || 0);
    return "入口 " + (safeIndex + 1);
  }

  /**
   * 俯视绘制（米）：按常见住宅小区近似尺寸。
   * - 车位：5.3m × 2.6m（长 × 宽）
   * - 居民楼占地：18m × 12m（示意）
   */
  const B = { bw: 18.0, bh: 12.0, sw: 5.3, sh: 2.6 };
  const HIT_PAD = 0.5;
  /** 与本地优化内核一致；东西带用 SNAP_INSET_EW，南北带用车宽一半+边距 */
  const SNAP_MARGIN = 0.45;
  const DEFAULT_ROAD_WIDTH = 6.0;
  const OVERLAP_EPS = 0.2;

  let scenario = null;
  let selection = null;
  let pendingAdd = null;
  let drag = null;
  let lastResult = null;
  const SNAPSHOT_STORAGE_KEY = "parking-pso-snapshots-v1";
  const CURRENT_STATE_STORAGE_KEY = "parking-pso-current-state-v1";
  const currentStateStore = storageFactory?.createStateStorage
    ? storageFactory.createStateStorage({ storageKey: CURRENT_STATE_STORAGE_KEY, debounceMs: 450 })
    : null;
  const snapshotStore = storageFactory?.createSnapshotStorage
    ? storageFactory.createSnapshotStorage(SNAPSHOT_STORAGE_KEY, 20)
    : null;
  const MAX_BENCHMARK_RUNS = analysisTools?.MAX_BENCHMARK_RUNS || 50;
  let benchmarkResult = null;
  const VEHICLE_PAGE_SIZE = 6;
  let vehiclePage = 0;
  let activeTab = "overview";
  let autoEntrancePreview = null;
  let autoEntrancePreviewTimer = null;
  let autoEntrancePreviewVersion = 0;
  let obstacleDraftPoints = null;
  let obstacleDraftHover = null;
  let obstacleDraftSnapStart = false;
  let roadDraftPoints = null;
  let roadDraftHover = null;
  let roadDraftSnapStart = false;
  let roadDraftClosed = true;
  let obstacleNormalizeError = null;
  let hoverTarget = null;
  let hoverRafPending = false;

  function notifyObstacleGeometryInvalid(reason) {
    const status = document.getElementById("result-status");
    if (!status) return;
    if (reason === "overlap") {
      status.textContent = "花坛不能与其他花坛重叠，请调整位置或形状。";
      return;
    }
    if (reason === "overlap_element") {
      status.textContent = "花坛不能与楼、车位或入口重叠，请调整位置或形状。";
      return;
    }
    if (reason === "overlap_road") {
      status.textContent = "花坛不能与道路重叠，请调整位置或形状。";
      return;
    }
    if (reason === "self_intersect") {
      status.textContent = "花坛多边形不能自交，请调整顶点位置。";
      return;
    }
    status.textContent = "花坛多边形无效：至少需要 3 个不共线顶点。";
  }

  function notifyRoadGeometryInvalid(reason) {
    const status = document.getElementById("result-status");
    if (!status) return;
    if (reason === "overlap_obstacle") {
      status.textContent = "道路不能与花坛重叠，请调整道路。";
      return;
    }
    if (reason === "overlap_building") {
      status.textContent = "道路不能与居民楼重叠，请调整道路。";
      return;
    }
    status.textContent = "道路几何无效，请调整道路。";
  }

  function obstacleBoundsFromPoints(points) {
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const p of points || []) {
      const x = Number(p?.[0]);
      const y = Number(p?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (x < xmin) xmin = x;
      if (x > xmax) xmax = x;
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    if (!Number.isFinite(xmin) || !Number.isFinite(xmax) || !Number.isFinite(ymin) || !Number.isFinite(ymax)) {
      return null;
    }
    return { xmin, xmax, ymin, ymax };
  }

  function polygonSignedArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      s += Number(a[0]) * Number(b[1]) - Number(b[0]) * Number(a[1]);
    }
    return s / 2;
  }

  function pointsNear(a, b, eps = 1e-6) {
    return Math.hypot(Number(a?.[0]) - Number(b?.[0]), Number(a?.[1]) - Number(b?.[1])) <= eps;
  }

  function normalizeAngle(theta) {
    const t = Number(theta);
    if (!Number.isFinite(t)) return 0;
    let out = t;
    while (out <= -Math.PI) out += Math.PI * 2;
    while (out > Math.PI) out -= Math.PI * 2;
    return out;
  }

  function normalizeSlotEntry(rawSlot) {
    const x = Number(rawSlot?.[0]);
    const y = Number(rawSlot?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y, normalizeAngle(rawSlot?.[2] ?? 0)];
  }

  function slotPoseOf(slotLike) {
    const s = normalizeSlotEntry(slotLike);
    if (!s) return null;
    return { x: s[0], y: s[1], theta: s[2] };
  }

  function setRoadClosed(closed) {
    if (!scenario?.road) return;
    const pts = Array.isArray(scenario.road.centerline) ? scenario.road.centerline : [];
    if (pts.length < 2) {
      scenario.road.closed = closed;
      return;
    }
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (closed) {
      if (!pointsNear(first, last)) pts.push([Number(first[0]), Number(first[1])]);
    } else if (pointsNear(first, last) && pts.length > 2) {
      pts.pop();
    }
    scenario.road.closed = closed;
  }

  function syncClosedRoadEndpoint(points, editedIndex) {
    if (!Array.isArray(points) || points.length < 2) return;
    const lastIdx = points.length - 1;
    if (editedIndex === 0) {
      points[lastIdx] = [Number(points[0][0]), Number(points[0][1])];
      return;
    }
    if (editedIndex === lastIdx) {
      points[0] = [Number(points[lastIdx][0]), Number(points[lastIdx][1])];
    }
  }

  function normalizeObstacleShape(raw) {
    if (!raw || typeof raw !== "object") return null;
    let pts = [];
    if (Array.isArray(raw.points) && raw.points.length) {
      pts = raw.points.map((p) => [Number(p?.[0]), Number(p?.[1])]);
    } else if (
      Number.isFinite(Number(raw.x_min)) &&
      Number.isFinite(Number(raw.x_max)) &&
      Number.isFinite(Number(raw.y_min)) &&
      Number.isFinite(Number(raw.y_max))
    ) {
      const x0 = Math.min(Number(raw.x_min), Number(raw.x_max));
      const x1 = Math.max(Number(raw.x_min), Number(raw.x_max));
      const y0 = Math.min(Number(raw.y_min), Number(raw.y_max));
      const y1 = Math.max(Number(raw.y_min), Number(raw.y_max));
      pts = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ];
    }
    const filtered = [];
    for (const p of pts) {
      const x = Number(p?.[0]);
      const y = Number(p?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!filtered.length) {
        filtered.push([x, y]);
        continue;
      }
      const q = filtered[filtered.length - 1];
      if (Math.hypot(x - q[0], y - q[1]) > 1e-4) filtered.push([x, y]);
    }
    if (filtered.length >= 2) {
      const f0 = filtered[0];
      const fn = filtered[filtered.length - 1];
      if (Math.hypot(f0[0] - fn[0], f0[1] - fn[1]) < 1e-4) filtered.pop();
    }
    if (filtered.length < 3) return null;
    if (polygonHasSelfIntersection(filtered)) return null;
    const area = Math.abs(polygonSignedArea(filtered));
    if (area < 0.05) return null;
    return { points: filtered };
  }

  function defaultObstacleShape() {
    return normalizeObstacleShape({ x_min: 44, x_max: 56, y_min: 30, y_max: 70 });
  }

  function ensureScenarioCollections() {
    if (!scenario) return;
    if (!Array.isArray(scenario.entrances) || !scenario.entrances.length) {
      scenario.entrances = [Array.isArray(scenario.entrance) ? scenario.entrance.slice(0, 2) : [22, 18]];
    }
    if (!Array.isArray(scenario.obstacles)) {
      scenario.obstacles = scenario.obstacle ? [normalizeObstacleShape(scenario.obstacle)] : [];
    }
    if (!Array.isArray(scenario.slots)) {
      scenario.slots = [];
    }
    scenario.entrances = scenario.entrances.map((e) => [Number(e?.[0] || 0), Number(e?.[1] || 0)]);
    scenario.obstacles = scenario.obstacles
      .map((o) => normalizeObstacleShape(o))
      .filter((o) => !!o);
    scenario.slots = scenario.slots
      .map((s) => normalizeSlotEntry(s))
      .filter((s) => !!s);
    scenario.entrance = scenario.entrances[0];
    if (scenario.obstacles.length) {
      const b = obstacleBoundsFromPoints(scenario.obstacles[0].points);
      scenario.obstacle = b ? { x_min: b.xmin, x_max: b.xmax, y_min: b.ymin, y_max: b.ymax } : null;
    } else {
      scenario.obstacle = null;
    }
    ensureRoadStructure();
  }

  function ensureVehicleEntrancesArray() {
    if (!scenario) return;
    ensureScenarioCollections();
    const n = Math.max(1, parseInt(scenario.n_veh, 10) || 1);
    const ne = Math.max(1, scenario.entrances.length);
    if (!Array.isArray(scenario.vehicle_entrances)) {
      scenario.vehicle_entrances = Array.from({ length: n }, () => 0);
    }
    while (scenario.vehicle_entrances.length < n) scenario.vehicle_entrances.push(0);
    if (scenario.vehicle_entrances.length > n) scenario.vehicle_entrances.length = n;
    scenario.vehicle_entrances = scenario.vehicle_entrances.map((v) => {
      const iv = parseInt(v, 10);
      return Number.isFinite(iv) ? Math.max(0, Math.min(ne - 1, iv)) : 0;
    });
    scenario.entrance_mode =
      String(scenario.entrance_mode || "auto").toLowerCase() === "fixed" ? "fixed" : "auto";
  }

  function obstacleRects() {
    ensureScenarioCollections();
    return scenario.obstacles
      .map((o) => obstacleBoundsFromPoints(o.points))
      .filter((b) => !!b)
      .map((b) => ({
        xmin: b.xmin,
        ymin: b.ymin,
        w: b.xmax - b.xmin,
        h: b.ymax - b.ymin,
      }));
  }

  function lotW() {
    return scenario?.lot?.width ?? 100;
  }
  function lotH() {
    return scenario?.lot?.height ?? 100;
  }

  function translateScene(dx, dy) {
    if (!scenario) return;
    if (Array.isArray(scenario.entrances)) {
      scenario.entrances = scenario.entrances.map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]);
      scenario.entrance = scenario.entrances[0];
    }
    if (Array.isArray(scenario.buildings)) {
      scenario.buildings = scenario.buildings.map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]);
    }
    if (Array.isArray(scenario.slots)) {
      scenario.slots = scenario.slots
        .map((s) => normalizeSlotEntry(s))
        .filter((s) => !!s)
        .map((p) => [Number(p[0]) + dx, Number(p[1]) + dy, Number(p[2])]);
    }
    if (Array.isArray(scenario.obstacles)) {
      scenario.obstacles = scenario.obstacles.map((o) => ({
        ...o,
        points: (o.points || []).map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]),
      }));
    }
    if (scenario.road?.centerline) {
      scenario.road.centerline = scenario.road.centerline.map((p) => [Number(p[0]) + dx, Number(p[1]) + dy]);
    }
    if (scenario.inner) {
      scenario.inner = {
        x_min: Number(scenario.inner.x_min) + dx,
        x_max: Number(scenario.inner.x_max) + dx,
        y_min: Number(scenario.inner.y_min) + dy,
        y_max: Number(scenario.inner.y_max) + dy,
      };
    }
  }

  function fitLotToMapAspect() {
    if (!scenario?.lot) return false;
    const w = Number(scenario.lot.width);
    const h = Number(scenario.lot.height);
    if (!(w > 0 && h > 0)) return false;
    const targetRatio = Math.max(0.2, mapCssW / Math.max(1, mapCssH));
    const curRatio = w / h;
    if (Math.abs(curRatio - targetRatio) < 1e-6) return false;
    if (curRatio < targetRatio) {
      const newW = Math.round(h * targetRatio * 10) / 10;
      const dx = (newW - w) / 2;
      translateScene(dx, 0);
      scenario.lot.width = newW;
    } else {
      const newH = Math.round((w / targetRatio) * 10) / 10;
      const dy = (newH - h) / 2;
      translateScene(0, dy);
      scenario.lot.height = newH;
    }
    return true;
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

  function clampBuildingCenter(x, y) {
    const halfW = B.bw / 2;
    const halfH = B.bh / 2;
    return {
      wx: Math.max(halfW, Math.min(lotW() - halfW, x)),
      wy: Math.max(halfH, Math.min(lotH() - halfH, y)),
    };
  }

  function uLen() {
    return scenario?.display?.length_unit ?? "m";
  }
  function uTime() {
    return scenario?.display?.time_unit ?? "s";
  }
  function metersPerUnit() {
    const v = Number(scenario?.display?.meters_per_unit);
    return v > 0 ? v : 2;
  }
  function scaleBarWorldM() {
    const v = Number(scenario?.display?.scale_bar_m);
    const meters = v > 0 ? v : 20;
    return meters / metersPerUnit();
  }

  function fmtDim(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return String(v);
    const s = n.toFixed(2);
    return s.replace(/\.?0+$/, "");
  }

  function ensureDisplay() {
    if (!scenario) return;
    if (!scenario.display) scenario.display = {};
    const d = scenario.display;
    if (!d.length_unit) d.length_unit = "m";
    if (!d.time_unit) d.time_unit = "s";
    if (d.meters_per_unit == null || Number.isNaN(Number(d.meters_per_unit))) d.meters_per_unit = 2;
    if (d.scale_bar_m == null || Number.isNaN(Number(d.scale_bar_m))) d.scale_bar_m = 20;
    if (!d.coord_note) d.coord_note = "平面坐标 1 单位 = 2 m";
  }

  function ensureConstraints() {
    if (!scenario) return;
    if (!scenario.constraints) scenario.constraints = {};
    /* 无开关：始终吸附道路停车带与道路中心线（与本地优化内核 normalize 一致） */
    scenario.constraints.snap_slots_to_inner_road = true;
    scenario.constraints.snap_entrance_to_inner = true;
    ensureDisplay();
  }

  function ensureVehicleDestinationsArray() {
    if (!scenario) return;
    ensureScenarioCollections();
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
    ensureVehicleEntrancesArray();
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

  function ensureVehiclePageInRange(totalVehicles) {
    const total = Math.max(1, totalVehicles);
    const pageCount = Math.max(1, Math.ceil(total / VEHICLE_PAGE_SIZE));
    if (!Number.isFinite(vehiclePage) || vehiclePage < 0) vehiclePage = 0;
    if (vehiclePage >= pageCount) vehiclePage = pageCount - 1;
    return pageCount;
  }

  function updateVehiclePager(totalVehicles, pageCount) {
    const status = document.getElementById("veh-page-status");
    const btnPrev = document.getElementById("btn-veh-page-prev");
    const btnNext = document.getElementById("btn-veh-page-next");
    if (status) status.textContent = pageCount > 0 ? vehiclePage + 1 + " / " + pageCount : "1 / 1";
    if (btnPrev) btnPrev.disabled = vehiclePage <= 0;
    if (btnNext) btnNext.disabled = vehiclePage >= pageCount - 1 || totalVehicles <= VEHICLE_PAGE_SIZE;
  }

  function switchTab(tabKey) {
    activeTab = tabKey || "overview";
    if (tabUtils?.applyTabState) tabUtils.applyTabState(activeTab);
    else {
      document.querySelectorAll(".side-tab").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.tab === activeTab);
      });
      document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === activeTab);
      });
    }
    if (activeTab === "result") {
      // Result chart may be initialized while hidden; re-measure after tab is visible.
      requestAnimationFrame(() => {
        syncChartCanvasSize();
        drawChart(lastChartSeries, lastChartOptimizer);
      });
    }
    schedulePersistCurrentState();
  }

  function readCurrentState() {
    return currentStateStore?.readState ? currentStateStore.readState() : null;
  }

  function persistCurrentStateNow() {
    if (!scenario || !optimizer || typeof optimizer.normalizeScenario !== "function") return;
    const payload = {
      scenario,
      activeTab,
      vehiclePage,
      savedAt: Date.now(),
    };
    currentStateStore?.persistNow?.(payload);
  }

  function schedulePersistCurrentState() {
    currentStateStore?.schedule?.(() => ({
      scenario,
      activeTab,
      vehiclePage,
      savedAt: Date.now(),
    }));
  }

  function clearPersistedCurrentState() {
    currentStateStore?.clear?.();
  }

  function computeAutoEntrancePreview() {
    if (!scenario || !optimizer || typeof optimizer.runOptimize !== "function") return null;
    const base = JSON.parse(JSON.stringify(scenario));
    const data = normalizeOptimizeResult(optimizer.runOptimize(base, { method: "exact" }), "exact", scenario);
    if (!Array.isArray(data.veh_entrances) || !data.veh_entrances.length) return null;
    return data.veh_entrances.slice();
  }

  function scheduleAutoEntrancePreviewRefresh() {
    clearTimeout(autoEntrancePreviewTimer);
    autoEntrancePreviewVersion += 1;
    const version = autoEntrancePreviewVersion;
    autoEntrancePreview = null;
    if (!scenario || scenario.entrance_mode === "fixed") return;
    autoEntrancePreviewTimer = setTimeout(() => {
      if (version !== autoEntrancePreviewVersion) return;
      try {
        autoEntrancePreview = computeAutoEntrancePreview();
      } catch (_) {
        autoEntrancePreview = null;
      }
      if (version !== autoEntrancePreviewVersion) return;
      if (!lastResult) rebuildVehicleTargetsUI();
    }, 120);
  }

  function rebuildVehicleTargetsUI() {
    const el = document.getElementById("vehicle-targets-list");
    if (!el || !scenario) return;
    ensureVehicleDestinationsArray();
    ensureVehicleEntrancesArray();
    const n = Math.max(1, parseInt(scenario.n_veh, 10) || 1);
    const nb = scenario.buildings?.length ?? 0;
    const ne = scenario.entrances?.length ?? 1;
    const pageCount = ensureVehiclePageInRange(n);
    const start = vehiclePage * VEHICLE_PAGE_SIZE;
    const end = Math.min(n, start + VEHICLE_PAGE_SIZE);
    const modeEl = document.getElementById("entrance-mode");
    if (modeEl) modeEl.value = scenario.entrance_mode || "auto";
    el.innerHTML = "";
    for (let i = start; i < end; i++) {
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
      const elab = document.createElement("label");
      elab.textContent = "入口";
      elab.setAttribute("for", "veh-ent-" + i);
      const eSel = document.createElement("select");
      eSel.id = "veh-ent-" + i;
      for (let ei = 0; ei < ne; ei++) {
        const opt = document.createElement("option");
        opt.value = String(ei);
        opt.textContent = entranceDisplayName(ei);
        eSel.appendChild(opt);
      }
      const autoEntrances = Array.isArray(lastResult?.veh_entrances)
        ? lastResult.veh_entrances
        : Array.isArray(autoEntrancePreview)
        ? autoEntrancePreview
        : null;
      const autoResolved = autoEntrances && Number.isFinite(autoEntrances[i]) ? autoEntrances[i] : null;
      const displayEntranceIndex =
        scenario.entrance_mode === "fixed"
          ? scenario.vehicle_entrances[i] ?? 0
          : autoResolved != null
          ? autoResolved
          : scenario.vehicle_entrances[i] ?? 0;
      eSel.value = String(Math.max(0, Math.min(ne - 1, Number(displayEntranceIndex) || 0)));
      eSel.disabled = scenario.entrance_mode !== "fixed";
      if (scenario.entrance_mode !== "fixed") {
        eSel.title =
          autoResolved != null
            ? Array.isArray(lastResult?.veh_entrances)
              ? "自动策略当前结果：入口 " + (autoResolved + 1)
              : "自动策略即时预估：入口 " + (autoResolved + 1)
            : "自动策略：入口变化后将自动刷新预估";
      }
      eSel.addEventListener("change", () => {
        const v = parseInt(eSel.value, 10);
        scenario.vehicle_entrances[i] = Number.isFinite(v) ? v : 0;
        invalidateOptimizationResult();
      });
      row.appendChild(elab);
      row.appendChild(eSel);
      el.appendChild(row);
    }
    updateVehiclePager(n, pageCount);
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
    scheduleAutoEntrancePreviewRefresh();
    renderBreakdownSummary();
    renderResultTip("");
    draw();
  }

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const q = geometry?.closestPointOnSegment
      ? geometry.closestPointOnSegment(px, py, x1, y1, x2, y2)
      : [x1, y1];
    return { qx: q[0], qy: q[1] };
  }

  function buildRoadFromInner(inner, width = DEFAULT_ROAD_WIDTH) {
    return {
      centerline: [
        [Number(inner.x_min), Number(inner.y_min)],
        [Number(inner.x_max), Number(inner.y_min)],
        [Number(inner.x_max), Number(inner.y_max)],
        [Number(inner.x_min), Number(inner.y_max)],
        [Number(inner.x_min), Number(inner.y_min)],
      ],
      width: Number(width) || DEFAULT_ROAD_WIDTH,
      closed: true,
    };
  }

  function roadInnerBounds(road) {
    const pts = road?.centerline || [];
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const p of pts) {
      const x = Number(p?.[0]);
      const y = Number(p?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    if (![xmin, xmax, ymin, ymax].every((v) => Number.isFinite(v))) return null;
    return { x_min: xmin, x_max: xmax, y_min: ymin, y_max: ymax };
  }

  function normalizeRoadShape(rawRoad, fallbackInner) {
    let road = rawRoad && typeof rawRoad === "object" ? JSON.parse(JSON.stringify(rawRoad)) : null;
    if (!road || !Array.isArray(road.centerline) || road.centerline.length < 2) {
      road = buildRoadFromInner(fallbackInner || scenario?.inner || { x_min: 22, x_max: 78, y_min: 18, y_max: 82 });
    }
    const pts = [];
    for (const p of road.centerline || []) {
      const x = Number(p?.[0]);
      const y = Number(p?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!pts.length || Math.hypot(pts[pts.length - 1][0] - x, pts[pts.length - 1][1] - y) > 1e-6) {
        pts.push([x, y]);
      }
    }
    if (pts.length < 2) return null;
    if (road.closed !== false) {
      if (pts.length < 3) return null;
      const first = pts[0];
      const last = pts[pts.length - 1];
      if (!pointsNear(first, last, 1e-6)) {
        pts.push([Number(first[0]), Number(first[1])]);
      } else {
        pts[pts.length - 1] = [Number(first[0]), Number(first[1])];
      }
    } else if (pts.length > 2 && pointsNear(pts[0], pts[pts.length - 1], 1e-6)) {
      pts.pop();
    }
    const segs = (geometry?.toRoadSegmentsFromCenterline
      ? geometry.toRoadSegmentsFromCenterline(pts)
      : []);
    if (!segs.length) return null;
    return {
      centerline: pts,
      width: Math.max(2.4, Number(road.width || DEFAULT_ROAD_WIDTH)),
      closed: road.closed !== false,
    };
  }

  function ensureRoadStructure() {
    if (!scenario) return;
    const normalized = normalizeRoadShape(scenario.road, scenario.inner);
    if (normalized) scenario.road = normalized;
    else scenario.road = buildRoadFromInner(scenario.inner || { x_min: 22, x_max: 78, y_min: 18, y_max: 82 });
    const bounds = roadInnerBounds(scenario.road);
    if (bounds) scenario.inner = bounds;
  }

  /** 可行驶道路中心线段 [x1,y1,x2,y2] */
  function innerBoundarySegments(roadLike) {
    const source = roadLike?.centerline ? { road: roadLike } : { road: scenario?.road, inner: roadLike || scenario?.inner };
    const segs = geometry?.buildRoadSegments ? geometry.buildRoadSegments(source) : [];
    return segs.map((seg) => [seg[0][0], seg[0][1], seg[1][0], seg[1][1]]);
  }

  function snapEntranceToInner(x, y) {
    ensureRoadStructure();
    const proj = geometry?.projectPointToRoad
      ? geometry.projectPointToRoad(x, y, { road: scenario.road })
      : null;
    return clampWorld(proj?.point?.[0] ?? x, proj?.point?.[1] ?? y);
  }

  function snapSlotToRoad(x, y) {
    const strips = getParkingStripDefs();
    if (!strips.length) {
      const p = clampWorld(x, y);
      return { wx: p.wx, wy: p.wy, theta: 0 };
    }
    let bestX = x;
    let bestY = y;
    let bestTheta = 0;
    let bestD = 1e30;
    for (const s of strips) {
      const q = closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      const d = (x - q.qx) ** 2 + (y - q.qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = q.qx;
        bestY = q.qy;
        bestTheta = s.theta;
      }
    }
    const p = clampWorld(bestX, bestY);
    return { wx: p.wx, wy: p.wy, theta: bestTheta };
  }

  function getParkingStripDefs() {
    ensureRoadStructure();
    const margin = SNAP_MARGIN;
    const strips = [];
    const segs = geometry?.buildRoadSegments ? geometry.buildRoadSegments({ road: scenario.road }) : [];
    const roadWidth = Math.max(2.4, Number(scenario.road?.width || DEFAULT_ROAD_WIDTH));
    const offset = roadWidth / 2 + B.sh / 2 + margin;
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const nx = -dy / len;
      const ny = dx / len;
      for (const side of [1, -1]) {
        const x1 = a[0] + nx * offset * side;
        const y1 = a[1] + ny * offset * side;
        const x2 = b[0] + nx * offset * side;
        const y2 = b[1] + ny * offset * side;
        strips.push({
          id: "road-" + i + "-" + (side > 0 ? "l" : "r"),
          segIndex: i,
          side,
          x1: Math.max(B.sw / 2 + 0.05, Math.min(lotW() - B.sw / 2 - 0.05, x1)),
          y1: Math.max(B.sw / 2 + 0.05, Math.min(lotH() - B.sw / 2 - 0.05, y1)),
          x2: Math.max(B.sw / 2 + 0.05, Math.min(lotW() - B.sw / 2 - 0.05, x2)),
          y2: Math.max(B.sw / 2 + 0.05, Math.min(lotH() - B.sw / 2 - 0.05, y2)),
          tx: dx / len,
          ty: dy / len,
          theta: Math.atan2(dy, dx),
          len: Math.hypot(x2 - x1, y2 - y1),
        });
      }
    }
    return strips;
  }

  function rectsOverlap(a, b, pad = 0) {
    return !(
      a.xmin + a.w + pad <= b.xmin ||
      b.xmin + b.w + pad <= a.xmin ||
      a.ymin + a.h + pad <= b.ymin ||
      b.ymin + b.h + pad <= a.ymin
    );
  }

  function pointInsideRect(px, py, r, pad = 0) {
    return (
      px >= r.xmin - pad &&
      px <= r.xmin + r.w + pad &&
      py >= r.ymin - pad &&
      py <= r.ymin + r.h + pad
    );
  }

  function obstaclePolygons() {
    ensureScenarioCollections();
    return scenario.obstacles.map((o) => o.points);
  }

  function pointOnSegment2D(px, py, ax, ay, bx, by, eps = 1e-6) {
    return geometry?.pointOnSegment
      ? geometry.pointOnSegment([px, py], [ax, ay], [bx, by], eps)
      : false;
  }

  function segmentsIntersect2D(a, b, c, d, eps = 1e-6) {
    return geometry?.segmentsIntersect ? geometry.segmentsIntersect(a, b, c, d, eps) : false;
  }

  function polygonHasSelfIntersection(poly) {
    return geometry?.polygonSelfIntersects ? geometry.polygonSelfIntersects(poly) : false;
  }

  function polygonsOverlap(polyA, polyB) {
    if (!Array.isArray(polyA) || !Array.isArray(polyB) || polyA.length < 3 || polyB.length < 3) return false;
    for (let i = 0; i < polyA.length; i++) {
      const a1 = polyA[i];
      const a2 = polyA[(i + 1) % polyA.length];
      for (let j = 0; j < polyB.length; j++) {
        const b1 = polyB[j];
        const b2 = polyB[(j + 1) % polyB.length];
        if (segmentsIntersect2D(a1, a2, b1, b2)) return true;
      }
    }
    if (pointInPolygon(polyA[0][0], polyA[0][1], polyB, true)) return true;
    if (pointInPolygon(polyB[0][0], polyB[0][1], polyA, true)) return true;
    return false;
  }

  function polygonOverlapsSceneElements(poly) {
    if (!Array.isArray(poly) || poly.length < 3 || !scenario) return false;
    for (let i = 0; i < (scenario.buildings || []).length; i++) {
      const b = scenario.buildings[i];
      if (rectIntersectsPolygon(buildingRectAt(Number(b[0]), Number(b[1])), poly)) return true;
    }
    for (let i = 0; i < (scenario.slots || []).length; i++) {
      const pose = slotPoseOf(scenario.slots[i]);
      if (!pose) continue;
      if (polygonsOverlap(slotPolygonAt(pose.x, pose.y, pose.theta), poly)) return true;
    }
    for (let i = 0; i < (scenario.entrances || []).length; i++) {
      const e = scenario.entrances[i];
      if (pointInPolygon(Number(e[0]), Number(e[1]), poly, true)) return true;
    }
    return false;
  }

  function pointInPolygon(px, py, poly, includeBoundary = true) {
    return geometry?.pointInPolygon
      ? geometry.pointInPolygon([px, py], poly, includeBoundary)
      : false;
  }

  function segmentIntersectsPolygon(a, b, poly) {
    return geometry?.segmentIntersectsPolygon ? geometry.segmentIntersectsPolygon(a, b, poly) : false;
  }

  function rectIntersectsPolygon(r, poly) {
    const corners = [
      [r.xmin, r.ymin],
      [r.xmin + r.w, r.ymin],
      [r.xmin + r.w, r.ymin + r.h],
      [r.xmin, r.ymin + r.h],
    ];
    for (const [x, y] of corners) {
      if (pointInPolygon(x, y, poly, true)) return true;
    }
    for (const p of poly) {
      if (pointInsideRect(Number(p[0]), Number(p[1]), r, 0)) return true;
    }
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      if (segmentIntersectsPolygon(a, b, poly)) return true;
    }
    return false;
  }

  function rectToPolygon(r) {
    return [
      [r.xmin, r.ymin],
      [r.xmin + r.w, r.ymin],
      [r.xmin + r.w, r.ymin + r.h],
      [r.xmin, r.ymin + r.h],
    ];
  }

  function polygonOverlapsInnerRoad(poly, clearance = 1.05) {
    if (!Array.isArray(poly) || poly.length < 3 || !scenario) return false;
    const segs = innerBoundarySegments(scenario.road || scenario.inner);
    const effClearance = Math.max(clearance, Number(scenario?.road?.width || DEFAULT_ROAD_WIDTH) / 2);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      for (let s = 0; s < segs.length; s++) {
        const [x1, y1, x2, y2] = segs[s];
        if (distPointToSeg(Number(p[0]), Number(p[1]), x1, y1, x2, y2) <= effClearance) return true;
      }
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      for (let s = 0; s < segs.length; s++) {
        const [x1, y1, x2, y2] = segs[s];
        if (segmentsIntersect2D(a, b, [x1, y1], [x2, y2])) return true;
      }
    }
    for (let s = 0; s < segs.length; s++) {
      const [x1, y1, x2, y2] = segs[s];
      if (pointInPolygon((x1 + x2) / 2, (y1 + y2) / 2, poly, true)) return true;
    }
    return false;
  }

  function validateRoadNoOverlap() {
    if (!scenario) return { ok: true };
    for (const poly of obstaclePolygons()) {
      if (polygonOverlapsInnerRoad(poly)) return { ok: false, reason: "overlap_obstacle" };
    }
    for (let i = 0; i < (scenario.buildings || []).length; i++) {
      const b = scenario.buildings[i];
      if (polygonOverlapsInnerRoad(rectToPolygon(buildingRectAt(Number(b[0]), Number(b[1]))))) {
        return { ok: false, reason: "overlap_building" };
      }
    }
    return { ok: true };
  }

  function buildingRectAt(cx, cy) {
    return { xmin: cx - B.bw / 2, ymin: cy - B.bh / 2, w: B.bw, h: B.bh };
  }

  // Slide element from (cx0,cy0) toward (cx1,cy1), hugging obstacles on each axis independently.
  function slideToward(cx0, cy0, cx1, cy1, canFn) {
    if (canFn(cx1, cy1)) return { wx: cx1, wy: cy1 };
    // Binary-search farthest valid point along one axis, the other axis fixed.
    function slide1D(start, end, fixX, fixY, moveX) {
      if (Math.abs(end - start) < 1e-6) return start;
      let lo = 0, hi = 1;
      for (let i = 0; i < 8; i++) {
        const mid = (lo + hi) / 2;
        const v = start + (end - start) * mid;
        if (canFn(moveX ? v : fixX, moveX ? fixY : v)) lo = mid; else hi = mid;
      }
      return start + (end - start) * lo;
    }
    // Try X then Y
    const x1 = slide1D(cx0, cx1, null, cy0, true);
    const y1 = slide1D(cy0, cy1, x1, null, false);
    // Try Y then X
    const y2 = slide1D(cy0, cy1, cx0, null, false);
    const x2 = slide1D(cx0, cx1, null, y2, true);
    // Pick whichever result is closest to target
    const d1 = (x1 - cx1) ** 2 + (y1 - cy1) ** 2;
    const d2 = (x2 - cx1) ** 2 + (y2 - cy1) ** 2;
    return d1 <= d2 ? { wx: x1, wy: y1 } : { wx: x2, wy: y2 };
  }

  // Pure read-only check: can the obstacle at obstacleIndex be placed at newPoints?
  // Mirrors normalizeObstacleInner() checks without mutating scenario state.
  function canPlaceObstacleAt(obstacleIndex, newPoints) {
    const shape = normalizeObstacleShape({ points: newPoints });
    if (!shape) return false;
    const poly = shape.points;
    for (let i = 0; i < (scenario.obstacles || []).length; i++) {
      if (i === obstacleIndex) continue;
      if (polygonsOverlap(poly, scenario.obstacles[i].points)) return false;
    }
    if (polygonOverlapsInnerRoad(poly)) return false;
    if (polygonOverlapsSceneElements(poly)) return false;
    return true;
  }

  function canPlaceBuilding(cx, cy, ignoreIndex = -1) {
    const r = buildingRectAt(cx, cy);
    const rPoly = rectToPolygon(r);
    if (polygonOverlapsInnerRoad(rectToPolygon(r))) return false;
    for (const poly of obstaclePolygons()) {
      if (rectIntersectsPolygon(r, poly)) return false;
    }
    for (let i = 0; i < scenario.buildings.length; i++) {
      if (i === ignoreIndex) continue;
      const [bx, by] = scenario.buildings[i];
      if (rectsOverlap(r, buildingRectAt(bx, by), OVERLAP_EPS)) return false;
    }
    for (let i = 0; i < scenario.slots.length; i++) {
      const pose = slotPoseOf(scenario.slots[i]);
      if (!pose) continue;
      if (polygonsOverlap(rPoly, slotPolygonAt(pose.x, pose.y, pose.theta))) return false;
    }
    for (const ent of scenario.entrances) {
      if (pointInsideRect(ent[0], ent[1], r, 0.25)) return false;
    }
    return true;
  }

  function nearestStripForPoint(x, y) {
    const strips = getParkingStripDefs();
    if (!strips.length) return null;
    const segs = geometry?.buildRoadSegments ? geometry.buildRoadSegments({ road: scenario?.road }) : [];
    let segIndex = -1;
    let bestCenterD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const d = distPointToSeg(x, y, a[0], a[1], b[0], b[1]);
      if (d < bestCenterD) {
        bestCenterD = d;
        segIndex = i;
      }
    }
    if (segIndex >= 0) {
      const sideCandidates = strips.filter((s) => s.segIndex === segIndex);
      if (sideCandidates.length >= 2) {
        const [a, b] = segs[segIndex];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) {
          const nx = -dy / len;
          const ny = dx / len;
          const sideSign = (x - a[0]) * nx + (y - a[1]) * ny >= 0 ? 1 : -1;
          const signed = sideCandidates.find((s) => s.side === sideSign);
          if (signed) return signed;
        }
      } else if (sideCandidates.length === 1) {
        return sideCandidates[0];
      }
    }
    let best = null;
    let bestD = Infinity;
    for (const s of strips) {
      const d = distPointToSeg(x, y, s.x1, s.y1, s.x2, s.y2);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

  function slotScalarOnStrip(def, x, y) {
    const len = Math.max(1e-9, Number(def?.len || 0));
    const tx = Number(def?.tx || 0);
    const ty = Number(def?.ty || 0);
    return ((x - def.x1) * tx + (y - def.y1) * ty) / len;
  }

  function slotPointFromScalar(def, tNorm) {
    const t = Math.max(0, Math.min(1, tNorm));
    return {
      wx: def.x1 + (def.x2 - def.x1) * t,
      wy: def.y1 + (def.y2 - def.y1) * t,
      theta: def.theta,
    };
  }

  function stripBaseId(stripId) {
    return String(stripId || "").replace(/-(l|r)$/, "");
  }

  function getSiblingStrip(def) {
    if (!def?.id) return null;
    const strips = getParkingStripDefs();
    const base = stripBaseId(def.id);
    return strips.find((s) => s.id !== def.id && stripBaseId(s.id) === base) || null;
  }

  function canPlaceSlot(cx, cy, ignoreIndex = -1) {
    const theta = slotThetaAt(cx, cy);
    const slotPoly = slotPolygonAt(cx, cy, theta);
    if (polygonOverlapsInnerRoad(slotPoly, Number(scenario?.road?.width || DEFAULT_ROAD_WIDTH) / 2 - 0.05)) return false;
    for (const poly of obstaclePolygons()) {
      if (polygonsOverlap(slotPoly, poly)) return false;
    }
    for (let i = 0; i < scenario.buildings.length; i++) {
      const [bx, by] = scenario.buildings[i];
      if (polygonsOverlap(slotPoly, rectToPolygon(buildingRectAt(bx, by)))) return false;
    }
    for (let i = 0; i < scenario.slots.length; i++) {
      if (i === ignoreIndex) continue;
      const pose = slotPoseOf(scenario.slots[i]);
      if (!pose) continue;
      if (polygonsOverlap(slotPoly, slotPolygonAt(pose.x, pose.y, pose.theta))) return false;
    }
    for (const ent of scenario.entrances) {
      if (pointInPolygon(Number(ent[0]), Number(ent[1]), slotPoly, true)) return false;
    }
    return true;
  }

  function canPlaceEntrance(wx, wy) {
    for (const poly of obstaclePolygons()) {
      if (pointInPolygon(wx, wy, poly, true)) return false;
    }
    for (let i = 0; i < scenario.buildings.length; i++) {
      const [bx, by] = scenario.buildings[i];
      if (pointInsideRect(wx, wy, buildingRectAt(bx, by), 0.12)) return false;
    }
    for (let i = 0; i < scenario.slots.length; i++) {
      const pose = slotPoseOf(scenario.slots[i]);
      if (!pose) continue;
      if (pointInPolygon(wx, wy, slotPolygonAt(pose.x, pose.y, pose.theta), true)) return false;
    }
    return true;
  }

  function suggestUniformSlotPosition(x, y, ignoreIndex = -1) {
    const snapped = snapSlotToRoad(x, y);
    const primaryLane = nearestStripForPoint(snapped.wx, snapped.wy);
    if (!primaryLane) return canPlaceSlot(snapped.wx, snapped.wy, ignoreIndex) ? snapped : null;
    const siblingLane = getSiblingStrip(primaryLane);
    const laneCandidates = [primaryLane];
    if (siblingLane) {
      const dPrimary = distPointToSeg(
        snapped.wx,
        snapped.wy,
        primaryLane.x1,
        primaryLane.y1,
        primaryLane.x2,
        primaryLane.y2
      );
      const dSibling = distPointToSeg(
        snapped.wx,
        snapped.wy,
        siblingLane.x1,
        siblingLane.y1,
        siblingLane.x2,
        siblingLane.y2
      );
      if (dSibling < dPrimary) {
        laneCandidates.unshift(siblingLane);
      } else {
        laneCandidates.push(siblingLane);
      }
    }

    for (const lane of laneCandidates) {
      const endInset = (B.sw / 2 + 0.08) / Math.max(1e-9, lane.len);
      const laneStart = endInset;
      const laneEnd = 1 - endInset;
      if (laneEnd <= laneStart + 1e-5) continue;
      const desired = Math.max(
        laneStart,
        Math.min(laneEnd, slotScalarOnStrip(lane, snapped.wx, snapped.wy))
      );
      const occupied = [];
      for (let i = 0; i < scenario.slots.length; i++) {
        if (i === ignoreIndex) continue;
        const [sx, sy] = scenario.slots[i];
        const sideLane = nearestStripForPoint(sx, sy);
        if (!sideLane || sideLane.id !== lane.id) continue;
        occupied.push(slotScalarOnStrip(lane, sx, sy));
      }
      occupied.sort((a, b) => a - b);
      const candidates = new Set([desired, laneStart, laneEnd]);
      const anchors = [laneStart, ...occupied, laneEnd];
      for (let i = 0; i < anchors.length - 1; i++) {
        candidates.add((anchors[i] + anchors[i + 1]) / 2);
      }
      const sortedCandidates = [...candidates].sort(
        (a, b) => Math.abs(a - desired) - Math.abs(b - desired)
      );
      for (const t0 of sortedCandidates) {
        const t = Math.max(laneStart, Math.min(laneEnd, t0));
        const p = slotPointFromScalar(lane, t);
        if (canPlaceSlot(p.wx, p.wy, ignoreIndex)) return p;
      }
    }
    return null;
  }

  function applySnapToSlot(i) {
    const p = suggestUniformSlotPosition(scenario.slots[i][0], scenario.slots[i][1], i);
    if (!p) return false;
    scenario.slots[i][0] = p.wx;
    scenario.slots[i][1] = p.wy;
    scenario.slots[i][2] = normalizeAngle(p.theta ?? scenario.slots[i][2] ?? 0);
    return true;
  }

  function applySnapToAllSlots() {
    if (!scenario?.slots?.length) return;
    scenario.slots.forEach((_, i) => applySnapToSlot(i));
  }

  function parkingStripSegments() {
    return getParkingStripDefs().map((s) => [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ]);
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
    for (const [x1, y1, x2, y2] of innerBoundarySegments(scenario.road || scenario.inner)) {
      const d = distPointToSeg(wx, wy, x1, y1, x2, y2);
      if (d < best) best = d;
    }
    const roadHalf = Math.max(1.2, Number(scenario?.road?.width || DEFAULT_ROAD_WIDTH) / 2);
    return best <= roadHalf + 0.4;
  }

  function pickAt(wx, wy) {
    for (let i = scenario.entrances.length - 1; i >= 0; i--) {
      const ent = scenario.entrances[i];
      if (Math.hypot(wx - ent[0], wy - ent[1]) < 1.2) return { kind: "entrance", index: i };
    }

    for (let i = scenario.buildings.length - 1; i >= 0; i--) {
      const [bx, by] = scenario.buildings[i];
      if (
        Math.abs(wx - bx) <= B.bw / 2 + HIT_PAD &&
        Math.abs(wy - by) <= B.bh / 2 + HIT_PAD
      )
        return { kind: "building", index: i };
    }
    for (let i = scenario.slots.length - 1; i >= 0; i--) {
      const pose = slotPoseOf(scenario.slots[i]);
      if (!pose) continue;
      const foot = slotFootprint(pose.x, pose.y, pose.theta);
      if (pointInPolygon(wx, wy, foot.poly, true)) return { kind: "slot", index: i };
    }

    for (let i = scenario.obstacles.length - 1; i >= 0; i--) {
      if (pointInPolygon(wx, wy, scenario.obstacles[i].points, true)) return { kind: "obstacle", index: i };
    }

    if (hitInnerRoad(wx, wy)) return { kind: "road" };

    return null;
  }

  function pickObstacleVertex(wx, wy, obstacleIndex, maxPx = 14) {
    const o = scenario?.obstacles?.[obstacleIndex];
    if (!o?.points?.length) return null;
    const m = worldToScreen(wx, wy);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < o.points.length; i++) {
      const p = o.points[i];
      const sp = worldToScreen(Number(p[0]), Number(p[1]));
      const d = Math.hypot(m.sx - sp.sx, m.sy - sp.sy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 || bestD > maxPx) return null;
    return best;
  }

  function pickAnyObstacleVertex(wx, wy, maxPx = 16) {
    if (!scenario?.obstacles?.length) return null;
    let best = null;
    let bestD = Infinity;
    const m = worldToScreen(wx, wy);
    for (let oi = 0; oi < scenario.obstacles.length; oi++) {
      const o = scenario.obstacles[oi];
      if (!o?.points?.length) continue;
      for (let vi = 0; vi < o.points.length; vi++) {
        const p = o.points[vi];
        const sp = worldToScreen(Number(p[0]), Number(p[1]));
        const d = Math.hypot(m.sx - sp.sx, m.sy - sp.sy);
        if (d < bestD) {
          bestD = d;
          best = { obstacleIndex: oi, vertexIndex: vi };
        }
      }
    }
    if (!best || bestD > maxPx) return null;
    return best;
  }

  function pickRoadVertex(wx, wy, maxPx = 16) {
    const pts = scenario?.road?.centerline;
    if (!Array.isArray(pts) || !pts.length) return null;
    const m = worldToScreen(wx, wy);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = worldToScreen(Number(pts[i][0]), Number(pts[i][1]));
      const d = Math.hypot(m.sx - p.sx, m.sy - p.sy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 || bestD > maxPx) return null;
    return best;
  }

  function drawRoadSegments(segs) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const scale = padScale().scale;
    const lw = Math.max(8, scale * Math.max(2.4, Number(scenario?.road?.width || DEFAULT_ROAD_WIDTH)));
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

  function nearestRoadTangentAngle(cx, cy) {
    const segs = geometry?.buildRoadSegments ? geometry.buildRoadSegments({ road: scenario?.road }) : [];
    let best = null;
    let bestD = Infinity;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const d = distPointToSeg(cx, cy, a[0], a[1], b[0], b[1]);
      if (d < bestD) {
        bestD = d;
        best = Math.atan2(dy, dx);
      }
    }
    return normalizeAngle(best ?? 0);
  }

  function slotThetaAt(cx, cy, fallbackTheta = 0) {
    const strips = getParkingStripDefs();
    if (strips.length) {
      const lane = nearestStripForPoint(cx, cy);
      if (lane) return normalizeAngle(lane.theta);
    }
    return normalizeAngle(fallbackTheta ?? nearestRoadTangentAngle(cx, cy));
  }

  function slotPolygonAt(cx, cy, theta) {
    const t = normalizeAngle(theta);
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const halfL = B.sw / 2;
    const halfW = B.sh / 2;
    const local = [
      [-halfL, -halfW],
      [halfL, -halfW],
      [halfL, halfW],
      [-halfL, halfW],
    ];
    return local.map(([lx, ly]) => [
      cx + lx * ct - ly * st,
      cy + lx * st + ly * ct,
    ]);
  }

  function slotFootprint(cx, cy, theta) {
    const poly = slotPolygonAt(cx, cy, slotThetaAt(cx, cy, theta));
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const p of poly) {
      xmin = Math.min(xmin, p[0]);
      xmax = Math.max(xmax, p[0]);
      ymin = Math.min(ymin, p[1]);
      ymax = Math.max(ymax, p[1]);
    }
    return { xmin, ymin, w: xmax - xmin, h: ymax - ymin, theta: slotThetaAt(cx, cy, theta), poly };
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
      const pose = slotPoseOf(scenario.slots[si]);
      if (!pose) continue;
      const wx = pose.x;
      const wy = pose.y;
      const b1 = (targets[vi] ?? 0) + 1;
      drawStackedWorldLabels(wx, wy, ["车" + (vi + 1), "→楼" + b1]);
    }
  }

  /** 俯视标准泊位：沥青块 + 四边白线（完整边框） */
  function drawParkingSlotWorld(cx, cy, theta) {
    const angle = slotThetaAt(cx, cy, theta);
    const poly = slotPolygonAt(cx, cy, angle).map((p) => worldToScreen(p[0], p[1]));
    ctx.fillStyle = COLORS.slotAsphalt;
    ctx.beginPath();
    ctx.moveTo(poly[0].sx, poly[0].sy);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].sx, poly[i].sy);
    ctx.closePath();
    ctx.fill();
    const scale = padScale().scale;
    ctx.strokeStyle = COLORS.slotPaint;
    ctx.lineWidth = Math.max(2.2, scale * 0.075);
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
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

  function fillObstaclePolygon(points) {
    if (!Array.isArray(points) || points.length < 3) return;
    const poly = points.map((p) => worldToScreen(Number(p[0]), Number(p[1])));
    let xmin = Infinity;
    let ymin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;
    for (const p of poly) {
      if (p.sx < xmin) xmin = p.sx;
      if (p.sx > xmax) xmax = p.sx;
      if (p.sy < ymin) ymin = p.sy;
      if (p.sy > ymax) ymax = p.sy;
    }
    const g = ctx.createLinearGradient(xmin, ymin, xmax, ymax);
    g.addColorStop(0, COLORS.grassA);
    g.addColorStop(0.5, COLORS.grassB);
    g.addColorStop(1, COLORS.grassC);
    ctx.beginPath();
    ctx.moveTo(poly[0].sx, poly[0].sy);
    for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].sx, poly[i].sy);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = COLORS.grassEdge;
    ctx.lineWidth = Math.max(1, padScale().scale * 0.06);
    ctx.stroke();
  }

  function drawRoadAndParkingStrips(scale) {
    ensureRoadStructure();
    const roadSegs = lastResult?.road_segments || buildRoadSegmentsLocal(scenario.road);
    drawRoadSegments(roadSegs);
    ctx.strokeStyle = COLORS.curb;
    ctx.lineWidth = Math.max(1.5, scale * 0.04);
    for (const [x1, y1, x2, y2] of innerBoundarySegments(scenario.road)) {
      const p1 = worldToScreen(x1, y1);
      const p2 = worldToScreen(x2, y2);
      ctx.beginPath();
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);
      ctx.stroke();
    }
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
  }

  function drawDraftShapes(scale) {
    if (pendingAdd === "obstacle" && Array.isArray(obstacleDraftPoints) && obstacleDraftPoints.length) {
      const pts = obstacleDraftPoints.slice();
      if (obstacleDraftHover) pts.push(obstacleDraftHover);
      ctx.beginPath();
      const p0 = worldToScreen(pts[0][0], pts[0][1]);
      ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < pts.length; i++) {
        const p = worldToScreen(pts[i][0], pts[i][1]);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.strokeStyle = "rgba(15,23,42,0.8)";
      ctx.lineWidth = Math.max(1.4, scale * 0.05);
      ctx.setLineDash([Math.max(4, scale * 0.08), Math.max(3, scale * 0.06)]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < obstacleDraftPoints.length; i++) {
        const p = worldToScreen(obstacleDraftPoints[i][0], obstacleDraftPoints[i][1]);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(4, scale * 0.15), 0, Math.PI * 2);
        ctx.fillStyle = i === 0 && obstacleDraftSnapStart ? "#f59e0b" : "#0f766e";
        ctx.fill();
      }
    }
    if (pendingAdd === "road" && Array.isArray(roadDraftPoints) && roadDraftPoints.length) {
      const pts = roadDraftPoints.slice();
      if (roadDraftHover) pts.push(roadDraftHover);
      ctx.beginPath();
      const p0 = worldToScreen(pts[0][0], pts[0][1]);
      ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < pts.length; i++) {
        const p = worldToScreen(pts[i][0], pts[i][1]);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.strokeStyle = "rgba(30,64,175,0.9)";
      ctx.lineWidth = Math.max(2, scale * 0.06);
      ctx.setLineDash([Math.max(5, scale * 0.09), Math.max(3, scale * 0.06)]);
      ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < roadDraftPoints.length; i++) {
        const p = worldToScreen(roadDraftPoints[i][0], roadDraftPoints[i][1]);
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, Math.max(4, scale * 0.15), 0, Math.PI * 2);
        ctx.fillStyle = i === 0 && roadDraftSnapStart ? "#f59e0b" : "#1d4ed8";
        ctx.fill();
      }
    }
  }

  function drawScenarioObjects(scale) {
    for (const o of scenario.obstacles) {
      fillObstaclePolygon(o.points);
    }
    drawDraftShapes(scale);
    for (const s of scenario.slots) {
      const pose = slotPoseOf(s);
      if (!pose) continue;
      drawParkingSlotWorld(pose.x, pose.y, pose.theta);
    }
    for (let bi = 0; bi < scenario.buildings.length; bi++) {
      const [x, y] = scenario.buildings[bi];
      drawBuildingWorld(x, y);
      drawStackedWorldLabels(x, y, [String(bi + 1)]);
    }
  }

  function drawEntrances(scale) {
    for (let ei = 0; ei < scenario.entrances.length; ei++) {
      const e = scenario.entrances[ei];
      const ep = worldToScreen(e[0], e[1]);
      const er = Math.max(8, scale * 0.42);
      ctx.beginPath();
      ctx.arc(ep.sx, ep.sy, er, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.entranceFill;
      ctx.fill();
      ctx.strokeStyle = COLORS.entranceStroke;
      ctx.lineWidth = Math.max(1.5, scale * 0.05);
      ctx.stroke();
      const fs = Math.max(10, Math.min(16, scale * 0.36));
      ctx.fillStyle = "#ffffff";
      ctx.font = `700 ${fs}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(ei + 1), ep.sx, ep.sy + 0.4);
    }
  }

  function drawResultPaths(scale) {
    if (!lastResult?.paths?.length) return;
    const baseWidth = Math.max(2.2, scale * 0.085);
    const glowWidth = baseWidth + Math.max(2.4, scale * 0.09);
    for (const poly of lastResult.paths) {
      if (poly.length < 2) continue;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = COLORS.pathGlow;
      ctx.lineWidth = glowWidth;
      ctx.beginPath();
      const p0 = worldToScreen(poly[0][0], poly[0][1]);
      ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < poly.length; i++) {
        const p = worldToScreen(poly[i][0], poly[i][1]);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();

      ctx.strokeStyle = COLORS.path;
      ctx.lineWidth = baseWidth;
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < poly.length; i++) {
        const p = worldToScreen(poly[i][0], poly[i][1]);
        ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();

      const pend = worldToScreen(poly[poly.length - 1][0], poly[poly.length - 1][1]);
      const endR = Math.max(2.8, scale * 0.13);
      ctx.beginPath();
      ctx.arc(pend.sx, pend.sy, endR, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.pathEnd;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, scale * 0.05);
      ctx.stroke();
    }
  }

  function draw() {
    if (!scenario) return;
    ensureScenarioCollections();
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

    drawRoadAndParkingStrips(scale);
    drawScenarioObjects(scale);
    drawEntrances(scale);
    drawResultPaths(scale);

    drawVehicleSlotAssignments();
    drawSelectionOutline();
    drawMapOverlays();
    if (hoverTarget && !drag && !pendingAdd) drawHoverBalloon();
    schedulePersistCurrentState();
  }

  function getHoveredElement(wx, wy) {
    if (!scenario) return null;
    const entrances = scenario.entrances || [];
    for (let i = 0; i < entrances.length; i++) {
      const [ex, ey] = entrances[i];
      if (Math.hypot(wx - ex, wy - ey) < 3.5) {
        return { type: "entrance", index: i, wx: ex, wy: ey };
      }
    }
    const slots = scenario.slots || [];
    const hitR = Math.max(B.sw, B.sh) * 0.5 + 0.6;
    for (let i = 0; i < slots.length; i++) {
      const [sx, sy] = slots[i];
      if (Math.hypot(wx - sx, wy - sy) < hitR) {
        return { type: "slot", index: i, wx: sx, wy: sy };
      }
    }
    const buildings = scenario.buildings || [];
    for (let i = 0; i < buildings.length; i++) {
      const [bx, by] = buildings[i];
      if (Math.abs(wx - bx) < B.bw / 2 && Math.abs(wy - by) < B.bh / 2) {
        return { type: "building", index: i, wx: bx, wy: by };
      }
    }
    return null;
  }

  function getTooltipLines(target) {
    if (!target) return [];
    if (target.type === "entrance") {
      const [ex, ey] = scenario.entrances[target.index];
      return ["入口 " + (target.index + 1), "坐标 (" + ex.toFixed(1) + ", " + ey.toFixed(1) + ")"];
    }
    if (target.type === "slot") {
      const i = target.index;
      const lines = ["车位 " + (i + 1)];
      if (lastResult && Array.isArray(lastResult.assign)) {
        const vehIdx = lastResult.assign.indexOf(i);
        if (vehIdx >= 0) {
          const bd = lastResult.vehicle_breakdown?.[vehIdx];
          const targetBldg = lastResult.veh_targets?.[vehIdx];
          lines.push("车辆 " + (vehIdx + 1) + " → 楼 " + ((targetBldg ?? 0) + 1));
          if (bd) {
            lines.push("行驶 " + Number(bd.drive_time || 0).toFixed(1) + " s");
            lines.push("步行 " + Number(bd.walk_time || 0).toFixed(1) + " s");
          }
        } else {
          lines.push("（未分配）");
        }
      }
      return lines;
    }
    if (target.type === "building") {
      const i = target.index;
      const lines = ["楼 " + (i + 1)];
      if (lastResult && Array.isArray(lastResult.veh_targets)) {
        const count = lastResult.veh_targets.filter((t) => t === i).length;
        lines.push(count + " 辆车目的地");
      }
      return lines;
    }
    return [];
  }

  function drawHoverBalloon() {
    if (!hoverTarget) return;
    const lines = getTooltipLines(hoverTarget);
    if (!lines.length) return;

    const FONT_PX = 12;
    const PAD_X = 10;
    const PAD_Y = 7;
    const LINE_H = 17;
    const ARROW_H = 7;
    const R = 4;

    ctx.save();
    const FONT_NORMAL = FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
    const FONT_BOLD   = "bold " + FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
    let maxW = 0;
    for (let i = 0; i < lines.length; i++) {
      ctx.font = i === 0 ? FONT_BOLD : FONT_NORMAL;
      maxW = Math.max(maxW, ctx.measureText(lines[i]).width);
    }
    // +12px safety buffer for CJK glyph metric variance
    const boxW = maxW + PAD_X * 2 + 12;
    const boxH = lines.length * LINE_H + PAD_Y * 2;

    const { sx, sy } = worldToScreen(hoverTarget.wx, hoverTarget.wy);
    let bx = sx - boxW / 2;
    let by = sy - boxH - ARROW_H - 6;
    let arrowBelow = true;

    if (by < 2) {
      by = sy + ARROW_H + 6;
      arrowBelow = false;
    }
    bx = Math.max(2, Math.min(mapCssW - boxW - 2, bx));
    const ax = Math.max(bx + R + 6, Math.min(bx + boxW - R - 6, sx));

    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;

    ctx.beginPath();
    ctx.moveTo(bx + R, by);
    if (!arrowBelow) {
      ctx.lineTo(ax - 7, by);
      ctx.lineTo(ax, by - ARROW_H);
      ctx.lineTo(ax + 7, by);
    }
    ctx.lineTo(bx + boxW - R, by);
    ctx.arcTo(bx + boxW, by, bx + boxW, by + R, R);
    ctx.lineTo(bx + boxW, by + boxH - R);
    ctx.arcTo(bx + boxW, by + boxH, bx + boxW - R, by + boxH, R);
    if (arrowBelow) {
      ctx.lineTo(ax + 7, by + boxH);
      ctx.lineTo(ax, by + boxH + ARROW_H);
      ctx.lineTo(ax - 7, by + boxH);
    }
    ctx.lineTo(bx + R, by + boxH);
    ctx.arcTo(bx, by + boxH, bx, by + boxH - R, R);
    ctx.lineTo(bx, by + R);
    ctx.arcTo(bx, by, bx + R, by, R);
    ctx.closePath();
    ctx.fillStyle = "rgba(10, 16, 28, 0.95)";
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(59,130,246,0.5)";
    ctx.lineWidth = 0.9;
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        ctx.fillStyle = "#f1f5f9";
        ctx.font = "bold " + FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      } else {
        ctx.fillStyle = "#94a3b8";
        ctx.font = FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      }
      ctx.fillText(lines[i], bx + PAD_X, by + PAD_Y + i * LINE_H);
    }
    ctx.restore();
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
        fmtDim(lotW()) +
        " " +
        uLen() +
        " × 0–" +
        fmtDim(lotH()) +
        " " +
        uLen();
    }
  }

  function buildRoadSegmentsLocal(road) {
    if (geometry?.buildRoadSegments) return geometry.buildRoadSegments({ road, inner: scenario?.inner });
    return [];
  }

  function tryApplyRoadUpdate(mutator) {
    if (!scenario?.road) return false;
    const prevRoad = JSON.parse(JSON.stringify(scenario.road));
    mutator();
    ensureRoadStructure();
    const check = validateRoadNoOverlap();
    if (!check.ok) {
      scenario.road = prevRoad;
      ensureRoadStructure();
      notifyRoadGeometryInvalid(check.reason);
      return false;
    }
    sanitizeScenarioGeometry();
    invalidateOptimizationResult();
    return true;
  }

  function drawSelectionOutline() {
    if (!selection) return;
    ctx.strokeStyle = COLORS.select;
    ctx.lineWidth = 3;
    if (selection.kind === "entrance") {
      const e = scenario.entrances[selection.index ?? 0];
      const ep = worldToScreen(e[0], e[1]);
      ctx.beginPath();
      ctx.arc(ep.sx, ep.sy, padScale().scale * 1.18, 0, Math.PI * 2);
      ctx.stroke();
    } else if (selection.kind === "obstacle") {
      const o = scenario.obstacles[selection.index ?? 0];
      if (o?.points?.length >= 3) {
        const p0 = worldToScreen(o.points[0][0], o.points[0][1]);
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < o.points.length; i++) {
          const pi = worldToScreen(o.points[i][0], o.points[i][1]);
          ctx.lineTo(pi.sx, pi.sy);
        }
        ctx.closePath();
        ctx.stroke();
        for (let i = 0; i < o.points.length; i++) {
          const v = worldToScreen(o.points[i][0], o.points[i][1]);
          ctx.beginPath();
          ctx.arc(v.sx, v.sy, Math.max(4, padScale().scale * 0.18), 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = COLORS.select;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    } else if (selection.kind === "road") {
      const pts = scenario.road?.centerline || [];
      if (pts.length >= 2) {
        const p0 = worldToScreen(pts[0][0], pts[0][1]);
        ctx.beginPath();
        ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < pts.length; i++) {
          const pi = worldToScreen(pts[i][0], pts[i][1]);
          ctx.lineTo(pi.sx, pi.sy);
        }
        ctx.stroke();
        for (let i = 0; i < pts.length; i++) {
          const v = worldToScreen(pts[i][0], pts[i][1]);
          ctx.beginPath();
          ctx.arc(v.sx, v.sy, Math.max(4, padScale().scale * 0.18), 0, Math.PI * 2);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.strokeStyle = COLORS.select;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
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
      const pose = slotPoseOf(scenario.slots[selection.index]);
      if (!pose) return;
      const poly = slotPolygonAt(pose.x, pose.y, pose.theta).map((p) => worldToScreen(p[0], p[1]));
      ctx.beginPath();
      ctx.moveTo(poly[0].sx, poly[0].sy);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].sx, poly[i].sy);
      ctx.closePath();
      ctx.stroke();
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
        "入口为道路上的一点（无单独引道线段）；拖拽松手或改数后会自动贴到道路中心线。"
      );
      const entIndex = selection.index ?? 0;
      const e = scenario.entrances[entIndex];
      const applyEntrance = () => {
        const oldX = scenario.entrances[entIndex][0];
        const oldY = scenario.entrances[entIndex][1];
        const sx = parseFloat(document.getElementById("p-ex").value) || 0;
        const sy = parseFloat(document.getElementById("p-ey").value) || 0;
        const s = snapEntranceToInner(sx, sy);
        if (!canPlaceEntrance(s.wx, s.wy)) {
          scenario.entrances[entIndex][0] = oldX;
          scenario.entrances[entIndex][1] = oldY;
        } else {
          scenario.entrances[entIndex][0] = s.wx;
          scenario.entrances[entIndex][1] = s.wy;
        }
        ensureScenarioCollections();
        invalidateOptimizationResult();
        renderProps();
      };
      addNum("入口 X (" + uLen() + ")", "p-ex", e[0], applyEntrance);
      addNum("入口 Y (" + uLen() + ")", "p-ey", e[1], applyEntrance);
    } else if (selection.kind === "obstacle") {
      const obsIndex = selection.index ?? 0;
      const getObstacle = () => scenario?.obstacles?.[obsIndex];
      const o = getObstacle();
      if (!o) {
        addNote("当前花坛不可用，请重新选择花坛。");
        return;
      }
      addNote("花坛为多边形：可编辑各顶点坐标，至少保留 3 个点；支持画布直接拖拽顶点。");
      (o?.points || []).forEach((pt, pi) => {
        addNum("顶点 " + (pi + 1) + " X (" + uLen() + ")", "p-opx-" + pi, pt[0], () => {
          const cur = getObstacle();
          if (!cur || !cur.points?.[pi]) return;
          const old = (cur.points || []).map((p) => [p[0], p[1]]);
          cur.points[pi][0] = parseFloat(document.getElementById("p-opx-" + pi).value) || 0;
          if (!normalizeObstacleInner()) {
            cur.points = old;
            notifyObstacleGeometryInvalid(obstacleNormalizeError || "self_intersect");
            renderProps();
            draw();
            return;
          }
          invalidateOptimizationResult();
          renderProps();
        });
        addNum("顶点 " + (pi + 1) + " Y (" + uLen() + ")", "p-opy-" + pi, pt[1], () => {
          const cur = getObstacle();
          if (!cur || !cur.points?.[pi]) return;
          const old = (cur.points || []).map((p) => [p[0], p[1]]);
          cur.points[pi][1] = parseFloat(document.getElementById("p-opy-" + pi).value) || 0;
          if (!normalizeObstacleInner()) {
            cur.points = old;
            notifyObstacleGeometryInvalid(obstacleNormalizeError || "self_intersect");
            renderProps();
            draw();
            return;
          }
          invalidateOptimizationResult();
          renderProps();
        });
      });
      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.textContent = "新增顶点";
      addBtn.style.gridColumn = "1 / -1";
      addBtn.addEventListener("click", () => {
        const cur = getObstacle();
        if (!cur) return;
        const pts = cur.points || [];
        const old = pts.map((p) => [p[0], p[1]]);
        if (!pts.length) {
          cur.points = [[50, 50], [54, 50], [52, 54]];
        } else if (pts.length === 1) {
          cur.points.push([pts[0][0] + 2, pts[0][1]]);
        } else {
          const a = pts[pts.length - 1];
          const b = pts[0];
          cur.points.push([(a[0] + b[0]) / 2 + 1.2, (a[1] + b[1]) / 2 + 1.2]);
        }
        if (!normalizeObstacleInner()) {
          cur.points = old;
          notifyObstacleGeometryInvalid(obstacleNormalizeError || "self_intersect");
          renderProps();
          draw();
          return;
        }
        invalidateOptimizationResult();
        renderProps();
      });
      propsForm.appendChild(addBtn);
      if ((o?.points || []).length > 3) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "删除最后顶点";
        delBtn.style.gridColumn = "1 / -1";
        delBtn.addEventListener("click", () => {
          const cur = getObstacle();
          if (!cur || !Array.isArray(cur.points) || cur.points.length <= 3) return;
          const old = cur.points.map((p) => [p[0], p[1]]);
          cur.points.pop();
          if (!normalizeObstacleInner()) {
            cur.points = old;
            notifyObstacleGeometryInvalid(obstacleNormalizeError || "self_intersect");
            renderProps();
            draw();
            return;
          }
          invalidateOptimizationResult();
          renderProps();
        });
        propsForm.appendChild(delBtn);
      }
    } else if (selection.kind === "road") {
      addNote("道路使用中心线顶点 + 宽度；支持编辑顶点坐标、宽度和环形/非环形。");
      ensureRoadStructure();
      const pts = scenario.road?.centerline || [];
      const shapeLabel = document.createElement("label");
      shapeLabel.htmlFor = "p-r-closed";
      shapeLabel.textContent = "道路形态";
      const shapeSel = document.createElement("select");
      shapeSel.id = "p-r-closed";
      shapeSel.innerHTML = '<option value="closed">环形（首尾相连）</option><option value="open">非环形（首尾不连）</option>';
      shapeSel.value = scenario.road?.closed === false ? "open" : "closed";
      shapeSel.addEventListener("change", () => {
        if (tryApplyRoadUpdate(() => setRoadClosed(shapeSel.value !== "open"))) {
          renderProps();
          draw();
        }
      });
      propsForm.appendChild(shapeLabel);
      propsForm.appendChild(shapeSel);
      addNum("道路宽度 (" + uLen() + ")", "p-r-width", scenario.road?.width || DEFAULT_ROAD_WIDTH, () => {
        const nextW = Math.max(2.4, parseFloat(document.getElementById("p-r-width").value) || DEFAULT_ROAD_WIDTH);
        if (tryApplyRoadUpdate(() => {
          scenario.road.width = nextW;
        })) {
          renderProps();
          draw();
        }
      });
      pts.forEach((pt, pi) => {
        addNum("道路顶点 " + (pi + 1) + " X (" + uLen() + ")", "p-rx-" + pi, pt[0], () => {
          const v = parseFloat(document.getElementById("p-rx-" + pi).value) || 0;
          if (tryApplyRoadUpdate(() => {
            scenario.road.centerline[pi][0] = v;
            if (scenario.road?.closed !== false) syncClosedRoadEndpoint(scenario.road.centerline, pi);
          })) {
            renderProps();
            draw();
          }
        });
        addNum("道路顶点 " + (pi + 1) + " Y (" + uLen() + ")", "p-ry-" + pi, pt[1], () => {
          const v = parseFloat(document.getElementById("p-ry-" + pi).value) || 0;
          if (tryApplyRoadUpdate(() => {
            scenario.road.centerline[pi][1] = v;
            if (scenario.road?.closed !== false) syncClosedRoadEndpoint(scenario.road.centerline, pi);
          })) {
            renderProps();
            draw();
          }
        });
      });
      if (pts.length > 2) {
        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.textContent = "删除最后道路顶点";
        delBtn.style.gridColumn = "1 / -1";
        delBtn.addEventListener("click", () => {
          if ((scenario.road?.centerline || []).length <= 2) return;
          if (tryApplyRoadUpdate(() => {
            scenario.road.centerline.pop();
          })) {
            renderProps();
            draw();
          }
        });
        propsForm.appendChild(delBtn);
      }
    } else if (selection.kind === "building") {
      const [x, y] = scenario.buildings[selection.index];
      addNum("楼中心 X (" + uLen() + ")", "p-bx", x, () => {
        const v = clampBuildingCenter(
          parseFloat(document.getElementById("p-bx").value) || 0,
          parseFloat(document.getElementById("p-by").value) || 0
        );
        if (canPlaceBuilding(v.wx, v.wy, selection.index)) {
          scenario.buildings[selection.index][0] = v.wx;
        }
        draw();
      });
      addNum("楼中心 Y (" + uLen() + ")", "p-by", y, () => {
        const v = clampBuildingCenter(
          parseFloat(document.getElementById("p-bx").value) || 0,
          parseFloat(document.getElementById("p-by").value) || 0
        );
        if (canPlaceBuilding(v.wx, v.wy, selection.index)) {
          scenario.buildings[selection.index][1] = v.wy;
        }
        draw();
      });
    } else if (selection.kind === "slot") {
      const pose = slotPoseOf(scenario.slots[selection.index]);
      if (!pose) return;
      const x = pose.x;
      const y = pose.y;
      const idx = selection.index;
      const applySlotFromInputs = () => {
        scenario.slots[idx][0] = parseFloat(document.getElementById("p-sx").value) || 0;
        scenario.slots[idx][1] = parseFloat(document.getElementById("p-sy").value) || 0;
        if (!applySnapToSlot(idx)) return;
        renderProps();
        draw();
      };
      addNum("车位中心 X (" + uLen() + ")", "p-sx", x, applySlotFromInputs);
      addNum("车位中心 Y (" + uLen() + ")", "p-sy", y, applySlotFromInputs);
      addNum("车位角度 (deg)", "p-st", (normalizeAngle(pose.theta) * 180) / Math.PI, () => {
        const deg = parseFloat(document.getElementById("p-st").value) || 0;
        scenario.slots[idx][2] = normalizeAngle((deg * Math.PI) / 180);
        draw();
      });
    }
  }

  function normalizeObstacleInner() {
    obstacleNormalizeError = null;
    ensureScenarioCollections();
    const normalized = scenario.obstacles
      .map((o) => normalizeObstacleShape(o))
      .filter((o) => !!o);
    if (normalized.length !== scenario.obstacles.length) {
      obstacleNormalizeError = "self_intersect";
      return false;
    }
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        if (polygonsOverlap(normalized[i].points, normalized[j].points)) {
          obstacleNormalizeError = "overlap";
          return false;
        }
      }
      if (polygonOverlapsInnerRoad(normalized[i].points)) {
        obstacleNormalizeError = "overlap_road";
        return false;
      }
      if (polygonOverlapsSceneElements(normalized[i].points)) {
        obstacleNormalizeError = "overlap_element";
        return false;
      }
    }
    scenario.obstacles = normalized;
    ensureRoadStructure();
    if (scenario.obstacles.length) {
      const b = obstacleBoundsFromPoints(scenario.obstacles[0].points);
      scenario.obstacle = b ? { x_min: b.xmin, x_max: b.xmax, y_min: b.ymin, y_max: b.ymax } : null;
    } else {
      scenario.obstacle = null;
    }
    return true;
  }

  function clonePoints(points) {
    return (points || []).map((p) => [Number(p[0]), Number(p[1])]);
  }

  function interpolatePoints(fromPoints, toPoints, t) {
    const n = Math.min(fromPoints.length, toPoints.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      const fx = Number(fromPoints[i][0]);
      const fy = Number(fromPoints[i][1]);
      const tx = Number(toPoints[i][0]);
      const ty = Number(toPoints[i][1]);
      out.push([fx + (tx - fx) * t, fy + (ty - fy) * t]);
    }
    return out;
  }

  function trySetObstaclePoints(obstacleIndex, nextPoints) {
    const o = scenario?.obstacles?.[obstacleIndex];
    if (!o) return false;
    const prev = clonePoints(o.points);
    o.points = clonePoints(nextPoints);
    const ok = normalizeObstacleInner();
    if (!ok) {
      o.points = prev;
      obstacleNormalizeError = null;
      return false;
    }
    return true;
  }

  function moveObstaclePointsToward(obstacleIndex, currentPoints, targetPoints, iters = 14) {
    if (trySetObstaclePoints(obstacleIndex, targetPoints)) return true;
    let lo = 0;
    let hi = 1;
    let moved = false;
    for (let i = 0; i < iters; i++) {
      if (hi - lo < 1e-9) break;
      const mid = (lo + hi) / 2;
      const cand = interpolatePoints(currentPoints, targetPoints, mid);
      if (trySetObstaclePoints(obstacleIndex, cand)) {
        lo = mid;
        moved = true;
      } else {
        hi = mid;
      }
    }
    return moved;
  }

  function findNearestValidBuildingPosition(x, y, ignoreIndex = -1) {
    const base = clampBuildingCenter(x, y);
    if (canPlaceBuilding(base.wx, base.wy, ignoreIndex)) return base;
    const angleN = 20;
    const ringN = 14;
    const step = Math.max(0.8, Math.min(B.sh, B.bh) * 0.45);
    for (let r = 1; r <= ringN; r++) {
      const radius = r * step;
      for (let k = 0; k < angleN; k++) {
        const a = (Math.PI * 2 * k) / angleN;
        const c = clampBuildingCenter(base.wx + radius * Math.cos(a), base.wy + radius * Math.sin(a));
        if (canPlaceBuilding(c.wx, c.wy, ignoreIndex)) return c;
      }
    }
    return null;
  }

  function nearestValidEntrancePoint(x, y) {
    const segs = innerBoundarySegments(scenario.road || scenario.inner);
    let best = null;
    let bestD = Infinity;
    for (const [x1, y1, x2, y2] of segs) {
      const samples = 72;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        if (!canPlaceEntrance(px, py)) continue;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { wx: px, wy: py };
        }
      }
    }
    return best;
  }

  function sanitizeScenarioGeometry() {
    if (!scenario) return;
    ensureScenarioCollections();
    ensureRoadStructure();
    normalizeObstacleInner();
    const rawBuildings = Array.isArray(scenario.buildings) ? scenario.buildings.slice() : [];
    const rawSlots = Array.isArray(scenario.slots) ? scenario.slots.slice() : [];
    scenario.slots = [];
    scenario.buildings = [];
    for (const b of rawBuildings) {
      const bx = Number(b?.[0]);
      const by = Number(b?.[1]);
      if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
      const p = findNearestValidBuildingPosition(bx, by, -1);
      if (p) scenario.buildings.push([p.wx, p.wy]);
    }
    for (let ei = 0; ei < scenario.entrances.length; ei++) {
      const cur = scenario.entrances[ei];
      const es = snapEntranceToInner(cur?.[0] ?? 0, cur?.[1] ?? 0);
      if (canPlaceEntrance(es.wx, es.wy)) {
        scenario.entrances[ei][0] = es.wx;
        scenario.entrances[ei][1] = es.wy;
      } else {
        const altE = nearestValidEntrancePoint(es.wx, es.wy);
        if (altE) {
          scenario.entrances[ei][0] = altE.wx;
          scenario.entrances[ei][1] = altE.wy;
        }
      }
    }
    for (const s of rawSlots) {
      const sx = Number(s?.[0]);
      const sy = Number(s?.[1]);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      const p = suggestUniformSlotPosition(sx, sy, -1);
      if (p) scenario.slots.push([p.wx, p.wy, normalizeAngle(p.theta ?? s?.[2] ?? 0)]);
    }
    ensureScenarioCollections();
    ensureVehicleEntrancesArray();
  }

  function appendObstacleDraftPoint(wx, wy) {
    const c = clampWorld(wx, wy);
    if (!obstacleDraftPoints) obstacleDraftPoints = [];
    const last = obstacleDraftPoints[obstacleDraftPoints.length - 1];
    if (last && Math.hypot(last[0] - c.wx, last[1] - c.wy) < 0.35) return;
    obstacleDraftPoints.push([c.wx, c.wy]);
  }

  function obstacleDraftSnap(wx, wy) {
    const c = clampWorld(wx, wy);
    const pts = obstacleDraftPoints || [];
    if (pts.length >= 3) {
      const s = pts[0];
      if (Math.hypot(c.wx - s[0], c.wy - s[1]) <= 1.2) {
        return { wx: s[0], wy: s[1], snapToStart: true };
      }
    }
    return { wx: c.wx, wy: c.wy, snapToStart: false };
  }

  function cancelObstacleDraft() {
    obstacleDraftPoints = null;
    obstacleDraftHover = null;
    obstacleDraftSnapStart = false;
    draw();
  }

  function appendRoadDraftPoint(wx, wy) {
    const c = clampWorld(wx, wy);
    if (!roadDraftPoints) roadDraftPoints = [];
    const last = roadDraftPoints[roadDraftPoints.length - 1];
    if (last && Math.hypot(last[0] - c.wx, last[1] - c.wy) < 0.35) return;
    roadDraftPoints.push([c.wx, c.wy]);
  }

  function roadDraftSnap(wx, wy) {
    const c = clampWorld(wx, wy);
    const pts = roadDraftPoints || [];
    if (pts.length >= 3 && roadDraftClosed) {
      const s = pts[0];
      if (Math.hypot(c.wx - s[0], c.wy - s[1]) <= 1.2) {
        return { wx: s[0], wy: s[1], snapToStart: true };
      }
    }
    return { wx: c.wx, wy: c.wy, snapToStart: false };
  }

  function cancelRoadDraft() {
    roadDraftPoints = null;
    roadDraftHover = null;
    roadDraftSnapStart = false;
    draw();
  }

  function finalizeRoadDraft() {
    if (!scenario || !roadDraftPoints || roadDraftPoints.length < 2) return false;
    const centerline = roadDraftPoints.map((p) => [Number(p[0]), Number(p[1])]);
    if (roadDraftClosed && centerline.length >= 3 && !pointsNear(centerline[0], centerline[centerline.length - 1])) {
      centerline.push([centerline[0][0], centerline[0][1]]);
    }
    const nextRoad = normalizeRoadShape({
      centerline,
      width: scenario?.road?.width || DEFAULT_ROAD_WIDTH,
      closed: roadDraftClosed,
    }, scenario.inner);
    if (!nextRoad) return false;
    const prevRoad = scenario.road ? JSON.parse(JSON.stringify(scenario.road)) : null;
    scenario.road = nextRoad;
    ensureRoadStructure();
    const check = validateRoadNoOverlap();
    if (!check.ok) {
      scenario.road = prevRoad;
      ensureRoadStructure();
      notifyRoadGeometryInvalid(check.reason);
      return false;
    }
    roadDraftPoints = null;
    roadDraftHover = null;
    roadDraftSnapStart = false;
    pendingAdd = null;
    setSelection({ kind: "road" });
    invalidateOptimizationResult();
    return true;
  }

  function finalizeObstacleDraft() {
    if (!scenario || !obstacleDraftPoints || obstacleDraftPoints.length < 3) return false;
    if (polygonHasSelfIntersection(obstacleDraftPoints)) {
      notifyObstacleGeometryInvalid("self_intersect");
      return false;
    }
    const poly = normalizeObstacleShape({ points: obstacleDraftPoints });
    if (!poly) {
      notifyObstacleGeometryInvalid("invalid");
      return false;
    }
    scenario.obstacles.push(poly);
    if (!normalizeObstacleInner()) {
      scenario.obstacles.pop();
      notifyObstacleGeometryInvalid(obstacleNormalizeError || "self_intersect");
      return false;
    }
    const idx = scenario.obstacles.length - 1;
    obstacleDraftPoints = null;
    obstacleDraftHover = null;
    obstacleDraftSnapStart = false;
    pendingAdd = null;
    setSelection({ kind: "obstacle", index: idx });
    invalidateOptimizationResult();
    return true;
  }

  function setSelection(sel) {
    selection = sel;
    document.querySelectorAll(".toolbar button").forEach((b) => {
      if (b.id === "btn-add-building") b.classList.toggle("active", pendingAdd === "building");
      if (b.id === "btn-add-slot") b.classList.toggle("active", pendingAdd === "slot");
      if (b.id === "btn-add-entrance") b.classList.toggle("active", pendingAdd === "entrance");
      if (b.id === "btn-add-obstacle") b.classList.toggle("active", pendingAdd === "obstacle");
      if (b.id === "btn-add-road") b.classList.toggle("active", pendingAdd === "road");
    });
    renderProps();
    draw();
  }

  function handlePendingAddPointerDown(wx, wy, ev) {
    if (pendingAdd === "entrance") {
      const c = clampWorld(wx, wy);
      const s = snapEntranceToInner(c.wx, c.wy);
      if (!canPlaceEntrance(s.wx, s.wy)) return true;
      scenario.entrances.push([s.wx, s.wy]);
      ensureVehicleEntrancesArray();
      rebuildVehicleTargetsUI();
      invalidateOptimizationResult();
      pendingAdd = null;
      setSelection({ kind: "entrance", index: scenario.entrances.length - 1 });
      return true;
    }
    if (pendingAdd === "obstacle") {
      const snap = obstacleDraftSnap(wx, wy);
      if (snap.snapToStart && obstacleDraftPoints?.length >= 3) {
        finalizeObstacleDraft();
      } else if (ev.detail >= 2) {
        appendObstacleDraftPoint(snap.wx, snap.wy);
        finalizeObstacleDraft();
      } else {
        appendObstacleDraftPoint(snap.wx, snap.wy);
        draw();
      }
      return true;
    }
    if (pendingAdd === "road") {
      const snap = roadDraftSnap(wx, wy);
      if (snap.snapToStart && roadDraftPoints?.length >= 2) {
        finalizeRoadDraft();
      } else if (ev.detail >= 2) {
        appendRoadDraftPoint(snap.wx, snap.wy);
        finalizeRoadDraft();
      } else {
        appendRoadDraftPoint(snap.wx, snap.wy);
        draw();
      }
      return true;
    }
    if (pendingAdd === "building") {
      const c = clampBuildingCenter(wx, wy);
      if (!canPlaceBuilding(c.wx, c.wy)) return true;
      scenario.buildings.push([c.wx, c.wy]);
      ensureVehicleDestinationsArray();
      rebuildVehicleTargetsUI();
      pendingAdd = null;
      setSelection({ kind: "building", index: scenario.buildings.length - 1 });
      return true;
    }
    if (pendingAdd === "slot") {
      const c = clampWorld(wx, wy);
      const p = suggestUniformSlotPosition(c.wx, c.wy, -1);
      if (!p) return true;
      scenario.slots.push([p.wx, p.wy, normalizeAngle(p.theta)]);
      const si = scenario.slots.length - 1;
      pendingAdd = null;
      setSelection({ kind: "slot", index: si });
      return true;
    }
    return false;
  }

  function beginDragForHit(hit, wx, wy) {
    if (hit.kind === "entrance") {
      drag = { kind: "entrance", index: hit.index ?? 0, ox: 0, oy: 0 };
      return;
    }
    if (hit.kind === "obstacle") {
      const vi = pickObstacleVertex(wx, wy, hit.index ?? 0, 16);
      if (vi != null && vi >= 0) {
        drag = {
          kind: "obstacle-vertex",
          index: hit.index ?? 0,
          vertexIndex: vi,
          ox: 0,
          oy: 0,
          origPoints: (scenario.obstacles[hit.index ?? 0].points || []).map((p) => [p[0], p[1]]),
        };
        return;
      }
      drag = {
        kind: "obstacle",
        index: hit.index ?? 0,
        startW: { wx, wy },
        origPoints: (scenario.obstacles[hit.index ?? 0].points || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    if (hit.kind === "road") {
      drag = {
        kind: "road",
        startW: { wx, wy },
        origPoints: (scenario.road?.centerline || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    if (hit.kind === "building") {
      drag = { kind: "building", index: hit.index, ox: 0, oy: 0 };
      return;
    }
    if (hit.kind === "slot") {
      drag = { kind: "slot", index: hit.index, ox: 0, oy: 0 };
    }
  }

  function pointerDown(ev) {
    if (!scenario) return;
    ensureScenarioCollections();
    const { wx, wy } = eventToWorld(ev);

    if (handlePendingAddPointerDown(wx, wy, ev)) {
      return;
    }

    const nearVertex = pickAnyObstacleVertex(wx, wy, 16);
    if (nearVertex) {
      const oi = nearVertex.obstacleIndex;
      const vi = nearVertex.vertexIndex;
      setSelection({ kind: "obstacle", index: oi });
      const v = scenario.obstacles[oi].points[vi];
      drag = {
        kind: "obstacle-vertex",
        index: oi,
        vertexIndex: vi,
        ox: 0,
        oy: 0,
        origPoints: (scenario.obstacles[oi].points || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    // Entrances beat road vertices when they overlap
    const mouseS = worldToScreen(wx, wy);
    const ents = scenario.entrances || [];
    for (let i = ents.length - 1; i >= 0; i--) {
      const ep = worldToScreen(ents[i][0], ents[i][1]);
      if (Math.hypot(mouseS.sx - ep.sx, mouseS.sy - ep.sy) < 16) {
        setSelection({ kind: "entrance", index: i });
        drag = { kind: "entrance", index: i, ox: 0, oy: 0 };
        return;
      }
    }
    const roadVertex = pickRoadVertex(wx, wy, 16);
    if (roadVertex != null) {
      setSelection({ kind: "road" });
      const v = scenario.road.centerline[roadVertex];
      drag = {
        kind: "road-vertex",
        vertexIndex: roadVertex,
        ox: 0,
        oy: 0,
        origPoints: (scenario.road.centerline || []).map((p) => [p[0], p[1]]),
      };
      return;
    }

    const hit = pickAt(wx, wy);
    if (!hit) {
      setSelection(null);
      return;
    }
    setSelection(hit);
    beginDragForHit(hit, wx, wy);
  }

  function pointerMove(ev) {
    let { wx, wy } = eventToWorld(ev);
    const cw = clampWorld(wx, wy);
    wx = cw.wx;
    wy = cw.wy;
    if (pendingAdd === "obstacle" && obstacleDraftPoints?.length) {
      const snap = obstacleDraftSnap(wx, wy);
      obstacleDraftHover = [snap.wx, snap.wy];
      obstacleDraftSnapStart = !!snap.snapToStart;
      draw();
      if (!drag || !scenario) return;
    }
    if (pendingAdd === "road" && roadDraftPoints?.length) {
      const snap = roadDraftSnap(wx, wy);
      roadDraftHover = [snap.wx, snap.wy];
      roadDraftSnapStart = !!snap.snapToStart;
      draw();
      if (!drag || !scenario) return;
    }
    if (!drag || !scenario) {
      if (!drag && scenario && !pendingAdd) {
        const newHover = getHoveredElement(wx, wy);
        const changed =
          newHover?.type !== hoverTarget?.type ||
          newHover?.index !== hoverTarget?.index;
        if (changed) {
          hoverTarget = newHover;
          if (!hoverRafPending) {
            hoverRafPending = true;
            requestAnimationFrame(() => {
              hoverRafPending = false;
              draw();
            });
          }
        }
      }
      return;
    }

    if (drag.kind === "entrance") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      const s = snapEntranceToInner(c.wx, c.wy);
      const cur = scenario.entrances[drag.index];
      const best = slideToward(cur[0], cur[1], s.wx, s.wy, canPlaceEntrance);
      scenario.entrances[drag.index][0] = best.wx;
      scenario.entrances[drag.index][1] = best.wy;
      ensureScenarioCollections();
    } else if (drag.kind === "building") {
      const target = clampBuildingCenter(wx + drag.ox, wy + drag.oy);
      const cur = scenario.buildings[drag.index];
      const best = slideToward(cur[0], cur[1], target.wx, target.wy, (x, y) => canPlaceBuilding(x, y, drag.index));
      const clamped = clampBuildingCenter(best.wx, best.wy);
      scenario.buildings[drag.index][0] = clamped.wx;
      scenario.buildings[drag.index][1] = clamped.wy;
    } else if (drag.kind === "slot") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      const p = suggestUniformSlotPosition(c.wx, c.wy, drag.index);
      if (p) {
        scenario.slots[drag.index][0] = p.wx;
        scenario.slots[drag.index][1] = p.wy;
        scenario.slots[drag.index][2] = normalizeAngle(p.theta ?? scenario.slots[drag.index][2] ?? 0);
      }
    } else if (drag.kind === "obstacle-vertex") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      const curPoints = clonePoints(scenario.obstacles[drag.index]?.points || []);
      const vi = drag.vertexIndex;
      const [curVx, curVy] = curPoints[vi] || [c.wx, c.wy];
      const tryVertex = (vx, vy) => {
        const np = clonePoints(curPoints);
        np[vi] = [vx, vy];
        const checked = normalizeObstacleShape({ points: np });
        if (checked) { moveObstaclePointsToward(drag.index, curPoints, checked.points, 12); return true; }
        return false;
      };
      if (!tryVertex(c.wx, c.wy)) {
        if (!tryVertex(c.wx, curVy)) tryVertex(curVx, c.wy);
      }
    } else if (drag.kind === "obstacle") {
      const dx = wx - drag.startW.wx;
      const dy = wy - drag.startW.wy;
      const pts = drag.origPoints || [];
      const curPts = scenario.obstacles[drag.index]?.points || [];
      const curOx = (curPts[0]?.[0] ?? 0) - (pts[0]?.[0] ?? 0);
      const curOy = (curPts[0]?.[1] ?? 0) - (pts[0]?.[1] ?? 0);
      const best = slideToward(curOx, curOy, dx, dy,
        (ox, oy) => canPlaceObstacleAt(drag.index, pts.map(p => [p[0] + ox, p[1] + oy]))
      );
      trySetObstaclePoints(drag.index, pts.map(p => [p[0] + best.wx, p[1] + best.wy]));
    } else if (drag.kind === "road-vertex") {
      const c = clampWorld(wx + drag.ox, wy + drag.oy);
      const prevRoad = JSON.parse(JSON.stringify(scenario.road));
      scenario.road.centerline[drag.vertexIndex] = [c.wx, c.wy];
      if (scenario.road?.closed !== false) syncClosedRoadEndpoint(scenario.road.centerline, drag.vertexIndex);
      ensureRoadStructure();
      const check = validateRoadNoOverlap();
      if (!check.ok) {
        scenario.road = prevRoad;
        ensureRoadStructure();
      }
    } else if (drag.kind === "road") {
      const dx = wx - drag.startW.wx;
      const dy = wy - drag.startW.wy;
      const prevRoad = JSON.parse(JSON.stringify(scenario.road));
      scenario.road.centerline = (drag.origPoints || []).map((p) => [p[0] + dx, p[1] + dy]);
      ensureRoadStructure();
      const check = validateRoadNoOverlap();
      if (!check.ok) {
        scenario.road = prevRoad;
        ensureRoadStructure();
      }
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
      const idx = d.index ?? 0;
      const s = snapEntranceToInner(scenario.entrances[idx][0], scenario.entrances[idx][1]);
      if (canPlaceEntrance(s.wx, s.wy)) {
        scenario.entrances[idx][0] = s.wx;
        scenario.entrances[idx][1] = s.wy;
        ensureScenarioCollections();
        changed = true;
      }
      renderProps();
    }
    if (d?.kind === "slot") {
      changed = applySnapToSlot(d.index) || changed;
      renderProps();
    }
    if (d?.kind === "obstacle" || d?.kind === "obstacle-vertex") {
      if (!normalizeObstacleInner()) {
        if (d?.kind === "obstacle-vertex" || d?.kind === "obstacle") {
          const o = scenario.obstacles[d.index];
          if (o && Array.isArray(d.origPoints)) o.points = d.origPoints.map((p) => [p[0], p[1]]);
        }
        notifyObstacleGeometryInvalid(obstacleNormalizeError || "self_intersect");
        draw();
        return;
      }
      changed = true;
      renderProps();
    }
    if (d?.kind === "road" || d?.kind === "road-vertex") {
      ensureRoadStructure();
      const check = validateRoadNoOverlap();
      if (!check.ok) {
        if (d?.origPoints?.length) {
          scenario.road.centerline = d.origPoints.map((p) => [p[0], p[1]]);
        }
        ensureRoadStructure();
        notifyRoadGeometryInvalid(check.reason);
        draw();
        return;
      }
      sanitizeScenarioGeometry();
      changed = true;
      renderProps();
    }
    if (changed) {
      if (
        d?.kind === "entrance" ||
        d?.kind === "obstacle" ||
        d?.kind === "obstacle-vertex" ||
        d?.kind === "road" ||
        d?.kind === "road-vertex"
      ) {
        invalidateOptimizationResult();
      } else {
        draw();
      }
    }
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
    } else if (selection.kind === "entrance") {
      if (scenario.entrances.length <= 1) return;
      scenario.entrances.splice(selection.index ?? 0, 1);
      ensureScenarioCollections();
      ensureVehicleEntrancesArray();
      rebuildVehicleTargetsUI();
      setSelection(null);
    } else if (selection.kind === "obstacle") {
      scenario.obstacles.splice(selection.index ?? 0, 1);
      normalizeObstacleInner();
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

  const CHART_THEME = {
    bg: "#f8fafc",
    axisText: "#64748b",
    helperText: "#475569",
    line: "#0284c7",
    lineSoft: "rgba(2,132,199,0.32)",
    dotStroke: "#0369a1",
    labelText: "#0f172a",
  };

  function chartDrawAxisDecor(w, h) {
    cctx.fillStyle = CHART_THEME.axisText;
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
    cctx.fillStyle = CHART_THEME.axisText;
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
    cctx.fillStyle = CHART_THEME.bg;
    cctx.fillRect(0, 0, w, h);
    if (!series.length) {
      cctx.fillStyle = CHART_THEME.helperText;
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
      cctx.strokeStyle = CHART_THEME.lineSoft;
      cctx.lineWidth = 1;
      cctx.setLineDash([5, 5]);
      cctx.beginPath();
      cctx.moveTo(pad, y);
      cctx.lineTo(w - pad, y);
      cctx.stroke();
      cctx.setLineDash([]);
      cctx.fillStyle = CHART_THEME.line;
      cctx.beginPath();
      cctx.arc(cx, y, 6, 0, Math.PI * 2);
      cctx.fill();
      cctx.strokeStyle = CHART_THEME.dotStroke;
      cctx.lineWidth = 1.5;
      cctx.stroke();
      cctx.fillStyle = CHART_THEME.labelText;
      cctx.font = '12px "Segoe UI", "Microsoft YaHei", sans-serif';
      cctx.textAlign = "left";
      cctx.textBaseline = "bottom";
      const label = v0.toFixed(2) + " " + uTime();
      cctx.fillText(label, Math.min(cx + 10, w - pad - 2), y - 4);
      cctx.textAlign = "center";
      cctx.textBaseline = "top";
      cctx.fillStyle = CHART_THEME.helperText;
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
    cctx.strokeStyle = CHART_THEME.line;
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
      cctx.fillStyle = CHART_THEME.line;
      cctx.beginPath();
      cctx.arc(x, y, 5, 0, Math.PI * 2);
      cctx.fill();
    }
    if (series.length >= 2) {
      cctx.fillStyle = CHART_THEME.axisText;
      cctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
      cctx.textBaseline = "top";
      cctx.textAlign = "left";
      cctx.fillText("0", pad, h - CHART_BOTTOM_AXIS + 2);
      cctx.textAlign = "right";
      cctx.fillText(String(series.length - 1), w - pad, h - CHART_BOTTOM_AXIS + 2);
    }
    chartDrawAxisDecor(w, h);
  }

  function renderBreakdownSummary() {
    const el = document.getElementById("result-breakdown");
    const driveEl = document.getElementById("metric-drive");
    const walkEl = document.getElementById("metric-walk");
    const totalEl = document.getElementById("metric-total");

    if (driveEl) driveEl.textContent = "--";
    if (walkEl) walkEl.textContent = "--";
    if (totalEl) totalEl.textContent = "--";
    if (el) el.textContent = "";

    const items = lastResult?.vehicle_breakdown;
    if (!Array.isArray(items) || !items.length) return;

    const totals = items.reduce(
      (acc, it) => {
        acc.drive += Number(it.drive_time || 0);
        acc.walk += Number(it.walk_time || 0);
        acc.penalty += Number(it.penalty || 0);
        return acc;
      },
      { drive: 0, walk: 0, penalty: 0 }
    );

    if (driveEl) driveEl.textContent = totals.drive.toFixed(1);
    if (walkEl) walkEl.textContent = totals.walk.toFixed(1);
    if (totalEl) totalEl.textContent = (totals.drive + totals.walk + totals.penalty).toFixed(1);

    if (el && totals.penalty > 0) {
      el.textContent = "含约束罚分 " + totals.penalty.toFixed(2) + " " + uTime();
    }
  }

  function renderResultTip(text) {
    const el = document.getElementById("result-tip");
    if (!el) return;
    el.textContent = text || "";
  }

  function normalizeBenchmarkRuns(rawRuns) {
    if (analysisTools?.normalizeRuns) return analysisTools.normalizeRuns(rawRuns);
    const parsed = Number.parseInt(rawRuns, 10);
    const safeRuns = Number.isFinite(parsed) ? parsed : 6;
    return Math.max(1, Math.min(MAX_BENCHMARK_RUNS, safeRuns));
  }

  async function runOptimize() {
    const btn = document.getElementById("btn-run");
    const status = document.getElementById("result-status");
    const gbestEl = document.getElementById("result-gbest");
    const methodEl = document.getElementById("optimizer-method");
    const seedEl = document.getElementById("pso-seed");
    const method = methodEl && methodEl.value ? methodEl.value : "exact";
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : null;
    btn.disabled = true;
    status.textContent = "计算中…（总时间单位：" + uTime() + "）";
    gbestEl.style.display = "none";
    try {
      if (!optimizer || typeof optimizer.runOptimize !== "function") {
        status.textContent = "本地优化模块未加载（assets/js/optimizer.js）。";
        invalidateOptimizationResult();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      const data = normalizeOptimizeResult(
        optimizer.runOptimize(scenario, { method, seed }),
        method,
        scenario
      );
      if (data.error) {
        status.textContent = data.error;
        invalidateOptimizationResult();
        return;
      }
      lastResult = data;
      autoEntrancePreview = Array.isArray(data.veh_entrances) ? data.veh_entrances.slice() : null;
      scenario = data.scenario;
      ensureConstraints();
      ensureScenarioCollections();
      sanitizeScenarioGeometry();
      ensureVehicleDestinationsArray();
      ensureVehicleEntrancesArray();
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
        Number(data.gbest_value ?? 0).toFixed(2) + " " + uTime();
      updateChartCaption(opt === "exact" ? "exact" : undefined);
      drawChart(data.history_best || [], opt);
      renderBreakdownSummary();
      if (opt === "exact") {
        renderResultTip("当前为全局最优解，可将其作为 PSO 调参与精度对照基线。");
      } else {
        let tip = "建议：若偏差较高，可提高 n_particles 或 n_iter，再重新对比 Benchmark。";
        try {
          const exactBase = normalizeOptimizeResult(
            optimizer.runOptimize(JSON.parse(JSON.stringify(scenario)), { method: "exact" }),
            "exact",
            scenario
          );
          if (Number.isFinite(exactBase.gbest_value) && Number.isFinite(data.gbest_value)) {
            const gap =
              ((data.gbest_value - exactBase.gbest_value) /
                Math.max(1e-6, exactBase.gbest_value)) *
              100;
            tip =
              "相对 exact 偏差：" +
              gap.toFixed(2) +
              "%。 " +
              (gap <= 2
                ? "当前参数已较优，优先关注耗时。"
                : "建议先使用“参数推荐”获取更稳妥配置。");
          }
        } catch (_) {
          // ignore exact baseline failures in tip rendering
        }
        renderResultTip(tip);
      }
      switchTab("result");
      draw();
    } catch (e) {
      status.textContent = "网络错误";
      console.error(e);
      renderResultTip("");
    } finally {
      btn.disabled = false;
    }
  }

  function exportScenarioToFile() {
    if (!scenario) return;
    const payload = JSON.stringify(scenario, null, 2);
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "parking-scenario-" + ts + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  function readSnapshots() {
    return snapshotStore?.readItems ? snapshotStore.readItems() : [];
  }

  function writeSnapshots(items) {
    if (!snapshotStore?.writeItems) return false;
    const result = snapshotStore.writeItems(items);
    if (result && typeof result === "object" && result.ok === false) {
      const status = document.getElementById("result-status");
      if (status) {
        status.textContent =
          "保存快照失败：本地存储空间不足或不可用，请清理浏览器存储后重试。";
      }
      return false;
    }
    return true;
  }

  function isSnapshotScenarioValid(candidate) {
    if (!candidate || typeof candidate !== "object") return false;
    const lot = candidate.lot;
    const lotW = Number(lot?.width);
    const lotH = Number(lot?.height);
    if (!Number.isFinite(lotW) || !Number.isFinite(lotH) || lotW <= 0 || lotH <= 0) return false;
    if (!Array.isArray(candidate.slots) || !Array.isArray(candidate.buildings)) return false;
    const nVeh = Number.parseInt(candidate.n_veh, 10);
    if (!Number.isFinite(nVeh) || nVeh < 0) return false;
    return true;
  }

  function refreshSnapshotSelect() {
    const sel = document.getElementById("snapshot-select");
    if (!sel) return;
    const items = readSnapshots();
    sel.innerHTML = "";
    if (!items.length) {
      const opt = document.createElement("option");
      opt.value = "";
      opt.textContent = "（暂无快照）";
      sel.appendChild(opt);
      return;
    }
    items.forEach((it) => {
      const opt = document.createElement("option");
      opt.value = String(it.id);
      opt.textContent = it.name;
      sel.appendChild(opt);
    });
  }

  function saveSnapshot() {
    if (!scenario) return;
    const items = readSnapshots();
    const id = Date.now();
    const name = new Date(id).toLocaleString();
    items.unshift({ id, name, scenario: JSON.parse(JSON.stringify(scenario)) });
    if (writeSnapshots(items)) {
      refreshSnapshotSelect();
    }
  }

  function loadSnapshot() {
    const sel = document.getElementById("snapshot-select");
    if (!sel || !sel.value) return;
    const items = readSnapshots();
    const hit = items.find((it) => String(it.id) === String(sel.value));
    if (!hit) return;
    if (!isSnapshotScenarioValid(hit.scenario)) {
      document.getElementById("result-status").textContent = "快照数据结构无效，无法加载。";
      return;
    }
    try {
      const normalized = optimizer.normalizeScenario(hit.scenario);
      if (!isSnapshotScenarioValid(normalized)) {
        throw new Error("normalized snapshot invalid");
      }
      scenario = normalized;
      ensureConstraints();
      ensureScenarioCollections();
      sanitizeScenarioGeometry();
      ensureVehicleDestinationsArray();
      ensureVehicleEntrancesArray();
      rebuildVehicleTargetsUI();
      invalidateOptimizationResult();
      setSelection(null);
    } catch (error) {
      document.getElementById("result-status").textContent =
        "加载快照失败：数据损坏或与当前版本不兼容。";
      console.error(error);
    }
  }

  async function importScenarioFromFile(file) {
    if (!file) return;
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    scenario = optimizer.normalizeScenario(parsed);
    ensureConstraints();
    ensureScenarioCollections();
    sanitizeScenarioGeometry();
    ensureVehicleDestinationsArray();
    ensureVehicleEntrancesArray();
    rebuildVehicleTargetsUI();
    nVehInput.value = scenario.n_veh ?? 12;
    invalidateOptimizationResult();
    setSelection(null);
  }

  function runBenchmark() {
    if (!scenario || !optimizer || !analysisTools?.runBenchmark) return;
    const out = document.getElementById("benchmark-output");
    const runsEl = document.getElementById("benchmark-runs");
    const seedEl = document.getElementById("pso-seed");
    const runs = normalizeBenchmarkRuns(runsEl?.value || "6");
    if (runsEl) runsEl.value = String(runs);
    const baseSeed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : 1;
    benchmarkResult = analysisTools.runBenchmark({
      scenario,
      optimizer,
      normalizeOptimizeResult,
      runs,
      baseSeed,
      outputEl: out,
      timeUnit: uTime(),
    });
    if (out && runs >= MAX_BENCHMARK_RUNS) {
      out.textContent += "\n已触发上限：" + MAX_BENCHMARK_RUNS + " 次（防止页面卡顿）。";
    }
  }

  function recommendParams() {
    if (!scenario || !optimizer || !analysisTools?.recommendParams) return;
    const out = document.getElementById("recommend-output");
    const seedEl = document.getElementById("pso-seed");
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : 1;
    analysisTools.recommendParams({
      scenario,
      optimizer,
      normalizeOptimizeResult,
      seed,
      outputEl: out,
      timeUnit: uTime(),
    });
  }

  mapCanvas.addEventListener("pointerdown", (e) => {
    mapCanvas.setPointerCapture(e.pointerId);
    pointerDown(e);
  });
  mapCanvas.addEventListener("pointermove", pointerMove);
  mapCanvas.addEventListener("pointerup", pointerUp);
  mapCanvas.addEventListener("pointercancel", pointerUp);
  mapCanvas.addEventListener("pointerleave", () => {
    if (hoverTarget) {
      hoverTarget = null;
      draw();
    }
  });

  function wireAddModeToggle(btnId, mode) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (pendingAdd === "obstacle" && mode !== "obstacle") cancelObstacleDraft();
      if (pendingAdd === "road" && mode !== "road") cancelRoadDraft();
      pendingAdd = pendingAdd === mode ? null : mode;
      if (pendingAdd !== "obstacle") cancelObstacleDraft();
      if (pendingAdd !== "road") cancelRoadDraft();
      if (pendingAdd === "road") {
        const shapeSel = document.getElementById("road-shape-mode");
        roadDraftClosed = shapeSel
          ? shapeSel.value !== "open"
          : scenario?.road?.closed !== false;
      }
      document.getElementById("btn-add-building").classList.toggle("active", pendingAdd === "building");
      document.getElementById("btn-add-slot").classList.toggle("active", pendingAdd === "slot");
      const addEnt = document.getElementById("btn-add-entrance");
      const addObs = document.getElementById("btn-add-obstacle");
      const addRoad = document.getElementById("btn-add-road");
      if (addEnt) addEnt.classList.toggle("active", pendingAdd === "entrance");
      if (addObs) addObs.classList.toggle("active", pendingAdd === "obstacle");
      if (addRoad) addRoad.classList.toggle("active", pendingAdd === "road");
      draw();
    });
  }
  wireAddModeToggle("btn-add-building", "building");
  wireAddModeToggle("btn-add-slot", "slot");
  wireAddModeToggle("btn-add-entrance", "entrance");
  wireAddModeToggle("btn-add-obstacle", "obstacle");
  wireAddModeToggle("btn-add-road", "road");
  document.getElementById("btn-delete").addEventListener("click", deleteSelected);
  document.getElementById("btn-random-dest").addEventListener("click", randomizeVehicleDestinations);
  document.getElementById("btn-reset-scenario")?.addEventListener("click", resetScenario);
  document.getElementById("btn-run").addEventListener("click", runOptimize);
  document.getElementById("btn-export-scenario")?.addEventListener("click", exportScenarioToFile);
  document.getElementById("btn-save-snapshot")?.addEventListener("click", saveSnapshot);
  document.getElementById("btn-load-snapshot")?.addEventListener("click", loadSnapshot);
  document.getElementById("btn-run-benchmark")?.addEventListener("click", runBenchmark);
  document.getElementById("btn-recommend-params")?.addEventListener("click", recommendParams);
  document.querySelectorAll(".side-tab").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });
  document.getElementById("btn-veh-page-prev")?.addEventListener("click", () => {
    vehiclePage = Math.max(0, vehiclePage - 1);
    rebuildVehicleTargetsUI();
  });
  document.getElementById("btn-veh-page-next")?.addEventListener("click", () => {
    vehiclePage += 1;
    rebuildVehicleTargetsUI();
  });
  document.getElementById("btn-legend-toggle")?.addEventListener("click", (e) => {
    const legend = document.querySelector(".map-legend");
    if (!legend) return;
    const compact = legend.classList.toggle("is-compact");
    e.target.textContent = compact ? "展开完整图例" : "收起扩展图例";
  });
  document.getElementById("btn-add-entrance")?.addEventListener("click", () => switchTab("scene"));
  document.getElementById("btn-add-obstacle")?.addEventListener("click", () => switchTab("scene"));
  document.getElementById("btn-add-road")?.addEventListener("click", () => switchTab("scene"));
  document.getElementById("road-shape-mode")?.addEventListener("change", (e) => {
    roadDraftClosed = e.target.value !== "open";
  });
  document.getElementById("btn-add-building")?.addEventListener("click", () => switchTab("scene"));
  document.getElementById("btn-add-slot")?.addEventListener("click", () => switchTab("scene"));
  document.getElementById("entrance-mode")?.addEventListener("change", (e) => {
    scenario.entrance_mode = e.target.value === "fixed" ? "fixed" : "auto";
    rebuildVehicleTargetsUI();
    invalidateOptimizationResult();
  });
  const importInput = document.getElementById("scenario-import-input");
  document.getElementById("btn-import-scenario")?.addEventListener("click", () => importInput?.click());
  importInput?.addEventListener("change", async () => {
    try {
      if (importInput.files && importInput.files[0]) {
        await importScenarioFromFile(importInput.files[0]);
      }
    } catch (e) {
      console.error(e);
      document.getElementById("result-status").textContent = "导入场景失败，请检查 JSON 格式。";
    } finally {
      importInput.value = "";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (pendingAdd === "obstacle" && obstacleDraftPoints?.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelObstacleDraft();
        pendingAdd = null;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finalizeObstacleDraft();
        return;
      }
    }
    if (pendingAdd === "road" && roadDraftPoints?.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        cancelRoadDraft();
        pendingAdd = null;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        finalizeRoadDraft();
        return;
      }
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (document.activeElement?.tagName === "INPUT") return;
      deleteSelected();
    }
  });
  window.addEventListener("beforeunload", () => {
    persistCurrentStateNow();
  });

  const nVehInput = document.getElementById("n-veh");
  nVehInput?.addEventListener("change", () => {
    if (!scenario) return;
    let n = parseInt(nVehInput.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    scenario.n_veh = n;
    vehiclePage = 0;
    ensureVehicleDestinationsArray();
    ensureVehicleEntrancesArray();
    rebuildVehicleTargetsUI();
    invalidateOptimizationResult();
  });

  async function getDefaultScenarioSource() {
    if (!scenarioSource?.getDefaultScenarioSource) {
      return optimizer.defaultScenario();
    }
    return scenarioSource.getDefaultScenarioSource(() => optimizer.defaultScenario());
  }

  async function loadDefault(options = {}) {
    try {
      if (!optimizer || typeof optimizer.normalizeScenario !== "function") {
        throw new Error("optimizer module missing");
      }
      const forceDefault = options.forceDefault === true;
      let sourceScenario = null;
      let restored = false;
      if (!forceDefault) {
        const cached = readCurrentState();
        if (cached && cached.scenario) {
          sourceScenario = cached.scenario;
          restored = true;
          activeTab = String(cached.activeTab || "overview");
          vehiclePage = Number.isFinite(Number(cached.vehiclePage))
            ? Math.max(0, parseInt(cached.vehiclePage, 10))
            : 0;
        }
      }
      if (!sourceScenario) {
        sourceScenario = await getDefaultScenarioSource();
        activeTab = "overview";
        vehiclePage = 0;
      }
      scenario = optimizer.normalizeScenario(sourceScenario);
      ensureConstraints();
      ensureScenarioCollections();
      syncMapCanvasSize();
      fitLotToMapAspect();
      sanitizeScenarioGeometry();
      ensureVehicleDestinationsArray();
      ensureVehicleEntrancesArray();
      rebuildVehicleTargetsUI();
      lastResult = null;
      autoEntrancePreview = null;
      nVehInput.value = scenario.n_veh ?? 12;
      setSelection(null);
      document.getElementById("result-status").textContent =
        "尚未运行（总时间单位：" + uTime() + "）";
      document.getElementById("result-gbest").style.display = "none";
      drawChart([]);
      updateChartCaption("idle");
      refreshSnapshotSelect();
      renderBreakdownSummary();
      renderResultTip("");
      const legend = document.querySelector(".map-legend");
      const legendBtn = document.getElementById("btn-legend-toggle");
      const roadShapeMode = document.getElementById("road-shape-mode");
      if (legend) legend.classList.add("is-compact");
      if (legendBtn) legendBtn.textContent = "展开完整图例";
      roadDraftClosed = scenario?.road?.closed !== false;
      if (roadShapeMode) roadShapeMode.value = roadDraftClosed ? "closed" : "open";
      switchTab(restored ? activeTab : "overview");
      scheduleAutoEntrancePreviewRefresh();
      schedulePersistCurrentState();
      draw();
    } catch (e) {
      document.getElementById("result-status").textContent =
        "默认场景加载失败，请检查 assets/data/default-scenario.json 或 optimizer.js 是否可访问。";
      console.error(e);
    }
  }

  async function resetScenario() {
    const ok = window.confirm("确定重置为默认场景吗？当前未导出的改动将丢失。");
    if (!ok) return;
    clearPersistedCurrentState();
    await loadDefault({ forceDefault: true });
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
