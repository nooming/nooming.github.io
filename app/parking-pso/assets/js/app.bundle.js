/* bundled app from 53 files */
/* --- app\api\api-client.js --- */
(function () {
  "use strict";

  const PK_PREFIX = "/api/parking";

  function apiBase() {
    if (typeof window.PARKING_API_BASE === "string" && window.PARKING_API_BASE) {
      return window.PARKING_API_BASE.replace(/\/$/, "");
    }
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") {
      return "http://127.0.0.1:5000";
    }
    return "https://noomings-backend.zeabur.app";
  }

  async function request(path, options) {
    const base = apiBase();
    const url = (base || "") + path;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json", ...(options && options.headers) },
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "API " + res.status);
    }
    return data;
  }

  function wsUrlFor(path) {
    const base = apiBase();
    if (base) {
      const u = new URL(base, window.location.origin);
      const proto = u.protocol === "https:" ? "wss:" : "ws:";
      return proto + "//" + u.host + path;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + window.location.host + path;
  }

  window.ParkingApiClient = {
    apiBase,
    async health() {
      return request("/api/health");
    },
    async optimize(scenario, method, seed) {
      return request(PK_PREFIX + "/optimize", {
        method: "POST",
        body: JSON.stringify({ scenario, method, seed }),
      });
    },
    async listScenarios() {
      return request(PK_PREFIX + "/scenarios");
    },
    async saveScenario(name, scenario, metrics) {
      return request(PK_PREFIX + "/scenarios", {
        method: "POST",
        body: JSON.stringify({ name, scenario, metrics }),
      });
    },
    async getScenario(id) {
      return request(PK_PREFIX + "/scenarios/" + encodeURIComponent(id));
    },
    async deleteScenario(id) {
      return request(PK_PREFIX + "/scenarios/" + encodeURIComponent(id), { method: "DELETE" });
    },
    async compareScenarioIds(ids) {
      return request(PK_PREFIX + "/compare", {
        method: "POST",
        body: JSON.stringify({ scenario_ids: ids }),
      });
    },
    async autoSlots(scenario, count) {
      return request(PK_PREFIX + "/plan/auto-slots", {
        method: "POST",
        body: JSON.stringify({ scenario, count }),
      });
    },
    async suggestPlans(scenario) {
      return request(PK_PREFIX + "/plan/suggest", {
        method: "POST",
        body: JSON.stringify({ scenario }),
      });
    },
    async simulate(result, schedule, asyncMode) {
      return request(PK_PREFIX + "/simulate", {
        method: "POST",
        body: JSON.stringify({ result, schedule, async: asyncMode !== false }),
      });
    },
    async getJob(jobId) {
      return request(PK_PREFIX + "/jobs/" + encodeURIComponent(jobId));
    },
    watchJob(jobId, onMessage) {
      return new Promise((resolve, reject) => {
        let ws;
        try {
          ws = new WebSocket(
            wsUrlFor(PK_PREFIX + "/jobs/" + encodeURIComponent(jobId) + "/stream")
          );
        } catch (e) {
          reject(e);
          return;
        }
        ws.onmessage = (ev) => {
          let data = {};
          try {
            data = JSON.parse(ev.data);
          } catch (_) {
            /* ignore */
          }
          if (onMessage) onMessage(data);
          if (data.status === "completed") {
            ws.close();
            resolve(data);
          } else if (data.status === "failed" || data.status === "missing") {
            ws.close();
            reject(new Error(data.error || data.status || "job failed"));
          }
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch (_) {
            /* ignore */
          }
          reject(new Error("websocket error"));
        };
      });
    },
  };
})();

/* --- app\state\app-state.js --- */
(function () {
  "use strict";

  const mapCanvas = document.getElementById("map");
  const chartCanvas = document.getElementById("chart");
  const ctx = mapCanvas.getContext("2d");
  const cctx = chartCanvas.getContext("2d");

  const P = {
    mapCanvas,
    chartCanvas,
    ctx,
    cctx,
    CHART_BOTTOM_AXIS: 28,
    MAP_CANVAS_EDGE: 12,
    mapCssW: 720,
    mapCssH: 720,
    mapDpr: 1,
    chartCssW: 300,
    chartCssH: 168,
    chartDpr: 1,
    lastChartSeries: [],
    lastChartOptimizer: "pso",
    optimizer: window.ParkingOptimizer || null,
    api: window.ParkingApiClient || null,
    geometry: window.ParkingGeometry || null,
    roadModel: window.ParkingRoadModel || null,
    roadSnap: window.ParkingRoad || null,
    coreConstants: window.ParkingCoreConstants || null,
    tabUtils: window.ParkingTabUtils || null,
    storageFactory: window.ParkingAppStorage || null,
    scenarioSource: window.ParkingScenarioSource || null,
    analysisTools: window.ParkingAnalysis || null,
    RESULT_KEYS:
      window.ParkingCoreConstants?.RESULT_KEYS ||
      window.ParkingOptimizer?.RESULT_KEYS || [
        "scenario",
        "gbest_value",
        "history_best",
        "assign",
        "veh_targets",
        "veh_entrances",
        "vehicle_breakdown",
        "paths",
        "drive_paths",
        "road_segments",
        "optimizer",
      ],
    COLORS: {
      lotGradientTop: "#e4e9ef",
      lotGradientBot: "#b9c6d2",
      road: "#3a4352",
      roadEdge: "#2c3340",
      curb: "rgba(255, 255, 255, 0.78)",
      parkingStrip: "rgba(255, 255, 255, 0.38)",
      slotAsphalt: "#8b95a3",
      slotPaint: "#f1f5f9",
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
    },
    B: { bw: 18.0, bh: 12.0, sw: 5.3, sh: 2.6 },
    HIT_PAD: 0.5,
    SNAP_MARGIN: 0.45,
    DEFAULT_ROAD_WIDTH: 6.0,
    OVERLAP_EPS: 0.2,
    scenario: null,
    selection: null,
    pendingAdd: null,
    drag: null,
    lastResult: null,
    SNAPSHOT_STORAGE_KEY: "parking-pso-snapshots-v1",
    CURRENT_STATE_STORAGE_KEY: "parking-pso-current-state-v1",
    currentStateStore: null,
    snapshotStore: null,
    MAX_BENCHMARK_RUNS: 50,
    benchmarkResult: null,
    VEHICLE_PAGE_SIZE: 6,
    vehiclePage: 0,
    activeTab: "overview",
    autoEntrancePreview: null,
    autoEntrancePreviewTimer: null,
    autoEntrancePreviewVersion: 0,
    obstacleDraftPoints: null,
    obstacleDraftHover: null,
    obstacleDraftSnapStart: false,
    roadDraftPoints: null,
    roadDraftHover: null,
    roadDraftSnapStart: false,
    roadDraftClosed: true,
    obstacleNormalizeError: null,
    hoverTarget: null,
    hoverRafPending: false,
    propsEmpty: document.getElementById("props-empty"),
    propsForm: document.getElementById("props-form"),
    CHART_THEME: {
      bg: "#f8fafc",
      axisText: "#64748b",
      helperText: "#475569",
      line: "#0284c7",
      lineSoft: "rgba(2,132,199,0.32)",
      dotStroke: "#0369a1",
      labelText: "#0f172a",
    },
    importInput: document.getElementById("scenario-import-input"),
    nVehInput: document.getElementById("n-veh"),
    resizeChartTimer: null,
    MAX_LOT_SPAN: 2000,
    viewPanX: 0,
    viewPanY: 0,
    viewZoom: 1,
    panDrag: null,
    dragRafPending: false,
  };

  P.currentStateStore = P.storageFactory?.createStateStorage
    ? P.storageFactory.createStateStorage({
        storageKey: P.CURRENT_STATE_STORAGE_KEY,
        debounceMs: 450,
      })
    : null;
  P.snapshotStore = P.storageFactory?.createSnapshotStorage
    ? P.storageFactory.createSnapshotStorage(P.SNAPSHOT_STORAGE_KEY, 20)
    : null;
  P.MAX_BENCHMARK_RUNS = P.analysisTools?.MAX_BENCHMARK_RUNS || 50;

  P._closestPointOnSegment = function (px, py, x1, y1, x2, y2) {
    if (P.geometry?.closestPointOnSegment) {
      return P.geometry.closestPointOnSegment(px, py, x1, y1, x2, y2);
    }
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-18) return [x1, y1];
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return [x1 + t * dx, y1 + t * dy];
  };

  P._pointInPolygon = function (px, py, poly, includeBoundary = true) {
    if (P.geometry?.pointInPolygon) {
      return P.geometry.pointInPolygon([px, py], poly, includeBoundary);
    }
    return false;
  };

  P._segmentsIntersect2D = function (a, b, c, d, eps = 1e-6) {
    if (P.geometry?.segmentsIntersect) {
      return P.geometry.segmentsIntersect(a, b, c, d, eps);
    }
    return false;
  };

  P._pointOnSegment2D = function (px, py, ax, ay, bx, by, eps = 1e-6) {
    if (P.geometry?.pointOnSegment) {
      return P.geometry.pointOnSegment([px, py], [ax, ay], [bx, by], eps);
    }
    return false;
  };

  P._segmentIntersectsPolygon = function (a, b, poly) {
    if (P.geometry?.segmentIntersectsPolygon) {
      return P.geometry.segmentIntersectsPolygon(a, b, poly);
    }
    return false;
  };

  window.ParkingAppState = P;
  window.ParkingApp = P;
})();

/* --- app\scenario\default-source.js --- */
(function () {
  "use strict";

  async function getDefaultScenarioSource(fallbackScenarioFactory) {
    try {
      const res = await fetch("assets/data/default-scenario.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (error) {
      console.warn("default scenario fetch failed, fallback in use", error);
      return typeof fallbackScenarioFactory === "function" ? fallbackScenarioFactory() : null;
    }
  }

  window.ParkingScenarioSource = {
    getDefaultScenarioSource,
  };
})();

/* --- app\scenario\collections.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/collections.js");

P.normalizeAngle = function (theta) {
    const fn = P.roadSnap?.normalizeAngle || window.ParkingRoad?.normalizeAngle;
    if (fn) return fn(theta);
    const t = Number(theta);
    if (!Number.isFinite(t)) return 0;
    let out = t;
    while (out <= -Math.PI) out += Math.PI * 2;
    while (out > Math.PI) out -= Math.PI * 2;
    return out;
  }

P.normalizeSlotEntry = function (rawSlot) {
    const x = Number(rawSlot?.[0]);
    const y = Number(rawSlot?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y, P.normalizeAngle(rawSlot?.[2] ?? 0)];
  }

P.slotPoseOf = function (slotLike) {
    const s = P.normalizeSlotEntry(slotLike);
    if (!s) return null;
    return { x: s[0], y: s[1], theta: s[2] };
  }

P.ensureScenarioCollections = function () {
    if (!P.scenario) return;
    if (!Array.isArray(P.scenario.entrances) || !P.scenario.entrances.length) {
      P.scenario.entrances = [Array.isArray(P.scenario.entrance) ? P.scenario.entrance.slice(0, 2) : [22, 18]];
    }
    if (!Array.isArray(P.scenario.obstacles)) {
      P.scenario.obstacles = P.scenario.obstacle ? [P.normalizeObstacleShape(P.scenario.obstacle)] : [];
    }
    if (!Array.isArray(P.scenario.slots)) {
      P.scenario.slots = [];
    }
    P.scenario.entrances = P.scenario.entrances.map((e) => [Number(e?.[0] || 0), Number(e?.[1] || 0)]);
    P.scenario.obstacles = P.scenario.obstacles
      .map((o) => P.normalizeObstacleShape(o))
      .filter((o) => !!o);
    P.scenario.slots = P.scenario.slots
      .map((s) => P.normalizeSlotEntry(s))
      .filter((s) => !!s);
    P.scenario.entrance = P.scenario.entrances[0];
    if (P.scenario.obstacles.length) {
      const b = P.obstacleBoundsFromPoints(P.scenario.obstacles[0].points);
      P.scenario.obstacle = b ? { x_min: b.xmin, x_max: b.xmax, y_min: b.ymin, y_max: b.ymax } : null;
    } else {
      P.scenario.obstacle = null;
    }
    P.ensureRoadStructure();
  }

P.ensureVehicleEntrancesArray = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const ne = Math.max(1, P.scenario.entrances.length);
    if (!Array.isArray(P.scenario.vehicle_entrances)) {
      P.scenario.vehicle_entrances = Array.from({ length: n }, () => 0);
    }
    while (P.scenario.vehicle_entrances.length < n) P.scenario.vehicle_entrances.push(0);
    if (P.scenario.vehicle_entrances.length > n) P.scenario.vehicle_entrances.length = n;
    P.scenario.vehicle_entrances = P.scenario.vehicle_entrances.map((v) => {
      const iv = parseInt(v, 10);
      return Number.isFinite(iv) ? Math.max(0, Math.min(ne - 1, iv)) : 0;
    });
    P.scenario.entrance_mode =
      String(P.scenario.entrance_mode || "auto").toLowerCase() === "fixed" ? "fixed" : "auto";
  }

P.obstacleBoundsFromPoints = function (points) {
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

P.polygonSignedArea = function (points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let s = 0;
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      s += Number(a[0]) * Number(b[1]) - Number(b[0]) * Number(a[1]);
    }
    return s / 2;
  }

P.pointsNear = function (a, b, eps = 1e-6) {
    return Math.hypot(Number(a?.[0]) - Number(b?.[0]), Number(a?.[1]) - Number(b?.[1])) <= eps;
  }

P.obstaclePolygons = function () {
    P.ensureScenarioCollections();
    return P.scenario.obstacles.map((o) => o.points);
  }

  P._pointOnSegment2D = function (px, py, ax, ay, bx, by, eps = 1e-6) {
    return P.geometry?.pointOnSegment
      ? P.geometry.pointOnSegment([px, py], [ax, ay], [bx, by], eps)
      : false;
  }

  P._segmentsIntersect2D = function (a, b, c, d, eps = 1e-6) {
    return P.geometry?.segmentsIntersect ? P.geometry.segmentsIntersect(a, b, c, d, eps) : false;
  }
})();

/* --- app\scenario\road-edit.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/road-edit.js");

P.buildRoadFromInner = function (inner, width = P.DEFAULT_ROAD_WIDTH) {
    const fn = P.roadModel?.roadFromInner || window.ParkingRoadModel?.roadFromInner;
    if (fn) return fn(inner, width);
    return {
      centerline: [
        [Number(inner.x_min), Number(inner.y_min)],
        [Number(inner.x_max), Number(inner.y_min)],
        [Number(inner.x_max), Number(inner.y_max)],
        [Number(inner.x_min), Number(inner.y_max)],
        [Number(inner.x_min), Number(inner.y_min)],
      ],
      width: Number(width) || P.DEFAULT_ROAD_WIDTH,
      closed: true,
    };
  }

P.roadInnerBounds = function (road) {
    const fn = P.roadModel?.innerFromRoad || window.ParkingRoadModel?.innerFromRoad;
    if (fn) return fn(road);
    const pts = road?.centerline || [];
    let xmin = Infinity, xmax = -Infinity, ymin = Infinity, ymax = -Infinity;
    for (const p of pts) {
      const x = Number(p?.[0]), y = Number(p?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xmin = Math.min(xmin, x); xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y); ymax = Math.max(ymax, y);
    }
    if (![xmin, xmax, ymin, ymax].every((v) => Number.isFinite(v))) return null;
    return { x_min: xmin, x_max: xmax, y_min: ymin, y_max: ymax };
  }

P.setRoadClosed = function (closed) {
    if (!P.scenario?.road) return;
    const pts = Array.isArray(P.scenario.road.centerline) ? P.scenario.road.centerline : [];
    if (pts.length < 2) {
      P.scenario.road.closed = closed;
      return;
    }
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (closed) {
      if (!P.pointsNear(first, last)) pts.push([Number(first[0]), Number(first[1])]);
    } else if (P.pointsNear(first, last) && pts.length > 2) {
      pts.pop();
    }
    P.scenario.road.closed = closed;
  }

P.syncClosedRoadEndpoint = function (points, editedIndex) {
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

P.normalizeRoadShape = function (rawRoad, fallbackInner) {
    let road = rawRoad && typeof rawRoad === "object" ? JSON.parse(JSON.stringify(rawRoad)) : null;
    if (!road || !Array.isArray(road.centerline) || road.centerline.length < 2) {
      road = P.buildRoadFromInner(fallbackInner || P.scenario?.inner || { x_min: 22, x_max: 78, y_min: 18, y_max: 82 });
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
      if (!P.pointsNear(first, last, 1e-6)) {
        pts.push([Number(first[0]), Number(first[1])]);
      } else {
        pts[pts.length - 1] = [Number(first[0]), Number(first[1])];
      }
    } else if (pts.length > 2 && P.pointsNear(pts[0], pts[pts.length - 1], 1e-6)) {
      pts.pop();
    }
    const segs = (P.geometry?.toRoadSegmentsFromCenterline
      ? P.geometry.toRoadSegmentsFromCenterline(pts)
      : []);
    if (!segs.length) return null;
    return {
      centerline: pts,
      width: Math.max(2.4, Number(road.width || P.DEFAULT_ROAD_WIDTH)),
      closed: road.closed !== false,
    };
  }

P.ensureRoadStructure = function () {
    if (!P.scenario) return;
    const normalized = P.normalizeRoadShape(P.scenario.road, P.scenario.inner);
    if (normalized) P.scenario.road = normalized;
    else P.scenario.road = P.buildRoadFromInner(P.scenario.inner || { x_min: 22, x_max: 78, y_min: 18, y_max: 82 });
    const bounds = P.roadInnerBounds(P.scenario.road);
    if (bounds) P.scenario.inner = bounds;
  }

  /** 可行驶道路中心线段 [x1,y1,x2,y2] */

P.innerBoundarySegments = function (roadLike) {
    const source = roadLike?.centerline ? { road: roadLike } : { road: P.scenario?.road, inner: roadLike || P.scenario?.inner };
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments(source) : [];
    return segs.map((seg) => [seg[0][0], seg[0][1], seg[1][0], seg[1][1]]);
  }

P.buildRoadSegmentsLocal = function (road) {
    if (P.geometry?.buildRoadSegments) return P.geometry.buildRoadSegments({ road, inner: P.scenario?.inner });
    return [];
  }

P.tryApplyRoadUpdate = function (mutator) {
    if (!P.scenario?.road) return false;
    const prevRoad = JSON.parse(JSON.stringify(P.scenario.road));
    mutator();
    P.ensureRoadStructure();
    const check = P.validateRoadNoOverlap();
    if (!check.ok) {
      P.scenario.road = prevRoad;
      P.ensureRoadStructure();
      P.notifyRoadGeometryInvalid(check.reason);
      return false;
    }
    P.sanitizeScenarioGeometry();
    P.invalidateOptimizationResult();
    return true;
  }

P.validateRoadNoOverlap = function () {
    if (!P.scenario) return { ok: true };
    if (!P.roadFitsInLot(P.scenario.road)) return { ok: false, reason: "outside_lot" };
    for (const poly of P.obstaclePolygons()) {
      if (P.polygonOverlapsInnerRoad(poly)) return { ok: false, reason: "overlap_obstacle" };
    }
    for (let i = 0; i < (P.scenario.buildings || []).length; i++) {
      const b = P.scenario.buildings[i];
      if (P.polygonOverlapsInnerRoad(P.rectToPolygon(P.buildingRectAt(Number(b[0]), Number(b[1]))))) {
        return { ok: false, reason: "overlap_building" };
      }
    }
    return { ok: true };
  }
})();

/* --- app\scenario\obstacle-edit.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/obstacle-edit.js");

P.normalizeObstacleShape = function (raw) {
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
    if (P.polygonHasSelfIntersection(filtered)) return null;
    const area = Math.abs(P.polygonSignedArea(filtered));
    if (area < 0.05) return null;
    return { points: filtered };
  }

P.defaultObstacleShape = function () {
    return P.normalizeObstacleShape({ x_min: 44, x_max: 56, y_min: 30, y_max: 70 });
  }

P.normalizeObstacleInner = function () {
    P.obstacleNormalizeError = null;
    P.ensureScenarioCollections();
    const normalized = P.scenario.obstacles
      .map((o) => P.normalizeObstacleShape(o))
      .filter((o) => !!o);
    if (normalized.length !== P.scenario.obstacles.length) {
      P.obstacleNormalizeError = "self_intersect";
      return false;
    }
    for (let i = 0; i < normalized.length; i++) {
      for (let j = i + 1; j < normalized.length; j++) {
        if (P.polygonsOverlap(normalized[i].points, normalized[j].points)) {
          P.obstacleNormalizeError = "overlap";
          return false;
        }
      }
      if (P.polygonOverlapsInnerRoad(normalized[i].points)) {
        P.obstacleNormalizeError = "overlap_road";
        return false;
      }
      if (P.polygonOverlapsSceneElements(normalized[i].points)) {
        P.obstacleNormalizeError = "overlap_element";
        return false;
      }
      if (!P.pointsFitInLot(normalized[i].points, 0)) {
        P.obstacleNormalizeError = "outside_lot";
        return false;
      }
    }
    P.scenario.obstacles = normalized;
    P.ensureRoadStructure();
    if (P.scenario.obstacles.length) {
      const b = P.obstacleBoundsFromPoints(P.scenario.obstacles[0].points);
      P.scenario.obstacle = b ? { x_min: b.xmin, x_max: b.xmax, y_min: b.ymin, y_max: b.ymax } : null;
    } else {
      P.scenario.obstacle = null;
    }
    return true;
  }

P.clonePoints = function (points) {
    return (points || []).map((p) => [Number(p[0]), Number(p[1])]);
  }

P.interpolatePoints = function (fromPoints, toPoints, t) {
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

P.trySetObstaclePoints = function (obstacleIndex, nextPoints) {
    const o = P.scenario?.obstacles?.[obstacleIndex];
    if (!o) return false;
    const prev = P.clonePoints(o.points);
    o.points = P.clonePoints(nextPoints);
    const ok = P.normalizeObstacleInner();
    if (!ok) {
      o.points = prev;
      P.obstacleNormalizeError = null;
      return false;
    }
    return true;
  }

P.moveObstaclePointsToward = function (obstacleIndex, currentPoints, targetPoints, iters = 14) {
    if (P.trySetObstaclePoints(obstacleIndex, targetPoints)) return true;
    let lo = 0;
    let hi = 1;
    let moved = false;
    for (let i = 0; i < iters; i++) {
      if (hi - lo < 1e-9) break;
      const mid = (lo + hi) / 2;
      const cand = P.interpolatePoints(currentPoints, targetPoints, mid);
      if (P.trySetObstaclePoints(obstacleIndex, cand)) {
        lo = mid;
        moved = true;
      } else {
        hi = mid;
      }
    }
    return moved;
  }
})();

/* --- app\scenario\collision.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/collision.js");

P.rectsOverlap = function (a, b, pad = 0) {
    return !(
      a.xmin + a.w + pad <= b.xmin ||
      b.xmin + b.w + pad <= a.xmin ||
      a.ymin + a.h + pad <= b.ymin ||
      b.ymin + b.h + pad <= a.ymin
    );
  }

P.pointInsideRect = function (px, py, r, pad = 0) {
    return (
      px >= r.xmin - pad &&
      px <= r.xmin + r.w + pad &&
      py >= r.ymin - pad &&
      py <= r.ymin + r.h + pad
    );
  }

P.polygonHasSelfIntersection = function (poly) {
    return P.geometry?.polygonSelfIntersects ? P.geometry.polygonSelfIntersects(poly) : false;
  }

P.polygonsOverlap = function (polyA, polyB) {
    if (!Array.isArray(polyA) || !Array.isArray(polyB) || polyA.length < 3 || polyB.length < 3) return false;
    for (let i = 0; i < polyA.length; i++) {
      const a1 = polyA[i];
      const a2 = polyA[(i + 1) % polyA.length];
      for (let j = 0; j < polyB.length; j++) {
        const b1 = polyB[j];
        const b2 = polyB[(j + 1) % polyB.length];
        if (P._segmentsIntersect2D(a1, a2, b1, b2)) return true;
      }
    }
    if (P._pointInPolygon(polyA[0][0], polyA[0][1], polyB, true)) return true;
    if (P._pointInPolygon(polyB[0][0], polyB[0][1], polyA, true)) return true;
    return false;
  }

P.polygonOverlapsSceneElements = function (poly) {
    if (!Array.isArray(poly) || poly.length < 3 || !P.scenario) return false;
    for (let i = 0; i < (P.scenario.buildings || []).length; i++) {
      const b = P.scenario.buildings[i];
      if (P.rectIntersectsPolygon(P.buildingRectAt(Number(b[0]), Number(b[1])), poly)) return true;
    }
    for (let i = 0; i < (P.scenario.slots || []).length; i++) {
      const pose = P.slotPoseOf(P.scenario.slots[i]);
      if (!pose) continue;
      if (P.polygonsOverlap(P.slotPolygonAt(pose.x, pose.y, pose.theta), poly)) return true;
    }
    for (let i = 0; i < (P.scenario.entrances || []).length; i++) {
      const e = P.scenario.entrances[i];
      if (P._pointInPolygon(Number(e[0]), Number(e[1]), poly, true)) return true;
    }
    return false;
  }

P.rectIntersectsPolygon = function (r, poly) {
    const corners = [
      [r.xmin, r.ymin],
      [r.xmin + r.w, r.ymin],
      [r.xmin + r.w, r.ymin + r.h],
      [r.xmin, r.ymin + r.h],
    ];
    for (const [x, y] of corners) {
      if (P._pointInPolygon(x, y, poly, true)) return true;
    }
    for (const p of poly) {
      if (P.pointInsideRect(Number(p[0]), Number(p[1]), r, 0)) return true;
    }
    for (let i = 0; i < corners.length; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % corners.length];
      if (P._segmentIntersectsPolygon(a, b, poly)) return true;
    }
    return false;
  }

P.rectToPolygon = function (r) {
    return [
      [r.xmin, r.ymin],
      [r.xmin + r.w, r.ymin],
      [r.xmin + r.w, r.ymin + r.h],
      [r.xmin, r.ymin + r.h],
    ];
  }

P.polygonOverlapsInnerRoad = function (poly, clearance = 1.05) {
    if (!Array.isArray(poly) || poly.length < 3 || !P.scenario) return false;
    const segs = P.innerBoundarySegments(P.scenario.road || P.scenario.inner);
    const effClearance = Math.max(clearance, Number(P.scenario?.road?.width || P.DEFAULT_ROAD_WIDTH) / 2);
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i];
      for (let s = 0; s < segs.length; s++) {
        const [x1, y1, x2, y2] = segs[s];
        if (P.distPointToSeg(Number(p[0]), Number(p[1]), x1, y1, x2, y2) <= effClearance) return true;
      }
    }
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      for (let s = 0; s < segs.length; s++) {
        const [x1, y1, x2, y2] = segs[s];
        if (P._segmentsIntersect2D(a, b, [x1, y1], [x2, y2])) return true;
      }
    }
    for (let s = 0; s < segs.length; s++) {
      const [x1, y1, x2, y2] = segs[s];
      if (P._pointInPolygon((x1 + x2) / 2, (y1 + y2) / 2, poly, true)) return true;
    }
    return false;
  }

P.buildingRectAt = function (cx, cy) {
    return { xmin: cx - P.B.bw / 2, ymin: cy - P.B.bh / 2, w: P.B.bw, h: P.B.bh };
  }

  // Slide element from (cx0,cy0) toward (cx1,cy1), hugging obstacles on each axis independently.

P.slideToward = function (cx0, cy0, cx1, cy1, canFn) {
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

P.canPlaceSlot = function (cx, cy, ignoreIndex = -1) {
    if (!P.slotFitsInLot(cx, cy, P.slotThetaAt(cx, cy))) return false;
    const theta = P.slotThetaAt(cx, cy);
    const slotPoly = P.slotPolygonAt(cx, cy, theta);
    if (P.polygonOverlapsInnerRoad(slotPoly, Number(P.scenario?.road?.width || P.DEFAULT_ROAD_WIDTH) / 2 - 0.05)) return false;
    for (const poly of P.obstaclePolygons()) {
      if (P.polygonsOverlap(slotPoly, poly)) return false;
    }
    for (let i = 0; i < P.scenario.buildings.length; i++) {
      const [bx, by] = P.scenario.buildings[i];
      if (P.polygonsOverlap(slotPoly, P.rectToPolygon(P.buildingRectAt(bx, by)))) return false;
    }
    for (let i = 0; i < P.scenario.slots.length; i++) {
      if (i === ignoreIndex) continue;
      const pose = P.slotPoseOf(P.scenario.slots[i]);
      if (!pose) continue;
      if (P.polygonsOverlap(slotPoly, P.slotPolygonAt(pose.x, pose.y, pose.theta))) return false;
    }
    for (const ent of P.scenario.entrances) {
      if (P._pointInPolygon(Number(ent[0]), Number(ent[1]), slotPoly, true)) return false;
    }
    return true;
  }

P.canPlaceEntrance = function (wx, wy) {
    if (!P.pointInLot(wx, wy, 0)) return false;
    for (const poly of P.obstaclePolygons()) {
      if (P._pointInPolygon(wx, wy, poly, true)) return false;
    }
    for (let i = 0; i < P.scenario.buildings.length; i++) {
      const [bx, by] = P.scenario.buildings[i];
      if (P.pointInsideRect(wx, wy, P.buildingRectAt(bx, by), 0.12)) return false;
    }
    for (let i = 0; i < P.scenario.slots.length; i++) {
      const pose = P.slotPoseOf(P.scenario.slots[i]);
      if (!pose) continue;
      if (P._pointInPolygon(wx, wy, P.slotPolygonAt(pose.x, pose.y, pose.theta), true)) return false;
    }
    return true;
  }

  // Pure read-only check: can the obstacle at obstacleIndex be placed at newPoints?
  // Mirrors P.normalizeObstacleInner() checks without mutating P.scenario state.

P.canPlaceObstacleAt = function (obstacleIndex, newPoints) {
    const shape = P.normalizeObstacleShape({ points: newPoints });
    if (!shape) return false;
    const poly = shape.points;
    if (!P.pointsFitInLot(poly, 0)) return false;
    for (let i = 0; i < (P.scenario.obstacles || []).length; i++) {
      if (i === obstacleIndex) continue;
      if (P.polygonsOverlap(poly, P.scenario.obstacles[i].points)) return false;
    }
    if (P.polygonOverlapsInnerRoad(poly)) return false;
    if (P.polygonOverlapsSceneElements(poly)) return false;
    return true;
  }

P.canPlaceBuilding = function (cx, cy, ignoreIndex = -1) {
    const r = P.buildingRectAt(cx, cy);
    const rPoly = P.rectToPolygon(r);
    if (P.polygonOverlapsInnerRoad(P.rectToPolygon(r))) return false;
    for (const poly of P.obstaclePolygons()) {
      if (P.rectIntersectsPolygon(r, poly)) return false;
    }
    for (let i = 0; i < P.scenario.buildings.length; i++) {
      if (i === ignoreIndex) continue;
      const [bx, by] = P.scenario.buildings[i];
      if (P.rectsOverlap(r, P.buildingRectAt(bx, by), P.OVERLAP_EPS)) return false;
    }
    for (let i = 0; i < P.scenario.slots.length; i++) {
      const pose = P.slotPoseOf(P.scenario.slots[i]);
      if (!pose) continue;
      if (P.polygonsOverlap(rPoly, P.slotPolygonAt(pose.x, pose.y, pose.theta))) return false;
    }
    for (const ent of P.scenario.entrances) {
      if (P.pointInsideRect(ent[0], ent[1], r, 0.25)) return false;
    }
    return true;
  }

P.findNearestValidBuildingPosition = function (x, y, ignoreIndex = -1) {
    const base = P.clampBuildingCenter(x, y);
    if (P.canPlaceBuilding(base.wx, base.wy, ignoreIndex)) return base;
    const angleN = 20;
    const ringN = 14;
    const step = Math.max(0.8, Math.min(P.B.sh, P.B.bh) * 0.45);
    for (let r = 1; r <= ringN; r++) {
      const radius = r * step;
      for (let k = 0; k < angleN; k++) {
        const a = (Math.PI * 2 * k) / angleN;
        const c = P.clampBuildingCenter(base.wx + radius * Math.cos(a), base.wy + radius * Math.sin(a));
        if (P.canPlaceBuilding(c.wx, c.wy, ignoreIndex)) return c;
      }
    }
    return null;
  }

P.nearestValidEntrancePoint = function (x, y) {
    const segs = P.innerBoundarySegments(P.scenario.road || P.scenario.inner);
    let best = null;
    let bestD = Infinity;
    for (const [x1, y1, x2, y2] of segs) {
      const samples = 72;
      for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        if (!P.canPlaceEntrance(px, py)) continue;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = { wx: px, wy: py };
        }
      }
    }
    return best;
  }
})();

/* --- app\scenario\snap.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/snap.js");

P.snapEntranceToInner = function (x, y) {
    P.ensureRoadStructure();
    const proj = P.geometry?.projectPointToRoad
      ? P.geometry.projectPointToRoad(x, y, { road: P.scenario.road })
      : null;
    return P.clampWorld(proj?.point?.[0] ?? x, proj?.point?.[1] ?? y);
  }

P.snapSlotToRoad = function (x, y) {
    const strips = P.getParkingStripDefs();
    if (!strips.length) {
      const p = P.clampWorld(x, y);
      return { wx: p.wx, wy: p.wy, theta: 0 };
    }
    let bestX = x;
    let bestY = y;
    let bestTheta = 0;
    let bestD = 1e30;
    for (const s of strips) {
      const q = P._closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      const d = (x - q.qx) ** 2 + (y - q.qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = q.qx;
        bestY = q.qy;
        bestTheta = s.theta;
      }
    }
    const p = P.clampWorld(bestX, bestY);
    return { wx: p.wx, wy: p.wy, theta: bestTheta };
  }

P.getParkingStripDefs = function () {
    P.ensureRoadStructure();
    const margin = P.SNAP_MARGIN;
    const strips = [];
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments({ road: P.scenario.road }) : [];
    const roadWidth = Math.max(2.4, Number(P.scenario.road?.width || P.DEFAULT_ROAD_WIDTH));
    const offset = roadWidth / 2 + P.B.sh / 2 + margin;
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
          x1: Math.max(P.lotX0() + P.B.sw / 2 + 0.05, Math.min(P.lotX1() - P.B.sw / 2 - 0.05, x1)),
          y1: Math.max(P.lotY0() + P.B.sw / 2 + 0.05, Math.min(P.lotY1() - P.B.sw / 2 - 0.05, y1)),
          x2: Math.max(P.lotX0() + P.B.sw / 2 + 0.05, Math.min(P.lotX1() - P.B.sw / 2 - 0.05, x2)),
          y2: Math.max(P.lotY0() + P.B.sw / 2 + 0.05, Math.min(P.lotY1() - P.B.sw / 2 - 0.05, y2)),
          tx: dx / len,
          ty: dy / len,
          theta: Math.atan2(dy, dx),
          len: Math.hypot(x2 - x1, y2 - y1),
        });
      }
    }
    return strips;
  }

P.nearestStripForPoint = function (x, y) {
    const strips = P.getParkingStripDefs();
    if (!strips.length) return null;
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments({ road: P.scenario?.road }) : [];
    let segIndex = -1;
    let bestCenterD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const d = P.distPointToSeg(x, y, a[0], a[1], b[0], b[1]);
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
      const d = P.distPointToSeg(x, y, s.x1, s.y1, s.x2, s.y2);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

P.slotScalarOnStrip = function (def, x, y) {
    const len = Math.max(1e-9, Number(def?.len || 0));
    const tx = Number(def?.tx || 0);
    const ty = Number(def?.ty || 0);
    return ((x - def.x1) * tx + (y - def.y1) * ty) / len;
  }

P.slotPointFromScalar = function (def, tNorm) {
    const t = Math.max(0, Math.min(1, tNorm));
    return {
      wx: def.x1 + (def.x2 - def.x1) * t,
      wy: def.y1 + (def.y2 - def.y1) * t,
      theta: def.theta,
    };
  }

P.stripBaseId = function (stripId) {
    return String(stripId || "").replace(/-(l|r)$/, "");
  }

P.getSiblingStrip = function (def) {
    if (!def?.id) return null;
    const strips = P.getParkingStripDefs();
    const base = P.stripBaseId(def.id);
    return strips.find((s) => s.id !== def.id && P.stripBaseId(s.id) === base) || null;
  }

P.suggestUniformSlotPosition = function (x, y, ignoreIndex = -1) {
    const snapped = P.snapSlotToRoad(x, y);
    const primaryLane = P.nearestStripForPoint(snapped.wx, snapped.wy);
    if (!primaryLane) return P.canPlaceSlot(snapped.wx, snapped.wy, ignoreIndex) ? snapped : null;
    const siblingLane = P.getSiblingStrip(primaryLane);
    const laneCandidates = [primaryLane];
    if (siblingLane) {
      const dPrimary = P.distPointToSeg(
        snapped.wx,
        snapped.wy,
        primaryLane.x1,
        primaryLane.y1,
        primaryLane.x2,
        primaryLane.y2
      );
      const dSibling = P.distPointToSeg(
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
      const endInset = (P.B.sw / 2 + 0.08) / Math.max(1e-9, lane.len);
      const laneStart = endInset;
      const laneEnd = 1 - endInset;
      if (laneEnd <= laneStart + 1e-5) continue;
      const desired = Math.max(
        laneStart,
        Math.min(laneEnd, P.slotScalarOnStrip(lane, snapped.wx, snapped.wy))
      );
      const occupied = [];
      for (let i = 0; i < P.scenario.slots.length; i++) {
        if (i === ignoreIndex) continue;
        const [sx, sy] = P.scenario.slots[i];
        const sideLane = P.nearestStripForPoint(sx, sy);
        if (!sideLane || sideLane.id !== lane.id) continue;
        occupied.push(P.slotScalarOnStrip(lane, sx, sy));
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
        const p = P.slotPointFromScalar(lane, t);
        if (P.canPlaceSlot(p.wx, p.wy, ignoreIndex)) return p;
      }
    }
    return null;
  }

P.applySnapToSlot = function (i) {
    const p = P.suggestUniformSlotPosition(P.scenario.slots[i][0], P.scenario.slots[i][1], i);
    if (!p) return false;
    P.scenario.slots[i][0] = p.wx;
    P.scenario.slots[i][1] = p.wy;
    P.scenario.slots[i][2] = P.normalizeAngle(p.theta ?? P.scenario.slots[i][2] ?? 0);
    return true;
  }

P.applySnapToAllSlots = function () {
    if (!P.scenario?.slots?.length) return;
    P.scenario.slots.forEach((_, i) => P.applySnapToSlot(i));
  }

P.tryPlaceSlotOnLane = function (lane, tNorm, occupiedByLane) {
    if (!lane) return null;
    const endInset = (P.B.sw / 2 + 0.08) / Math.max(1e-9, lane.len);
    const laneStart = endInset;
    const laneEnd = 1 - endInset;
    if (laneEnd <= laneStart + 1e-5) return null;
    const t = Math.max(laneStart, Math.min(laneEnd, tNorm));
    const pitch = P.B.sw + 0.4;
    const minNormGap = pitch / Math.max(1e-9, lane.len);
    const occ = occupiedByLane.get(lane.id) || [];
    for (const ot of occ) {
      if (Math.abs(ot - t) * lane.len < pitch - 0.1) return null;
    }
    const p = P.slotPointFromScalar(lane, t);
    if (!P.canPlaceSlot(p.wx, p.wy, -1)) return null;
    return { ...p, lane, t };
  };

P.generateSlotsAlongStrips = function (count, options = {}) {
    if (!P.scenario) return { slots: [], requested: 0, placed: 0, skipped: 0 };
    const strips = P.getParkingStripDefs();
    const requested = Math.max(1, parseInt(count, 10) || P.scenario.n_veh || 12);
    if (!strips.length) return { slots: [], requested, placed: 0, skipped: requested };

    P.scenario.slots = [];
    const slots = [];
    const occupiedByLane = new Map();
    let skipped = 0;
    const per = Math.max(1, Math.ceil(requested / strips.length));
    const pitch = P.B.sw + 0.4;

    for (const lane of strips) {
      if (slots.length >= requested) break;
      const fit = Math.max(1, Math.floor(lane.len / pitch));
      const use = Math.min(per, fit);
      for (let k = 0; k < use && slots.length < requested; k++) {
        const tCenter = (k + 0.5) / use;
        let placed = P.tryPlaceSlotOnLane(lane, tCenter, occupiedByLane);
        if (!placed) {
          const sibling = P.getSiblingStrip(lane);
          if (sibling) placed = P.tryPlaceSlotOnLane(sibling, tCenter, occupiedByLane);
        }
        if (!placed) {
          const seed = P.slotPointFromScalar(lane, tCenter);
          const resolved = P.suggestUniformSlotPosition(seed.wx, seed.wy, -1);
          if (resolved) {
            const laneUsed = P.nearestStripForPoint(resolved.wx, resolved.wy);
            placed = laneUsed
              ? {
                  ...resolved,
                  lane: laneUsed,
                  t: P.slotScalarOnStrip(laneUsed, resolved.wx, resolved.wy),
                }
              : { ...resolved, lane, t: tCenter };
          }
        }
        if (placed) {
          const theta = P.normalizeAngle(placed.theta ?? lane.theta ?? 0);
          const slot = [placed.wx, placed.wy, theta];
          slots.push(slot);
          P.scenario.slots.push(slot);
          const laneUsed = placed.lane || P.nearestStripForPoint(placed.wx, placed.wy) || lane;
          const occ = occupiedByLane.get(laneUsed.id) || [];
          occ.push(placed.t ?? P.slotScalarOnStrip(laneUsed, placed.wx, placed.wy));
          occupiedByLane.set(laneUsed.id, occ);
        } else {
          skipped += 1;
        }
      }
    }

    skipped += Math.max(0, requested - slots.length);
    return { slots, requested, placed: slots.length, skipped };
  };

P.parkingStripSegments = function () {
    return P.getParkingStripDefs().map((s) => [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ]);
  }

P.distPointToSeg = function (px, py, x1, y1, x2, y2) {
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
})();

/* --- app\scenario\sanitize.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/sanitize.js");

P.sanitizeScenarioGeometry = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    P.ensureRoadStructure();
    P.normalizeObstacleInner();
    const rawBuildings = Array.isArray(P.scenario.buildings) ? P.scenario.buildings.slice() : [];
    const rawSlots = Array.isArray(P.scenario.slots) ? P.scenario.slots.slice() : [];
    P.scenario.slots = [];
    P.scenario.buildings = [];
    for (const b of rawBuildings) {
      const bx = Number(b?.[0]);
      const by = Number(b?.[1]);
      if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
      const p = P.findNearestValidBuildingPosition(bx, by, -1);
      if (p) P.scenario.buildings.push([p.wx, p.wy]);
    }
    for (let ei = 0; ei < P.scenario.entrances.length; ei++) {
      const cur = P.scenario.entrances[ei];
      const es = P.snapEntranceToInner(cur?.[0] ?? 0, cur?.[1] ?? 0);
      if (P.canPlaceEntrance(es.wx, es.wy)) {
        P.scenario.entrances[ei][0] = es.wx;
        P.scenario.entrances[ei][1] = es.wy;
      } else {
        const altE = P.nearestValidEntrancePoint(es.wx, es.wy);
        if (altE) {
          P.scenario.entrances[ei][0] = altE.wx;
          P.scenario.entrances[ei][1] = altE.wy;
        }
      }
    }
    for (const s of rawSlots) {
      const sx = Number(s?.[0]);
      const sy = Number(s?.[1]);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      const p = P.suggestUniformSlotPosition(sx, sy, -1);
      if (p) P.scenario.slots.push([p.wx, p.wy, P.normalizeAngle(p.theta ?? s?.[2] ?? 0)]);
    }
    P.ensureScenarioCollections();
    P.ensureVehicleEntrancesArray();
  }
})();

/* --- app\storage\state-storage.js --- */
(function () {
  "use strict";

  function createStateStorage(config) {
    const storageKey = String(config.storageKey || "");
    const debounceMs = Math.max(0, Number(config.debounceMs) || 0);
    let timer = null;

    function readState() {
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_) {
        return null;
      }
    }

    function persistNow(payload) {
      if (!payload) return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
      } catch (e) {
        console.warn("状态保存失败:", e?.message || e);
      }
    }

    function schedule(payloadFactory) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const payload = typeof payloadFactory === "function" ? payloadFactory() : null;
        persistNow(payload);
      }, debounceMs);
    }

    function clear() {
      clearTimeout(timer);
      timer = null;
      try {
        localStorage.removeItem(storageKey);
      } catch (_) {
        // ignore storage clear errors
      }
    }

    return {
      readState,
      persistNow,
      schedule,
      clear,
    };
  }

  function createSnapshotStorage(storageKey, maxItems) {
    const key = String(storageKey || "");
    const cap = Math.max(1, Number(maxItems) || 20);

    function readItems() {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (_) {
        return [];
      }
    }

    function writeItems(items) {
      const safe = Array.isArray(items) ? items.slice(0, cap) : [];
      try {
        localStorage.setItem(key, JSON.stringify(safe));
        return { ok: true, count: safe.length };
      } catch (error) {
        return {
          ok: false,
          count: safe.length,
          error: error instanceof Error ? error.message : String(error || "unknown storage error"),
        };
      }
    }

    return {
      readItems,
      writeItems,
    };
  }

  window.ParkingAppStorage = {
    createStateStorage,
    createSnapshotStorage,
  };
})();

/* --- app\storage\scenario-io.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/storage/scenario-io.js");

P.readCurrentState = function () {
    return P.currentStateStore?.readState ? P.currentStateStore.readState() : null;
  }

P.persistCurrentStateNow = function () {
    if (!P.scenario || !P.optimizer || typeof P.optimizer.normalizeScenario !== "function") return;
    const payload = {
      scenario: P.scenario,
      activeTab: P.activeTab,
      vehiclePage: P.vehiclePage,
      viewState: { viewPanX: P.viewPanX ?? 0, viewPanY: P.viewPanY ?? 0, viewZoom: P.viewZoom ?? 1 },
      savedAt: Date.now(),
    };
    P.currentStateStore?.persistNow?.(payload);
  }

P.schedulePersistCurrentState = function () {
    P.currentStateStore?.schedule?.(() => ({
      scenario: P.scenario,
      activeTab: P.activeTab,
      vehiclePage: P.vehiclePage,
      viewState: { viewPanX: P.viewPanX ?? 0, viewPanY: P.viewPanY ?? 0, viewZoom: P.viewZoom ?? 1 },
      savedAt: Date.now(),
    }));
  }

P.clearPersistedCurrentState = function () {
    P.currentStateStore?.clear?.();
  }

P.exportScenarioToFile = function () {
    if (!P.scenario) return;
    const payload = JSON.stringify(P.scenario, null, 2);
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

P.readSnapshots = function () {
    return P.snapshotStore?.readItems ? P.snapshotStore.readItems() : [];
  }

P.writeSnapshots = function (items) {
    if (!P.snapshotStore?.writeItems) return false;
    const result = P.snapshotStore.writeItems(items);
    if (result && typeof result === "object" && result.ok === false) {
      P.showWorkspaceMessage?.("保存快照失败：本地存储空间不足或不可用，请清理浏览器存储后重试。", {
        level: "error",
      });
      return false;
    }
    return true;
  }

P.isSnapshotScenarioValid = function (candidate) {
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

P.refreshSnapshotSelect = function () {
    const sel = document.getElementById("snapshot-select");
    if (!sel) return;
    const items = P.readSnapshots();
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

P.saveSnapshot = function () {
    if (!P.scenario) return;
    const items = P.readSnapshots();
    const id = Date.now();
    const name = new Date(id).toLocaleString();
    items.unshift({ id, name, scenario: JSON.parse(JSON.stringify(P.scenario)) });
    if (P.writeSnapshots(items)) {
      P.refreshSnapshotSelect();
    }
  }

P.loadSnapshot = function () {
    const sel = document.getElementById("snapshot-select");
    if (!sel || !sel.value) return;
    const items = P.readSnapshots();
    const hit = items.find((it) => String(it.id) === String(sel.value));
    if (!hit) return;
    if (!P.isSnapshotScenarioValid(hit.scenario)) {
      P.showWorkspaceMessage?.("快照数据结构无效，无法加载。", { level: "error" });
      return;
    }
    try {
      const normalized = P.optimizer.normalizeScenario(hit.scenario);
      if (!P.isSnapshotScenarioValid(normalized)) {
        throw new Error("normalized snapshot invalid");
      }
      P.scenario = normalized;
      P.ensureConstraints();
      P.ensureScenarioCollections();
      P.sanitizeScenarioGeometry();
      P.ensureVehicleDestinationsArray();
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.invalidateOptimizationResult();
      P.setSelection(null);
      P.syncLotInputsFromScenario?.();
      P.updateActionGates?.();
    } catch (error) {
      P.showWorkspaceMessage?.("加载快照失败：数据损坏或与当前版本不兼容。", { level: "error" });
      console.error(error);
    }
  }

P.importScenarioFromFile = async function (file) {
    if (!file) return;
    const txt = await file.text();
    const parsed = JSON.parse(txt);
    P.scenario = P.optimizer.normalizeScenario(parsed);
    P.ensureConstraints();
    P.ensureScenarioCollections();
    P.sanitizeScenarioGeometry();
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    P.rebuildVehicleTargetsUI();
    P.nVehInput.value = P.scenario.n_veh ?? 12;
    P.invalidateOptimizationResult();
    P.setSelection(null);
    P.syncLotInputsFromScenario?.();
    P.fitViewToLot();
    P.updateActionGates?.();
    P.updateRunBarSummary?.();
    P.draw();
  }

P.runBenchmark = function () {
    if (!P.scenario || !P.optimizer || !P.analysisTools?.runBenchmark) return;
    const out = document.getElementById("benchmark-output");
    const runsEl = document.getElementById("benchmark-runs");
    const seedEl = document.getElementById("pso-seed");
    const runs = P.normalizeBenchmarkRuns(runsEl?.value || "6");
    if (runsEl) runsEl.value = String(runs);
    const baseSeed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : 1;
    P.benchmarkResult = P.analysisTools.runBenchmark({
      scenario: P.scenario,
      optimizer: P.optimizer,
      normalizeOptimizeResult: P.normalizeOptimizeResult,
      runs,
      baseSeed,
      outputEl: out,
      timeUnit: P.uTime(),
    });
    if (out && runs >= P.MAX_BENCHMARK_RUNS) {
      out.textContent += "\n已触发上限：" + P.MAX_BENCHMARK_RUNS + " 次（防止页面卡顿）。";
    }
  }

P.recommendParams = function () {
    if (!P.scenario || !P.optimizer || !P.analysisTools?.recommendParams) return;
    const out = document.getElementById("recommend-output");
    const seedEl = document.getElementById("pso-seed");
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : 1;
    P.analysisTools.recommendParams({
      scenario: P.scenario,
      optimizer: P.optimizer,
      normalizeOptimizeResult: P.normalizeOptimizeResult,
      seed,
      outputEl: out,
      timeUnit: P.uTime(),
    });
  }
})();

/* --- app\analysis\optimizer-analysis.js --- */
(function () {
  "use strict";

  const MAX_BENCHMARK_RUNS = 50;

  function normalizeRuns(rawRuns) {
    const parsed = Number.parseInt(rawRuns, 10);
    const safeRuns = Number.isFinite(parsed) ? parsed : 6;
    return Math.max(1, Math.min(MAX_BENCHMARK_RUNS, safeRuns));
  }

  function benchmarkText(stats, timeUnit) {
    if (!stats) return "";
    return (
      "Benchmark（" +
      stats.runs +
      " 次）\n" +
      "Exact 平均: " +
      stats.exactAvg.toFixed(2) +
      " " +
      timeUnit +
      "\nPSO 平均: " +
      stats.psoAvg.toFixed(2) +
      " " +
      timeUnit +
      "\n平均偏差: " +
      stats.gapPct.toFixed(2) +
      "%\nPSO 平均耗时: " +
      stats.psoMs.toFixed(1) +
      " ms"
    );
  }

  function runBenchmark(deps) {
    const {
      scenario,
      optimizer,
      normalizeOptimizeResult,
      runs,
      baseSeed,
      outputEl,
      timeUnit,
    } = deps;
    if (!scenario || !optimizer) return null;
    const exactVals = [];
    const psoVals = [];
    const psoMs = [];
    const safeRuns = normalizeRuns(runs);
    for (let i = 0; i < safeRuns; i++) {
      const base = JSON.parse(JSON.stringify(scenario));
      const exact = normalizeOptimizeResult(optimizer.runOptimize(base, { method: "exact" }), "exact", scenario);
      const t0 = performance.now();
      const pso = normalizeOptimizeResult(
        optimizer.runOptimize(base, { method: "pso", seed: baseSeed + i }),
        "pso",
        scenario
      );
      const t1 = performance.now();
      if (Number.isFinite(exact.gbest_value) && Number.isFinite(pso.gbest_value)) {
        exactVals.push(exact.gbest_value);
        psoVals.push(pso.gbest_value);
        psoMs.push(t1 - t0);
      }
    }
    if (!exactVals.length) return null;
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stats = {
      runs: exactVals.length,
      exactAvg: avg(exactVals),
      psoAvg: avg(psoVals),
      gapPct: ((avg(psoVals) - avg(exactVals)) / Math.max(1e-6, avg(exactVals))) * 100,
      psoMs: avg(psoMs),
    };
    if (outputEl) outputEl.textContent = benchmarkText(stats, timeUnit);
    return stats;
  }

  function recommendParams(deps) {
    const {
      scenario,
      optimizer,
      normalizeOptimizeResult,
      seed,
      outputEl,
      timeUnit,
    } = deps;
    if (!scenario || !optimizer) return null;
    const exact = normalizeOptimizeResult(
      optimizer.runOptimize(JSON.parse(JSON.stringify(scenario)), { method: "exact" }),
      "exact",
      scenario
    );
    if (!Number.isFinite(exact.gbest_value)) return null;
    const candidates = [
      { label: "速度优先", n_particles: 18, n_iter: 180 },
      { label: "平衡", n_particles: 30, n_iter: 320 },
      { label: "精度优先", n_particles: 45, n_iter: 650 },
    ];
    const rows = candidates.map((cfg, idx) => {
      const base = JSON.parse(JSON.stringify(scenario));
      base.pso = {
        ...base.pso,
        n_particles: cfg.n_particles,
        n_iter: cfg.n_iter,
      };
      const t0 = performance.now();
      const res = normalizeOptimizeResult(
        optimizer.runOptimize(base, { method: "pso", seed: seed + idx }),
        "pso",
        scenario
      );
      const dt = performance.now() - t0;
      const gap = ((res.gbest_value - exact.gbest_value) / Math.max(1e-6, exact.gbest_value)) * 100;
      return { ...cfg, val: res.gbest_value, gap, ms: dt };
    });
    const best = rows.slice().sort((a, b) => a.gap - b.gap || a.ms - b.ms)[0];
    if (outputEl) {
      outputEl.textContent = rows
        .map(
          (r) =>
            r.label +
            ": " +
            r.val.toFixed(2) +
            " " +
            timeUnit +
            "，偏差 " +
            r.gap.toFixed(2) +
            "%，耗时 " +
            r.ms.toFixed(1) +
            " ms"
        )
        .join("\n") + "\n建议：默认使用「" + best.label + "」配置。";
    }
    return { rows, best };
  }

  window.ParkingAnalysis = {
    MAX_BENCHMARK_RUNS,
    normalizeRuns,
    benchmarkText,
    runBenchmark,
    recommendParams,
  };
})();

/* --- app\ui\tab-utils.js --- */
(function () {
  "use strict";

  function applyTabState(tabKey) {
    document.querySelectorAll(".side-tab").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.tab === tabKey);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.tabPanel === tabKey);
    });
  }

  window.ParkingTabUtils = {
    applyTabState,
  };
})();

/* --- app\ui\workspace-status.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/workspace-status.js");

  P.showWorkspaceMessage = function (text, options) {
    const opts = options || {};
    const level = opts.level === "error" || opts.level === "warn" ? opts.level : "info";
    const alsoResult = opts.alsoResult !== false;
    const el = document.getElementById("workspace-status");
    if (el) {
      const msg = String(text || "").trim();
      if (msg) {
        el.textContent = msg;
        el.hidden = false;
        el.className =
          "workspace-status workspace-status--message workspace-status--" + level;
      } else {
        P.clearWorkspaceMessage();
      }
    }
    if (alsoResult) {
      const resultEl = document.getElementById("result-status");
      if (resultEl && text) resultEl.textContent = String(text);
    }
  };

  P.clearWorkspaceMessage = function () {
    const el = document.getElementById("workspace-status");
    if (el) {
      el.textContent = "";
      el.hidden = true;
      el.className = "workspace-status workspace-status--message";
    }
  };

  P.updateRunBarSummary = function () {
    const el = document.getElementById("run-bar-summary");
    if (!el) return;
    const nVehEl = document.getElementById("n-veh");
    const methodEl = document.getElementById("optimizer-method");
    const n = nVehEl && nVehEl.value !== "" ? parseInt(nVehEl.value, 10) : P.scenario?.n_veh;
    const method = methodEl?.value === "pso" ? "pso" : "exact";
    const nSafe = Number.isFinite(n) && n > 0 ? n : "--";
    el.textContent = nSafe + " 辆 · " + method;
  };

  P.syncDeleteButton = function () {
    const btn = document.getElementById("btn-delete");
    if (!btn) return;
    btn.disabled = !P.selection;
  };

  P.clearPendingAddMode = function () {
    if (P.pendingAdd === "obstacle") P.cancelObstacleDraft?.();
    if (P.pendingAdd === "road") P.cancelRoadDraft?.();
    P.pendingAdd = null;
    document.getElementById("btn-add-building")?.classList.remove("active");
    document.getElementById("btn-add-slot")?.classList.remove("active");
    document.getElementById("btn-add-entrance")?.classList.remove("active");
    document.getElementById("btn-add-obstacle")?.classList.remove("active");
    document.getElementById("btn-add-road")?.classList.remove("active");
    P.draw();
  };
})();

/* --- app\ui\tab-flow.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/tab-flow.js");

P.normalizeTabKey = function (tabKey) {
    if (tabKey === "plans" || tabKey === "compare") return "schemes";
    if (tabKey === "lab") return "overview";
    return tabKey || "overview";
  };

P.switchTab = function (tabKey) {
    P.activeTab = P.normalizeTabKey(tabKey);
    if (P.tabUtils?.applyTabState) P.tabUtils.applyTabState(P.activeTab);
    else {
      document.querySelectorAll(".side-tab").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.tab === P.activeTab);
      });
      document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === P.activeTab);
      });
    }
    if (P.activeTab === "result") {
      requestAnimationFrame(() => {
        P.syncChartCanvasSize();
        P.drawChart(P.lastChartSeries, P.lastChartOptimizer);
      });
    }
    if (P.activeTab === "schemes") {
      if (P.renderScenarioLibrary) P.renderScenarioLibrary();
      requestAnimationFrame(() => {
        P.syncCompareRadarSize?.();
        if (P.renderComparePanel) P.renderComparePanel();
      });
    }
    if (P.activeTab === "simulate") {
      requestAnimationFrame(() => {
        P.syncSimQueueChartSize?.();
        if (P.simState?.timeline) P.drawSimQueueChart?.(P.simState.timeline);
      });
      P.draw();
    }
    const runBar = document.querySelector(".run-bar");
    if (runBar) runBar.hidden = P.activeTab === "overview";
    P.updateRunBarSummary?.();
    P.updateActionGates?.();
    P.schedulePersistCurrentState();
  }

P.entranceDisplayName = function (index) {
    const safeIndex = Math.max(0, Number(index) || 0);
    return "入口 " + (safeIndex + 1);
  }

P.notifyObstacleGeometryInvalid = function (reason) {
    if (reason === "overlap") {
      P.showWorkspaceMessage?.("花坛不能与其他花坛重叠，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "overlap_element") {
      P.showWorkspaceMessage?.("花坛不能与楼、车位或入口重叠，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "overlap_road") {
      P.showWorkspaceMessage?.("花坛不能与道路重叠，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "outside_lot") {
      P.showWorkspaceMessage?.("花坛不能超出地块边界，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "self_intersect") {
      P.showWorkspaceMessage?.("花坛多边形不能自交，请调整顶点位置。", { level: "error" });
      return;
    }
    P.showWorkspaceMessage?.("花坛多边形无效：至少需要 3 个不共线顶点。", { level: "error" });
  }

P.notifyRoadGeometryInvalid = function (reason) {
    if (reason === "overlap_obstacle") {
      P.showWorkspaceMessage?.("道路不能与花坛重叠，请调整道路。", { level: "error" });
      return;
    }
    if (reason === "overlap_building") {
      P.showWorkspaceMessage?.("道路不能与居民楼重叠，请调整道路。", { level: "error" });
      return;
    }
    if (reason === "outside_lot") {
      P.showWorkspaceMessage?.("道路不能超出地块边界，请调整道路。", { level: "error" });
      return;
    }
    P.showWorkspaceMessage?.("道路几何无效，请调整道路。", { level: "error" });
  }

P.clearOptimizationResultLight = function () {
    P.lastResult = null;
    P.lastChartSeries = [];
    P.drawChart([]);
    P.updateChartCaption("idle");
    P.renderBreakdownSummary();
    P.renderResultTip("");
    P.showWorkspaceMessage?.("场景已变更，请重新运行优化。", { level: "warn" });
    P.updateActionGates?.();
  }

P.invalidateOptimizationResult = function () {
    P.clearOptimizationResultLight();
    P.draw();
  }

})();

/* --- app\ui\props\props-form-utils.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-form-utils.js");

  P.propsAddNote = function (text) {
    const p = document.createElement("p");
    p.style.gridColumn = "1 / -1";
    p.style.margin = "0 0 0.35rem";
    p.style.fontSize = "0.88rem";
    p.style.color = "var(--muted)";
    p.textContent = text;
    P.propsForm.appendChild(p);
  };

  P.propsAddNum = function (label, id, val, onChange) {
    const l = document.createElement("label");
    l.htmlFor = id;
    l.textContent = label;
    const inp = document.createElement("input");
    inp.type = "number";
    inp.id = id;
    inp.step = "0.1";
    inp.value = val;
    inp.addEventListener("change", onChange);
    P.propsForm.appendChild(l);
    P.propsForm.appendChild(inp);
  };
})();

/* --- app\ui\props\props-entrance.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-entrance.js");

  P.renderPropsEntrance = function () {
    P.propsAddNote(
      "入口为道路上的一点（无单独引道线段）；拖拽松手或改数后会自动贴到道路中心线。"
    );
    const entIndex = P.selection.index ?? 0;
    const e = P.scenario.entrances[entIndex];
    const applyEntrance = () => {
      const oldX = P.scenario.entrances[entIndex][0];
      const oldY = P.scenario.entrances[entIndex][1];
      const sx = parseFloat(document.getElementById("p-ex").value) || 0;
      const sy = parseFloat(document.getElementById("p-ey").value) || 0;
      const s = P.snapEntranceToInner(sx, sy);
      if (!P.canPlaceEntrance(s.wx, s.wy)) {
        P.scenario.entrances[entIndex][0] = oldX;
        P.scenario.entrances[entIndex][1] = oldY;
      } else {
        P.scenario.entrances[entIndex][0] = s.wx;
        P.scenario.entrances[entIndex][1] = s.wy;
      }
      P.ensureScenarioCollections();
      P.invalidateOptimizationResult();
      P.renderProps();
    };
    P.propsAddNum("入口 X (" + P.uLen() + ")", "p-ex", e[0], applyEntrance);
    P.propsAddNum("入口 Y (" + P.uLen() + ")", "p-ey", e[1], applyEntrance);
  };
})();

/* --- app\ui\props\props-obstacle.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-obstacle.js");

  P.renderPropsObstacle = function () {
    const obsIndex = P.selection.index ?? 0;
    const getObstacle = () => P.scenario?.obstacles?.[obsIndex];
    const o = getObstacle();
    if (!o) {
      P.propsAddNote("当前花坛不可用，请重新选择花坛。");
      return;
    }
    P.propsAddNote("花坛为多边形：可编辑各顶点坐标，至少保留 3 个点；支持画布直接拖拽顶点。");
    (o?.points || []).forEach((pt, pi) => {
      P.propsAddNum("顶点 " + (pi + 1) + " X (" + P.uLen() + ")", "p-opx-" + pi, pt[0], () => {
        const cur = getObstacle();
        if (!cur || !cur.points?.[pi]) return;
        const old = (cur.points || []).map((p) => [p[0], p[1]]);
        cur.points[pi][0] = parseFloat(document.getElementById("p-opx-" + pi).value) || 0;
        if (!P.normalizeObstacleInner()) {
          cur.points = old;
          P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
          P.renderProps();
          P.draw();
          return;
        }
        P.invalidateOptimizationResult();
        P.renderProps();
      });
      P.propsAddNum("顶点 " + (pi + 1) + " Y (" + P.uLen() + ")", "p-opy-" + pi, pt[1], () => {
        const cur = getObstacle();
        if (!cur || !cur.points?.[pi]) return;
        const old = (cur.points || []).map((p) => [p[0], p[1]]);
        cur.points[pi][1] = parseFloat(document.getElementById("p-opy-" + pi).value) || 0;
        if (!P.normalizeObstacleInner()) {
          cur.points = old;
          P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
          P.renderProps();
          P.draw();
          return;
        }
        P.invalidateOptimizationResult();
        P.renderProps();
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
        cur.points = [
          [50, 50],
          [54, 50],
          [52, 54],
        ];
      } else if (pts.length === 1) {
        cur.points.push([pts[0][0] + 2, pts[0][1]]);
      } else {
        const a = pts[pts.length - 1];
        const b = pts[0];
        cur.points.push([(a[0] + b[0]) / 2 + 1.2, (a[1] + b[1]) / 2 + 1.2]);
      }
      if (!P.normalizeObstacleInner()) {
        cur.points = old;
        P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
        P.renderProps();
        P.draw();
        return;
      }
      P.invalidateOptimizationResult();
      P.renderProps();
    });
    P.propsForm.appendChild(addBtn);
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
        if (!P.normalizeObstacleInner()) {
          cur.points = old;
          P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
          P.renderProps();
          P.draw();
          return;
        }
        P.invalidateOptimizationResult();
        P.renderProps();
      });
      P.propsForm.appendChild(delBtn);
    }
  };
})();

/* --- app\ui\props\props-road.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-road.js");

  P.renderPropsRoad = function () {
    P.propsAddNote("道路使用中心线顶点 + 宽度；支持编辑顶点坐标、宽度和环形/非环形。");
    P.ensureRoadStructure();
    const pts = P.scenario.road?.centerline || [];
    const shapeLabel = document.createElement("label");
    shapeLabel.htmlFor = "p-r-closed";
    shapeLabel.textContent = "道路形态";
    const shapeSel = document.createElement("select");
    shapeSel.id = "p-r-closed";
    shapeSel.innerHTML =
      '<option value="closed">环形（首尾相连）</option><option value="open">非环形（首尾不连）</option>';
    shapeSel.value = P.scenario.road?.closed === false ? "open" : "closed";
    shapeSel.addEventListener("change", () => {
      if (P.tryApplyRoadUpdate(() => P.setRoadClosed(shapeSel.value !== "open"))) {
        P.renderProps();
        P.draw();
      }
    });
    P.propsForm.appendChild(shapeLabel);
    P.propsForm.appendChild(shapeSel);
    P.propsAddNum(
      "道路宽度 (" + P.uLen() + ")",
      "p-r-width",
      P.scenario.road?.width || P.DEFAULT_ROAD_WIDTH,
      () => {
        const nextW = Math.max(
          2.4,
          parseFloat(document.getElementById("p-r-width").value) || P.DEFAULT_ROAD_WIDTH
        );
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.width = nextW;
          })
        ) {
          P.renderProps();
          P.draw();
        }
      }
    );
    pts.forEach((pt, pi) => {
      P.propsAddNum("道路顶点 " + (pi + 1) + " X (" + P.uLen() + ")", "p-rx-" + pi, pt[0], () => {
        const v = parseFloat(document.getElementById("p-rx-" + pi).value) || 0;
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.centerline[pi][0] = v;
            if (P.scenario.road?.closed !== false) {
              P.syncClosedRoadEndpoint(P.scenario.road.centerline, pi);
            }
          })
        ) {
          P.renderProps();
          P.draw();
        }
      });
      P.propsAddNum("道路顶点 " + (pi + 1) + " Y (" + P.uLen() + ")", "p-ry-" + pi, pt[1], () => {
        const v = parseFloat(document.getElementById("p-ry-" + pi).value) || 0;
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.centerline[pi][1] = v;
            if (P.scenario.road?.closed !== false) {
              P.syncClosedRoadEndpoint(P.scenario.road.centerline, pi);
            }
          })
        ) {
          P.renderProps();
          P.draw();
        }
      });
    });
    if (pts.length > 2) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "删除最后道路顶点";
      delBtn.style.gridColumn = "1 / -1";
      delBtn.addEventListener("click", () => {
        if ((P.scenario.road?.centerline || []).length <= 2) return;
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.centerline.pop();
          })
        ) {
          P.renderProps();
          P.draw();
        }
      });
      P.propsForm.appendChild(delBtn);
    }
  };
})();

/* --- app\ui\props\props-building.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-building.js");

  P.renderPropsBuilding = function () {
    const [x, y] = P.scenario.buildings[P.selection.index];
    P.propsAddNum("楼中心 X (" + P.uLen() + ")", "p-bx", x, () => {
      const v = P.clampBuildingCenter(
        parseFloat(document.getElementById("p-bx").value) || 0,
        parseFloat(document.getElementById("p-by").value) || 0
      );
      if (P.canPlaceBuilding(v.wx, v.wy, P.selection.index)) {
        P.scenario.buildings[P.selection.index][0] = v.wx;
      }
      P.draw();
    });
    P.propsAddNum("楼中心 Y (" + P.uLen() + ")", "p-by", y, () => {
      const v = P.clampBuildingCenter(
        parseFloat(document.getElementById("p-bx").value) || 0,
        parseFloat(document.getElementById("p-by").value) || 0
      );
      if (P.canPlaceBuilding(v.wx, v.wy, P.selection.index)) {
        P.scenario.buildings[P.selection.index][1] = v.wy;
      }
      P.draw();
    });
  };
})();

/* --- app\ui\props\props-slot.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-slot.js");

  P.renderPropsSlot = function () {
    const pose = P.slotPoseOf(P.scenario.slots[P.selection.index]);
    if (!pose) return;
    const x = pose.x;
    const y = pose.y;
    const idx = P.selection.index;
    const applySlotFromInputs = () => {
      P.scenario.slots[idx][0] = parseFloat(document.getElementById("p-sx").value) || 0;
      P.scenario.slots[idx][1] = parseFloat(document.getElementById("p-sy").value) || 0;
      if (!P.applySnapToSlot(idx)) return;
      P.renderProps();
      P.draw();
    };
    P.propsAddNum("车位中心 X (" + P.uLen() + ")", "p-sx", x, applySlotFromInputs);
    P.propsAddNum("车位中心 Y (" + P.uLen() + ")", "p-sy", y, applySlotFromInputs);
    P.propsAddNum("车位角度 (deg)", "p-st", (P.normalizeAngle(pose.theta) * 180) / Math.PI, () => {
      const deg = parseFloat(document.getElementById("p-st").value) || 0;
      P.scenario.slots[idx][2] = P.normalizeAngle((deg * Math.PI) / 180);
      P.draw();
    });
    P.ensureConstraints();
    const types = ["normal", "accessible", "ev", "visitor"];
    const labels = { normal: "普通", accessible: "无障碍", ev: "充电", visitor: "访客" };
    const cur = P.scenario.slot_types?.[idx] || "normal";
    const wrap = document.createElement("div");
    wrap.className = "prop-grid";
    const lab = document.createElement("label");
    lab.setAttribute("for", "p-slot-type");
    lab.textContent = "车位类型";
    const sel = document.createElement("select");
    sel.id = "p-slot-type";
    types.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = labels[t] || t;
      sel.appendChild(o);
    });
    sel.value = cur;
    sel.addEventListener("change", () => {
      P.scenario.slot_types[idx] = sel.value;
      P.invalidateOptimizationResult();
      P.draw();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    document.getElementById("props-form").appendChild(wrap);
  };
})();

/* --- app\ui\lot-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/lot-panel.js");

  const MIN_LOT_DIM = 40;

  P.applyLotDimensions = function (w, h) {
    if (!P.scenario?.lot) return false;
    const nw = Math.round(Number(w) * 10) / 10;
    const nh = Math.round(Number(h) * 10) / 10;
    if (!Number.isFinite(nw) || !Number.isFinite(nh)) return false;
    if (nw < MIN_LOT_DIM || nh < MIN_LOT_DIM) return false;
    if (nw > P.MAX_LOT_SPAN || nh > P.MAX_LOT_SPAN) return false;
    P.ensureLotOrigin();
    P.scenario.lot.width = nw;
    P.scenario.lot.height = nh;
    P.invalidateOptimizationResult();
    P.persistCurrentStateNow?.();
    P.draw();
    return true;
  };

  P.syncLotInputsFromScenario = function () {
    const wEl = document.getElementById("lot-width");
    const hEl = document.getElementById("lot-height");
    if (!wEl || !hEl || !P.scenario?.lot) return;
    wEl.value = String(P.lotW());
    hEl.value = String(P.lotH());
  };

  P.bindLotPanel = function () {
    const wEl = document.getElementById("lot-width");
    const hEl = document.getElementById("lot-height");
    if (!wEl || !hEl) return;

    const onChange = () => {
      const ok = P.applyLotDimensions(
        parseFloat(wEl.value),
        parseFloat(hEl.value)
      );
      P.syncLotInputsFromScenario();
      if (!ok) {
        P.showWorkspaceMessage?.(
          "地块尺寸无效（" + MIN_LOT_DIM + "–" + P.MAX_LOT_SPAN + " " + P.uLen() + "）。",
          { level: "error" }
        );
      }
    };

    wEl.addEventListener("change", onChange);
    hEl.addEventListener("change", onChange);
  };
})();

/* --- app\ui\props-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props-panel.js");

  P.renderProps = function () {
    P.propsForm.innerHTML = "";
    if (!P.selection) {
      P.propsEmpty.hidden = false;
      P.propsForm.hidden = true;
      return;
    }
    P.propsEmpty.hidden = true;
    P.propsForm.hidden = false;

    const kind = P.selection.kind;
    if (kind === "entrance") P.renderPropsEntrance();
    else if (kind === "obstacle") P.renderPropsObstacle();
    else if (kind === "road") P.renderPropsRoad();
    else if (kind === "building") P.renderPropsBuilding();
    else if (kind === "slot") P.renderPropsSlot();
  };
})();

/* --- app\ui\vehicle-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/vehicle-panel.js");

P.ensureVehicleDestinationsArray = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const nb = P.scenario.buildings?.length ?? 0;
    if (!Array.isArray(P.scenario.vehicle_destinations)) {
      P.scenario.vehicle_destinations = Array.from({ length: n }, (_, i) =>
        nb > 0 ? i % nb : 0
      );
      return;
    }
    while (P.scenario.vehicle_destinations.length < n) {
      const i = P.scenario.vehicle_destinations.length;
      P.scenario.vehicle_destinations.push(nb > 0 ? i % nb : 0);
    }
    if (P.scenario.vehicle_destinations.length > n) {
      P.scenario.vehicle_destinations.length = n;
    }
    if (nb > 0) {
      P.scenario.vehicle_destinations = P.scenario.vehicle_destinations.map((d) => {
        let v = parseInt(d, 10);
        if (!Number.isFinite(v)) v = 0;
        return Math.max(0, Math.min(nb - 1, v));
      });
    }
    P.ensureVehicleEntrancesArray();
  }

P.adjustVehicleDestinationsAfterBuildingRemoved = function (removedIndex) {
    if (!P.scenario || !Array.isArray(P.scenario.vehicle_destinations)) return;
    const nb = P.scenario.buildings.length;
    P.scenario.vehicle_destinations = P.scenario.vehicle_destinations.map((d) => {
      let v = parseInt(d, 10);
      if (!Number.isFinite(v)) v = 0;
      if (v === removedIndex) return Math.max(0, removedIndex - 1);
      if (v > removedIndex) return v - 1;
      return v;
    });
    if (nb > 0) {
      P.scenario.vehicle_destinations = P.scenario.vehicle_destinations.map((d) =>
        Math.max(0, Math.min(nb - 1, d))
      );
    }
  }

P.ensureVehiclePageInRange = function (totalVehicles) {
    const total = Math.max(1, totalVehicles);
    const pageCount = Math.max(1, Math.ceil(total / P.VEHICLE_PAGE_SIZE));
    if (!Number.isFinite(P.vehiclePage) || P.vehiclePage < 0) P.vehiclePage = 0;
    if (P.vehiclePage >= pageCount) P.vehiclePage = pageCount - 1;
    return pageCount;
  }

P.updateVehiclePager = function (totalVehicles, pageCount) {
    const status = document.getElementById("veh-page-status");
    const btnPrev = document.getElementById("btn-veh-page-prev");
    const btnNext = document.getElementById("btn-veh-page-next");
    if (status) status.textContent = pageCount > 0 ? P.vehiclePage + 1 + " / " + pageCount : "1 / 1";
    if (btnPrev) btnPrev.disabled = P.vehiclePage <= 0;
    if (btnNext) btnNext.disabled = P.vehiclePage >= pageCount - 1 || totalVehicles <= P.VEHICLE_PAGE_SIZE;
  }

P.rebuildVehicleTargetsUI = function () {
    const el = document.getElementById("vehicle-targets-list");
    if (!el || !P.scenario) return;
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const nb = P.scenario.buildings?.length ?? 0;
    const ne = P.scenario.entrances?.length ?? 1;
    const pageCount = P.ensureVehiclePageInRange(n);
    const start = P.vehiclePage * P.VEHICLE_PAGE_SIZE;
    const end = Math.min(n, start + P.VEHICLE_PAGE_SIZE);
    const modeEl = document.getElementById("entrance-mode");
    if (modeEl) modeEl.value = P.scenario.entrance_mode || "auto";
    el.innerHTML = "";
    for (let i = start; i < end; i++) {
      const row = document.createElement("div");
      row.className = "vehicle-target-row";
      const lab = document.createElement("label");
      lab.textContent = "车 " + (i + 1);
      lab.setAttribute("for", "veh-dest-" + i);
      lab.className = "vehicle-link-label";
      lab.title = "点击高亮入口→车位→楼链路";
      lab.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (P.setHighlightVehicle) P.setHighlightVehicle(i);
      });
      const breakdown = P.lastResult?.vehicle_breakdown?.[i];
      if (breakdown && Number(breakdown.penalty || 0) > 0) {
        const badge = document.createElement("span");
        badge.className = "vehicle-violation-badge";
        badge.textContent = "违约";
        badge.title = "类型约束违约，罚分 " + Number(breakdown.penalty).toFixed(2);
        lab.appendChild(badge);
      }
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
        const dest = P.scenario.vehicle_destinations[i] ?? 0;
        sel.value = String(Math.max(0, Math.min(nb - 1, dest)));
        sel.addEventListener("change", () => {
          const v = parseInt(sel.value, 10);
          P.scenario.vehicle_destinations[i] = Number.isFinite(v) ? v : 0;
          P.invalidateOptimizationResult();
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
        opt.textContent = P.entranceDisplayName(ei);
        eSel.appendChild(opt);
      }
      const autoEntrances = Array.isArray(P.lastResult?.veh_entrances)
        ? P.lastResult.veh_entrances
        : Array.isArray(P.autoEntrancePreview)
        ? P.autoEntrancePreview
        : null;
      const autoResolved = autoEntrances && Number.isFinite(autoEntrances[i]) ? autoEntrances[i] : null;
      const displayEntranceIndex =
        P.scenario.entrance_mode === "fixed"
          ? P.scenario.vehicle_entrances[i] ?? 0
          : autoResolved != null
          ? autoResolved
          : P.scenario.vehicle_entrances[i] ?? 0;
      eSel.value = String(Math.max(0, Math.min(ne - 1, Number(displayEntranceIndex) || 0)));
      eSel.disabled = P.scenario.entrance_mode !== "fixed";
      if (P.scenario.entrance_mode !== "fixed") {
        eSel.title =
          autoResolved != null
            ? Array.isArray(P.lastResult?.veh_entrances)
              ? "自动策略当前结果：入口 " + (autoResolved + 1)
              : "自动策略即时预估：入口 " + (autoResolved + 1)
            : "自动策略：入口变化后将自动刷新预估";
      }
      eSel.addEventListener("change", () => {
        const v = parseInt(eSel.value, 10);
        P.scenario.vehicle_entrances[i] = Number.isFinite(v) ? v : 0;
        P.invalidateOptimizationResult();
      });
      row.appendChild(elab);
      row.appendChild(eSel);
      const rlab = document.createElement("label");
      rlab.textContent = "需求";
      rlab.setAttribute("for", "veh-req-" + i);
      const rSel = document.createElement("select");
      rSel.id = "veh-req-" + i;
      ["normal", "accessible", "ev", "visitor"].forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = { normal: "普通", accessible: "无障碍", ev: "充电", visitor: "访客" }[t] || t;
        rSel.appendChild(opt);
      });
      P.ensureConstraints();
      rSel.value = P.scenario.vehicle_requirements?.[i] || "normal";
      rSel.addEventListener("change", () => {
        P.scenario.vehicle_requirements[i] = rSel.value;
        P.invalidateOptimizationResult();
      });
      row.appendChild(rlab);
      row.appendChild(rSel);
      el.appendChild(row);
    }
    P.updateVehiclePager(n, pageCount);
  }

P.randomizeVehicleDestinations = function () {
    if (!P.scenario) return;
    const nb = P.scenario.buildings?.length ?? 0;
    if (nb === 0) return;
    P.ensureVehicleDestinationsArray();
    const n = P.scenario.vehicle_destinations.length;
    for (let i = 0; i < n; i++) {
      P.scenario.vehicle_destinations[i] = Math.floor(Math.random() * nb);
    }
    P.rebuildVehicleTargetsUI();
    P.invalidateOptimizationResult();
  }

P.computeAutoEntrancePreview = function () {
    if (!P.scenario || !P.optimizer || typeof P.optimizer.runOptimize !== "function") return null;
    const base = JSON.parse(JSON.stringify(P.scenario));
    const data = P.normalizeOptimizeResult(P.optimizer.runOptimize(base, { method: "exact" }), "exact", P.scenario);
    if (!Array.isArray(data.veh_entrances) || !data.veh_entrances.length) return null;
    return data.veh_entrances.slice();
  }

P.scheduleAutoEntrancePreviewRefresh = function () {
    clearTimeout(P.autoEntrancePreviewTimer);
    P.autoEntrancePreviewVersion += 1;
    const version = P.autoEntrancePreviewVersion;
    P.autoEntrancePreview = null;
    if (!P.scenario || P.scenario.entrance_mode === "fixed") return;
    P.autoEntrancePreviewTimer = setTimeout(() => {
      if (version !== P.autoEntrancePreviewVersion) return;
      try {
        P.autoEntrancePreview = P.computeAutoEntrancePreview();
      } catch (_) {
        P.autoEntrancePreview = null;
      }
      if (version !== P.autoEntrancePreviewVersion) return;
      if (!P.lastResult) P.rebuildVehicleTargetsUI();
    }, 120);
  }
})();

/* --- app\ui\results-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/results-panel.js");

P.normalizeOptimizeResult = function (raw, method, fallbackScenario) {
    const fallback = {
      scenario: fallbackScenario,
      gbest_value: null,
      history_best: [],
      assign: [],
      veh_targets: [],
      veh_entrances: [],
      vehicle_breakdown: [],
      paths: [],
      drive_paths: [],
      road_segments: [],
      optimizer: method || "exact",
      error: "优化结果结构无效",
    };
    if (!raw || typeof raw !== "object") return fallback;
    const out = {};
    for (const key of P.RESULT_KEYS) {
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
    out.drive_paths = Array.isArray(raw.drive_paths) ? raw.drive_paths : [];
    out.road_segments = Array.isArray(out.road_segments) ? out.road_segments : [];
    return out;
  }

  /**
   * 俯视配色参考公开资料（非贴图）：沥青/路面 #36454F 系、铺装混凝土 #d1d8dc 系、
   * 热熔泊位线黄、混凝土屋面、绿地渐变。可选无缝贴图可自行换用 CC0：
   * https://cc0-textures.com/ （如 Asphalt 010）等，本实现零外链以离线可用。
   */
P.renderBreakdownSummary = function () {
    const el = document.getElementById("result-breakdown");
    const driveEl = document.getElementById("metric-drive");
    const walkEl = document.getElementById("metric-walk");
    const totalEl = document.getElementById("metric-total");

    if (driveEl) driveEl.textContent = "--";
    if (walkEl) walkEl.textContent = "--";
    if (totalEl) totalEl.textContent = "--";
    if (el) el.textContent = "";
    const mismatchEl = document.getElementById("metric-mismatch");
    if (mismatchEl) mismatchEl.textContent = "--";

    const items = P.lastResult?.vehicle_breakdown;
    if (!Array.isArray(items) || !items.length) return;

    const totals = items.reduce(
      (acc, it) => {
        acc.drive += Number(it.drive_time || 0);
        acc.walk += Number(it.walk_time || 0);
        acc.penalty += Number(it.penalty || 0);
        if (Number(it.penalty || 0) > 0) acc.mismatch += 1;
        return acc;
      },
      { drive: 0, walk: 0, penalty: 0, mismatch: 0 }
    );

    if (driveEl) driveEl.textContent = totals.drive.toFixed(1);
    if (walkEl) walkEl.textContent = totals.walk.toFixed(1);
    if (totalEl) totalEl.textContent = (totals.drive + totals.walk + totals.penalty).toFixed(1);
    if (mismatchEl) mismatchEl.textContent = String(totals.mismatch);

    if (el) {
      const violators = items.filter((it) => Number(it.penalty || 0) > 0);
      if (violators.length) {
        const lines = violators.map(
          (it) =>
            "车 " +
            (Number(it.vehicle_index) + 1) +
            " → 车位 " +
            (Number(it.slot_index) + 1) +
            "，罚分 " +
            Number(it.penalty).toFixed(2) +
            " " +
            P.uTime()
        );
        el.innerHTML = lines.map((t) => "<div class=\"breakdown-violation\">" + t + "</div>").join("");
      } else if (totals.penalty > 0) {
        el.textContent = "含约束罚分 " + totals.penalty.toFixed(2) + " " + P.uTime();
      } else {
        el.textContent = "无类型违约";
      }
    }
  }

P.renderResultTip = function (text) {
    const el = document.getElementById("result-tip");
    if (!el) return;
    el.textContent = text || "";
  }

P.normalizeBenchmarkRuns = function (rawRuns) {
    if (P.analysisTools?.normalizeRuns) return P.analysisTools.normalizeRuns(rawRuns);
    const parsed = Number.parseInt(rawRuns, 10);
    const safeRuns = Number.isFinite(parsed) ? parsed : 6;
    return Math.max(1, Math.min(P.MAX_BENCHMARK_RUNS, safeRuns));
  }

P.runOptimize = async function () {
    const gate = P.canRunOptimize?.();
    if (gate && !gate.ok) {
      P.showWorkspaceMessage?.(gate.reason, { level: "warn" });
      return;
    }
    const runBtns = document.querySelectorAll(".js-run-optimize");
    const progressEl = document.getElementById("run-progress");
    const status = document.getElementById("result-status");
    const gbestEl = document.getElementById("result-gbest");
    const methodEl = document.getElementById("optimizer-method");
    const seedEl = document.getElementById("pso-seed");
    const method = methodEl && methodEl.value ? methodEl.value : "exact";
    const seed = seedEl && seedEl.value !== "" ? Number(seedEl.value) : null;
    const roadPts = P.scenario?.road?.centerline?.length || 0;
    if (roadPts < 2) {
      P.switchTab?.("overview");
      P.updateWorkflowGuide?.();
    }
    runBtns.forEach((btn) => {
      btn.disabled = true;
      btn.classList.add("is-loading");
    });
    if (progressEl) progressEl.hidden = false;
    const canLocal = !!(P.optimizer && typeof P.optimizer.runOptimize === "function");
    const statusPrefix =
      method === "exact"
        ? "本地计算中…（匈牙利全局最优）"
        : "本地 PSO 计算中…";
    status.textContent = statusPrefix + "（总时间单位：" + P.uTime() + "）";
    gbestEl.style.display = "none";
    try {
      if (!canLocal && !P.api?.optimize) {
        status.textContent = "本地优化模块未加载（assets/js/optimizer/）。";
        P.invalidateOptimizationResult();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      let raw = null;
      if (canLocal) {
        raw = P.optimizer.runOptimize(P.scenario, { method, seed });
      } else if (P.api?.optimize) {
        try {
          const apiRes = await P.api.optimize(P.scenario, method, seed);
          raw = apiRes.result;
        } catch (apiErr) {
          console.warn("API optimize fallback failed", apiErr);
        }
      }
      const data = P.normalizeOptimizeResult(raw, method, P.scenario);
      if (data.error) {
        status.textContent = data.error;
        P.invalidateOptimizationResult();
        return;
      }
      P.lastResult = data;
      P.autoEntrancePreview = Array.isArray(data.veh_entrances) ? data.veh_entrances.slice() : null;
      P.scenario = data.scenario;
      P.ensureConstraints();
      P.ensureScenarioCollections();
      P.sanitizeScenarioGeometry();
      P.ensureVehicleDestinationsArray();
      P.ensureVehicleEntrancesArray();
      P.nVehInput.value = P.scenario.n_veh ?? 12;
      P.rebuildVehicleTargetsUI();
      const opt = data.optimizer || method;
      status.textContent =
        (opt === "exact" ? "全局最优总时间" : "PSO 最优总时间") +
        "（行车 + 步行）/ " +
        P.uTime() +
        "：";
      gbestEl.style.display = "block";
      gbestEl.textContent =
        Number(data.gbest_value ?? 0).toFixed(2) + " " + P.uTime();
      P.updateChartCaption(opt === "exact" ? "exact" : undefined);
      P.drawChart(data.history_best || [], opt);
      P.renderBreakdownSummary();
      P.updateWorkflowGuide?.();
      if (opt === "exact") {
        P.renderResultTip("当前为全局最优解，可将其作为 PSO 调参与精度对照基线。");
      } else {
        let tip = "建议：若偏差较高，可提高 n_particles 或 n_iter，再重新对比 Benchmark。";
        try {
          const exactBase = P.normalizeOptimizeResult(
            P.optimizer.runOptimize(JSON.parse(JSON.stringify(P.scenario)), { method: "exact" }),
            "exact",
            P.scenario
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
        P.renderResultTip(tip);
      }
      P.switchTab("result");
      P.draw();
      P.clearWorkspaceMessage?.();
      P.updateActionGates?.();
      P.updateRunBarSummary?.();
    } catch (e) {
      status.textContent = "网络错误";
      console.error(e);
      P.renderResultTip("");
    } finally {
      runBtns.forEach((btn) => {
        btn.classList.remove("is-loading");
      });
      if (progressEl) progressEl.hidden = true;
      P.updateActionGates?.();
      P.updateRunBarSummary?.();
    }
  }
})();

/* --- app\ui\api-status.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/api-status.js");

  P.apiOnline = false;

  P.refreshApiStatus = async function () {
    const el = document.getElementById("api-status");
    if (el) el.textContent = "检查 API 连接…";
    if (!P.api?.health) {
      P.apiOnline = false;
      if (el) {
        el.textContent = "离线（仅本地优化）";
        el.className = "api-status api-status--offline";
      }
      return false;
    }
    try {
      const res = await P.api.health();
      P.apiOnline = !!(res && res.ok);
      if (el) {
        if (P.apiOnline) {
          el.textContent = "在线（后端 API）";
          el.className = "api-status api-status--online";
        } else {
          el.textContent = "离线（仅本地优化）";
          el.className = "api-status api-status--offline";
        }
      }
      return P.apiOnline;
    } catch (_) {
      P.apiOnline = false;
      if (el) {
        const base = P.api.apiBase();
        el.textContent = base
          ? "离线（无法连接 " + base + "）"
          : "离线（静态站未配置 PARKING_API_BASE，见 README）";
        el.className = "api-status api-status--offline";
      }
      return false;
    }
  };
})();

/* --- app\ui\scenario-library.js --- */
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
    return {
      gbest_value: Number.isFinite(gbest) ? gbest : null,
      worst_vehicle_time: worst || null,
      avg_walk_time: breakdown.length ? walkSum / breakdown.length : null,
      slot_utilization: nSlot ? nVeh / nSlot : 0,
      type_match_rate: nVeh ? 1 - mismatch / nVeh : 1,
      mismatch_count: mismatch,
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

/* --- app\ui\compare-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/compare-panel.js");

  const METRIC_KEYS = [
    { key: "gbest_value", label: "总优化时间", lowerBetter: true },
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
          text =
            mk.key.includes("rate") || mk.key.includes("utilization")
              ? (v * 100).toFixed(0) + "%"
              : Number(v).toFixed(2);
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

/* --- app\ui\planner-panel.js --- */
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

/* --- app\ui\underlay-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/underlay-panel.js");

  P.underlayCalibrating = null;

  P.ensureUnderlayDisplay = function () {
    if (!P.scenario) return null;
    P.scenario.display = P.scenario.display || {};
    if (!P.scenario.display.underlay || typeof P.scenario.display.underlay !== "object") {
      P.scenario.display.underlay = {
        dataUrl: "",
        opacity: 0.55,
        imageSize: null,
        worldA: null,
        worldB: null,
        imageA: null,
        imageB: null,
      };
    }
    return P.scenario.display.underlay;
  };

  P.setUnderlayStatus = function (text) {
    const el = document.getElementById("underlay-status");
    if (el) el.textContent = text || "";
  };

  P.wireUnderlayPanel = function () {
    const fileEl = document.getElementById("underlay-file");
    const opacityEl = document.getElementById("underlay-opacity");
    const btnStart = document.getElementById("btn-underlay-calibrate");
    const btnConfirm = document.getElementById("btn-underlay-confirm");
    const btnClear = document.getElementById("btn-underlay-clear");

    fileEl?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file || !P.scenario) return;
      if (file.size > 2 * 1024 * 1024) {
        P.setUnderlayStatus("图片建议小于 2MB，过大可能影响保存与加载。");
      }
      const reader = new FileReader();
      reader.onload = () => {
        const u = P.ensureUnderlayDisplay();
        u.dataUrl = String(reader.result || "");
        const img = new Image();
        img.onload = () => {
          u.imageSize = [img.naturalWidth, img.naturalHeight];
          u.worldA = null;
          u.worldB = null;
          u.imageA = [0, img.naturalHeight];
          u.imageB = [img.naturalWidth, 0];
          P.underlayCalibrating = null;
          P.mapCanvas?.classList.remove("is-underlay-calibrating");
          P.setUnderlayStatus("已加载底图。点击「开始校准」在画布上选取两个世界坐标点。");
          P.ensureUnderlayImage?.(u.dataUrl);
          P.schedulePersistCurrentState?.();
          P.draw();
        };
        img.src = u.dataUrl;
      };
      reader.readAsDataURL(file);
    });

    opacityEl?.addEventListener("input", () => {
      const u = P.ensureUnderlayDisplay();
      u.opacity = Math.max(0.05, Math.min(1, Number(opacityEl.value) || 0.55));
      P.draw();
      P.schedulePersistCurrentState?.();
    });

    btnStart?.addEventListener("click", () => {
      const u = P.ensureUnderlayDisplay();
      if (!u.dataUrl) {
        P.setUnderlayStatus("请先上传底图。");
        return;
      }
      P.underlayCalibrating = { step: "world", worldPts: [] };
      P.mapCanvas?.classList.add("is-underlay-calibrating");
      P.setUnderlayStatus("校准中：在画布上依次点击两个已知世界坐标点（A、B）。");
      P.switchTab?.("scene");
      P.draw();
    });

    btnConfirm?.addEventListener("click", () => {
      const u = P.ensureUnderlayDisplay();
      const cal = P.underlayCalibrating;
      if (!u.dataUrl || !cal?.worldPts || cal.worldPts.length < 2) {
        P.setUnderlayStatus("请先完成两个世界坐标点的选取。");
        return;
      }
      const size = u.imageSize || [1, 1];
      u.worldA = cal.worldPts[0].slice();
      u.worldB = cal.worldPts[1].slice();
      if (!u.imageA) u.imageA = [0, size[1]];
      if (!u.imageB) u.imageB = [size[0], 0];
      P.underlayCalibrating = null;
      P.mapCanvas?.classList.remove("is-underlay-calibrating");
      P.setUnderlayStatus("底图校准已保存。可调整透明度或清除底图。");
      P.schedulePersistCurrentState?.();
      P.draw();
    });

    btnClear?.addEventListener("click", () => {
      if (!P.scenario) return;
      P.scenario.display.underlay = {
        dataUrl: "",
        opacity: 0.55,
        imageSize: null,
        worldA: null,
        worldB: null,
        imageA: null,
        imageB: null,
      };
      P.underlayCalibrating = null;
      P.mapCanvas?.classList.remove("is-underlay-calibrating");
      if (fileEl) fileEl.value = "";
      if (opacityEl) opacityEl.value = "0.55";
      P.ensureUnderlayImage?.("");
      P.setUnderlayStatus("底图已清除。");
      P.schedulePersistCurrentState?.();
      P.draw();
    });
  };

  P.syncUnderlayPanelFromScenario = function () {
    const u = P.scenario?.display?.underlay;
    const opacityEl = document.getElementById("underlay-opacity");
    if (opacityEl && u) opacityEl.value = String(u.opacity ?? 0.55);
    if (u?.dataUrl && u.worldA && u.worldB) {
      P.setUnderlayStatus("底图已校准。可重新校准或清除。");
    } else if (u?.dataUrl) {
      P.setUnderlayStatus("底图已加载，尚未校准。");
    }
  };

  P.handleUnderlayCalibrationClick = function (wx, wy) {
    const cal = P.underlayCalibrating;
    if (!cal || cal.step !== "world") return false;
    cal.worldPts.push([wx, wy]);
    if (cal.worldPts.length === 1) {
      P.setUnderlayStatus("已选 A 点，请再点击 B 点。");
    } else if (cal.worldPts.length >= 2) {
      cal.worldPts.length = 2;
      const u = P.ensureUnderlayDisplay();
      const size = u.imageSize || [1, 1];
      u.imageA = [0, size[1]];
      u.imageB = [size[0], 0];
      P.setUnderlayStatus("世界坐标已选齐。点击「确认校准」完成（图像点默认左下→右上）。");
    }
    P.draw();
    return true;
  };
})();

/* --- app\ui\workflow-guide.js --- */
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
      id: "optimize",
      title: "运行优化",
      desc: "计算最优分配与路径",
      tab: "result",
      action: "optimize",
    },
    {
      id: "compare",
      title: "保存与对比",
      desc: "保存方案并排雷达图",
      tab: "schemes",
      action: "schemes",
    },
    {
      id: "simulate",
      title: "到达仿真",
      desc: "回放车辆到达过程",
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
      case "schemes":
        P.switchTab("schemes");
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
    if (!P.lastResult?.assign?.length) return { ok: false, reason: "需先完成优化" };
    return { ok: true, reason: "" };
  };

  P.updateActionGates = function () {
    const opt = P.canRunOptimize?.() || { ok: true, reason: "" };
    document.querySelectorAll(".js-run-optimize").forEach((btn) => {
      btn.disabled = !opt.ok;
      btn.title = opt.ok ? "" : opt.reason;
    });
    const sim = P.canRunSimulation?.() || { ok: false, reason: "需先完成优化" };
    const runSim = document.getElementById("btn-run-sim");
    const playSim = document.getElementById("btn-sim-play");
    const hasTimeline = !!(P.simState?.timeline?.frames?.length);
    if (runSim) {
      runSim.disabled = !sim.ok;
      runSim.title = sim.ok ? "" : sim.reason;
    }
    if (playSim) {
      playSim.disabled = !hasTimeline;
      playSim.title = hasTimeline ? "" : "需先运行仿真";
    }
  };
})();

/* --- app\ui\simulate-panel.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/simulate-panel.js");

  P.simState = P.simState || { playing: false, frameIndex: 0, timeline: null, raf: null };

  P.updateSimTimeLabel = function () {
    const el = document.getElementById("sim-time-label");
    const frame = P.simState.timeline?.frames?.[P.simState.frameIndex];
    if (!el) return;
    const t = frame?.t;
    el.textContent =
      "回放时间：" + (Number.isFinite(Number(t)) ? Number(t).toFixed(1) : "0.0") + " s";
  };

  P.applySimTimeline = function (timeline, st, label) {
    P.simState.timeline = timeline;
    P.simState.frameIndex = 0;
    P._simulationRan = true;
    P._syncSimScrubMax();
    P.drawSimQueueChart?.(timeline);
    if (st) st.textContent = label || "仿真就绪";
    P.updateWorkflowGuide?.();
    P.updateSimStats?.();
    P.updateSimTimeLabel?.();
    P.updateActionGates?.();
    P.draw();
  };

  P.runSimulation = async function () {
    const gate = P.canRunSimulation?.();
    if (gate && !gate.ok) {
      P.showWorkspaceMessage?.(gate.reason, { level: "warn", alsoResult: false });
      const st = document.getElementById("sim-status");
      if (st) st.textContent = gate.reason;
      return;
    }
    if (!P.lastResult) {
      const st = document.getElementById("sim-status");
      if (st) st.textContent = "请先运行优化。";
      return;
    }
    const st = document.getElementById("sim-status");
    const durEl = document.getElementById("sim-duration-min");
    const duration_min = durEl ? parseFloat(durEl.value) || 20 : 20;
    const schedule = { mode: "uniform", duration_min, count: P.lastResult.assign?.length || P.scenario?.n_veh };
    if (st) st.textContent = "仿真计算中…";
    try {
      if (P.api?.simulate) {
        const res = await P.api.simulate(P.lastResult, schedule, true);
        if (res.timeline) {
          P.applySimTimeline(res.timeline, st, "仿真就绪（同步）");
          return;
        }
        if (res.job_id) {
          await P.watchSimJob(res.job_id, st);
          return;
        }
      }
    } catch (e) {
      console.warn("api simulate failed", e);
    }
    P.applySimTimeline(P.runSimulationLocal(P.lastResult, schedule), st, "仿真就绪（本地）");
  };

  P._syncSimScrubMax = function () {
    const slider = document.getElementById("sim-scrub");
    const n = P.simState.timeline?.frames?.length || 0;
    if (slider && n > 0) {
      slider.max = String(n - 1);
      slider.value = String(P.simState.frameIndex || 0);
    }
    P.updateSimTimeLabel?.();
  };

  P.watchSimJob = async function (jobId, st) {
    try {
      if (P.api?.watchJob) {
        const data = await P.api.watchJob(jobId, (msg) => {
          if (!st) return;
          if (msg.status === "running") st.textContent = "仿真计算中（实时）…";
          else if (msg.status === "pending") st.textContent = "仿真排队中…";
        });
        if (data?.result) {
          P.applySimTimeline(data.result, st, "仿真就绪");
          return;
        }
      }
    } catch (e) {
      console.warn("websocket job watch failed, fallback to poll", e);
    }
    await P.pollSimJob(jobId, st);
  };

  P.pollSimJob = async function (jobId, st) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, Math.min(800, 300 + i * 5)));
      const res = await P.api.getJob(jobId);
      const job = res.job;
      if (!job) break;
      if (job.status === "completed" && job.result) {
        P.applySimTimeline(job.result, st, "仿真就绪");
        return;
      }
      if (job.status === "failed") {
        if (st) st.textContent = "仿真失败：" + (job.error || "");
        return;
      }
      if (st) st.textContent = "仿真进行中…（轮询 " + (i + 1) + "/120）";
    }
    if (st) st.textContent = "仿真超时，请重试。";
  };

  P.runSimulationLocal = function (result, schedule) {
    const breakdown = result.vehicle_breakdown || [];
    const n = breakdown.length;
    const duration_s = (schedule.duration_min || 20) * 60;
    const arrivals = [];
    const step = duration_s / Math.max(1, n);
    for (let i = 0; i < n; i++) arrivals.push(i * step);

    const events = breakdown.map((bd, i) => {
      const arr = arrivals[i] ?? i * 5;
      const drive_t = Number(bd.drive_time || 0);
      const walk_t = Number(bd.walk_time || 0);
      const ei = Number(bd.entrance_index || 0);
      const ent = (P.scenario?.entrances || [[0, 0]])[ei] || [0, 0];
      const si = Number(bd.slot_index ?? 0);
      const slot = (P.scenario?.slots || [])[si] || [0, 0];
      const parkAt = [slot[0], slot[1]];
      const dpRaw = result.drive_paths?.[i];
      const drive_path =
        Array.isArray(dpRaw) && dpRaw.length >= 2
          ? dpRaw.map((p) => [Number(p[0]), Number(p[1])])
          : [ent, parkAt];
      return {
        arrival: arr,
        drive_start: arr,
        drive_end: arr + drive_t,
        walk_end: arr + drive_t + walk_t,
        entrance: ent,
        park_at: parkAt,
        drive_path,
        path: result.paths?.[i] || [ent, parkAt],
      };
    });

    const endT = events.length ? Math.max(...events.map((e) => e.walk_end)) : 0;
    const frames = [];
    let queue_len_peak = 0;
    const wait_samples = [];

    for (let t = 0; t <= endT + 0.5; t += 0.5) {
      const vehicles = [];
      let queue = 0;
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        let state = "waiting";
        let x = ev.entrance[0];
        let y = ev.entrance[1];
        if (t < ev.arrival) {
          state = "pending";
        } else if (t < ev.drive_start) {
          state = "queued";
          queue += 1;
          wait_samples.push(t - ev.arrival);
        } else if (t < ev.drive_end) {
          state = "driving";
          const prog = (t - ev.drive_start) / Math.max(1e-6, ev.drive_end - ev.drive_start);
          const pt = P._interpPolylineAtProgress(ev.drive_path, prog);
          x = pt[0];
          y = pt[1];
        } else if (t < ev.walk_end) {
          state = "walking";
          const prog = (t - ev.drive_end) / Math.max(1e-6, ev.walk_end - ev.drive_end);
          const pt = P._interpPolylineAtProgress(ev.path, prog);
          x = pt[0];
          y = pt[1];
        } else {
          state = "done";
          const path = ev.path;
          x = path?.length ? path[path.length - 1][0] : ev.park_at[0];
          y = path?.length ? path[path.length - 1][1] : ev.park_at[1];
        }
        vehicles.push({ index: i, state, x, y });
      }
      queue_len_peak = Math.max(queue_len_peak, queue);
      frames.push({ t: Math.round(t * 100) / 100, vehicles, queue, occupied_count: 0 });
    }

    const total_times = events.map((e) => e.walk_end - e.arrival);
    total_times.sort((a, b) => a - b);
    const p95 = total_times.length
      ? total_times[Math.floor(0.95 * (total_times.length - 1))]
      : 0;

    return {
      frames,
      duration: endT,
      stats: {
        peak_queue: queue_len_peak,
        avg_wait: wait_samples.length ? wait_samples.reduce((a, b) => a + b, 0) / wait_samples.length : 0,
        p95_total_time: p95,
        vehicle_count: n,
      },
    };
  };

  P._polylineLen = function (pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return d;
  };

  P._interpPolylineAtProgress = function (pts, prog) {
    const path = Array.isArray(pts) ? pts : [];
    if (path.length < 2) {
      const p = path[0] || [0, 0];
      return [Number(p[0]) || 0, Number(p[1]) || 0];
    }
    const plen = P._polylineLen(path);
    if (plen < 1e-6) {
      return [Number(path[0][0]), Number(path[0][1])];
    }
    const dist = Math.max(0, Math.min(1, prog)) * plen;
    let remain = dist;
    for (let k = 1; k < path.length; k++) {
      const seg = Math.hypot(path[k][0] - path[k - 1][0], path[k][1] - path[k - 1][1]);
      if (remain <= seg || k === path.length - 1) {
        const u = seg < 1e-9 ? 0 : remain / seg;
        return [
          path[k - 1][0] + (path[k][0] - path[k - 1][0]) * Math.min(1, u),
          path[k - 1][1] + (path[k][1] - path[k - 1][1]) * Math.min(1, u),
        ];
      }
      remain -= seg;
    }
    const last = path[path.length - 1];
    return [Number(last[0]), Number(last[1])];
  };

  P.drawSimQueueChart = function (timeline) {
    const canvas = document.getElementById("sim-queue-chart");
    if (!canvas) return;
    P.syncSimQueueChartSize?.();
    const ctx = canvas.getContext("2d");
    const w = P.simQueueCssW;
    const h = P.simQueueCssH;
    ctx.clearRect(0, 0, w, h);
    const frames = timeline?.frames || [];
    if (frames.length < 2) return;
    const padL = 36;
    const padR = 8;
    const padT = 10;
    const padB = 22;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const t0 = frames[0].t;
    const t1 = frames[frames.length - 1].t || t0 + 1;
    let qMax = 1;
    for (const f of frames) qMax = Math.max(qMax, Number(f.queue) || 0);
    ctx.fillStyle = "#64748b";
    ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(String(qMax), padL - 4, padT + 4);
    ctx.fillText("0", padL - 4, padT + plotH);
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.beginPath();
    ctx.moveTo(padL, padT + plotH);
    ctx.lineTo(padL + plotW, padT + plotH);
    ctx.stroke();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    frames.forEach((f, i) => {
      const x = padL + ((f.t - t0) / Math.max(1e-6, t1 - t0)) * plotW;
      const y = padT + plotH - ((Number(f.queue) || 0) / qMax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText("时间 (s)", padL + plotW / 2, h - padB + 4);
    ctx.textAlign = "left";
    ctx.fillText("排队长度", 4, padT + 2);
  };

  P.toggleSimPlay = function () {
    P.simState.playing = !P.simState.playing;
    if (P.simState.playing) P.simTick();
    else if (P.simState.raf) cancelAnimationFrame(P.simState.raf);
  };

  P.simTick = function () {
    if (!P.simState.playing || !P.simState.timeline?.frames?.length) return;
    P.simState.frameIndex = (P.simState.frameIndex + 1) % P.simState.timeline.frames.length;
    const slider = document.getElementById("sim-scrub");
    if (slider) slider.value = String(P.simState.frameIndex);
    P.updateSimTimeLabel?.();
    P.updateSimStats();
    P.draw();
    P.simState.raf = requestAnimationFrame(() => {
      setTimeout(P.simTick, 80);
    });
  };

  P.updateSimStats = function () {
    const el = document.getElementById("sim-stats");
    const stats = P.simState.timeline?.stats;
    const frame = P.simState.timeline?.frames?.[P.simState.frameIndex];
    if (!el) return;
    if (!stats && !frame) {
      el.textContent = "";
      return;
    }
    el.textContent =
      "峰值排队: " +
      (stats?.peak_queue ?? frame?.queue ?? 0) +
      " · 车辆数: " +
      (stats?.vehicle_count ?? 0) +
      (stats?.p95_total_time != null ? " · P95总耗时: " + stats.p95_total_time.toFixed(1) + " s" : "");
  };

  P.drawSimulationOverlay = function (scale) {
    const tl = P.simState.timeline;
    if (!tl?.frames?.length || P.activeTab !== "simulate") return;
    const frame = tl.frames[P.simState.frameIndex] || tl.frames[0];
    for (const v of frame.vehicles || []) {
      if (v.state === "pending") continue;
      const p = P.worldToScreen(v.x, v.y);
      P.ctx.beginPath();
      P.ctx.arc(p.sx, p.sy, Math.max(5, scale * 0.28), 0, Math.PI * 2);
      P.ctx.fillStyle = v.state === "driving" ? "#2563eb" : v.state === "walking" ? "#0d9488" : "#94a3b8";
      P.ctx.fill();
      P.ctx.strokeStyle = "#fff";
      P.ctx.lineWidth = 1.5;
      P.ctx.stroke();
    }
  };
})();

/* --- app\canvas\viewport.js --- */
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

/* --- app\canvas\layer-controls.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layer-controls.js");

  P.layerVisibility = P.layerVisibility || {
    underlay: true,
    road: true,
    strip: true,
    path: true,
    sim: true,
  };

  P.highlightVehicleIndex = null;

  P.setHighlightVehicle = function (vi) {
    const n = P.lastResult?.assign?.length ?? 0;
    if (!Number.isFinite(vi) || vi < 0 || vi >= n) {
      P.highlightVehicleIndex = null;
    } else {
      P.highlightVehicleIndex = vi === P.highlightVehicleIndex ? null : vi;
    }
    P.draw();
  };

  P.wireLayerControls = function () {
    const map = {
      "layer-underlay": "underlay",
      "layer-road": "road",
      "layer-strip": "strip",
      "layer-path": "path",
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        P.layerVisibility[map[id]] = !!el.checked;
        P.draw();
      });
    });
  };

  P.shouldDrawRoad = function () {
    return P.layerVisibility.road !== false;
  };

  P.shouldDrawUnderlay = function () {
    return P.layerVisibility.underlay !== false;
  };

  P.shouldDrawStrip = function () {
    return P.layerVisibility.strip !== false;
  };

  P.shouldDrawPaths = function () {
    return P.layerVisibility.path !== false;
  };
})();

/* --- app\canvas\layers\underlay-layer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/underlay-layer.js");

  P._underlayImage = null;
  P._underlayImageSrc = "";

  P.ensureUnderlayImage = function (dataUrl) {
    if (!dataUrl) {
      P._underlayImage = null;
      P._underlayImageSrc = "";
      return;
    }
    if (P._underlayImage && P._underlayImageSrc === dataUrl) return;
    const img = new Image();
    img.onload = () => P.draw();
    img.src = dataUrl;
    P._underlayImage = img;
    P._underlayImageSrc = dataUrl;
  };

  P.shouldDrawUnderlay = function () {
    return P.layerVisibility?.underlay !== false;
  };

  P.drawUnderlay = function (scale) {
    if (!P.shouldDrawUnderlay() || !P.scenario) return;
    const u = P.scenario.display?.underlay;
    if (!u?.dataUrl) return;
    const wa = u.worldA;
    const wb = u.worldB;
    const ia = u.imageA;
    const ib = u.imageB;
    if (!wa || !wb || !ia || !ib) return;

    P.ensureUnderlayImage(u.dataUrl);
    const img = P._underlayImage;
    if (!img || !img.complete || !img.naturalWidth) return;

    const wx0 = Number(wa[0]);
    const wy0 = Number(wa[1]);
    const wx1 = Number(wb[0]);
    const wy1 = Number(wb[1]);
    const iu0 = Number(ia[0]);
    const iv0 = Number(ia[1]);
    const iu1 = Number(ib[0]);
    const iv1 = Number(ib[1]);
    const di = Math.hypot(iu1 - iu0, iv1 - iv0);
    const dw = Math.hypot(wx1 - wx0, wy1 - wy0);
    if (di < 1e-6 || dw < 1e-6) return;

    const pxPerImgPx = (dw / di) * scale;
    const rot = Math.atan2(wy1 - wy0, wx1 - wx0) - Math.atan2(iv1 - iv0, iu1 - iu0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const anchor = P.worldToScreen(wx0, wy0);

    P.ctx.save();
    P.ctx.globalAlpha = Number.isFinite(Number(u.opacity)) ? Number(u.opacity) : 0.55;
    P.ctx.setTransform(
      pxPerImgPx * cos,
      pxPerImgPx * sin,
      -pxPerImgPx * sin,
      pxPerImgPx * cos,
      anchor.sx - pxPerImgPx * (iu0 * cos - iv0 * sin),
      anchor.sy - pxPerImgPx * (iu0 * sin + iv0 * cos)
    );
    P.ctx.drawImage(img, 0, 0);
    P.ctx.restore();
  };

  P.drawUnderlayCalibrationMarkers = function (scale) {
    const cal = P.underlayCalibrating;
    if (!cal?.worldPts?.length) return;
    P.ctx.save();
    P.ctx.fillStyle = "#f59e0b";
    P.ctx.strokeStyle = "#ffffff";
    P.ctx.lineWidth = Math.max(2, scale * 0.08);
    cal.worldPts.forEach((pt, i) => {
      const p = P.worldToScreen(pt[0], pt[1]);
      const r = Math.max(5, scale * 0.2);
      P.ctx.beginPath();
      P.ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      P.ctx.fill();
      P.ctx.stroke();
      P.ctx.font = `700 ${Math.max(11, scale * 0.35)}px sans-serif`;
      P.ctx.textAlign = "center";
      P.ctx.textBaseline = "bottom";
      P.ctx.fillText(String.fromCharCode(65 + i), p.sx, p.sy - r - 2);
    });
    if (cal.worldPts.length >= 2) {
      const a = P.worldToScreen(cal.worldPts[0][0], cal.worldPts[0][1]);
      const b = P.worldToScreen(cal.worldPts[1][0], cal.worldPts[1][1]);
      P.ctx.strokeStyle = "#f59e0b";
      P.ctx.setLineDash([6, 4]);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(b.sx, b.sy);
      P.ctx.stroke();
      P.ctx.setLineDash([]);
    }
    P.ctx.restore();
  };
})();

/* --- app\canvas\layers\road-layer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/road-layer.js");

P.drawRoadSegments = function (segs) {
    P.ctx.lineCap = "round";
    P.ctx.lineJoin = "round";
    const scale = P.padScale().scale;
    const lw = Math.max(8, scale * Math.max(2.4, Number(P.scenario?.road?.width || P.DEFAULT_ROAD_WIDTH)));
    for (const [[x1, y1], [x2, y2]] of segs) {
      const p1 = P.worldToScreen(x1, y1);
      const p2 = P.worldToScreen(x2, y2);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.strokeStyle = P.COLORS.road;
      P.ctx.lineWidth = lw;
      P.ctx.stroke();
      P.ctx.strokeStyle = P.COLORS.roadEdge;
      P.ctx.lineWidth = Math.max(3, lw * 0.28);
      P.ctx.stroke();
    }
  }

P.nearestRoadTangentAngle = function (cx, cy) {
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments({ road: P.scenario?.road }) : [];
    let best = null;
    let bestD = Infinity;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const d = P.distPointToSeg(cx, cy, a[0], a[1], b[0], b[1]);
      if (d < bestD) {
        bestD = d;
        best = Math.atan2(dy, dx);
      }
    }
    return P.normalizeAngle(best ?? 0);
  }

P.drawRoadAndParkingStrips = function (scale) {
    P.ensureRoadStructure();
    const roadSegs = P.lastResult?.road_segments || P.buildRoadSegmentsLocal(P.scenario.road);
    if (!P.shouldDrawRoad || P.shouldDrawRoad()) P.drawRoadSegments(roadSegs);
    P.ctx.strokeStyle = P.COLORS.curb;
    P.ctx.lineWidth = Math.max(1.5, scale * 0.04);
    for (const [x1, y1, x2, y2] of P.innerBoundarySegments(P.scenario.road)) {
      const p1 = P.worldToScreen(x1, y1);
      const p2 = P.worldToScreen(x2, y2);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    if (!P.shouldDrawStrip || P.shouldDrawStrip()) {
    P.ctx.save();
    P.ctx.setLineDash([Math.max(4, scale * 0.1), Math.max(3, scale * 0.08)]);
    P.ctx.strokeStyle = P.COLORS.parkingStrip;
    P.ctx.lineWidth = Math.max(1.2, scale * 0.045);
    for (const [[ax, ay], [bx, by]] of P.parkingStripSegments()) {
      const p1 = P.worldToScreen(ax, ay);
      const p2 = P.worldToScreen(bx, by);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    P.ctx.restore();
    }
  }
})();

/* --- app\canvas\layers\draw-primitives.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-primitives.js");

  P.fillRectWorld = function (xmin, ymin, w, h, fill, stroke, lineWidth) {
    const tl = P.worldToScreen(xmin, ymin + h);
    const br = P.worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    if (fill && fill !== "transparent") {
      P.ctx.fillStyle = fill;
      P.ctx.fillRect(x, y, ww, hh);
    }
    if (stroke) {
      P.ctx.strokeStyle = stroke;
      P.ctx.lineWidth = lineWidth != null ? lineWidth : 2;
      P.ctx.strokeRect(x, y, ww, hh);
    }
  };

  /** 世界坐标中心点叠字（描边便于压在路面/屋面上） */
  P.drawStackedWorldLabels = function (wx, wy, lines) {
    if (!lines?.length) return;
    const p = P.worldToScreen(wx, wy);
    const scale = P.padScale().scale;
    const fs = Math.max(12, Math.min(20, scale * 0.42));
    const lh = fs * 1.08;
    P.ctx.save();
    P.ctx.font = `700 ${fs}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    P.ctx.textAlign = "center";
    P.ctx.textBaseline = "middle";
    const half = ((lines.length - 1) * lh) / 2;
    for (let i = 0; i < lines.length; i++) {
      const yy = p.sy - half + i * lh;
      P.ctx.lineWidth = Math.max(2.8, scale * 0.1);
      P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
      P.ctx.fillStyle = "#ffffff";
      P.ctx.strokeText(lines[i], p.sx, yy);
      P.ctx.fillText(lines[i], p.sx, yy);
    }
    P.ctx.restore();
  };
})();

/* --- app\canvas\layers\draw-slots.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-slots.js");

  P.slotThetaAt = function (cx, cy, fallbackTheta = 0) {
    const strips = P.getParkingStripDefs();
    if (strips.length) {
      const lane = P.nearestStripForPoint(cx, cy);
      if (lane) return P.normalizeAngle(lane.theta);
    }
    return P.normalizeAngle(fallbackTheta ?? P.nearestRoadTangentAngle(cx, cy));
  };

  P.slotPolygonAt = function (cx, cy, theta) {
    const t = P.normalizeAngle(theta);
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const halfL = P.B.sw / 2;
    const halfW = P.B.sh / 2;
    const local = [
      [-halfL, -halfW],
      [halfL, -halfW],
      [halfL, halfW],
      [-halfL, halfW],
    ];
    return local.map(([lx, ly]) => [cx + lx * ct - ly * st, cy + lx * st + ly * ct]);
  };

  P.slotFootprint = function (cx, cy, theta) {
    const poly = P.slotPolygonAt(cx, cy, P.slotThetaAt(cx, cy, theta));
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
    return { xmin, ymin, w: xmax - xmin, h: ymax - ymin, theta: P.slotThetaAt(cx, cy, theta), poly };
  };

  /** 俯视标准泊位：沥青块 + 四边白线（完整边框） */
  P.drawParkingSlotWorld = function (cx, cy, theta) {
    const angle = P.slotThetaAt(cx, cy, theta);
    const poly = P.slotPolygonAt(cx, cy, angle).map((p) => P.worldToScreen(p[0], p[1]));
    P.ctx.fillStyle = P.COLORS.slotAsphalt;
    P.ctx.beginPath();
    P.ctx.moveTo(poly[0].sx, poly[0].sy);
    for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
    P.ctx.closePath();
    P.ctx.fill();
    const scale = P.padScale().scale;
    P.ctx.strokeStyle = P.COLORS.slotPaint;
    P.ctx.lineWidth = Math.max(2.2, scale * 0.075);
    P.ctx.lineCap = "square";
    P.ctx.lineJoin = "miter";
    P.ctx.stroke();
  };

  P.drawVehicleSlotAssignments = function () {
    const assign = P.lastResult?.assign;
    const targets = P.lastResult?.veh_targets;
    if (!assign?.length || !targets?.length || !P.scenario?.slots?.length) return;
    const n = Math.min(assign.length, targets.length);
    for (let vi = 0; vi < n; vi++) {
      const si = assign[vi];
      if (si < 0 || si >= P.scenario.slots.length) continue;
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      if (!pose) continue;
      const wx = pose.x;
      const wy = pose.y;
      const b1 = (targets[vi] ?? 0) + 1;
      P.drawStackedWorldLabels(wx, wy, ["车" + (vi + 1), "→楼" + b1]);
    }
  };
})();

/* --- app\canvas\layers\draw-buildings.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-buildings.js");

  /** 居民楼 footprint：阴影 + 屋面渐变 + 窗格 */
  P.drawBuildingWorld = function (cx, cy) {
    const xmin = cx - P.B.bw / 2;
    const ymin = cy - P.B.bh / 2;
    const w = P.B.bw;
    const h = P.B.bh;
    const tl = P.worldToScreen(xmin, ymin + h);
    const br = P.worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    const scale = P.padScale().scale;
    const sh = Math.max(2, scale * 0.14);
    P.ctx.fillStyle = P.COLORS.buildingShadow;
    P.ctx.fillRect(x + sh, y + sh, ww, hh);
    const g = P.ctx.createLinearGradient(x, y, x + ww, y + hh);
    g.addColorStop(0, P.COLORS.buildingRoofHi);
    g.addColorStop(0.55, P.COLORS.buildingRoofLo);
    g.addColorStop(1, "#6b7784");
    P.ctx.fillStyle = g;
    P.ctx.fillRect(x, y, ww, hh);
    P.ctx.strokeStyle = P.COLORS.buildingStroke;
    P.ctx.lineWidth = Math.max(1.2, scale * 0.055);
    P.ctx.strokeRect(x, y, ww, hh);
    const cols = Math.max(3, Math.min(8, Math.round(w / 2.2)));
    const rows = Math.max(2, Math.min(6, Math.round(h / 2.4)));
    P.ctx.strokeStyle = P.COLORS.buildingMullion;
    P.ctx.lineWidth = Math.max(0.55, scale * 0.018);
    for (let i = 1; i < cols; i++) {
      const wx = xmin + (i * w) / cols;
      const p1 = P.worldToScreen(wx, ymin);
      const p2 = P.worldToScreen(wx, ymin + h);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      const wy = ymin + (j * h) / rows;
      const p1 = P.worldToScreen(xmin, wy);
      const p2 = P.worldToScreen(xmin + w, wy);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    P.ctx.strokeStyle = "rgba(255,255,255,0.2)";
    P.ctx.lineWidth = Math.max(0.5, scale * 0.012);
    P.ctx.strokeRect(x + scale * 0.06, y + scale * 0.06, ww - scale * 0.12, hh - scale * 0.12);
  };
})();

/* --- app\canvas\layers\draw-obstacles.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-obstacles.js");

  P.fillObstaclePolygon = function (points) {
    if (!Array.isArray(points) || points.length < 3) return;
    const poly = points.map((p) => P.worldToScreen(Number(p[0]), Number(p[1])));
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
    const g = P.ctx.createLinearGradient(xmin, ymin, xmax, ymax);
    g.addColorStop(0, P.COLORS.grassA);
    g.addColorStop(0.5, P.COLORS.grassB);
    g.addColorStop(1, P.COLORS.grassC);
    P.ctx.beginPath();
    P.ctx.moveTo(poly[0].sx, poly[0].sy);
    for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
    P.ctx.closePath();
    P.ctx.fillStyle = g;
    P.ctx.fill();
    P.ctx.strokeStyle = P.COLORS.grassEdge;
    P.ctx.lineWidth = Math.max(1, P.padScale().scale * 0.06);
    P.ctx.stroke();
  };
})();

/* --- app\canvas\layers\draw-drafts.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-drafts.js");

  P.drawDraftShapes = function (scale) {
    if (P.pendingAdd === "obstacle" && Array.isArray(P.obstacleDraftPoints) && P.obstacleDraftPoints.length) {
      const pts = P.obstacleDraftPoints.slice();
      if (P.obstacleDraftHover) pts.push(P.obstacleDraftHover);
      P.ctx.beginPath();
      const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
      P.ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < pts.length; i++) {
        const p = P.worldToScreen(pts[i][0], pts[i][1]);
        P.ctx.lineTo(p.sx, p.sy);
      }
      P.ctx.strokeStyle = "rgba(15,23,42,0.8)";
      P.ctx.lineWidth = Math.max(1.4, scale * 0.05);
      P.ctx.setLineDash([Math.max(4, scale * 0.08), Math.max(3, scale * 0.06)]);
      P.ctx.stroke();
      P.ctx.setLineDash([]);
      for (let i = 0; i < P.obstacleDraftPoints.length; i++) {
        const p = P.worldToScreen(P.obstacleDraftPoints[i][0], P.obstacleDraftPoints[i][1]);
        P.ctx.beginPath();
        P.ctx.arc(p.sx, p.sy, Math.max(4, scale * 0.15), 0, Math.PI * 2);
        P.ctx.fillStyle = i === 0 && P.obstacleDraftSnapStart ? "#f59e0b" : "#0f766e";
        P.ctx.fill();
      }
    }
    if (P.pendingAdd === "road" && Array.isArray(P.roadDraftPoints) && P.roadDraftPoints.length) {
      const pts = P.roadDraftPoints.slice();
      if (P.roadDraftHover) pts.push(P.roadDraftHover);
      P.ctx.beginPath();
      const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
      P.ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < pts.length; i++) {
        const p = P.worldToScreen(pts[i][0], pts[i][1]);
        P.ctx.lineTo(p.sx, p.sy);
      }
      P.ctx.strokeStyle = "rgba(30,64,175,0.9)";
      P.ctx.lineWidth = Math.max(2, scale * 0.06);
      P.ctx.setLineDash([Math.max(5, scale * 0.09), Math.max(3, scale * 0.06)]);
      P.ctx.stroke();
      P.ctx.setLineDash([]);
      for (let i = 0; i < P.roadDraftPoints.length; i++) {
        const p = P.worldToScreen(P.roadDraftPoints[i][0], P.roadDraftPoints[i][1]);
        P.ctx.beginPath();
        P.ctx.arc(p.sx, p.sy, Math.max(4, scale * 0.15), 0, Math.PI * 2);
        P.ctx.fillStyle = i === 0 && P.roadDraftSnapStart ? "#f59e0b" : "#1d4ed8";
        P.ctx.fill();
      }
    }
  };
})();

/* --- app\canvas\layers\draw-entrances.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-entrances.js");

  P.drawEntrances = function (scale) {
    for (let ei = 0; ei < P.scenario.entrances.length; ei++) {
      const e = P.scenario.entrances[ei];
      const ep = P.worldToScreen(e[0], e[1]);
      const er = Math.max(8, scale * 0.42);
      P.ctx.beginPath();
      P.ctx.arc(ep.sx, ep.sy, er, 0, Math.PI * 2);
      P.ctx.fillStyle = P.COLORS.entranceFill;
      P.ctx.fill();
      P.ctx.strokeStyle = P.COLORS.entranceStroke;
      P.ctx.lineWidth = Math.max(1.5, scale * 0.05);
      P.ctx.stroke();
      const fs = Math.max(10, Math.min(16, scale * 0.36));
      P.ctx.fillStyle = "#ffffff";
      P.ctx.font = `700 ${fs}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      P.ctx.textAlign = "center";
      P.ctx.textBaseline = "middle";
      P.ctx.fillText(String(ei + 1), ep.sx, ep.sy + 0.4);
    }
  };
})();

/* --- app\canvas\layers\objects-layer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/objects-layer.js");

  P.drawScenarioObjects = function (scale) {
    for (const o of P.scenario.obstacles) {
      P.fillObstaclePolygon(o.points);
    }
    P.drawDraftShapes(scale);
    for (const s of P.scenario.slots) {
      const pose = P.slotPoseOf(s);
      if (!pose) continue;
      P.drawParkingSlotWorld(pose.x, pose.y, pose.theta);
    }
    for (let bi = 0; bi < P.scenario.buildings.length; bi++) {
      const [x, y] = P.scenario.buildings[bi];
      P.drawBuildingWorld(x, y);
      P.drawStackedWorldLabels(x, y, [String(bi + 1)]);
    }
  };
})();

/* --- app\canvas\layers\hover-layer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/hover-layer.js");

  P.drawHoverBalloon = function () {
    if (!P.hoverTarget) return;
    const lines = P.getTooltipLines(P.hoverTarget);
    if (!lines.length) return;

    const FONT_PX = 12;
    const PAD_X = 10;
    const PAD_Y = 7;
    const LINE_H = 17;
    const ARROW_H = 7;
    const R = 4;

    P.ctx.save();
    const FONT_NORMAL = FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
    let maxW = 0;
    for (let i = 0; i < lines.length; i++) {
      P.ctx.font = i === 0 ? "bold " + FONT_NORMAL : FONT_NORMAL;
      maxW = Math.max(maxW, P.ctx.measureText(lines[i]).width);
    }
    const boxW = maxW + PAD_X * 2 + 12;
    const boxH = lines.length * LINE_H + PAD_Y * 2;

    const { sx, sy } = P.worldToScreen(P.hoverTarget.wx, P.hoverTarget.wy);
    let bx = sx - boxW / 2;
    let by = sy - boxH - ARROW_H - 6;
    let arrowBelow = true;

    if (by < 2) {
      by = sy + ARROW_H + 6;
      arrowBelow = false;
    }
    bx = Math.max(2, Math.min(P.mapCssW - boxW - 2, bx));
    const ax = Math.max(bx + R + 6, Math.min(bx + boxW - R - 6, sx));

    P.ctx.shadowColor = "rgba(0,0,0,0.55)";
    P.ctx.shadowBlur = 10;
    P.ctx.shadowOffsetY = 3;

    P.ctx.beginPath();
    P.ctx.moveTo(bx + R, by);
    if (!arrowBelow) {
      P.ctx.lineTo(ax - 7, by);
      P.ctx.lineTo(ax, by - ARROW_H);
      P.ctx.lineTo(ax + 7, by);
    }
    P.ctx.lineTo(bx + boxW - R, by);
    P.ctx.arcTo(bx + boxW, by, bx + boxW, by + R, R);
    P.ctx.lineTo(bx + boxW, by + boxH - R);
    P.ctx.arcTo(bx + boxW, by + boxH, bx + boxW - R, by + boxH, R);
    if (arrowBelow) {
      P.ctx.lineTo(ax + 7, by + boxH);
      P.ctx.lineTo(ax, by + boxH + ARROW_H);
      P.ctx.lineTo(ax - 7, by + boxH);
    }
    P.ctx.lineTo(bx + R, by + boxH);
    P.ctx.arcTo(bx, by + boxH, bx, by + boxH - R, R);
    P.ctx.lineTo(bx, by + R);
    P.ctx.arcTo(bx, by, bx + R, by, R);
    P.ctx.closePath();
    P.ctx.fillStyle = "rgba(10, 16, 28, 0.95)";
    P.ctx.fill();
    P.ctx.shadowColor = "transparent";
    P.ctx.strokeStyle = "rgba(59,130,246,0.5)";
    P.ctx.lineWidth = 0.9;
    P.ctx.stroke();

    P.ctx.textAlign = "left";
    P.ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        P.ctx.fillStyle = "#f1f5f9";
        P.ctx.font = "bold " + FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      } else {
        P.ctx.fillStyle = "#94a3b8";
        P.ctx.font = FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      }
      P.ctx.fillText(lines[i], bx + PAD_X, by + PAD_Y + i * LINE_H);
    }
    P.ctx.restore();
  };
})();

/* --- app\canvas\layers\overlay-layer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/overlay-layer.js");

  function strokePathPoly(poly, scale, style) {
    if (poly.length < 2) return;
    const baseWidth = style.baseWidth ?? Math.max(2.2, scale * 0.085);
    const glowWidth = style.glowWidth ?? baseWidth + Math.max(2.4, scale * 0.09);
    P.ctx.lineCap = "round";
    P.ctx.lineJoin = "round";
    P.ctx.strokeStyle = style.glow || P.COLORS.pathGlow;
    P.ctx.lineWidth = glowWidth;
    P.ctx.beginPath();
    const p0 = P.worldToScreen(poly[0][0], poly[0][1]);
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    P.ctx.strokeStyle = style.stroke || P.COLORS.path;
    P.ctx.lineWidth = baseWidth;
    P.ctx.beginPath();
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    if (style.endDot !== false) {
      const pend = P.worldToScreen(poly[poly.length - 1][0], poly[poly.length - 1][1]);
      const endR = Math.max(2.8, scale * 0.13);
      P.ctx.beginPath();
      P.ctx.arc(pend.sx, pend.sy, endR, 0, Math.PI * 2);
      P.ctx.fillStyle = style.endFill || P.COLORS.pathEnd;
      P.ctx.fill();
      P.ctx.strokeStyle = "rgba(255,255,255,0.9)";
      P.ctx.lineWidth = Math.max(1, scale * 0.05);
      P.ctx.stroke();
    }
  }

  function strokeDashedPathPoly(poly, scale, style) {
    if (poly.length < 2) return;
    const baseWidth = style.baseWidth ?? Math.max(2, scale * 0.075);
    const dash = style.dash ?? [Math.max(5, scale * 0.18), Math.max(4, scale * 0.12)];
    P.ctx.lineCap = "round";
    P.ctx.lineJoin = "round";
    P.ctx.setLineDash(dash);
    P.ctx.strokeStyle = style.glow || "rgba(168,85,247,0.35)";
    P.ctx.lineWidth = baseWidth + Math.max(2, scale * 0.08);
    P.ctx.beginPath();
    const p0 = P.worldToScreen(poly[0][0], poly[0][1]);
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    P.ctx.strokeStyle = style.stroke || "#06b6d4";
    P.ctx.lineWidth = baseWidth;
    P.ctx.beginPath();
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    P.ctx.setLineDash([]);
    if (style.endDot !== false) {
      const pend = P.worldToScreen(poly[poly.length - 1][0], poly[poly.length - 1][1]);
      const endR = Math.max(2.5, scale * 0.11);
      P.ctx.beginPath();
      P.ctx.arc(pend.sx, pend.sy, endR, 0, Math.PI * 2);
      P.ctx.fillStyle = style.endFill || "#a855f7";
      P.ctx.fill();
    }
  }

P.drawDrivePaths = function (scale) {
    if (!P.lastResult?.drive_paths?.length) return;
    const hi = P.highlightVehicleIndex;
    const dim = {
      glow: "rgba(168,85,247,0.12)",
      stroke: "rgba(6,182,212,0.28)",
      endFill: "rgba(168,85,247,0.35)",
      baseWidth: Math.max(1.4, scale * 0.055),
    };
    const bright = {
      glow: "rgba(168,85,247,0.55)",
      stroke: "#a855f7",
      endFill: "#c084fc",
      baseWidth: Math.max(2.8, scale * 0.1),
    };
    P.lastResult.drive_paths.forEach((poly, vi) => {
      if (!poly?.length) return;
      if (hi != null && vi !== hi) strokeDashedPathPoly(poly, scale, dim);
      else if (hi == null) strokeDashedPathPoly(poly, scale, {});
    });
    if (hi != null && P.lastResult.drive_paths[hi]?.length) {
      strokeDashedPathPoly(P.lastResult.drive_paths[hi], scale, bright);
    }
  };

P.drawResultPaths = function (scale) {
    P.drawDrivePaths(scale);
    if (!P.lastResult?.paths?.length) return;
    const hi = P.highlightVehicleIndex;
    const dim = {
      glow: "rgba(59,130,246,0.12)",
      stroke: "rgba(59,130,246,0.22)",
      endFill: "rgba(59,130,246,0.35)",
      baseWidth: Math.max(1.6, scale * 0.06),
    };
    const bright = {
      glow: "rgba(250,204,21,0.55)",
      stroke: "#f59e0b",
      endFill: "#fbbf24",
      baseWidth: Math.max(3.2, scale * 0.12),
      glowWidth: Math.max(5, scale * 0.18),
    };
    P.lastResult.paths.forEach((poly, vi) => {
      if (hi != null && vi !== hi) strokePathPoly(poly, scale, dim);
      else if (hi == null) strokePathPoly(poly, scale, {});
    });
    if (hi != null && P.lastResult.paths[hi]) {
      strokePathPoly(P.lastResult.paths[hi], scale, bright);
    }
  }

P.drawViolationSlotHighlights = function (scale) {
    const items = P.lastResult?.vehicle_breakdown;
    if (!Array.isArray(items) || !P.scenario?.slots?.length) return;
    const violators = items.filter((it) => Number(it.penalty || 0) > 0);
    if (!violators.length) return;
    for (const it of violators) {
      const si = Number(it.slot_index);
      if (!Number.isFinite(si) || si < 0 || si >= P.scenario.slots.length) continue;
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      if (!pose) continue;
      const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((pt) =>
        P.worldToScreen(pt[0], pt[1])
      );
      P.ctx.strokeStyle = "#ef4444";
      P.ctx.lineWidth = Math.max(3, scale * 0.12);
      P.ctx.beginPath();
      P.ctx.moveTo(poly[0].sx, poly[0].sy);
      for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
      P.ctx.closePath();
      P.ctx.stroke();
    }
  };

P.drawVehicleChainHighlight = function (scale) {
    const vi = P.highlightVehicleIndex;
    if (vi == null || !P.lastResult || !P.scenario) return;
    const si = P.lastResult.assign?.[vi];
    const bi = P.lastResult.veh_targets?.[vi];
    const ei = P.lastResult.veh_entrances?.[vi];
    const ring = Math.max(6, scale * 0.35);
    const drawRing = (wx, wy, color) => {
      const p = P.worldToScreen(wx, wy);
      P.ctx.beginPath();
      P.ctx.arc(p.sx, p.sy, ring, 0, Math.PI * 2);
      P.ctx.strokeStyle = color;
      P.ctx.lineWidth = Math.max(2.5, scale * 0.1);
      P.ctx.stroke();
    };
    if (Number.isFinite(ei) && P.scenario.entrances?.[ei]) {
      const e = P.scenario.entrances[ei];
      drawRing(e[0], e[1], "#22c55e");
      P.drawStackedWorldLabels(e[0], e[1], ["入口 " + (ei + 1)]);
    }
    if (Number.isFinite(si) && P.scenario.slots?.[si]) {
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      if (pose) {
        const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((pt) =>
          P.worldToScreen(pt[0], pt[1])
        );
        P.ctx.strokeStyle = "#f59e0b";
        P.ctx.lineWidth = Math.max(3, scale * 0.12);
        P.ctx.beginPath();
        P.ctx.moveTo(poly[0].sx, poly[0].sy);
        for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
        P.ctx.closePath();
        P.ctx.stroke();
      }
    }
    if (Number.isFinite(bi) && P.scenario.buildings?.[bi]) {
      const [bx, by] = P.scenario.buildings[bi];
      P.fillRectWorld(
        bx - P.B.bw / 2,
        by - P.B.bh / 2,
        P.B.bw,
        P.B.bh,
        "rgba(251,191,36,0.18)",
        "#f59e0b",
        Math.max(3, scale * 0.1)
      );
      P.drawStackedWorldLabels(bx, by, ["楼 " + (bi + 1)]);
    }
  }

P.drawSelectionOutline = function () {
    if (!P.selection) return;
    P.ctx.strokeStyle = P.COLORS.select;
    P.ctx.lineWidth = 3;
    if (P.selection.kind === "entrance") {
      const e = P.scenario.entrances[P.selection.index ?? 0];
      const ep = P.worldToScreen(e[0], e[1]);
      P.ctx.beginPath();
      P.ctx.arc(ep.sx, ep.sy, P.padScale().scale * 1.18, 0, Math.PI * 2);
      P.ctx.stroke();
    } else if (P.selection.kind === "obstacle") {
      const o = P.scenario.obstacles[P.selection.index ?? 0];
      if (o?.points?.length >= 3) {
        const p0 = P.worldToScreen(o.points[0][0], o.points[0][1]);
        P.ctx.beginPath();
        P.ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < o.points.length; i++) {
          const pi = P.worldToScreen(o.points[i][0], o.points[i][1]);
          P.ctx.lineTo(pi.sx, pi.sy);
        }
        P.ctx.closePath();
        P.ctx.stroke();
        for (let i = 0; i < o.points.length; i++) {
          const v = P.worldToScreen(o.points[i][0], o.points[i][1]);
          P.ctx.beginPath();
          P.ctx.arc(v.sx, v.sy, Math.max(4, P.padScale().scale * 0.18), 0, Math.PI * 2);
          P.ctx.fillStyle = "#ffffff";
          P.ctx.fill();
          P.ctx.strokeStyle = P.COLORS.select;
          P.ctx.lineWidth = 2;
          P.ctx.stroke();
        }
      }
    } else if (P.selection.kind === "road") {
      const pts = P.scenario.road?.centerline || [];
      if (pts.length >= 2) {
        const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
        P.ctx.beginPath();
        P.ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < pts.length; i++) {
          const pi = P.worldToScreen(pts[i][0], pts[i][1]);
          P.ctx.lineTo(pi.sx, pi.sy);
        }
        P.ctx.stroke();
        for (let i = 0; i < pts.length; i++) {
          const v = P.worldToScreen(pts[i][0], pts[i][1]);
          P.ctx.beginPath();
          P.ctx.arc(v.sx, v.sy, Math.max(4, P.padScale().scale * 0.18), 0, Math.PI * 2);
          P.ctx.fillStyle = "#ffffff";
          P.ctx.fill();
          P.ctx.strokeStyle = P.COLORS.select;
          P.ctx.lineWidth = 2;
          P.ctx.stroke();
        }
      }
    } else if (P.selection.kind === "building") {
      const [x, y] = P.scenario.buildings[P.selection.index];
      P.fillRectWorld(
        x - P.B.bw / 2,
        y - P.B.bh / 2,
        P.B.bw,
        P.B.bh,
        "transparent",
        P.COLORS.select,
        3
      );
    } else if (P.selection.kind === "slot") {
      const pose = P.slotPoseOf(P.scenario.slots[P.selection.index]);
      if (!pose) return;
      const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((p) => P.worldToScreen(p[0], p[1]));
      P.ctx.beginPath();
      P.ctx.moveTo(poly[0].sx, poly[0].sy);
      for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
      P.ctx.closePath();
      P.ctx.stroke();
    }
  }

P.drawMapOverlays = function () {
    if (!P.scenario) return;
    const { scale } = P.padScale();
    const Lm = P.scaleBarWorldM();
    const barPx = Lm * scale;
    const pad = 14;
    const yLine = P.mapCssH - pad;
    const xBar0 = pad;
    const xBar1 = pad + barPx;
    P.ctx.save();
    P.ctx.strokeStyle = "#5c6b82";
    P.ctx.fillStyle = "#b4c2d6";
    P.ctx.lineWidth = 2.5;
    P.ctx.lineCap = "butt";
    P.ctx.beginPath();
    P.ctx.moveTo(xBar0, yLine);
    P.ctx.lineTo(xBar1, yLine);
    P.ctx.stroke();
    const tick = 5;
    P.ctx.beginPath();
    P.ctx.moveTo(xBar0, yLine - tick);
    P.ctx.lineTo(xBar0, yLine);
    P.ctx.moveTo(xBar1, yLine - tick);
    P.ctx.lineTo(xBar1, yLine);
    P.ctx.stroke();
    const midX = (xBar0 + xBar1) / 2;
    const label = P.fmtDim(Lm) + " " + P.uLen();
    const fsScale = Math.max(11, Math.min(14, scale * 0.35));
    P.ctx.font = `700 ${fsScale}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    P.ctx.textAlign = "center";
    P.ctx.textBaseline = "bottom";
    const gap = 6;
    const labelY = yLine - tick - gap;
    P.ctx.lineWidth = 2.5;
    P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
    P.ctx.fillStyle = "#ffffff";
    P.ctx.strokeText(label, midX, labelY);
    P.ctx.fillText(label, midX, labelY);
    if (P.pendingAdd) {
      const labels = {
        entrance: "入口",
        road: "道路",
        obstacle: "花坛",
        building: "居民楼",
        slot: "车位",
      };
      const hint = "绘制" + (labels[P.pendingAdd] || P.pendingAdd) + " · Esc 取消";
      P.ctx.font = `700 12px "Segoe UI", "Microsoft YaHei", sans-serif`;
      P.ctx.textAlign = "left";
      P.ctx.textBaseline = "top";
      P.ctx.lineWidth = 2.5;
      P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
      P.ctx.fillStyle = "#ffffff";
      P.ctx.strokeText(hint, pad, pad);
      P.ctx.fillText(hint, pad, pad);
    }
    P.ctx.restore();

    const cap = document.getElementById("map-unit-caption");
    if (cap) {
      cap.textContent =
        (P.scenario.display?.coord_note || "") + " · 比例尺见画布左下角";
    }
    const lotHint = document.getElementById("lot-dim-hint");
    if (lotHint) {
      const ox = P.fmtDim(P.lotX0());
      const oy = P.fmtDim(P.lotY0());
      const zoomPct = Math.round((P.viewZoom ?? 1) * 100);
      lotHint.textContent =
        "地块 " +
        P.fmtDim(P.lotW()) +
        " × " +
        P.fmtDim(P.lotH()) +
        " " +
        P.uLen() +
        "（原点 " +
        ox +
        "," +
        oy +
        "）· 缩放 " +
        zoomPct +
        "% · 右键拖动画布，滚轮缩放";
    }
  }
})();

/* --- app\canvas\renderer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/renderer.js");

P.drawWorldGrid = function () {
    const topLeft = P.screenToWorld(0, 0);
    const bottomRight = P.screenToWorld(P.mapCssW, P.mapCssH);
    const x0 = Math.floor(Math.min(topLeft.wx, bottomRight.wx));
    const x1 = Math.ceil(Math.max(topLeft.wx, bottomRight.wx));
    const y0 = Math.floor(Math.min(topLeft.wy, bottomRight.wy));
    const y1 = Math.ceil(Math.max(topLeft.wy, bottomRight.wy));
    const step = P.scaleBarWorldM() >= 10 ? 10 : 5;
    P.ctx.save();
    P.ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    P.ctx.lineWidth = 1;
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      const a = P.worldToScreen(x, y0);
      const b = P.worldToScreen(x, y1);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(b.sx, b.sy);
      P.ctx.stroke();
    }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
      const a = P.worldToScreen(x0, y);
      const b = P.worldToScreen(x1, y);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(b.sx, b.sy);
      P.ctx.stroke();
    }
    P.ctx.restore();
  };

P.draw = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    P.ensureLotOrigin();
    P.syncMapCanvasSize();
    const { scale } = P.padScale();
    P.ctx.clearRect(0, 0, P.mapCssW, P.mapCssH);
    P.ctx.fillStyle = "#e8edf2";
    P.ctx.fillRect(0, 0, P.mapCssW, P.mapCssH);
    if (!P.drag) P.drawWorldGrid();
    if (P.drawUnderlay) P.drawUnderlay(scale);
    const tl = P.worldToScreen(P.lotX0(), P.lotY1());
    const br = P.worldToScreen(P.lotX1(), P.lotY0());
    const lotWp = br.sx - tl.sx;
    const lotHp = br.sy - tl.sy;
    const glot = P.ctx.createLinearGradient(tl.sx, tl.sy, tl.sx + lotWp, tl.sy + lotHp);
    glot.addColorStop(0, P.COLORS.lotGradientTop);
    glot.addColorStop(1, P.COLORS.lotGradientBot);
    P.ctx.fillStyle = glot;
    P.ctx.fillRect(tl.sx, tl.sy, lotWp, lotHp);

    if (!P.shouldDrawRoad || P.shouldDrawRoad()) P.drawRoadAndParkingStrips(scale);
    P.drawScenarioObjects(scale);
    P.drawEntrances(scale);
    if (!P.shouldDrawPaths || P.shouldDrawPaths()) P.drawResultPaths(scale);
    if (P.drawVehicleChainHighlight) P.drawVehicleChainHighlight(scale);
    if (P.drawViolationSlotHighlights) P.drawViolationSlotHighlights(scale);
    if (P.drawUnderlayCalibrationMarkers) P.drawUnderlayCalibrationMarkers(scale);

    P.drawVehicleSlotAssignments();
    if (P.drawSimulationOverlay) P.drawSimulationOverlay(scale);
    P.drawSelectionOutline();
    P.drawMapOverlays();
    if (P.hoverTarget && !P.drag && !P.pendingAdd && !P.panDrag) P.drawHoverBalloon();
    if (!P.drag) P.schedulePersistCurrentState();
  }
})();

/* --- app\canvas\chart.js --- */
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

/* --- app\interaction\pick.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/interaction/pick.js");

P.hitInnerRoad = function (wx, wy) {
    let best = Infinity;
    for (const [x1, y1, x2, y2] of P.innerBoundarySegments(P.scenario.road || P.scenario.inner)) {
      const d = P.distPointToSeg(wx, wy, x1, y1, x2, y2);
      if (d < best) best = d;
    }
    const roadHalf = Math.max(1.2, Number(P.scenario?.road?.width || P.DEFAULT_ROAD_WIDTH) / 2);
    return best <= roadHalf + 0.4;
  }

P.pickAt = function (wx, wy) {
    for (let i = P.scenario.entrances.length - 1; i >= 0; i--) {
      const ent = P.scenario.entrances[i];
      if (Math.hypot(wx - ent[0], wy - ent[1]) < 1.2) return { kind: "entrance", index: i };
    }

    for (let i = P.scenario.buildings.length - 1; i >= 0; i--) {
      const [bx, by] = P.scenario.buildings[i];
      if (
        Math.abs(wx - bx) <= P.B.bw / 2 + P.HIT_PAD &&
        Math.abs(wy - by) <= P.B.bh / 2 + P.HIT_PAD
      )
        return { kind: "building", index: i };
    }
    for (let i = P.scenario.slots.length - 1; i >= 0; i--) {
      const pose = P.slotPoseOf(P.scenario.slots[i]);
      if (!pose) continue;
      const foot = P.slotFootprint(pose.x, pose.y, pose.theta);
      if (P._pointInPolygon(wx, wy, foot.poly, true)) return { kind: "slot", index: i };
    }

    for (let i = P.scenario.obstacles.length - 1; i >= 0; i--) {
      if (P._pointInPolygon(wx, wy, P.scenario.obstacles[i].points, true)) return { kind: "obstacle", index: i };
    }

    if (P.hitInnerRoad(wx, wy)) return { kind: "road" };

    return null;
  }

P.pickObstacleVertex = function (wx, wy, obstacleIndex, maxPx = 14) {
    const o = P.scenario?.obstacles?.[obstacleIndex];
    if (!o?.points?.length) return null;
    const m = P.worldToScreen(wx, wy);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < o.points.length; i++) {
      const p = o.points[i];
      const sp = P.worldToScreen(Number(p[0]), Number(p[1]));
      const d = Math.hypot(m.sx - sp.sx, m.sy - sp.sy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 || bestD > maxPx) return null;
    return best;
  }

P.pickAnyObstacleVertex = function (wx, wy, maxPx = 16) {
    if (!P.scenario?.obstacles?.length) return null;
    let best = null;
    let bestD = Infinity;
    const m = P.worldToScreen(wx, wy);
    for (let oi = 0; oi < P.scenario.obstacles.length; oi++) {
      const o = P.scenario.obstacles[oi];
      if (!o?.points?.length) continue;
      for (let vi = 0; vi < o.points.length; vi++) {
        const p = o.points[vi];
        const sp = P.worldToScreen(Number(p[0]), Number(p[1]));
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

P.pickRoadVertex = function (wx, wy, maxPx = 16) {
    const pts = P.scenario?.road?.centerline;
    if (!Array.isArray(pts) || !pts.length) return null;
    const m = P.worldToScreen(wx, wy);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p = P.worldToScreen(Number(pts[i][0]), Number(pts[i][1]));
      const d = Math.hypot(m.sx - p.sx, m.sy - p.sy);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0 || bestD > maxPx) return null;
    return best;
  }

P.getHoveredElement = function (wx, wy) {
    if (!P.scenario) return null;
    const entrances = P.scenario.entrances || [];
    for (let i = 0; i < entrances.length; i++) {
      const [ex, ey] = entrances[i];
      if (Math.hypot(wx - ex, wy - ey) < 3.5) {
        return { type: "entrance", index: i, wx: ex, wy: ey };
      }
    }
    const slots = P.scenario.slots || [];
    const hitR = Math.max(P.B.sw, P.B.sh) * 0.5 + 0.6;
    for (let i = 0; i < slots.length; i++) {
      const [sx, sy] = slots[i];
      if (Math.hypot(wx - sx, wy - sy) < hitR) {
        return { type: "slot", index: i, wx: sx, wy: sy };
      }
    }
    const buildings = P.scenario.buildings || [];
    for (let i = 0; i < buildings.length; i++) {
      const [bx, by] = buildings[i];
      if (Math.abs(wx - bx) < P.B.bw / 2 && Math.abs(wy - by) < P.B.bh / 2) {
        return { type: "building", index: i, wx: bx, wy: by };
      }
    }
    return null;
  }

P.getTooltipLines = function (target) {
    if (!target) return [];
    if (target.type === "entrance") {
      const [ex, ey] = P.scenario.entrances[target.index];
      return ["入口 " + (target.index + 1), "坐标 (" + ex.toFixed(1) + ", " + ey.toFixed(1) + ")"];
    }
    if (target.type === "slot") {
      const i = target.index;
      const lines = ["车位 " + (i + 1)];
      if (P.lastResult && Array.isArray(P.lastResult.assign)) {
        const vehIdx = P.lastResult.assign.indexOf(i);
        if (vehIdx >= 0) {
          const bd = P.lastResult.vehicle_breakdown?.[vehIdx];
          const targetBldg = P.lastResult.veh_targets?.[vehIdx];
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
      if (P.lastResult && Array.isArray(P.lastResult.veh_targets)) {
        const count = P.lastResult.veh_targets.filter((t) => t === i).length;
        lines.push(count + " 辆车目的地");
      }
      return lines;
    }
    return [];
  }
})();

/* --- app\interaction\draft-tools.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/interaction/draft-tools.js");

P.appendObstacleDraftPoint = function (wx, wy) {
    const c = P.clampWorld(wx, wy);
    if (!P.obstacleDraftPoints) P.obstacleDraftPoints = [];
    const last = P.obstacleDraftPoints[P.obstacleDraftPoints.length - 1];
    if (last && Math.hypot(last[0] - c.wx, last[1] - c.wy) < 0.35) return;
    P.obstacleDraftPoints.push([c.wx, c.wy]);
  }

P.obstacleDraftSnap = function (wx, wy) {
    const c = P.clampWorld(wx, wy);
    const pts = P.obstacleDraftPoints || [];
    if (pts.length >= 3) {
      const s = pts[0];
      if (Math.hypot(c.wx - s[0], c.wy - s[1]) <= 1.2) {
        return { wx: s[0], wy: s[1], snapToStart: true };
      }
    }
    return { wx: c.wx, wy: c.wy, snapToStart: false };
  }

P.cancelObstacleDraft = function () {
    P.obstacleDraftPoints = null;
    P.obstacleDraftHover = null;
    P.obstacleDraftSnapStart = false;
    P.draw();
  }

P.appendRoadDraftPoint = function (wx, wy) {
    const c = P.clampWorld(wx, wy);
    if (!P.roadDraftPoints) P.roadDraftPoints = [];
    const last = P.roadDraftPoints[P.roadDraftPoints.length - 1];
    if (last && Math.hypot(last[0] - c.wx, last[1] - c.wy) < 0.35) return;
    P.roadDraftPoints.push([c.wx, c.wy]);
  }

P.roadDraftSnap = function (wx, wy) {
    const c = P.clampWorld(wx, wy);
    const pts = P.roadDraftPoints || [];
    if (pts.length >= 3 && P.roadDraftClosed) {
      const s = pts[0];
      if (Math.hypot(c.wx - s[0], c.wy - s[1]) <= 1.2) {
        return { wx: s[0], wy: s[1], snapToStart: true };
      }
    }
    return { wx: c.wx, wy: c.wy, snapToStart: false };
  }

P.cancelRoadDraft = function () {
    P.roadDraftPoints = null;
    P.roadDraftHover = null;
    P.roadDraftSnapStart = false;
    P.draw();
  }

P.finalizeRoadDraft = function () {
    if (!P.scenario || !P.roadDraftPoints || P.roadDraftPoints.length < 2) return false;
    const centerline = P.roadDraftPoints.map((p) => [Number(p[0]), Number(p[1])]);
    if (P.roadDraftClosed && centerline.length >= 3 && !P.pointsNear(centerline[0], centerline[centerline.length - 1])) {
      centerline.push([centerline[0][0], centerline[0][1]]);
    }
    const nextRoad = P.normalizeRoadShape({
      centerline,
      width: P.scenario?.road?.width || P.DEFAULT_ROAD_WIDTH,
      closed: P.roadDraftClosed,
    }, P.scenario.inner);
    if (!nextRoad) return false;
    const prevRoad = P.scenario.road ? JSON.parse(JSON.stringify(P.scenario.road)) : null;
    P.scenario.road = nextRoad;
    P.ensureRoadStructure();
    const check = P.validateRoadNoOverlap();
    if (!check.ok) {
      P.scenario.road = prevRoad;
      P.ensureRoadStructure();
      P.notifyRoadGeometryInvalid(check.reason);
      return false;
    }
    P.roadDraftPoints = null;
    P.roadDraftHover = null;
    P.roadDraftSnapStart = false;
    P.pendingAdd = null;
    P.setSelection({ kind: "road" });
    P.invalidateOptimizationResult();
    P.commitSceneGeometry();
    return true;
  }

P.finalizeObstacleDraft = function () {
    if (!P.scenario || !P.obstacleDraftPoints || P.obstacleDraftPoints.length < 3) return false;
    if (P.polygonHasSelfIntersection(P.obstacleDraftPoints)) {
      P.notifyObstacleGeometryInvalid("self_intersect");
      return false;
    }
    const poly = P.normalizeObstacleShape({ points: P.obstacleDraftPoints });
    if (!poly) {
      P.notifyObstacleGeometryInvalid("invalid");
      return false;
    }
    P.scenario.obstacles.push(poly);
    if (!P.normalizeObstacleInner()) {
      P.scenario.obstacles.pop();
      P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
      return false;
    }
    const idx = P.scenario.obstacles.length - 1;
    P.obstacleDraftPoints = null;
    P.obstacleDraftHover = null;
    P.obstacleDraftSnapStart = false;
    P.pendingAdd = null;
    P.setSelection({ kind: "obstacle", index: idx });
    P.invalidateOptimizationResult();
    P.commitSceneGeometry();
    return true;
  }
})();

/* --- app\interaction\drag-session.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/interaction/drag-session.js");

  P.scheduleDragRedraw = function () {
    if (P.dragRafPending) return;
    P.dragRafPending = true;
    requestAnimationFrame(() => {
      P.dragRafPending = false;
      if (!P.drag) return;
      P.draw();
    });
  };

  P.beginDragForHit = function (hit, wx, wy) {
    if (hit.kind === "entrance") {
      P.drag = { kind: "entrance", index: hit.index ?? 0, ox: 0, oy: 0 };
      return;
    }
    if (hit.kind === "obstacle") {
      const vi = P.pickObstacleVertex(wx, wy, hit.index ?? 0, 16);
      if (vi != null && vi >= 0) {
        P.drag = {
          kind: "obstacle-vertex",
          index: hit.index ?? 0,
          vertexIndex: vi,
          ox: 0,
          oy: 0,
          origPoints: (P.scenario.obstacles[hit.index ?? 0].points || []).map((p) => [p[0], p[1]]),
        };
        return;
      }
      P.drag = {
        kind: "obstacle",
        index: hit.index ?? 0,
        startW: { wx, wy },
        origPoints: (P.scenario.obstacles[hit.index ?? 0].points || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    if (hit.kind === "road") {
      P.drag = {
        kind: "road",
        startW: { wx, wy },
        origPoints: (P.scenario.road?.centerline || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    if (hit.kind === "building") {
      P.drag = { kind: "building", index: hit.index, ox: 0, oy: 0 };
      return;
    }
    if (hit.kind === "slot") {
      P.drag = { kind: "slot", index: hit.index, ox: 0, oy: 0 };
    }
  };

  P.updateDragFromPointer = function (wx, wy) {
    if (!P.drag || !P.scenario) return false;

    if (P.drag.kind === "entrance") {
      const c = P.clampWorld(wx + P.drag.ox, wy + P.drag.oy);
      const s = P.snapEntranceToInner(c.wx, c.wy);
      const cur = P.scenario.entrances[P.drag.index];
      const best = P.slideToward(cur[0], cur[1], s.wx, s.wy, (x, y) => P.canPlaceEntrance(x, y));
      P.scenario.entrances[P.drag.index][0] = best.wx;
      P.scenario.entrances[P.drag.index][1] = best.wy;
      P.ensureScenarioCollections();
    } else if (P.drag.kind === "building") {
      const target = P.clampBuildingCenter(wx + P.drag.ox, wy + P.drag.oy);
      const cur = P.scenario.buildings[P.drag.index];
      const best = P.slideToward(cur[0], cur[1], target.wx, target.wy, (x, y) =>
        P.canPlaceBuilding(x, y, P.drag.index)
      );
      const clamped = P.clampBuildingCenter(best.wx, best.wy);
      P.scenario.buildings[P.drag.index][0] = clamped.wx;
      P.scenario.buildings[P.drag.index][1] = clamped.wy;
    } else if (P.drag.kind === "slot") {
      const c = P.clampWorld(wx + P.drag.ox, wy + P.drag.oy);
      const p = P.suggestUniformSlotPosition(c.wx, c.wy, P.drag.index);
      if (p) {
        P.scenario.slots[P.drag.index][0] = p.wx;
        P.scenario.slots[P.drag.index][1] = p.wy;
        P.scenario.slots[P.drag.index][2] = P.normalizeAngle(
          p.theta ?? P.scenario.slots[P.drag.index][2] ?? 0
        );
      }
    } else if (P.drag.kind === "obstacle-vertex") {
      const c = P.clampWorld(wx + P.drag.ox, wy + P.drag.oy);
      const curPoints = P.clonePoints(P.scenario.obstacles[P.drag.index]?.points || []);
      const vi = P.drag.vertexIndex;
      const [curVx, curVy] = curPoints[vi] || [c.wx, c.wy];
      const tryVertex = (vx, vy) => {
        const np = P.clonePoints(curPoints);
        np[vi] = [vx, vy];
        const checked = P.normalizeObstacleShape({ points: np });
        if (checked) {
          P.moveObstaclePointsToward(P.drag.index, curPoints, checked.points, 12);
          return true;
        }
        return false;
      };
      if (!tryVertex(c.wx, c.wy)) {
        if (!tryVertex(c.wx, curVy)) tryVertex(curVx, c.wy);
      }
    } else if (P.drag.kind === "obstacle") {
      const dx = wx - P.drag.startW.wx;
      const dy = wy - P.drag.startW.wy;
      const pts = P.drag.origPoints || [];
      const curPts = P.scenario.obstacles[P.drag.index]?.points || [];
      const curOx = (curPts[0]?.[0] ?? 0) - (pts[0]?.[0] ?? 0);
      const curOy = (curPts[0]?.[1] ?? 0) - (pts[0]?.[1] ?? 0);
      const best = P.slideToward(curOx, curOy, dx, dy, (ox, oy) =>
        P.canPlaceObstacleAt(
          P.drag.index,
          pts.map((p) => [p[0] + ox, p[1] + oy])
        )
      );
      P.trySetObstaclePoints(
        P.drag.index,
        pts.map((p) => [p[0] + best.wx, p[1] + best.wy])
      );
    } else if (P.drag.kind === "road-vertex") {
      const roadWidth = Math.max(2.4, Number(P.scenario.road?.width || P.DEFAULT_ROAD_WIDTH));
      const c = P.clampWorld(wx + P.drag.ox, wy + P.drag.oy, roadWidth / 2);
      const prevRoad = JSON.parse(JSON.stringify(P.scenario.road));
      P.scenario.road.centerline[P.drag.vertexIndex] = [c.wx, c.wy];
      if (P.scenario.road?.closed !== false) {
        P.syncClosedRoadEndpoint(P.scenario.road.centerline, P.drag.vertexIndex);
      }
      P.ensureRoadStructure();
      const check = P.validateRoadNoOverlap();
      if (!check.ok) {
        P.scenario.road = prevRoad;
        P.ensureRoadStructure();
      }
    } else if (P.drag.kind === "road") {
      const dx = wx - P.drag.startW.wx;
      const dy = wy - P.drag.startW.wy;
      const prevRoad = JSON.parse(JSON.stringify(P.scenario.road));
      P.scenario.road.centerline = (P.drag.origPoints || []).map((p) => [p[0] + dx, p[1] + dy]);
      P.ensureRoadStructure();
      const check = P.validateRoadNoOverlap();
      if (!check.ok) {
        P.scenario.road = prevRoad;
        P.ensureRoadStructure();
      }
    } else {
      return false;
    }
    P.scheduleDragRedraw();
    return true;
  };

  P.finishDragFromPointer = function () {
    const d = P.drag;
    P.drag = null;
    P.dragRafPending = false;
    if (!P.scenario || !d) return;
    let changed = false;
    if (d.kind === "entrance") {
      const idx = d.index ?? 0;
      const s = P.snapEntranceToInner(P.scenario.entrances[idx][0], P.scenario.entrances[idx][1]);
      if (P.canPlaceEntrance(s.wx, s.wy)) {
        P.scenario.entrances[idx][0] = s.wx;
        P.scenario.entrances[idx][1] = s.wy;
        P.ensureScenarioCollections();
        changed = true;
      }
      P.renderProps();
      if (changed) {
        P.clearOptimizationResultLight();
        P.commitSceneGeometry();
        P.persistCurrentStateNow?.();
        P.draw();
      }
      return;
    }
    if (d.kind === "slot") {
      changed = P.applySnapToSlot(d.index) || changed;
      P.renderProps();
    }
    if (d.kind === "obstacle" || d.kind === "obstacle-vertex") {
      if (!P.normalizeObstacleInner()) {
        const o = P.scenario.obstacles[d.index];
        if (o && Array.isArray(d.origPoints)) o.points = d.origPoints.map((p) => [p[0], p[1]]);
        P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
        P.draw();
        return;
      }
      changed = true;
      P.renderProps();
    }
    if (d.kind === "road" || d.kind === "road-vertex") {
      P.ensureRoadStructure();
      const check = P.validateRoadNoOverlap();
      if (!check.ok) {
        if (d.origPoints?.length) {
          P.scenario.road.centerline = d.origPoints.map((p) => [p[0], p[1]]);
        }
        P.ensureRoadStructure();
        P.notifyRoadGeometryInvalid(check.reason);
        P.draw();
        return;
      }
      P.sanitizeScenarioGeometry();
      changed = true;
      P.renderProps();
    }
    if (d.kind === "building") {
      changed = true;
      P.renderProps();
    }
    if (changed) {
      P.commitSceneGeometry();
      if (
        d.kind === "obstacle" ||
        d.kind === "obstacle-vertex" ||
        d.kind === "road" ||
        d.kind === "road-vertex"
      ) {
        P.invalidateOptimizationResult();
      } else {
        P.persistCurrentStateNow?.();
        P.draw();
      }
    }
  };
})();

/* --- app\interaction\pointer.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/interaction/pointer.js");

  P.setSelection = function (sel) {
    P.selection = sel;
    document.querySelectorAll(".toolbar button").forEach((b) => {
      if (b.id === "btn-add-building") b.classList.toggle("active", P.pendingAdd === "building");
      if (b.id === "btn-add-slot") b.classList.toggle("active", P.pendingAdd === "slot");
      if (b.id === "btn-add-entrance") b.classList.toggle("active", P.pendingAdd === "entrance");
      if (b.id === "btn-add-obstacle") b.classList.toggle("active", P.pendingAdd === "obstacle");
      if (b.id === "btn-add-road") b.classList.toggle("active", P.pendingAdd === "road");
    });
    P.syncDeleteButton?.();
    P.renderProps();
    P.draw();
  };

  P.handlePendingAddPointerDown = function (wx, wy, ev) {
    if (P.pendingAdd === "entrance") {
      const c = P.clampWorld(wx, wy);
      const s = P.snapEntranceToInner(c.wx, c.wy);
      if (!P.canPlaceEntrance(s.wx, s.wy)) return true;
      P.scenario.entrances.push([s.wx, s.wy]);
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.invalidateOptimizationResult();
      P.pendingAdd = null;
      P.setSelection({ kind: "entrance", index: P.scenario.entrances.length - 1 });
      P.commitSceneGeometry();
      return true;
    }
    if (P.pendingAdd === "obstacle") {
      const snap = P.obstacleDraftSnap(wx, wy);
      if (snap.snapToStart && P.obstacleDraftPoints?.length >= 3) {
        P.finalizeObstacleDraft();
      } else if (ev.detail >= 2) {
        P.appendObstacleDraftPoint(snap.wx, snap.wy);
        P.finalizeObstacleDraft();
      } else {
        P.appendObstacleDraftPoint(snap.wx, snap.wy);
        P.draw();
      }
      return true;
    }
    if (P.pendingAdd === "road") {
      const snap = P.roadDraftSnap(wx, wy);
      if (snap.snapToStart && P.roadDraftPoints?.length >= 2) {
        P.finalizeRoadDraft();
      } else if (ev.detail >= 2) {
        P.appendRoadDraftPoint(snap.wx, snap.wy);
        P.finalizeRoadDraft();
      } else {
        P.appendRoadDraftPoint(snap.wx, snap.wy);
        P.draw();
      }
      return true;
    }
    if (P.pendingAdd === "building") {
      const c = P.clampBuildingCenter(wx, wy);
      if (!P.canPlaceBuilding(c.wx, c.wy)) return true;
      P.scenario.buildings.push([c.wx, c.wy]);
      P.ensureVehicleDestinationsArray();
      P.rebuildVehicleTargetsUI();
      P.pendingAdd = null;
      P.setSelection({ kind: "building", index: P.scenario.buildings.length - 1 });
      P.commitSceneGeometry();
      return true;
    }
    if (P.pendingAdd === "slot") {
      const c = P.clampWorld(wx, wy);
      const p = P.suggestUniformSlotPosition(c.wx, c.wy, -1);
      if (!p) return true;
      P.scenario.slots.push([p.wx, p.wy, P.normalizeAngle(p.theta)]);
      const si = P.scenario.slots.length - 1;
      P.pendingAdd = null;
      P.setSelection({ kind: "slot", index: si });
      P.commitSceneGeometry();
      return true;
    }
    return false;
  };

  P.pointerDown = function (ev) {
    if (!P.scenario) return;
    P.ensureScenarioCollections();

    const isPan = ev.button === 2;
    if (isPan) {
      ev.preventDefault();
      const { sx, sy } = P.eventToScreen(ev);
      P.panDrag = {
        startSx: sx,
        startSy: sy,
        origPanX: P.viewPanX ?? 0,
        origPanY: P.viewPanY ?? 0,
      };
      P.mapCanvas.classList.add("is-panning");
      return;
    }

    const { wx, wy } = P.eventToWorld(ev);

    if (P.handleUnderlayCalibrationClick?.(wx, wy)) return;

    if (P.handlePendingAddPointerDown(wx, wy, ev)) return;

    const nearVertex = P.pickAnyObstacleVertex(wx, wy, 16);
    if (nearVertex) {
      const oi = nearVertex.obstacleIndex;
      const vi = nearVertex.vertexIndex;
      P.setSelection({ kind: "obstacle", index: oi });
      P.drag = {
        kind: "obstacle-vertex",
        index: oi,
        vertexIndex: vi,
        ox: 0,
        oy: 0,
        origPoints: (P.scenario.obstacles[oi].points || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    const mouseS = P.worldToScreen(wx, wy);
    const ents = P.scenario.entrances || [];
    for (let i = ents.length - 1; i >= 0; i--) {
      const ep = P.worldToScreen(ents[i][0], ents[i][1]);
      if (Math.hypot(mouseS.sx - ep.sx, mouseS.sy - ep.sy) < 16) {
        P.setSelection({ kind: "entrance", index: i });
        P.drag = { kind: "entrance", index: i, ox: 0, oy: 0 };
        return;
      }
    }
    const roadVertex = P.pickRoadVertex(wx, wy, 16);
    if (roadVertex != null) {
      P.setSelection({ kind: "road" });
      P.drag = {
        kind: "road-vertex",
        vertexIndex: roadVertex,
        ox: 0,
        oy: 0,
        origPoints: (P.scenario.road.centerline || []).map((p) => [p[0], p[1]]),
      };
      return;
    }

    const hit = P.pickAt(wx, wy);
    if (!hit) {
      P.setSelection(null);
      return;
    }
    P.setSelection(hit);
    P.beginDragForHit(hit, wx, wy);
  };

  P.pointerMove = function (ev) {
    if (P.panDrag) {
      const { sx, sy } = P.eventToScreen(ev);
      P.viewPanX = P.panDrag.origPanX + (sx - P.panDrag.startSx);
      P.viewPanY = P.panDrag.origPanY + (sy - P.panDrag.startSy);
      P.draw();
      return;
    }

    let { wx, wy } = P.eventToWorld(ev);
    const cw = P.clampWorld(wx, wy);
    wx = cw.wx;
    wy = cw.wy;
    if (P.pendingAdd === "obstacle" && P.obstacleDraftPoints?.length) {
      const snap = P.obstacleDraftSnap(wx, wy);
      P.obstacleDraftHover = [snap.wx, snap.wy];
      P.obstacleDraftSnapStart = !!snap.snapToStart;
      P.draw();
      if (!P.drag || !P.scenario) return;
    }
    if (P.pendingAdd === "road" && P.roadDraftPoints?.length) {
      const snap = P.roadDraftSnap(wx, wy);
      P.roadDraftHover = [snap.wx, snap.wy];
      P.roadDraftSnapStart = !!snap.snapToStart;
      P.draw();
      if (!P.drag || !P.scenario) return;
    }
    if (!P.drag || !P.scenario) {
      if (!P.drag && !P.panDrag && P.scenario && !P.pendingAdd) {
        const newHover = P.getHoveredElement(wx, wy);
        const changed =
          newHover?.type !== P.hoverTarget?.type || newHover?.index !== P.hoverTarget?.index;
        if (changed) {
          P.hoverTarget = newHover;
          if (!P.hoverRafPending) {
            P.hoverRafPending = true;
            requestAnimationFrame(() => {
              P.hoverRafPending = false;
              P.draw();
            });
          }
        }
      }
      return;
    }
    P.updateDragFromPointer(wx, wy);
  };

  P.pointerUp = function () {
    if (P.panDrag) {
      P.panDrag = null;
      P.mapCanvas.classList.remove("is-panning");
      P.schedulePersistCurrentState?.();
      return;
    }
    P.finishDragFromPointer();
  };

  P.deleteSelected = function () {
    if (!P.selection) return;
    if (P.selection.kind === "building") {
      const ri = P.selection.index;
      P.scenario.buildings.splice(ri, 1);
      P.adjustVehicleDestinationsAfterBuildingRemoved(ri);
      P.rebuildVehicleTargetsUI();
      P.setSelection(null);
    } else if (P.selection.kind === "slot") {
      P.scenario.slots.splice(P.selection.index, 1);
      P.setSelection(null);
    } else if (P.selection.kind === "entrance") {
      if (P.scenario.entrances.length <= 1) return;
      P.scenario.entrances.splice(P.selection.index ?? 0, 1);
      P.ensureScenarioCollections();
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.setSelection(null);
    } else if (P.selection.kind === "obstacle") {
      P.scenario.obstacles.splice(P.selection.index ?? 0, 1);
      P.normalizeObstacleInner();
      P.setSelection(null);
    }
    P.invalidateOptimizationResult();
  };
})();

/* --- app\lifecycle\startup.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/lifecycle/startup.js");

  P.getDefaultScenarioSource = async function () {
    if (!P.scenarioSource?.getDefaultScenarioSource) {
      return P.optimizer.defaultScenario();
    }
    return P.scenarioSource.getDefaultScenarioSource(() => P.optimizer.defaultScenario());
  };

  P.loadDefault = async function (options = {}) {
    try {
      if (!P.optimizer || typeof P.optimizer.normalizeScenario !== "function") {
        throw new Error("optimizer module missing");
      }
      const forceDefault = options.forceDefault === true;
      let sourceScenario = null;
      let restored = false;
      if (!forceDefault) {
        const cached = P.readCurrentState();
        if (cached && cached.scenario) {
          sourceScenario = cached.scenario;
          restored = true;
          P.activeTab = P.normalizeTabKey
            ? P.normalizeTabKey(String(cached.activeTab || "overview"))
            : String(cached.activeTab || "overview");
          P.vehiclePage = Number.isFinite(Number(cached.vehiclePage))
            ? Math.max(0, parseInt(cached.vehiclePage, 10))
            : 0;
          if (cached.viewState) {
            P.viewPanX = Number(cached.viewState.viewPanX) || 0;
            P.viewPanY = Number(cached.viewState.viewPanY) || 0;
            P.viewZoom = Number(cached.viewState.viewZoom) || 1;
          }
        }
      }
      if (!sourceScenario) {
        sourceScenario = await P.getDefaultScenarioSource();
        P.activeTab = "overview";
        P.vehiclePage = 0;
      }
      P.scenario = P.optimizer.normalizeScenario(sourceScenario);
      P.ensureConstraints();
      P.ensureScenarioCollections();
      P.syncMapCanvasSize();
      if (!restored || !cached?.viewState) {
        P.fitViewToLot();
      }
      P.sanitizeScenarioGeometry();
      P.ensureVehicleDestinationsArray();
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.lastResult = null;
      P.autoEntrancePreview = null;
      P.nVehInput.value = P.scenario.n_veh ?? 12;
      P.setSelection(null);
      document.getElementById("result-status").textContent =
        "尚未运行（总时间单位：" + P.uTime() + "）";
      document.getElementById("result-gbest").style.display = "none";
      P.drawChart([]);
      P.updateChartCaption("idle");
      P.refreshSnapshotSelect();
      P.renderBreakdownSummary();
      P.renderResultTip("");
      const legend = document.querySelector(".map-legend");
      const legendBtn = document.getElementById("btn-legend-toggle");
      const roadShapeMode = document.getElementById("road-shape-mode");
      if (legend) legend.classList.add("is-compact");
      if (legendBtn) legendBtn.textContent = "展开完整图例";
      P.roadDraftClosed = P.scenario?.road?.closed !== false;
      if (roadShapeMode) roadShapeMode.value = P.roadDraftClosed ? "closed" : "open";
      P.switchTab(restored ? P.activeTab : "overview");
      P.scheduleAutoEntrancePreviewRefresh();
      P.schedulePersistCurrentState();
      P.syncLotInputsFromScenario?.();
      P.updateActionGates?.();
      P.updateRunBarSummary?.();
      P.clearWorkspaceMessage?.();
      P.draw();
    } catch (e) {
      P.showWorkspaceMessage?.(
        "默认场景加载失败，请检查 assets/data/default-scenario.json 或 optimizer 模块是否可访问。",
        { level: "error" }
      );
      console.error(e);
    }
  };

  P.resetScenario = async function () {
    const ok = window.confirm("确定重置为默认场景吗？当前未导出的改动将丢失。");
    if (!ok) return;
    P.clearPersistedCurrentState();
    await P.loadDefault({ forceDefault: true });
  };
})();

/* --- app\bootstrap.js --- */
(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/bootstrap.js");

  P.wireAddModeToggle = function (btnId, mode) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (P.pendingAdd === "obstacle" && mode !== "obstacle") P.cancelObstacleDraft();
      if (P.pendingAdd === "road" && mode !== "road") P.cancelRoadDraft();
      P.pendingAdd = P.pendingAdd === mode ? null : mode;
      if (P.pendingAdd !== "obstacle") P.cancelObstacleDraft();
      if (P.pendingAdd !== "road") P.cancelRoadDraft();
      if (P.pendingAdd === "road") {
        const shapeSel = document.getElementById("road-shape-mode");
        P.roadDraftClosed = shapeSel
          ? shapeSel.value !== "open"
          : P.scenario?.road?.closed !== false;
      }
      document.getElementById("btn-add-building").classList.toggle("active", P.pendingAdd === "building");
      document.getElementById("btn-add-slot").classList.toggle("active", P.pendingAdd === "slot");
      const addEnt = document.getElementById("btn-add-entrance");
      const addObs = document.getElementById("btn-add-obstacle");
      const addRoad = document.getElementById("btn-add-road");
      if (addEnt) addEnt.classList.toggle("active", P.pendingAdd === "entrance");
      if (addObs) addObs.classList.toggle("active", P.pendingAdd === "obstacle");
      if (addRoad) addRoad.classList.toggle("active", P.pendingAdd === "road");
      P.syncDeleteButton?.();
      P.draw();
    });
  };

  P.mapCanvas.addEventListener("pointerdown", (e) => {
    P.mapCanvas.setPointerCapture(e.pointerId);
    P.pointerDown(e);
  });
  P.mapCanvas.addEventListener("pointermove", P.pointerMove);
  P.mapCanvas.addEventListener("pointerup", P.pointerUp);
  P.mapCanvas.addEventListener("pointercancel", P.pointerUp);
  P.mapCanvas.addEventListener("pointerleave", () => {
    if (P.hoverTarget) {
      P.hoverTarget = null;
      P.draw();
    }
  });
  P.mapCanvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const { sx, sy } = P.eventToScreen(e);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      P.zoomAtScreen(sx, sy, factor);
    },
    { passive: false }
  );
  P.mapCanvas.addEventListener("dblclick", (e) => {
    if (!P.scenario || P.pendingAdd) return;
    const { wx, wy } = P.eventToWorld(e);
    if (!P.pickAt(wx, wy)) P.fitViewToLot();
  });
  P.mapCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

  document.getElementById("btn-fit-lot-view")?.addEventListener("click", () => P.fitViewToLot?.());
  document.getElementById("btn-fit-content-view")?.addEventListener("click", () => P.fitViewToContent?.());

  P.wireAddModeToggle("btn-add-building", "building");
  P.wireAddModeToggle("btn-add-slot", "slot");
  P.wireAddModeToggle("btn-add-entrance", "entrance");
  P.wireAddModeToggle("btn-add-obstacle", "obstacle");
  P.wireAddModeToggle("btn-add-road", "road");
  document.getElementById("btn-delete").addEventListener("click", P.deleteSelected);
  document.getElementById("btn-random-dest").addEventListener("click", P.randomizeVehicleDestinations);
  document.getElementById("btn-reset-scenario")?.addEventListener("click", P.resetScenario);
  document.querySelectorAll(".js-run-optimize").forEach((btn) => {
    btn.addEventListener("click", P.runOptimize);
  });
  document.getElementById("btn-export-scenario")?.addEventListener("click", P.exportScenarioToFile);
  document.getElementById("btn-save-snapshot")?.addEventListener("click", P.saveSnapshot);
  document.getElementById("btn-load-snapshot")?.addEventListener("click", P.loadSnapshot);
  document.getElementById("btn-run-benchmark")?.addEventListener("click", P.runBenchmark);
  document.getElementById("btn-recommend-params")?.addEventListener("click", P.recommendParams);
  document.querySelectorAll(".side-tab").forEach((btn) => {
    btn.addEventListener("click", () => P.switchTab(btn.dataset.tab));
  });
  document.getElementById("btn-veh-page-prev")?.addEventListener("click", () => {
    P.vehiclePage = Math.max(0, P.vehiclePage - 1);
    P.rebuildVehicleTargetsUI();
  });
  document.getElementById("btn-veh-page-next")?.addEventListener("click", () => {
    P.vehiclePage += 1;
    P.rebuildVehicleTargetsUI();
  });
  document.getElementById("btn-legend-toggle")?.addEventListener("click", (e) => {
    const legend = document.querySelector(".map-legend");
    if (!legend) return;
    const compact = legend.classList.toggle("is-compact");
    e.target.textContent = compact ? "展开完整图例" : "收起扩展图例";
  });
  document.getElementById("btn-add-entrance")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("btn-add-obstacle")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("btn-add-road")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("road-shape-mode")?.addEventListener("change", (e) => {
    P.roadDraftClosed = e.target.value !== "open";
  });
  document.getElementById("btn-add-building")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("btn-add-slot")?.addEventListener("click", () => P.switchTab("scene"));
  document.getElementById("entrance-mode")?.addEventListener("change", (e) => {
    P.scenario.entrance_mode = e.target.value === "fixed" ? "fixed" : "auto";
    P.rebuildVehicleTargetsUI();
    P.invalidateOptimizationResult();
  });
  document.getElementById("btn-import-scenario")?.addEventListener("click", () => P.importInput?.click());
  P.importInput?.addEventListener("change", async () => {
    try {
      if (P.importInput.files && P.importInput.files[0]) {
        await P.importScenarioFromFile(P.importInput.files[0]);
      }
    } catch (e) {
      console.error(e);
      P.showWorkspaceMessage?.("导入场景失败，请检查 JSON 格式。", { level: "error" });
    } finally {
      P.importInput.value = "";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (P.pendingAdd === "obstacle" && P.obstacleDraftPoints?.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        P.cancelObstacleDraft();
        P.pendingAdd = null;
        P.syncDeleteButton?.();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        P.finalizeObstacleDraft();
        return;
      }
    }
    if (P.pendingAdd === "road" && P.roadDraftPoints?.length) {
      if (e.key === "Escape") {
        e.preventDefault();
        P.cancelRoadDraft();
        P.pendingAdd = null;
        P.syncDeleteButton?.();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        P.finalizeRoadDraft();
        return;
      }
    }
    if (e.key === "Escape" && P.pendingAdd) {
      e.preventDefault();
      P.clearPendingAddMode?.();
      P.syncDeleteButton?.();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (document.activeElement?.tagName === "INPUT") return;
      P.deleteSelected();
    }
  });
  window.addEventListener("beforeunload", () => P.persistCurrentStateNow());

  P.nVehInput?.addEventListener("change", () => {
    if (!P.scenario) return;
    let n = parseInt(P.nVehInput.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 1;
    P.scenario.n_veh = n;
    P.vehiclePage = 0;
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    P.rebuildVehicleTargetsUI();
    P.invalidateOptimizationResult();
    P.scheduleAutoEntrancePreviewRefresh?.();
    P.updateRunBarSummary?.();
    P.updateActionGates?.();
  });

  document.getElementById("optimizer-method")?.addEventListener("change", () => {
    P.updateRunBarSummary?.();
  });

  window.addEventListener("resize", () => {
    clearTimeout(P.resizeChartTimer);
    P.resizeChartTimer = setTimeout(() => {
      P.syncMapCanvasSize();
      P.syncChartCanvasSize();
      P.syncCompareRadarSize?.();
      P.syncSimQueueChartSize?.();
      if (P.scenario) P.draw();
      P.drawChart(P.lastChartSeries, P.lastChartOptimizer);
      P.redrawAuxCharts?.();
    }, 80);
  });

  P.wireLayerControls?.();
  P.wireUnderlayPanel?.();
  P.wireWorkflowGuide?.();

  document.getElementById("btn-save-named-plan")?.addEventListener("click", () => {
    const nameEl = document.getElementById("plan-save-name");
    P.saveNamedPlan?.(nameEl?.value || "");
    if (nameEl) nameEl.value = "";
  });
  document.getElementById("btn-refresh-compare")?.addEventListener("click", () => {
    P.renderComparePanel?.();
  });
  document.getElementById("btn-export-compare-report")?.addEventListener("click", () => {
    P.exportCompareReport?.();
  });
  document.getElementById("btn-auto-slots")?.addEventListener("click", () => P.runAutoSlots?.());
  document.getElementById("btn-suggest-plans")?.addEventListener("click", () => P.runSuggestPlans?.());
  document.getElementById("btn-run-sim")?.addEventListener("click", () => P.runSimulation?.());
  document.getElementById("btn-sim-play")?.addEventListener("click", () => P.toggleSimPlay?.());
  document.getElementById("sim-scrub")?.addEventListener("input", (e) => {
    P.simState.frameIndex = parseInt(e.target.value, 10) || 0;
    P.updateSimTimeLabel?.();
    P.updateSimStats?.();
    P.draw();
  });

  (async function initPlansAndApi() {
    await P.refreshApiStatus?.();
    await P.loadPlans?.();
    P.syncUnderlayPanelFromScenario?.();
    P.updateWorkflowGuide?.();
  })();

  P.bindLotPanel?.();

  P.loadDefault();
  P.syncUnderlayPanelFromScenario?.();
  P.updateWorkflowGuide?.();
  P.syncDeleteButton?.();
  P.updateRunBarSummary?.();
  P.updateActionGates?.();
})();

