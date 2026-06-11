(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/road-layer.js");

P.drawRoadSegments = function (segs) {
    P.ctx.lineCap = "round";
    P.ctx.lineJoin = "round";
    const scale = P.padScale().scale;
    const lw = Math.max(8, scale * Math.max(2.4, Number(P.scenario?.road?.width || P.DEFAULT_ROAD_WIDTH)));
    for (const [[x1, y1], [x2, y2]] of segs) {
      const p1 = P.worldToScreen(x1, y1);
      const p2 = P.worldToScreen(x2, y2);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.strokeStyle = P.COLORS.road;
      P.ctx.lineWidth = lw;
      P.ctx.stroke();
      P.ctx.strokeStyle = P.COLORS.roadEdge;
      P.ctx.lineWidth = Math.max(3, lw * 0.28);
      P.ctx.stroke();
    }
  }

P.nearestRoadTangentAngle = function (cx, cy) {
    const segs = P.geometry?.buildRoadSegments ? P.geometry.buildRoadSegments({ road: P.scenario?.road }) : [];
    let best = null;
    let bestD = Infinity;
    for (const [a, b] of segs) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const d = P.distPointToSeg(cx, cy, a[0], a[1], b[0], b[1]);
      if (d < bestD) {
        bestD = d;
        best = Math.atan2(dy, dx);
      }
    }
    return P.normalizeAngle(best ?? 0);
  }

P.drawRoadAndParkingStrips = function (scale) {
    P.ensureRoadStructure();
    const roadSegs = P.lastResult?.road_segments || P.buildRoadSegmentsLocal(P.scenario.road);
    P.drawRoadSegments(roadSegs);
    P.ctx.strokeStyle = P.COLORS.curb;
    P.ctx.lineWidth = Math.max(1.5, scale * 0.04);
    for (const [x1, y1, x2, y2] of P.innerBoundarySegments(P.scenario.road)) {
      const p1 = P.worldToScreen(x1, y1);
      const p2 = P.worldToScreen(x2, y2);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    P.ctx.save();
    P.ctx.setLineDash([Math.max(4, scale * 0.1), Math.max(3, scale * 0.08)]);
    P.ctx.strokeStyle = P.COLORS.parkingStrip;
    P.ctx.lineWidth = Math.max(1.2, scale * 0.045);
    for (const [[ax, ay], [bx, by]] of P.parkingStripSegments()) {
      const p1 = P.worldToScreen(ax, ay);
      const p2 = P.worldToScreen(bx, by);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    P.ctx.restore();
  }
})();
