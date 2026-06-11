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
