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
    return true;
  }
})();
