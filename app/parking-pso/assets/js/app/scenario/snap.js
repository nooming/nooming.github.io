(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/snap.js");

P.snapEntranceToInner = function (x, y) {
    P.ensureRoadStructure();
    const proj = P.geometry?.projectPointToRoad
      ? P.geometry.projectPointToRoad(x, y, { road: P.scenario.road })
      : null;
    return P.clampWorld(proj?.point?.[0] ?? x, proj?.point?.[1] ?? y);
  }

P.snapSlotToRoad = function (x, y) {
    const strips = P.getParkingStripDefs();
    if (!strips.length) {
      const p = P.clampWorld(x, y);
      return { wx: p.wx, wy: p.wy, theta: 0 };
    }
    let bestX = x;
    let bestY = y;
    let bestTheta = 0;
    let bestD = 1e30;
    for (const s of strips) {
      const q = P._closestPointOnSegment(x, y, s.x1, s.y1, s.x2, s.y2);
      const d = (x - q.qx) ** 2 + (y - q.qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = q.qx;
        bestY = q.qy;
        bestTheta = s.theta;
      }
    }
    const p = P.clampWorld(bestX, bestY);
    return { wx: p.wx, wy: p.wy, theta: bestTheta };
  }

P.getParkingStripDefs = function () {
    P.ensureRoadStructure();
    const margin = P.SNAP_MARGIN;
    const strips = [];
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments({ road: P.scenario.road }) : [];
    const roadWidth = Math.max(2.4, Number(P.scenario.road?.width || P.DEFAULT_ROAD_WIDTH));
    const offset = roadWidth / 2 + P.B.sh / 2 + margin;
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const nx = -dy / len;
      const ny = dx / len;
      for (const side of [1, -1]) {
        const x1 = a[0] + nx * offset * side;
        const y1 = a[1] + ny * offset * side;
        const x2 = b[0] + nx * offset * side;
        const y2 = b[1] + ny * offset * side;
        strips.push({
          id: "road-" + i + "-" + (side > 0 ? "l" : "r"),
          segIndex: i,
          side,
          x1: Math.max(P.B.sw / 2 + 0.05, Math.min(P.lotW() - P.B.sw / 2 - 0.05, x1)),
          y1: Math.max(P.B.sw / 2 + 0.05, Math.min(P.lotH() - P.B.sw / 2 - 0.05, y1)),
          x2: Math.max(P.B.sw / 2 + 0.05, Math.min(P.lotW() - P.B.sw / 2 - 0.05, x2)),
          y2: Math.max(P.B.sw / 2 + 0.05, Math.min(P.lotH() - P.B.sw / 2 - 0.05, y2)),
          tx: dx / len,
          ty: dy / len,
          theta: Math.atan2(dy, dx),
          len: Math.hypot(x2 - x1, y2 - y1),
        });
      }
    }
    return strips;
  }

P.nearestStripForPoint = function (x, y) {
    const strips = P.getParkingStripDefs();
    if (!strips.length) return null;
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments({ road: P.scenario?.road }) : [];
    let segIndex = -1;
    let bestCenterD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const [a, b] = segs[i];
      const d = P.distPointToSeg(x, y, a[0], a[1], b[0], b[1]);
      if (d < bestCenterD) {
        bestCenterD = d;
        segIndex = i;
      }
    }
    if (segIndex >= 0) {
      const sideCandidates = strips.filter((s) => s.segIndex === segIndex);
      if (sideCandidates.length >= 2) {
        const [a, b] = segs[segIndex];
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const len = Math.hypot(dx, dy);
        if (len > 1e-6) {
          const nx = -dy / len;
          const ny = dx / len;
          const sideSign = (x - a[0]) * nx + (y - a[1]) * ny >= 0 ? 1 : -1;
          const signed = sideCandidates.find((s) => s.side === sideSign);
          if (signed) return signed;
        }
      } else if (sideCandidates.length === 1) {
        return sideCandidates[0];
      }
    }
    let best = null;
    let bestD = Infinity;
    for (const s of strips) {
      const d = P.distPointToSeg(x, y, s.x1, s.y1, s.x2, s.y2);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return best;
  }

P.slotScalarOnStrip = function (def, x, y) {
    const len = Math.max(1e-9, Number(def?.len || 0));
    const tx = Number(def?.tx || 0);
    const ty = Number(def?.ty || 0);
    return ((x - def.x1) * tx + (y - def.y1) * ty) / len;
  }

P.slotPointFromScalar = function (def, tNorm) {
    const t = Math.max(0, Math.min(1, tNorm));
    return {
      wx: def.x1 + (def.x2 - def.x1) * t,
      wy: def.y1 + (def.y2 - def.y1) * t,
      theta: def.theta,
    };
  }

P.stripBaseId = function (stripId) {
    return String(stripId || "").replace(/-(l|r)$/, "");
  }

P.getSiblingStrip = function (def) {
    if (!def?.id) return null;
    const strips = P.getParkingStripDefs();
    const base = P.stripBaseId(def.id);
    return strips.find((s) => s.id !== def.id && P.stripBaseId(s.id) === base) || null;
  }

P.suggestUniformSlotPosition = function (x, y, ignoreIndex = -1) {
    const snapped = P.snapSlotToRoad(x, y);
    const primaryLane = P.nearestStripForPoint(snapped.wx, snapped.wy);
    if (!primaryLane) return P.canPlaceSlot(snapped.wx, snapped.wy, ignoreIndex) ? snapped : null;
    const siblingLane = P.getSiblingStrip(primaryLane);
    const laneCandidates = [primaryLane];
    if (siblingLane) {
      const dPrimary = P.distPointToSeg(
        snapped.wx,
        snapped.wy,
        primaryLane.x1,
        primaryLane.y1,
        primaryLane.x2,
        primaryLane.y2
      );
      const dSibling = P.distPointToSeg(
        snapped.wx,
        snapped.wy,
        siblingLane.x1,
        siblingLane.y1,
        siblingLane.x2,
        siblingLane.y2
      );
      if (dSibling < dPrimary) {
        laneCandidates.unshift(siblingLane);
      } else {
        laneCandidates.push(siblingLane);
      }
    }

    for (const lane of laneCandidates) {
      const endInset = (P.B.sw / 2 + 0.08) / Math.max(1e-9, lane.len);
      const laneStart = endInset;
      const laneEnd = 1 - endInset;
      if (laneEnd <= laneStart + 1e-5) continue;
      const desired = Math.max(
        laneStart,
        Math.min(laneEnd, P.slotScalarOnStrip(lane, snapped.wx, snapped.wy))
      );
      const occupied = [];
      for (let i = 0; i < P.scenario.slots.length; i++) {
        if (i === ignoreIndex) continue;
        const [sx, sy] = P.scenario.slots[i];
        const sideLane = P.nearestStripForPoint(sx, sy);
        if (!sideLane || sideLane.id !== lane.id) continue;
        occupied.push(P.slotScalarOnStrip(lane, sx, sy));
      }
      occupied.sort((a, b) => a - b);
      const candidates = new Set([desired, laneStart, laneEnd]);
      const anchors = [laneStart, ...occupied, laneEnd];
      for (let i = 0; i < anchors.length - 1; i++) {
        candidates.add((anchors[i] + anchors[i + 1]) / 2);
      }
      const sortedCandidates = [...candidates].sort(
        (a, b) => Math.abs(a - desired) - Math.abs(b - desired)
      );
      for (const t0 of sortedCandidates) {
        const t = Math.max(laneStart, Math.min(laneEnd, t0));
        const p = P.slotPointFromScalar(lane, t);
        if (P.canPlaceSlot(p.wx, p.wy, ignoreIndex)) return p;
      }
    }
    return null;
  }

P.applySnapToSlot = function (i) {
    const p = P.suggestUniformSlotPosition(P.scenario.slots[i][0], P.scenario.slots[i][1], i);
    if (!p) return false;
    P.scenario.slots[i][0] = p.wx;
    P.scenario.slots[i][1] = p.wy;
    P.scenario.slots[i][2] = P.normalizeAngle(p.theta ?? P.scenario.slots[i][2] ?? 0);
    return true;
  }

P.applySnapToAllSlots = function () {
    if (!P.scenario?.slots?.length) return;
    P.scenario.slots.forEach((_, i) => P.applySnapToSlot(i));
  }

P.parkingStripSegments = function () {
    return P.getParkingStripDefs().map((s) => [
      [s.x1, s.y1],
      [s.x2, s.y2],
    ]);
  }

P.distPointToSeg = function (px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-12) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = x1 + t * dx;
    const qy = y1 + t * dy;
    return Math.hypot(px - qx, py - qy);
  }
})();
