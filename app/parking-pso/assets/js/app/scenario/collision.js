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
