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
