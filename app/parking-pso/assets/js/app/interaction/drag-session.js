(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/interaction/drag-session.js");

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
      const c = P.clampWorld(wx + P.drag.ox, wy + P.drag.oy);
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
    P.renderProps();
    P.draw();
    return true;
  };

  P.finishDragFromPointer = function () {
    const d = P.drag;
    P.drag = null;
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
    if (changed) {
      if (
        d.kind === "entrance" ||
        d.kind === "obstacle" ||
        d.kind === "obstacle-vertex" ||
        d.kind === "road" ||
        d.kind === "road-vertex"
      ) {
        P.invalidateOptimizationResult();
      } else {
        P.draw();
      }
    }
  };
})();
