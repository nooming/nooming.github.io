(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-slots.js");

  P.slotThetaAt = function (cx, cy, fallbackTheta = 0) {
    const strips = P.getParkingStripDefs();
    if (strips.length) {
      const lane = P.nearestStripForPoint(cx, cy);
      if (lane) return P.normalizeAngle(lane.theta);
    }
    return P.normalizeAngle(fallbackTheta ?? P.nearestRoadTangentAngle(cx, cy));
  };

  P.slotPolygonAt = function (cx, cy, theta) {
    const t = P.normalizeAngle(theta);
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const halfL = P.B.sw / 2;
    const halfW = P.B.sh / 2;
    const local = [
      [-halfL, -halfW],
      [halfL, -halfW],
      [halfL, halfW],
      [-halfL, halfW],
    ];
    return local.map(([lx, ly]) => [cx + lx * ct - ly * st, cy + lx * st + ly * ct]);
  };

  P.slotFootprint = function (cx, cy, theta) {
    const poly = P.slotPolygonAt(cx, cy, P.slotThetaAt(cx, cy, theta));
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (const p of poly) {
      xmin = Math.min(xmin, p[0]);
      xmax = Math.max(xmax, p[0]);
      ymin = Math.min(ymin, p[1]);
      ymax = Math.max(ymax, p[1]);
    }
    return { xmin, ymin, w: xmax - xmin, h: ymax - ymin, theta: P.slotThetaAt(cx, cy, theta), poly };
  };

  /** 俯视标准泊位：沥青块 + 四边白线（完整边框） */
  P.drawParkingSlotWorld = function (cx, cy, theta) {
    const angle = P.slotThetaAt(cx, cy, theta);
    const poly = P.slotPolygonAt(cx, cy, angle).map((p) => P.worldToScreen(p[0], p[1]));
    P.ctx.fillStyle = P.COLORS.slotAsphalt;
    P.ctx.beginPath();
    P.ctx.moveTo(poly[0].sx, poly[0].sy);
    for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
    P.ctx.closePath();
    P.ctx.fill();
    const scale = P.padScale().scale;
    P.ctx.strokeStyle = P.COLORS.slotPaint;
    P.ctx.lineWidth = Math.max(2.2, scale * 0.075);
    P.ctx.lineCap = "square";
    P.ctx.lineJoin = "miter";
    P.ctx.stroke();
  };

  P.drawVehicleSlotAssignments = function () {
    const assign = P.lastResult?.assign;
    const targets = P.lastResult?.veh_targets;
    if (!assign?.length || !targets?.length || !P.scenario?.slots?.length) return;
    const n = Math.min(assign.length, targets.length);
    for (let vi = 0; vi < n; vi++) {
      const si = assign[vi];
      if (si < 0 || si >= P.scenario.slots.length) continue;
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      if (!pose) continue;
      const wx = pose.x;
      const wy = pose.y;
      const b1 = (targets[vi] ?? 0) + 1;
      P.drawStackedWorldLabels(wx, wy, ["车" + (vi + 1), "→楼" + b1]);
    }
  };
})();
