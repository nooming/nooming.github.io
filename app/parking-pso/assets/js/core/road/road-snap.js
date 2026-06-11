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

  function snapPointToInnerPerimeter(x, y, roadOrInner, lotW, lotH) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    const proj = geometry?.projectPointToRoad
      ? geometry.projectPointToRoad(Number(x), Number(y), { road })
      : null;
    const qx = proj?.point?.[0] ?? Number(x);
    const qy = proj?.point?.[1] ?? Number(y);
    return [Math.max(0, Math.min(lotW, qx)), Math.max(0, Math.min(lotH, qy))];
  }

  function buildRoadGuideSegments(road, lotW, lotH, margin = SLOT_SNAP_MARGIN) {
    const segs = geometry?.buildRoadSegments ? geometry.buildRoadSegments({ road }) : [];
    const strips = [];
    const offset = Math.max(0.8, Number(road?.width || DEFAULT_ROAD_WIDTH) / 2 + SLOT_HALF_BERTH_W + margin);
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
        const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
        strips.push({
          id: side.id,
          x1: clamp(x1, SLOT_HALF_BERTH_W + 0.05, lotW - SLOT_HALF_BERTH_W - 0.05),
          y1: clamp(y1, SLOT_HALF_BERTH_W + 0.05, lotH - SLOT_HALF_BERTH_W - 0.05),
          x2: clamp(x2, SLOT_HALF_BERTH_W + 0.05, lotW - SLOT_HALF_BERTH_W - 0.05),
          y2: clamp(y2, SLOT_HALF_BERTH_W + 0.05, lotH - SLOT_HALF_BERTH_W - 0.05),
          tx: dx / len,
          ty: dy / len,
          theta: Math.atan2(dy, dx),
          len: Math.hypot(x2 - x1, y2 - y1),
        });
      }
    }
    return strips;
  }

  function snapSlotToRoad(x, y, roadOrInner, lotW, lotH, margin = SLOT_SNAP_MARGIN) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    const strips = buildRoadGuideSegments(road, lotW, lotH, margin);
    if (!strips.length) return [Math.max(0, Math.min(lotW, x)), Math.max(0, Math.min(lotH, y)), 0];
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
    return [
      Math.max(0, Math.min(lotW, bestX)),
      Math.max(0, Math.min(lotH, bestY)),
      normalizeAngle(bestTheta),
    ];
  }

  window.ParkingRoad = {
    SLOT_SNAP_MARGIN,
    SLOT_HALF_BERTH_W,
    snapPointToInnerPerimeter,
    buildRoadGuideSegments,
    snapSlotToRoad,
    normalizeAngle,
  };
})();
