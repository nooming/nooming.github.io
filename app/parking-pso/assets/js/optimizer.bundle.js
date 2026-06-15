/* bundled optimizer from 14 files */
/* --- core\constants.js --- */
(function () {
  "use strict";

  const RESULT_KEYS = [
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
  ];

  window.ParkingCoreConstants = {
    RESULT_KEYS,
  };
})();

/* --- core\geometry.js --- */
(function () {
  "use strict";

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-18) return [x1, y1];
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return [x1 + t * dx, y1 + t * dy];
  }

  function normalizePolyline(points) {
    if (!Array.isArray(points)) return [];
    const out = [];
    for (let i = 0; i < points.length; i++) {
      const x = Number(points[i]?.[0]);
      const y = Number(points[i]?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      if (!out.length || Math.hypot(out[out.length - 1][0] - x, out[out.length - 1][1] - y) > 1e-6) {
        out.push([x, y]);
      }
    }
    return out;
  }

  function pointOnSegment(p, a, b, eps = 1e-6) {
    const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (Math.abs(cross) > eps) return false;
    const dot = (p[0] - a[0]) * (p[0] - b[0]) + (p[1] - a[1]) * (p[1] - b[1]);
    return dot <= eps;
  }

  function segmentsIntersect(a, b, c, d, eps = 1e-6) {
    const cross = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
    const o1 = cross(a, b, c);
    const o2 = cross(a, b, d);
    const o3 = cross(c, d, a);
    const o4 = cross(c, d, b);
    if ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) {
      if ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps)) return true;
    }
    if (Math.abs(o1) <= eps && pointOnSegment(c, a, b, eps)) return true;
    if (Math.abs(o2) <= eps && pointOnSegment(d, a, b, eps)) return true;
    if (Math.abs(o3) <= eps && pointOnSegment(a, c, d, eps)) return true;
    if (Math.abs(o4) <= eps && pointOnSegment(b, c, d, eps)) return true;
    return false;
  }

  function polygonSelfIntersects(poly) {
    if (!Array.isArray(poly) || poly.length < 4) return false;
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        if (i === j) continue;
        if ((i + 1) % n === j || (j + 1) % n === i) continue;
        const c = poly[j];
        const d = poly[(j + 1) % n];
        if (segmentsIntersect(a, b, c, d)) return true;
      }
    }
    return false;
  }

  function pointInPolygon(p, poly, includeBoundary) {
    const withBoundary = includeBoundary !== false;
    if (!Array.isArray(poly) || poly.length < 3) return false;
    if (withBoundary) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (pointOnSegment(p, a, b)) return true;
      }
    }
    let inside = false;
    const px = Number(p[0]);
    const py = Number(p[1]);
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = Number(poly[i][0]);
      const yi = Number(poly[i][1]);
      const xj = Number(poly[j][0]);
      const yj = Number(poly[j][1]);
      const cross = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / ((yj - yi) || 1e-12) + xi;
      if (cross) inside = !inside;
    }
    return inside;
  }

  function segmentIntersectsPolygon(p1, p2, poly) {
    if (pointInPolygon(p1, poly, true) || pointInPolygon(p2, poly, true)) return true;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (segmentsIntersect(p1, p2, a, b)) return true;
    }
    return false;
  }

  function toRoadSegmentsFromCenterline(centerline) {
    const pts = normalizePolyline(centerline);
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) continue;
      segs.push([a, b]);
    }
    return segs;
  }

  function buildRoadSegments(source) {
    if (!source || typeof source !== "object") return [];
    const road = source.road && typeof source.road === "object" ? source.road : source;
    if (Array.isArray(road.centerline)) {
      const byCenterline = toRoadSegmentsFromCenterline(road.centerline);
      if (byCenterline.length) return byCenterline;
    }
    const inner = source.inner && typeof source.inner === "object" ? source.inner : source;
    const ix0 = Number(inner.x_min);
    const ix1 = Number(inner.x_max);
    const iy0 = Number(inner.y_min);
    const iy1 = Number(inner.y_max);
    if (![ix0, ix1, iy0, iy1].every((v) => Number.isFinite(v))) return [];
    return [
      [[ix0, iy0], [ix1, iy0]],
      [[ix1, iy0], [ix1, iy1]],
      [[ix1, iy1], [ix0, iy1]],
      [[ix0, iy1], [ix0, iy0]],
    ];
  }

  function polylineLength(points) {
    const pts = normalizePolyline(points);
    let sum = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      sum += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    }
    return sum;
  }

  function nearestPointOnPolyline(px, py, polyline) {
    const pts = normalizePolyline(polyline);
    if (pts.length < 2) return null;
    let best = null;
    let bestD2 = Infinity;
    let prefix = 0;
    let bestAlong = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const q = closestPointOnSegment(px, py, a[0], a[1], b[0], b[1]);
      const d2 = (px - q[0]) * (px - q[0]) + (py - q[1]) * (py - q[1]);
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const projLen = Math.hypot(q[0] - a[0], q[1] - a[1]);
      if (d2 < bestD2) {
        bestD2 = d2;
        bestAlong = prefix + projLen;
        best = {
          point: [q[0], q[1]],
          segmentIndex: i,
          distance: Math.sqrt(d2),
          distanceSquared: d2,
          along: bestAlong,
          totalLength: polylineLength(pts),
          segmentLength: segLen,
        };
      }
      prefix += segLen;
    }
    return best;
  }

  function projectPointToRoad(px, py, source) {
    if (!source || typeof source !== "object") return null;
    const road = source.road && typeof source.road === "object" ? source.road : source;
    if (Array.isArray(road.centerline) && road.centerline.length >= 2) {
      return nearestPointOnPolyline(px, py, road.centerline);
    }
    const segs = buildRoadSegments(source);
    let best = null;
    let bestD2 = Infinity;
    let prefix = 0;
    let totalLength = 0;
    for (const [a, b] of segs) totalLength += Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const q = closestPointOnSegment(px, py, a[0], a[1], b[0], b[1]);
      const d2 = (px - q[0]) * (px - q[0]) + (py - q[1]) * (py - q[1]);
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const projLen = Math.hypot(q[0] - a[0], q[1] - a[1]);
      if (d2 < bestD2) {
        bestD2 = d2;
        best = {
          point: [q[0], q[1]],
          segmentIndex: i,
          distance: Math.sqrt(d2),
          distanceSquared: d2,
          along: prefix + projLen,
          totalLength,
          segmentLength: segLen,
        };
      }
      prefix += segLen;
    }
    return best;
  }

  function roadDistanceBetweenPoints(a, b, source) {
    const pa = projectPointToRoad(Number(a?.[0]), Number(a?.[1]), source);
    const pb = projectPointToRoad(Number(b?.[0]), Number(b?.[1]), source);
    if (!pa || !pb) return 0;
    const L = Math.max(1e-9, Number(pa.totalLength || pb.totalLength || 0));
    let d = Math.abs(pa.along - pb.along);
    const road = source?.road && typeof source.road === "object" ? source.road : source;
    const closed = road?.closed !== false;
    if (closed) d = Math.min(d, L - d);
    return d;
  }

  function centerlineAlongMeta(centerline) {
    const pts = normalizePolyline(centerline);
    if (pts.length < 2) return { pts, cumAlong: [0], total: 0 };
    const cumAlong = [0];
    for (let i = 0; i < pts.length - 1; i++) {
      cumAlong.push(
        cumAlong[cumAlong.length - 1] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
      );
    }
    return { pts, cumAlong, total: cumAlong[cumAlong.length - 1] };
  }

  function pointAtAlong(pts, cumAlong, along, closed) {
    const L = cumAlong[cumAlong.length - 1];
    if (L < 1e-9) return pts.length ? [pts[0][0], pts[0][1]] : [0, 0];
    let t = along;
    if (closed) t = ((t % L) + L) % L;
    else t = Math.max(0, Math.min(L, t));
    for (let i = 0; i < cumAlong.length - 1; i++) {
      if (t <= cumAlong[i + 1] + 1e-9) {
        const a = pts[i];
        const b = pts[i + 1];
        const segLen = cumAlong[i + 1] - cumAlong[i];
        const u = segLen < 1e-9 ? 0 : (t - cumAlong[i]) / segLen;
        return [a[0] + u * (b[0] - a[0]), a[1] + u * (b[1] - a[1])];
      }
    }
    const last = pts[pts.length - 1];
    return [last[0], last[1]];
  }

  function appendUniquePoint(out, p) {
    const x = Number(p?.[0]);
    const y = Number(p?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (out.length) {
      const last = out[out.length - 1];
      if (Math.hypot(last[0] - x, last[1] - y) < 1e-6) return;
    }
    out.push([x, y]);
  }

  function sampleCenterlineArc(pts, cumAlong, alongStart, alongEnd, closed) {
    const L = cumAlong[cumAlong.length - 1];
    if (L < 1e-9) return [];
    const a0 = alongStart;
    const a1 = alongEnd;
    let forward = a1 >= a0 ? a1 - a0 : closed ? L - a0 + a1 : a0 - a1;
    let backward = closed ? L - forward : Infinity;
    const useForward = closed ? forward <= backward : true;
    const dist = closed ? Math.min(forward, backward) : forward;
    if (dist < 1e-6) return [pointAtAlong(pts, cumAlong, a0, closed)];
    const step = Math.max(0.35, L / 90);
    const nSteps = Math.max(1, Math.ceil(dist / step));
    const out = [];
    for (let i = 0; i <= nSteps; i++) {
      const frac = i / nSteps;
      let along;
      if (useForward) {
        along = closed ? a0 + dist * frac : a0 + dist * frac;
        if (closed) along = ((along % L) + L) % L;
      } else {
        along = a0 - dist * frac;
        if (closed) along = ((along % L) + L) % L;
      }
      appendUniquePoint(out, pointAtAlong(pts, cumAlong, along, closed));
    }
    return out;
  }

  function roadPolylineBetweenPoints(a, b, source) {
    const entrance = [Number(a?.[0]), Number(a?.[1])];
    const slot = [Number(b?.[0]), Number(b?.[1])];
    if (!Number.isFinite(entrance[0]) || !Number.isFinite(entrance[1])) return normalizePolyline([slot]);
    if (!Number.isFinite(slot[0]) || !Number.isFinite(slot[1])) return normalizePolyline([entrance]);

    const road = source?.road && typeof source.road === "object" ? source.road : source;
    if (!road || typeof road !== "object") return normalizePolyline([entrance, slot]);

    let centerline = Array.isArray(road.centerline) ? road.centerline : null;
    const closed = road.closed !== false;
    if (!centerline || centerline.length < 2) {
      const segs = buildRoadSegments(source);
      if (!segs.length) return normalizePolyline([entrance, slot]);
      centerline = [segs[0][0]];
      for (const seg of segs) centerline.push(seg[1]);
    }

    const pa = projectPointToRoad(entrance[0], entrance[1], source);
    const pb = projectPointToRoad(slot[0], slot[1], source);
    if (!pa || !pb) return normalizePolyline([entrance, slot]);

    const { pts, cumAlong } = centerlineAlongMeta(centerline);
    const arcPts = sampleCenterlineArc(pts, cumAlong, pa.along, pb.along, closed);
    const out = [];
    appendUniquePoint(out, entrance);
    appendUniquePoint(out, pa.point);
    for (const p of arcPts) appendUniquePoint(out, p);
    appendUniquePoint(out, pb.point);
    appendUniquePoint(out, slot);
    return out;
  }

  window.ParkingGeometry = {
    closestPointOnSegment,
    normalizePolyline,
    pointOnSegment,
    segmentsIntersect,
    polygonSelfIntersects,
    pointInPolygon,
    segmentIntersectsPolygon,
    toRoadSegmentsFromCenterline,
    buildRoadSegments,
    polylineLength,
    nearestPointOnPolyline,
    projectPointToRoad,
    roadDistanceBetweenPoints,
    roadPolylineBetweenPoints,
  };
})();

/* --- core\road\road-model.js --- */
(function () {
  "use strict";

  const scenarioDefault = window.ParkingScenarioDefault || {};
  const DEFAULT_ROAD_WIDTH = scenarioDefault.DEFAULT_ROAD_WIDTH || 6.0;

  function cloneJson(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function roadFromInner(inner, fallbackWidth = DEFAULT_ROAD_WIDTH) {
    const ix0 = Number(inner?.x_min);
    const ix1 = Number(inner?.x_max);
    const iy0 = Number(inner?.y_min);
    const iy1 = Number(inner?.y_max);
    if (![ix0, ix1, iy0, iy1].every((v) => Number.isFinite(v))) return null;
    return {
      centerline: [
        [ix0, iy0],
        [ix1, iy0],
        [ix1, iy1],
        [ix0, iy1],
        [ix0, iy0],
      ],
      width: Number.isFinite(Number(fallbackWidth)) ? Number(fallbackWidth) : DEFAULT_ROAD_WIDTH,
      closed: true,
    };
  }

  function innerFromRoad(road) {
    const pts = Array.isArray(road?.centerline) ? road.centerline : [];
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const x = Number(pts[i]?.[0]);
      const y = Number(pts[i]?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    if (![xmin, xmax, ymin, ymax].every((v) => Number.isFinite(v))) return null;
    return { x_min: xmin, x_max: xmax, y_min: ymin, y_max: ymax };
  }

  function normalizeRoad(roadRaw, innerRaw, fallbackRoadFactory) {
    const fallbackRoad =
      typeof fallbackRoadFactory === "function" ? fallbackRoadFactory() : null;
    let road = roadRaw && typeof roadRaw === "object" ? cloneJson(roadRaw) : null;
    if (!road || !Array.isArray(road.centerline) || road.centerline.length < 2) {
      road = roadFromInner(innerRaw || {}, road?.width);
    }
    if (!road) return cloneJson(fallbackRoad || roadFromInner({}, DEFAULT_ROAD_WIDTH));
    const centerline = Array.isArray(road.centerline) ? road.centerline : [];
    const norm = centerline
      .map((p) => [Number(p?.[0]), Number(p?.[1])])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const clean = [];
    for (let i = 0; i < norm.length; i++) {
      if (
        !clean.length ||
        Math.hypot(clean[clean.length - 1][0] - norm[i][0], clean[clean.length - 1][1] - norm[i][1]) >
          1e-6
      ) {
        clean.push(norm[i]);
      }
    }
    if (clean.length < 2) return cloneJson(fallbackRoad || roadFromInner({}, DEFAULT_ROAD_WIDTH));
    road.centerline = clean;
    road.width = Math.max(2.4, Number(road.width ?? DEFAULT_ROAD_WIDTH) || DEFAULT_ROAD_WIDTH);
    road.closed = road.closed !== false;
    return road;
  }

  function buildRoadSegments(roadOrInner) {
    const geometry = window.ParkingGeometry || null;
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    if (geometry?.buildRoadSegments) return geometry.buildRoadSegments({ road });
    return [];
  }

  window.ParkingRoadModel = {
    DEFAULT_ROAD_WIDTH,
    cloneJson,
    roadFromInner,
    innerFromRoad,
    normalizeRoad,
    buildRoadSegments,
  };
})();

/* --- core\road\road-snap.js --- */
(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;
  const roadModel = window.ParkingRoadModel || {};
  const DEFAULT_ROAD_WIDTH = roadModel.DEFAULT_ROAD_WIDTH || 6.0;
  const roadFromInner = roadModel.roadFromInner || (() => null);
  const closestPointOnSegment =
    geometry?.closestPointOnSegment ||
    function (px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 < 1e-18) return [x1, y1];
      let t = ((px - x1) * dx + (py - y1) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      return [x1 + t * dx, y1 + t * dy];
    };

  const SLOT_SNAP_MARGIN = 0.45;
  const SLOT_HALF_BERTH_W = 1.3;

  function normalizeAngle(theta) {
    const t = Number(theta);
    if (!Number.isFinite(t)) return 0;
    let out = t;
    while (out <= -Math.PI) out += Math.PI * 2;
    while (out > Math.PI) out -= Math.PI * 2;
    return out;
  }

  function parseLotExtents(lotOrW, lotH) {
    if (typeof lotOrW === "object" && lotOrW !== null) {
      const xMin = Number(lotOrW.x_min ?? 0);
      const yMin = Number(lotOrW.y_min ?? 0);
      const w = Number(lotOrW.width ?? 100);
      const h = Number(lotOrW.height ?? 100);
      return { xMin, yMin, xMax: xMin + w, yMax: yMin + h, w, h };
    }
    const w = Number(lotOrW ?? 100);
    const h = Number(lotH ?? 100);
    return { xMin: 0, yMin: 0, xMax: w, yMax: h, w, h };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function snapPointToInnerPerimeter(x, y, roadOrInner, lotOrW, lotH) {
    const { xMin, yMin, xMax, yMax } = parseLotExtents(lotOrW, lotH);
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    const proj = geometry?.projectPointToRoad
      ? geometry.projectPointToRoad(Number(x), Number(y), { road })
      : null;
    const qx = proj?.point?.[0] ?? Number(x);
    const qy = proj?.point?.[1] ?? Number(y);
    return [clamp(qx, xMin, xMax), clamp(qy, yMin, yMax)];
  }

  function buildRoadGuideSegments(road, lotOrW, lotH, margin = SLOT_SNAP_MARGIN) {
    const { xMin, yMin, xMax, yMax } = parseLotExtents(lotOrW, lotH);
    const segs = geometry?.buildRoadSegments ? geometry.buildRoadSegments({ road }) : [];
    const strips = [];
    const offset = Math.max(0.8, Number(road?.width || DEFAULT_ROAD_WIDTH) / 2 + SLOT_HALF_BERTH_W + margin);
    const xLo = xMin + SLOT_HALF_BERTH_W + 0.05;
    const xHi = xMax - SLOT_HALF_BERTH_W - 0.05;
    const yLo = yMin + SLOT_HALF_BERTH_W + 0.05;
    const yHi = yMax - SLOT_HALF_BERTH_W - 0.05;
    for (let i = 0; i < segs.length; i++) {
      const a = segs[i][0];
      const b = segs[i][1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const sideDefs = [
        { sign: 1, id: "left-" + i },
        { sign: -1, id: "right-" + i },
      ];
      for (const side of sideDefs) {
        const x1 = a[0] + nx * offset * side.sign;
        const y1 = a[1] + ny * offset * side.sign;
        const x2 = b[0] + nx * offset * side.sign;
        const y2 = b[1] + ny * offset * side.sign;
        strips.push({
          id: side.id,
          x1: clamp(x1, xLo, xHi),
          y1: clamp(y1, yLo, yHi),
          x2: clamp(x2, xLo, xHi),
          y2: clamp(y2, yLo, yHi),
          tx: dx / len,
          ty: dy / len,
          theta: Math.atan2(dy, dx),
          len: Math.hypot(x2 - x1, y2 - y1),
        });
      }
    }
    return strips;
  }

  function snapSlotToRoad(x, y, roadOrInner, lotOrW, lotH, margin = SLOT_SNAP_MARGIN) {
    const { xMin, yMin, xMax, yMax } = parseLotExtents(lotOrW, lotH);
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    const strips = buildRoadGuideSegments(road, lotOrW, lotH, margin);
    if (!strips.length) return [clamp(x, xMin, xMax), clamp(y, yMin, yMax), 0];
    let bestX = x;
    let bestY = y;
    let bestTheta = 0;
    let bestD = 1e30;
    strips.forEach((s) => {
      const [qx, qy] = closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      const d = (x - qx) ** 2 + (y - qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = qx;
        bestY = qy;
        bestTheta = s.theta;
      }
    });
    return [clamp(bestX, xMin, xMax), clamp(bestY, yMin, yMax), normalizeAngle(bestTheta)];
  }

  window.ParkingRoad = {
    SLOT_SNAP_MARGIN,
    SLOT_HALF_BERTH_W,
    parseLotExtents,
    snapPointToInnerPerimeter,
    buildRoadGuideSegments,
    snapSlotToRoad,
    normalizeAngle,
  };
})();

/* --- core\scenario\default-scenario.js --- */
(function () {
  "use strict";

  const N_PARTICLES_DEFAULT = 40;
  const N_ITER_DEFAULT = 600;
  const W_DEFAULT = 0.7;
  const C1_DEFAULT = 1.5;
  const C2_DEFAULT = 1.5;
  const V_MAX_DEFAULT = 0.25;
  const DEFAULT_ROAD_WIDTH = 6.0;

  const CONTENT_X0 = 23.25;
  const CONTENT_Y0 = 10.0;
  const CONTENT_SPAN_X = 93.5;
  const CONTENT_SPAN_Y = 80.0;
  const INNER_W = 84.0;
  const INNER_H = 64.0;
  const SLOT_Y0 = 24.0;
  const BUILDING_XS = [28.0, 56.0, 84.0, 112.0];
  const BUILDING_YS = [10.0, 90.0];
  const OBSTACLE_X0 = 64.0;
  const OBSTACLE_X1 = 76.0;
  const OBSTACLE_Y0 = 30.0;
  const OBSTACLE_Y1 = 70.0;

  function defaultScenario() {
    const lotW = 180.0;
    const lotH = 140.0;
    const offX = (lotW - CONTENT_SPAN_X) / 2 - CONTENT_X0;
    const offY = (lotH - CONTENT_SPAN_Y) / 2 - CONTENT_Y0;

    const inner = {
      x_min: (lotW - INNER_W) / 2,
      x_max: (lotW + INNER_W) / 2,
      y_min: (lotH - INNER_H) / 2,
      y_max: (lotH + INNER_H) / 2,
    };

    const nVeh = 12;
    const laneRows = Math.max(1, Math.ceil(nVeh / 2));
    const slots = Array.from({ length: nVeh }, (_, i) => {
      const row = Math.floor(i / 2);
      const t = laneRows <= 1 ? 0.5 : row / (laneRows - 1);
      return [
        CONTENT_X0 + offX + (i % 2) * CONTENT_SPAN_X,
        SLOT_Y0 + offY + t * 52,
        0,
      ];
    });

    const buildings = [];
    for (const y of BUILDING_YS) {
      for (const x of BUILDING_XS) {
        buildings.push([x + offX, y + offY]);
      }
    }

    const obstacle = {
      x_min: OBSTACLE_X0 + offX,
      x_max: OBSTACLE_X1 + offX,
      y_min: OBSTACLE_Y0 + offY,
      y_max: OBSTACLE_Y1 + offY,
    };

    return {
      lot: { width: lotW, height: lotH },
      entrance: [inner.x_min, inner.y_min],
      entrances: [
        [inner.x_min, inner.y_min],
        [inner.x_max, inner.y_max],
      ],
      inner,
      road: {
        centerline: [
          [inner.x_min, inner.y_min],
          [inner.x_max, inner.y_min],
          [inner.x_max, inner.y_max],
          [inner.x_min, inner.y_max],
          [inner.x_min, inner.y_min],
        ],
        width: DEFAULT_ROAD_WIDTH,
        closed: true,
      },
      obstacle,
      obstacles: [
        {
          points: [
            [obstacle.x_min, obstacle.y_min],
            [obstacle.x_max, obstacle.y_min],
            [obstacle.x_max, obstacle.y_max],
            [obstacle.x_min, obstacle.y_max],
          ],
        },
      ],
      buildings,
      slots,
      n_veh: nVeh,
      vehicle_destinations: Array.from({ length: nVeh }, (_, i) => i % buildings.length),
      vehicle_entrances: Array.from({ length: nVeh }, (_, i) => (i < nVeh / 2 ? 0 : 1)),
      entrance_mode: "auto",
      pso: {
        n_particles: N_PARTICLES_DEFAULT,
        n_iter: N_ITER_DEFAULT,
        w: W_DEFAULT,
        c1: C1_DEFAULT,
        c2: C2_DEFAULT,
        v_max: V_MAX_DEFAULT,
      },
      constraints: { snap_slots_to_inner_road: true, snap_entrance_to_inner: true },
      slot_types: Array.from({ length: slots.length }, () => "normal"),
      vehicle_requirements: Array.from({ length: nVeh }, () => "normal"),
      soft_constraints: { type_mismatch_penalty: 0 },
      display: {
        length_unit: "m",
        time_unit: "s",
        meters_per_unit: 2,
        scale_bar_m: 20.0,
        coord_note: "平面坐标 1 单位 = 2 m",
      },
    };
  }

  window.ParkingScenarioDefault = {
    defaultScenario,
    N_PARTICLES_DEFAULT,
    N_ITER_DEFAULT,
    W_DEFAULT,
    C1_DEFAULT,
    C2_DEFAULT,
    V_MAX_DEFAULT,
    DEFAULT_ROAD_WIDTH,
  };
})();

/* --- core\scenario\normalize.js --- */
(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;
  const scenarioDefault = window.ParkingScenarioDefault || {};
  const roadModel = window.ParkingRoadModel || {};
  const roadSnap = window.ParkingRoad || {};

  const defaultScenario = scenarioDefault.defaultScenario || (() => ({}));
  const N_PARTICLES_DEFAULT = scenarioDefault.N_PARTICLES_DEFAULT || 40;
  const N_ITER_DEFAULT = scenarioDefault.N_ITER_DEFAULT || 600;
  const W_DEFAULT = scenarioDefault.W_DEFAULT || 0.7;
  const C1_DEFAULT = scenarioDefault.C1_DEFAULT || 1.5;
  const C2_DEFAULT = scenarioDefault.C2_DEFAULT || 1.5;
  const V_MAX_DEFAULT = scenarioDefault.V_MAX_DEFAULT || 0.25;

  const cloneJson = roadModel.cloneJson || ((v) => JSON.parse(JSON.stringify(v)));
  const normalizeRoad = roadModel.normalizeRoad || ((r) => r);
  const innerFromRoad = roadModel.innerFromRoad || (() => null);
  const snapPointToInnerPerimeter = roadSnap.snapPointToInnerPerimeter || ((x, y) => [x, y]);
  const snapSlotToRoad = roadSnap.snapSlotToRoad || ((x, y) => [x, y, 0]);
  const normalizeAngle = roadSnap.normalizeAngle || ((t) => t);

  function normalizeSlotEntry(rawSlot) {
    const x = Number(rawSlot?.[0]);
    const y = Number(rawSlot?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y, normalizeAngle(rawSlot?.[2] ?? 0)];
  }

  function polygonSelfIntersects(poly) {
    return geometry?.polygonSelfIntersects ? geometry.polygonSelfIntersects(poly) : false;
  }

  function normalizeVehicleDestinations(s) {
    const nB = Array.isArray(s.buildings) ? s.buildings.length : 0;
    const nVeh = Math.max(0, parseInt(s.n_veh, 10) || 0);
    if (nB <= 0 || nVeh <= 0) {
      s.vehicle_destinations = [];
      return;
    }
    const raw = Array.isArray(s.vehicle_destinations) ? s.vehicle_destinations : [];
    const out = [];
    for (let i = 0; i < nVeh; i++) {
      const v = parseInt(i < raw.length ? raw[i] : i % nB, 10);
      const bi = Number.isFinite(v) ? v : i % nB;
      out.push(Math.max(0, Math.min(nB - 1, bi)));
    }
    s.vehicle_destinations = out;
  }

  function normalizeVehicleEntrances(s) {
    const nVeh = Math.max(0, parseInt(s.n_veh, 10) || 0);
    const nE = Array.isArray(s.entrances) && s.entrances.length ? s.entrances.length : 1;
    const raw = Array.isArray(s.vehicle_entrances) ? s.vehicle_entrances : [];
    const out = [];
    for (let i = 0; i < nVeh; i++) {
      const v = parseInt(i < raw.length ? raw[i] : 0, 10);
      out.push(Number.isFinite(v) ? Math.max(0, Math.min(nE - 1, v)) : 0);
    }
    s.vehicle_entrances = out;
    s.entrance_mode = String(s.entrance_mode || "auto").toLowerCase() === "fixed" ? "fixed" : "auto";
  }

  function normalizeSlotAndVehicleTypes(s) {
    const nSlot = Array.isArray(s.slots) ? s.slots.length : 0;
    const nVeh = Math.max(0, parseInt(s.n_veh, 10) || 0);
    const slotTypesRaw = Array.isArray(s.slot_types) ? s.slot_types : [];
    const reqRaw = Array.isArray(s.vehicle_requirements) ? s.vehicle_requirements : [];
    s.slot_types = Array.from({ length: nSlot }, (_, i) =>
      String(slotTypesRaw[i] || "normal").trim().toLowerCase() || "normal"
    );
    s.vehicle_requirements = Array.from({ length: nVeh }, (_, i) =>
      String(reqRaw[i] || "normal").trim().toLowerCase() || "normal"
    );
    const soft = s.soft_constraints || {};
    s.soft_constraints = {
      type_mismatch_penalty: Math.max(0, Number(soft.type_mismatch_penalty || 0)),
    };
  }

  function normalizeScenario(raw) {
    const s = cloneJson(raw || {});
    const def = defaultScenario();
    const lot = s.lot || {};
    const xMin = Number(lot.x_min ?? 0);
    const yMin = Number(lot.y_min ?? 0);
    const lw = Number(lot.width ?? 100);
    const lh = Number(lot.height ?? 100);
    s.lot = {
      x_min: Number.isFinite(xMin) ? xMin : 0,
      y_min: Number.isFinite(yMin) ? yMin : 0,
      width: lw,
      height: lh,
    };
    s.entrance = Array.isArray(s.entrance)
      ? [Number(s.entrance[0] || 0), Number(s.entrance[1] || 0)]
      : cloneJson(def.entrance);
    s.inner = s.inner || cloneJson(def.inner);
    s.road = normalizeRoad(s.road, s.inner, () => def.road);
    s.inner = innerFromRoad(s.road) || cloneJson(def.inner);
    s.obstacle = s.obstacle || null;
    const rawEntrances = Array.isArray(s.entrances) && s.entrances.length ? s.entrances : [s.entrance];
    s.entrances = rawEntrances.map((p) => [Number(p?.[0] || 0), Number(p?.[1] || 0)]);
    const normalizeObstacle = (o) => {
      if (!o || typeof o !== "object") return null;
      let pts = [];
      if (Array.isArray(o.points) && o.points.length) {
        pts = o.points.map((p) => [Number(p?.[0]), Number(p?.[1])]);
      } else if (
        Number.isFinite(Number(o.x_min)) &&
        Number.isFinite(Number(o.x_max)) &&
        Number.isFinite(Number(o.y_min)) &&
        Number.isFinite(Number(o.y_max))
      ) {
        const x0 = Math.min(Number(o.x_min), Number(o.x_max));
        const x1 = Math.max(Number(o.x_min), Number(o.x_max));
        const y0 = Math.min(Number(o.y_min), Number(o.y_max));
        const y1 = Math.max(Number(o.y_min), Number(o.y_max));
        pts = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ];
      }
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const x = Number(pts[i]?.[0]);
        const y = Number(pts[i]?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (!out.length || Math.hypot(out[out.length - 1][0] - x, out[out.length - 1][1] - y) > 1e-6) {
          out.push([x, y]);
        }
      }
      if (out.length >= 2) {
        const f0 = out[0];
        const fn = out[out.length - 1];
        if (Math.hypot(f0[0] - fn[0], f0[1] - fn[1]) < 1e-6) out.pop();
      }
      if (out.length < 3) return null;
      if (polygonSelfIntersects(out)) return null;
      let area = 0;
      for (let i = 0; i < out.length; i++) {
        const a = out[i];
        const b = out[(i + 1) % out.length];
        area += a[0] * b[1] - b[0] * a[1];
      }
      if (Math.abs(area) < 0.1) return null;
      return { points: out };
    };
    const rawObstacles = Array.isArray(s.obstacles) && s.obstacles.length ? s.obstacles : [s.obstacle];
    s.obstacles = rawObstacles.map((o) => normalizeObstacle(o)).filter((o) => !!o);
    s.buildings = Array.isArray(s.buildings) ? s.buildings.map((p) => [Number(p[0]), Number(p[1])]) : [];
    s.slots = Array.isArray(s.slots)
      ? s.slots.map((p) => normalizeSlotEntry(p)).filter((p) => !!p)
      : [];
    s.constraints = {
      snap_slots_to_inner_road: true,
      snap_entrance_to_inner: true,
    };
    if (s.constraints.snap_entrance_to_inner) {
      s.entrances = s.entrances.map((p) =>
        snapPointToInnerPerimeter(Number(p[0]), Number(p[1]), s.road, s.lot)
      );
    }
    s.entrance = s.entrances[0] || cloneJson(def.entrance);
    const p0 = s.obstacles[0]?.points || [];
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < p0.length; i++) {
      xmin = Math.min(xmin, Number(p0[i][0]));
      xmax = Math.max(xmax, Number(p0[i][0]));
      ymin = Math.min(ymin, Number(p0[i][1]));
      ymax = Math.max(ymax, Number(p0[i][1]));
    }
    s.obstacle =
      Number.isFinite(xmin) && Number.isFinite(xmax) && Number.isFinite(ymin) && Number.isFinite(ymax)
        ? { x_min: xmin, x_max: xmax, y_min: ymin, y_max: ymax }
        : null;
    if (s.constraints.snap_slots_to_inner_road && s.slots.length) {
      s.slots = s.slots.map((p) => {
        const snapped = snapSlotToRoad(Number(p[0]), Number(p[1]), s.road, s.lot);
        return [snapped[0], snapped[1], normalizeAngle(snapped[2] ?? p[2] ?? 0)];
      });
    }
    const nVehRaw = parseInt(s.n_veh, 10) || 12;
    if (s.slots.length === 0) s.n_veh = 0;
    else s.n_veh = Math.max(1, Math.min(nVehRaw, s.slots.length));
    const pso = s.pso || {};
    s.pso = {
      n_particles: parseInt(pso.n_particles, 10) || N_PARTICLES_DEFAULT,
      n_iter: parseInt(pso.n_iter, 10) || N_ITER_DEFAULT,
      w: Number(pso.w ?? W_DEFAULT),
      c1: Number(pso.c1 ?? C1_DEFAULT),
      c2: Number(pso.c2 ?? C2_DEFAULT),
      v_max: Number(pso.v_max ?? V_MAX_DEFAULT),
    };
    const disp = s.display || {};
    const metersPerUnit = Number(disp.meters_per_unit ?? 2);
    const rawUnderlay = disp.underlay && typeof disp.underlay === "object" ? disp.underlay : {};
    const opacity = Number(rawUnderlay.opacity);
    const normPt = (arr) =>
      Array.isArray(arr) && arr.length >= 2
        ? [Number(arr[0]), Number(arr[1])].map((v) => (Number.isFinite(v) ? v : 0))
        : null;
    const imageSize =
      Array.isArray(rawUnderlay.imageSize) && rawUnderlay.imageSize.length >= 2
        ? [
            Math.max(1, Number(rawUnderlay.imageSize[0]) || 1),
            Math.max(1, Number(rawUnderlay.imageSize[1]) || 1),
          ]
        : null;
    s.display = {
      length_unit: String(disp.length_unit || "m"),
      time_unit: String(disp.time_unit || "s"),
      meters_per_unit: Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 2,
      scale_bar_m: Number(disp.scale_bar_m ?? 20),
      coord_note: String(disp.coord_note || "平面坐标 1 单位 = 2 m"),
      underlay: {
        dataUrl: typeof rawUnderlay.dataUrl === "string" ? rawUnderlay.dataUrl : "",
        opacity: Number.isFinite(opacity) ? Math.max(0.05, Math.min(1, opacity)) : 0.55,
        imageSize,
        worldA: normPt(rawUnderlay.worldA),
        worldB: normPt(rawUnderlay.worldB),
        imageA: normPt(rawUnderlay.imageA),
        imageB: normPt(rawUnderlay.imageB),
      },
    };
    normalizeVehicleDestinations(s);
    normalizeVehicleEntrances(s);
    normalizeSlotAndVehicleTypes(s);
    return s;
  }

  window.ParkingScenario = {
    defaultScenario,
    normalizeScenario,
    normalizeVehicleDestinations,
    normalizeVehicleEntrances,
    normalizeSlotEntry,
  };
})();

/* --- optimizer\nav-grid.js --- */
(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;

  const NAV_GRID_STEP = 1.2;
  const NAV_GRID_STEP_MAX = 1.8;

  function pointInPolygon(p, poly, includeBoundary = true) {
    return geometry?.pointInPolygon ? geometry.pointInPolygon(p, poly, includeBoundary) : false;
  }

  function segmentIntersectsPolygon(p1, p2, poly) {
    return geometry?.segmentIntersectsPolygon
      ? geometry.segmentIntersectsPolygon(p1, p2, poly)
      : false;
  }

  function segmentClearBoxes(p1, p2, boxes) {
    for (let i = 0; i < boxes.length; i++) {
      if (segmentIntersectsPolygon(p1, p2, boxes[i])) return false;
    }
    return true;
  }

  function pointInsideAnyObstacle(p, obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
      if (pointInPolygon(p, obstacles[i], true)) return true;
    }
    return false;
  }

  function navGridIdx(i, j, nx) {
    return j * nx + i;
  }

  function recommendNavStep(lotW, lotH, obstacleCount) {
    const area = Math.max(1, Number(lotW) * Number(lotH));
    const obsFactor = Math.max(0, Number(obstacleCount) || 0);
    const densePenalty = Math.min(0.5, obsFactor * 0.04);
    const areaPenalty = Math.min(0.4, Math.max(0, area - 12000) / 30000);
    return Math.max(NAV_GRID_STEP, Math.min(NAV_GRID_STEP_MAX, NAV_GRID_STEP + densePenalty + areaPenalty));
  }

  function buildNavigationGrid(obstacles, lotW, lotH, step = NAV_GRID_STEP, xMin = 0, yMin = 0) {
    const nx = Math.max(2, Math.floor(lotW / step) + 1);
    const ny = Math.max(2, Math.floor(lotH / step) + 1);
    const valid = new Uint8Array(nx * ny);
    const points = Array(nx * ny);
    const xMax = xMin + lotW;
    const yMax = yMin + lotH;
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = navGridIdx(i, j, nx);
        const x = Math.min(xMax, xMin + i * step);
        const y = Math.min(yMax, yMin + j * step);
        points[idx] = [x, y];
        valid[idx] = pointInsideAnyObstacle([x, y], obstacles) ? 0 : 1;
      }
    }
    const adj = Array.from({ length: nx * ny }, () => []);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = navGridIdx(i, j, nx);
        if (!valid[idx]) continue;
        const p = points[idx];
        for (let d = 0; d < dirs.length; d++) {
          const ni = i + dirs[d][0];
          const nj = j + dirs[d][1];
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = navGridIdx(ni, nj, nx);
          if (!valid[nidx]) continue;
          const q = points[nidx];
          if (!segmentClearBoxes(p, q, obstacles)) continue;
          adj[idx].push([nidx, Math.hypot(q[0] - p[0], q[1] - p[1])]);
        }
      }
    }
    return { nx, ny, step, xMin, yMin, lotW, lotH, valid, points, adj, nodeCount: nx * ny };
  }

  function nearestVisibleGridNodes(point, nav, obstacles, maxNodes = 6, maxPx = 6) {
    if (pointInsideAnyObstacle(point, obstacles)) return [];
    const [px, py] = point;
    const xMin = nav.xMin ?? 0;
    const yMin = nav.yMin ?? 0;
    const ci = Math.max(0, Math.min(nav.nx - 1, Math.round((px - xMin) / nav.step)));
    const cj = Math.max(0, Math.min(nav.ny - 1, Math.round((py - yMin) / nav.step)));
    const cands = [];
    for (let r = 0; r <= maxPx; r++) {
      const i0 = Math.max(0, ci - r);
      const i1 = Math.min(nav.nx - 1, ci + r);
      const j0 = Math.max(0, cj - r);
      const j1 = Math.min(nav.ny - 1, cj + r);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (r > 0 && i > i0 && i < i1 && j > j0 && j < j1) continue;
          const idx = navGridIdx(i, j, nav.nx);
          if (!nav.valid[idx]) continue;
          const q = nav.points[idx];
          if (!segmentClearBoxes(point, q, obstacles)) continue;
          cands.push([idx, Math.hypot(q[0] - px, q[1] - py)]);
        }
      }
      if (cands.length >= maxNodes) break;
    }
    if (!cands.length) {
      for (let idx = 0; idx < nav.nodeCount; idx++) {
        if (!nav.valid[idx]) continue;
        const q = nav.points[idx];
        if (!segmentClearBoxes(point, q, obstacles)) continue;
        cands.push([idx, Math.hypot(q[0] - px, q[1] - py)]);
      }
    }
    cands.sort((a, b) => a[1] - b[1]);
    return cands.slice(0, maxNodes);
  }

  window.ParkingOptimizerNav = {
    recommendNavStep,
    buildNavigationGrid,
    nearestVisibleGridNodes,
    segmentClearBoxes,
  };
})();

/* --- optimizer\pathfinding.js --- */
(function () {
  "use strict";

  const nav = window.ParkingOptimizerNav || {};
  const segmentClearBoxes = nav.segmentClearBoxes || (() => true);
  const buildNavigationGrid = nav.buildNavigationGrid;
  const recommendNavStep = nav.recommendNavStep;
  const nearestVisibleGridNodes = nav.nearestVisibleGridNodes;

  const BUILDING_FOOTPRINT_W = 18.0;
  const BUILDING_FOOTPRINT_H = 12.0;
  const UNREACHABLE_WALK_DIST = 1e6;

  function buildingAxisBox(cx, cy) {
    const hw = BUILDING_FOOTPRINT_W / 2;
    const hh = BUILDING_FOOTPRINT_H / 2;
    return [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ];
  }

  function walkBlockingBoxes(obstacles, buildingsPos, destBi) {
    const boxes = (Array.isArray(obstacles) ? obstacles : [])
      .map((o) =>
        Array.isArray(o?.points) ? o.points.map((p) => [Number(p[0]), Number(p[1])]) : null
      )
      .filter((o) => Array.isArray(o) && o.length >= 3);
    for (let i = 0; i < buildingsPos.length; i++) {
      if (i === destBi) continue;
      boxes.push(buildingAxisBox(buildingsPos[i][0], buildingsPos[i][1]));
    }
    return boxes;
  }

  function polylineLength(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return d;
  }

  function polylineSegmentsClear(pts, boxes) {
    for (let i = 1; i < pts.length; i++) {
      if (!segmentClearBoxes(pts[i - 1], pts[i], boxes)) return false;
    }
    return true;
  }

  function simplifyColinearPolyline(pts) {
    if (pts.length <= 2) return pts.slice();
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const v1x = b[0] - a[0];
      const v1y = b[1] - a[1];
      const v2x = c[0] - b[0];
      const v2y = c[1] - b[1];
      const cross = v1x * v2y - v1y * v2x;
      if (Math.abs(cross) > 1e-5) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function minHeapPush(heap, item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }

  function minHeapPop(heap) {
    if (!heap.length) return null;
    const top = heap[0];
    const tail = heap.pop();
    if (heap.length) {
      heap[0] = tail;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  }

  function aStarBetweenNodes(startIdx, goalIdx, grid) {
    if (startIdx === goalIdx) return [0, [startIdx]];
    const n = grid.nodeCount;
    const g = Array.from({ length: n }, () => Infinity);
    const f = Array.from({ length: n }, () => Infinity);
    const parent = Array.from({ length: n }, () => -1);
    const closed = new Uint8Array(n);
    const goalPt = grid.points[goalIdx];
    g[startIdx] = 0;
    f[startIdx] = Math.hypot(
      grid.points[startIdx][0] - goalPt[0],
      grid.points[startIdx][1] - goalPt[1]
    );
    const heap = [];
    minHeapPush(heap, [f[startIdx], startIdx]);
    while (heap.length) {
      const cur = minHeapPop(heap);
      const u = cur[1];
      if (closed[u]) continue;
      closed[u] = 1;
      if (u === goalIdx) break;
      const nbrs = grid.adj[u];
      for (let i = 0; i < nbrs.length; i++) {
        const v = nbrs[i][0];
        const w = nbrs[i][1];
        if (closed[v]) continue;
        const ng = g[u] + w;
        if (ng >= g[v]) continue;
        g[v] = ng;
        parent[v] = u;
        f[v] = ng + Math.hypot(grid.points[v][0] - goalPt[0], grid.points[v][1] - goalPt[1]);
        minHeapPush(heap, [f[v], v]);
      }
    }
    if (!Number.isFinite(g[goalIdx])) return null;
    const seq = [];
    for (let cur = goalIdx; cur >= 0; cur = parent[cur]) {
      seq.push(cur);
      if (cur === startIdx) break;
    }
    seq.reverse();
    return [g[goalIdx], seq];
  }

  function simplifyPathWithCollision(path, obstacles) {
    if (!Array.isArray(path) || path.length <= 2) return path ? path.slice() : [];
    const out = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let best = anchor + 1;
      for (let j = path.length - 1; j > anchor + 1; j--) {
        if (segmentClearBoxes(path[anchor], path[j], obstacles)) {
          best = j;
          break;
        }
      }
      out.push(path[best]);
      anchor = best;
    }
    return simplifyColinearPolyline(out);
  }

  function walkingPlan(slotXY, buildingXY, obstacles, buildingsPos, destBi, boxesInput, navInput, lotInput) {
    const boxes = boxesInput || walkBlockingBoxes(obstacles, buildingsPos, destBi);
    const s = [Number(slotXY[0]), Number(slotXY[1])];
    const t = [Number(buildingXY[0]), Number(buildingXY[1])];
    if (segmentClearBoxes(s, t, boxes)) return [Math.hypot(s[0] - t[0], s[1] - t[1]), [s, t]];
    const lotW = Math.max(1, Number(lotInput?.width || 100));
    const lotH = Math.max(1, Number(lotInput?.height || 100));
    const xMin = Number(lotInput?.x_min ?? 0);
    const yMin = Number(lotInput?.y_min ?? 0);
    const grid =
      navInput ||
      buildNavigationGrid(
        boxes,
        lotW,
        lotH,
        recommendNavStep(lotW, lotH, boxes.length),
        xMin,
        yMin
      );
    const sNodes = nearestVisibleGridNodes(s, grid, boxes, 6, 7);
    const tNodes = nearestVisibleGridNodes(t, grid, boxes, 6, 7);
    if (!sNodes.length || !tNodes.length) return [UNREACHABLE_WALK_DIST, [s]];
    let bestDist = Infinity;
    let bestPath = null;
    for (let i = 0; i < sNodes.length; i++) {
      const [si, ds] = sNodes[i];
      for (let j = 0; j < tNodes.length; j++) {
        const [ti, dt] = tNodes[j];
        const ast = aStarBetweenNodes(si, ti, grid);
        if (!ast) continue;
        const [dgrid, idxSeq] = ast;
        const pts = [s, ...idxSeq.map((idx) => grid.points[idx]), t];
        const simp = simplifyPathWithCollision(pts, boxes);
        if (!polylineSegmentsClear(simp, boxes)) continue;
        const d = ds + dgrid + dt;
        if (d < bestDist) {
          bestDist = d;
          bestPath = simp;
        }
      }
    }
    if (!bestPath) return [UNREACHABLE_WALK_DIST, [s]];
    return [polylineLength(bestPath), bestPath];
  }

  window.ParkingOptimizerNav = {
    ...nav,
    UNREACHABLE_WALK_DIST,
    walkBlockingBoxes,
    recommendNavStep,
    buildNavigationGrid,
    walkingPlan,
    segmentClearBoxes,
    polylineLength,
  };
})();

/* --- optimizer\path-cost.js --- */
(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;
  const roadModel = window.ParkingRoadModel || {};
  const roadFromInner = roadModel.roadFromInner || (() => null);
  const DEFAULT_ROAD_WIDTH = roadModel.DEFAULT_ROAD_WIDTH || 6.0;

  function arcLengthFromBLCCW(px, py, roadOrInner) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    if (!geometry?.projectPointToRoad) return 0;
    const proj = geometry.projectPointToRoad(px, py, { road });
    return Number(proj?.along || 0);
  }

  function perimeterDistanceBetween(ax, ay, bx, by, roadOrInner) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    if (geometry?.roadDistanceBetweenPoints) {
      return geometry.roadDistanceBetweenPoints([ax, ay], [bx, by], { road });
    }
    return Math.abs(arcLengthFromBLCCW(ax, ay, road) - arcLengthFromBLCCW(bx, by, road));
  }

  function drivingDistanceFromEntrance(slotXY, roadOrInner, entrance) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    const ex = Number(entrance[0]);
    const ey = Number(entrance[1]);
    const sx = Number(slotXY[0]);
    const sy = Number(slotXY[1]);
    const pSlot = geometry?.projectPointToRoad ? geometry.projectPointToRoad(sx, sy, { road }) : null;
    if (!pSlot) return 0;
    const onRoadDist = perimeterDistanceBetween(ex, ey, pSlot.point[0], pSlot.point[1], road);
    return onRoadDist + pSlot.distance;
  }

  window.ParkingOptimizerPathCost = {
    drivingDistanceFromEntrance,
    perimeterDistanceBetween,
  };
})();

/* --- optimizer\cost-matrix.js --- */
(function () {
  "use strict";

  const nav = window.ParkingOptimizerNav || {};
  const pathCost = window.ParkingOptimizerPathCost || {};
  const roadModel = window.ParkingRoadModel || {};
  const roadFromInner = roadModel.roadFromInner || (() => null);
  const DEFAULT_ROAD_WIDTH = roadModel.DEFAULT_ROAD_WIDTH || 6.0;

  const walkBlockingBoxes = nav.walkBlockingBoxes || (() => []);
  const recommendNavStep = nav.recommendNavStep || (() => 1.2);
  const buildNavigationGrid = nav.buildNavigationGrid || (() => ({}));
  const walkingPlan = nav.walkingPlan || (() => [0, []]);
  const drivingDistanceFromEntrance = pathCost.drivingDistanceFromEntrance || (() => 0);

  function vehicleSlotPenalty(s, vehIdx, slotIdx) {
    const req = s.vehicle_requirements?.[vehIdx] || "normal";
    if (req === "normal") return 0;
    const slotType = s.slot_types?.[slotIdx] || "normal";
    if (slotType === req) return 0;
    return Number(s.soft_constraints?.type_mismatch_penalty || 0);
  }

  function precomputeFromNormalized(s) {
    const road = s.road || roadFromInner(s.inner, DEFAULT_ROAD_WIDTH);
    const obstacles = s.obstacles;
    const lot = s.lot || { width: 100, height: 100 };
    const metersPerUnit = Number(s?.display?.meters_per_unit) > 0 ? Number(s.display.meters_per_unit) : 2;
    const slotsPos = s.slots.map((p) => [Number(p[0]), Number(p[1])]);
    const buildingsPos = s.buildings.map((p) => [Number(p[0]), Number(p[1])]);
    const nSlot = slotsPos.length;
    const nB = buildingsPos.length;
    const entrancesPos = s.entrances.map((p) => [Number(p[0]), Number(p[1])]);
    if (!nSlot || !nB) {
      return {
        driveDistByEntrance: [],
        walkMat: [],
        boxesByBi: [],
        navByBi: [],
        slotsPos,
        buildingsPos,
        entrancesPos,
        nSlot,
        nB,
      };
    }
    const driveDistByEntrance = slotsPos.map((slot) =>
      entrancesPos.map((ent) => drivingDistanceFromEntrance(slot, road, ent) * metersPerUnit)
    );
    const boxesByBi = Array.from({ length: nB }, (_, bi) =>
      walkBlockingBoxes(obstacles, buildingsPos, bi)
    );
    const navByBi = Array.from({ length: nB }, (_, bi) => {
      const lw = Number(lot.width || 100);
      const lh = Number(lot.height || 100);
      const xMin = Number(lot.x_min ?? 0);
      const yMin = Number(lot.y_min ?? 0);
      const step = recommendNavStep(lw, lh, boxesByBi[bi].length);
      return buildNavigationGrid(boxesByBi[bi], lw, lh, step, xMin, yMin);
    });
    const walkMat = Array.from({ length: nSlot }, () => Array.from({ length: nB }, () => 0));
    for (let si = 0; si < nSlot; si++) {
      for (let bi = 0; bi < nB; bi++) {
        walkMat[si][bi] =
          walkingPlan(
            slotsPos[si],
            buildingsPos[bi],
            obstacles,
            buildingsPos,
            bi,
            boxesByBi[bi],
            navByBi[bi],
            lot
          )[0] * metersPerUnit;
      }
    }
    return {
      driveDistByEntrance,
      walkMat,
      boxesByBi,
      navByBi,
      slotsPos,
      buildingsPos,
      entrancesPos,
      nSlot,
      nB,
      road,
    };
  }

  window.ParkingOptimizerCost = {
    vehicleSlotPenalty,
    precomputeFromNormalized,
  };
})();

/* --- optimizer\algorithms\hungarian.js --- */
(function () {
  "use strict";

  function hungarianRect(cost) {
    const n = cost.length;
    const m = cost[0].length;
    const u = Array(n + 1).fill(0);
    const v = Array(m + 1).fill(0);
    const p = Array(m + 1).fill(0);
    const way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(m + 1).fill(Infinity);
      const used = Array(m + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = 0;
        for (let j = 1; j <= m; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
        for (let j = 0; j <= m; j++) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }
    const colForRow = Array(n).fill(-1);
    for (let j = 1; j <= m; j++) {
      if (p[j] > 0) colForRow[p[j] - 1] = j - 1;
    }
    return colForRow;
  }

  window.ParkingOptimizerHungarian = {
    hungarianRect,
  };
})();

/* --- optimizer\algorithms\pso.js --- */
(function () {
  "use strict";

  function decodeParticle(position, nVeh, nSlot) {
    const entries = position.map((v, i) => ({
      v,
      i,
      want: Math.min(nSlot - 1, Math.max(0, Math.floor(v * nSlot))),
    }));
    entries.sort((a, b) => a.v - b.v);
    const used = new Set();
    const assign = new Array(nVeh).fill(0);
    for (const { i, want } of entries) {
      let slot = want;
      for (let delta = 0; delta <= nSlot; delta++) {
        if (!used.has(want + delta) && want + delta < nSlot) {
          slot = want + delta;
          break;
        }
        if (!used.has(want - delta) && want - delta >= 0) {
          slot = want - delta;
          break;
        }
      }
      assign[i] = slot;
      used.add(slot);
    }
    return assign;
  }

  function makeRng(seed) {
    if (seed === null || seed === undefined || Number.isNaN(Number(seed))) {
      return { random: () => Math.random() };
    }
    let t = (Number(seed) >>> 0) || 1;
    return {
      random: () => {
        t += 0x6d2b79f5;
        let z = t;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
      },
    };
  }

  function gaussian(rng) {
    const u1 = Math.max(1e-12, rng.random());
    const u2 = rng.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function encodeAssignToPosition(assign, nSlot) {
    return assign.map((slotIdx) => (slotIdx + 0.5) / nSlot);
  }

  window.ParkingOptimizerPso = {
    decodeParticle,
    makeRng,
    gaussian,
    encodeAssignToPosition,
  };
})();

/* --- optimizer\pack-result.js --- */
(function () {
  "use strict";

  const nav = window.ParkingOptimizerNav || {};
  const roadModel = window.ParkingRoadModel || {};
  const geometry = window.ParkingGeometry || {};
  const walkingPlan = nav.walkingPlan || (() => [0, []]);
  const buildRoadSegments = roadModel.buildRoadSegments || (() => []);
  const roadPolylineBetweenPoints = geometry.roadPolylineBetweenPoints || (() => []);

  function packResult(s, opts) {
    const paths = [];
    const drive_paths = [];
    const entrances = Array.isArray(s.entrances) ? s.entrances : [];
    const roadSource = { road: opts.road || s.road || {} };
    for (let i = 0; i < opts.bestAssign.length; i++) {
      const ti = opts.vehTargets[i];
      const slotXY = opts.slotsPos[opts.bestAssign[i]];
      const bxy = opts.buildingsPos[ti];
      const poly = walkingPlan(
        slotXY,
        bxy,
        opts.obstacles,
        opts.buildingsPos,
        ti,
        opts.boxesByBi[ti],
        opts.navByBi ? opts.navByBi[ti] : null,
        opts.lot
      )[1];
      paths.push(poly.map((p) => [Number(p[0]), Number(p[1])]));
      const ei = opts.bestEntrances[i];
      const ent = entrances[ei];
      if (ent) {
        const drivePoly = roadPolylineBetweenPoints(ent, slotXY, roadSource);
        drive_paths.push(drivePoly.map((p) => [Number(p[0]), Number(p[1])]));
      } else {
        drive_paths.push([]);
      }
    }
    return {
      scenario: s,
      gbest_value: Number(opts.gbestValue),
      history_best: opts.historyBest.map((v) => Number(v)),
      assign: opts.bestAssign.map((v) => Number(v)),
      veh_targets: opts.vehTargets.map((v) => Number(v)),
      veh_entrances: opts.bestEntrances.map((v) => Number(v)),
      vehicle_breakdown: opts.vehicleBreakdown.map((it) => ({
        vehicle_index: Number(it.vehicle_index),
        slot_index: Number(it.slot_index),
        destination_index: Number(it.destination_index),
        entrance_index: Number(it.entrance_index),
        drive_time: Number(it.drive_time),
        walk_time: Number(it.walk_time),
        penalty: Number(it.penalty),
        total_time: Number(it.total_time),
      })),
      paths,
      drive_paths,
      road_segments: buildRoadSegments(opts.road).map((seg) => [
        [Number(seg[0][0]), Number(seg[0][1])],
        [Number(seg[1][0]), Number(seg[1][1])],
      ]),
      optimizer: opts.optimizer,
    };
  }

  window.ParkingOptimizerPack = {
    packResult,
  };
})();

/* --- optimizer\index.js --- */
(function () {
  "use strict";

  const coreConstants = window.ParkingCoreConstants || null;
  const scenarioModule = window.ParkingScenario || {};
  const costModule = window.ParkingOptimizerCost || {};
  const hungarianModule = window.ParkingOptimizerHungarian || {};
  const psoModule = window.ParkingOptimizerPso || {};
  const packModule = window.ParkingOptimizerPack || {};
  const roadModel = window.ParkingRoadModel || {};
  const scenarioDefault = window.ParkingScenarioDefault || {};

  const RESULT_KEYS = coreConstants?.RESULT_KEYS || [
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
  ];

  const defaultScenario = scenarioModule.defaultScenario || (() => ({}));
  const normalizeScenario = scenarioModule.normalizeScenario || ((raw) => raw);
  const normalizeVehicleDestinations = scenarioModule.normalizeVehicleDestinations || (() => {});
  const precomputeFromNormalized = costModule.precomputeFromNormalized || (() => ({}));
  const vehicleSlotPenalty = costModule.vehicleSlotPenalty || (() => 0);
  const hungarianRect = hungarianModule.hungarianRect || (() => []);
  const decodeParticle = psoModule.decodeParticle || (() => []);
  const makeRng = psoModule.makeRng || (() => ({ random: Math.random }));
  const gaussian = psoModule.gaussian || (() => 0);
  const packResult = packModule.packResult || ((s, opts) => ({ scenario: s, ...opts }));
  const roadFromInner = roadModel.roadFromInner || (() => null);

  const N_PARTICLES_DEFAULT = scenarioDefault.N_PARTICLES_DEFAULT || 40;
  const N_ITER_DEFAULT = scenarioDefault.N_ITER_DEFAULT || 600;
  const W_DEFAULT = scenarioDefault.W_DEFAULT || 0.7;
  const C1_DEFAULT = scenarioDefault.C1_DEFAULT || 1.5;
  const C2_DEFAULT = scenarioDefault.C2_DEFAULT || 1.5;
  const V_MAX_DEFAULT = scenarioDefault.V_MAX_DEFAULT || 0.25;
  const DEFAULT_ROAD_WIDTH = scenarioDefault.DEFAULT_ROAD_WIDTH || 6.0;

  function runOptimize(scenarioInput, options) {
    const methodRaw = String((options && options.method) || "exact").trim().toLowerCase();
    const method = methodRaw === "pso" ? "pso" : "exact";
    const seed = options && Object.prototype.hasOwnProperty.call(options, "seed") ? options.seed : null;
    const s = normalizeScenario(scenarioInput);
    const road = s.road || roadFromInner(s.inner, DEFAULT_ROAD_WIDTH);
    const obstacles = s.obstacles;
    const prep = precomputeFromNormalized(s);
    const nSlot = prep.nSlot;
    const nB = prep.nB;
    const err = {
      error: "需要至少一个车位、一栋楼，且车辆数大于 0。",
      scenario: s,
      gbest_value: null,
      history_best: [],
      assign: [],
      veh_targets: [],
      paths: [],
      road_segments: [],
      optimizer: method,
    };
    if (!nSlot || !nB || !s.n_veh) return err;
    const nVeh = Math.min(Number(s.n_veh), nSlot);
    s.n_veh = nVeh;
    normalizeVehicleDestinations(s);
    const vehTargets = s.vehicle_destinations.slice(0, nVeh);
    const vehEntrances = s.vehicle_entrances.slice(0, nVeh);
    const entranceMode = s.entrance_mode === "fixed" ? "fixed" : "auto";
    const entranceCount = prep.entrancesPos.length || 1;
    const vCar = 10.0;
    const vWalk = 1.5;

    function resolveDriveForVehicle(slotIndex, vehIdx) {
      if (entranceMode === "fixed") {
        const eiRaw = Number(vehEntrances[vehIdx]);
        const ei = Number.isFinite(eiRaw) ? Math.max(0, Math.min(entranceCount - 1, eiRaw)) : 0;
        return { driveTime: prep.driveDistByEntrance[slotIndex][ei] / vCar, entranceIndex: ei };
      }
      let bestEi = 0;
      let bestDrive = prep.driveDistByEntrance[slotIndex][0] / vCar;
      for (let ei = 1; ei < entranceCount; ei++) {
        const cur = prep.driveDistByEntrance[slotIndex][ei] / vCar;
        if (cur < bestDrive) {
          bestDrive = cur;
          bestEi = ei;
        }
      }
      return { driveTime: bestDrive, entranceIndex: bestEi };
    }

    function buildVehicleBreakdown(bestAssign) {
      const bestEntrances = [];
      const items = [];
      for (let i = 0; i < nVeh; i++) {
        const slotIndex = bestAssign[i];
        const drive = resolveDriveForVehicle(slotIndex, i);
        const walkTime = prep.walkMat[slotIndex][vehTargets[i]] / vWalk;
        const penalty = vehicleSlotPenalty(s, i, slotIndex);
        bestEntrances.push(drive.entranceIndex);
        items.push({
          vehicle_index: i,
          slot_index: slotIndex,
          destination_index: vehTargets[i],
          entrance_index: drive.entranceIndex,
          drive_time: drive.driveTime,
          walk_time: walkTime,
          penalty,
          total_time: drive.driveTime + walkTime + penalty,
        });
      }
      return { bestEntrances, items };
    }

    function runExactMethod() {
      const cost = Array.from({ length: nVeh }, (_, i) =>
        Array.from({ length: nSlot }, (_, j) => {
          const drive = resolveDriveForVehicle(j, i).driveTime;
          const walk = prep.walkMat[j][vehTargets[i]] / vWalk;
          const penalty = vehicleSlotPenalty(s, i, j);
          return drive + walk + penalty;
        })
      );
      const bestAssign = hungarianRect(cost);
      let gbestValue = 0;
      for (let i = 0; i < nVeh; i++) gbestValue += cost[i][bestAssign[i]];
      const breakdown = buildVehicleBreakdown(bestAssign);
      return packResult(s, {
        gbestValue,
        historyBest: [gbestValue],
        bestAssign,
        bestEntrances: breakdown.bestEntrances,
        vehicleBreakdown: breakdown.items,
        slotsPos: prep.slotsPos,
        buildingsPos: prep.buildingsPos,
        obstacles,
        vehTargets,
        boxesByBi: prep.boxesByBi,
        navByBi: prep.navByBi,
        lot: s.lot,
        road,
        optimizer: "exact",
      });
    }

    function runPsoMethod() {
      const rng = makeRng(seed);
      const pso = s.pso || {};
      const nParticles = Math.max(2, Number(pso.n_particles) || N_PARTICLES_DEFAULT);
      const nIter = Math.max(1, Number(pso.n_iter) || N_ITER_DEFAULT);
      const wMax = Number(pso.w ?? W_DEFAULT) > 0.5 ? Number(pso.w ?? W_DEFAULT) : 0.9;
      const wMin = 0.4;
      const c1 = Number(pso.c1 ?? C1_DEFAULT);
      const c2 = Number(pso.c2 ?? C2_DEFAULT);
      const vMax = Number(pso.v_max ?? V_MAX_DEFAULT);
      const EARLY_STOP_PATIENCE = Math.max(80, Math.round(nIter * 0.2));

      function objective(position) {
        const assign = decodeParticle(position, nVeh, nSlot);
        let driveTotal = 0;
        let walkTotal = 0;
        for (let i = 0; i < nVeh; i++) {
          const slotIndex = assign[i];
          driveTotal += resolveDriveForVehicle(slotIndex, i).driveTime;
          walkTotal += prep.walkMat[slotIndex][vehTargets[i]] / vWalk;
          walkTotal += vehicleSlotPenalty(s, i, slotIndex);
        }
        return driveTotal + walkTotal;
      }

      const positions = Array.from({ length: nParticles }, () =>
        Array.from({ length: nVeh }, () => rng.random())
      );
      const velocities = Array.from({ length: nParticles }, () =>
        Array.from({ length: nVeh }, () => gaussian(rng) * 0.1)
      );
      const pbestPositions = positions.map((p) => p.slice());
      const pbestValues = positions.map((p) => objective(p));
      let gbestIdx = 0;
      for (let i = 1; i < nParticles; i++) {
        if (pbestValues[i] < pbestValues[gbestIdx]) gbestIdx = i;
      }
      let gbestPosition = pbestPositions[gbestIdx].slice();
      let gbestValue = pbestValues[gbestIdx];
      const historyBest = [gbestValue];
      let noImprovCount = 0;

      for (let it = 0; it < nIter; it++) {
        const w = nIter > 1 ? wMax - (wMax - wMin) * (it / (nIter - 1)) : wMax;
        for (let i = 0; i < nParticles; i++) {
          for (let d = 0; d < nVeh; d++) {
            const r1 = rng.random();
            const r2 = rng.random();
            velocities[i][d] =
              w * velocities[i][d] +
              c1 * r1 * (pbestPositions[i][d] - positions[i][d]) +
              c2 * r2 * (gbestPosition[d] - positions[i][d]);
            velocities[i][d] = Math.max(-vMax, Math.min(vMax, velocities[i][d]));
            positions[i][d] = Math.max(0, Math.min(1, positions[i][d] + velocities[i][d]));
          }
          const val = objective(positions[i]);
          if (val < pbestValues[i]) {
            pbestValues[i] = val;
            pbestPositions[i] = positions[i].slice();
          }
        }
        gbestIdx = 0;
        for (let i = 1; i < nParticles; i++) {
          if (pbestValues[i] < pbestValues[gbestIdx]) gbestIdx = i;
        }
        if (pbestValues[gbestIdx] < gbestValue) {
          gbestValue = pbestValues[gbestIdx];
          gbestPosition = pbestPositions[gbestIdx].slice();
          noImprovCount = 0;
        } else {
          noImprovCount++;
          if (noImprovCount >= EARLY_STOP_PATIENCE) break;
        }
        historyBest.push(gbestValue);
      }
      const bestAssign = decodeParticle(gbestPosition, nVeh, nSlot);
      const breakdown = buildVehicleBreakdown(bestAssign);
      return packResult(s, {
        gbestValue,
        historyBest,
        bestAssign,
        bestEntrances: breakdown.bestEntrances,
        vehicleBreakdown: breakdown.items,
        slotsPos: prep.slotsPos,
        buildingsPos: prep.buildingsPos,
        obstacles,
        vehTargets,
        boxesByBi: prep.boxesByBi,
        navByBi: prep.navByBi,
        lot: s.lot,
        road,
        optimizer: "pso",
      });
    }

    return method === "exact" ? runExactMethod() : runPsoMethod();
  }

  window.ParkingOptimizer = {
    RESULT_KEYS,
    defaultScenario,
    normalizeScenario,
    runOptimize,
  };
})();

