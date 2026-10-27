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
