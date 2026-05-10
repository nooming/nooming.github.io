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
  };
})();
