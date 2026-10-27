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
