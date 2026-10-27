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
