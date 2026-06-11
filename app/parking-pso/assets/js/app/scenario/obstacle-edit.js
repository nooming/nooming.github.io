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
