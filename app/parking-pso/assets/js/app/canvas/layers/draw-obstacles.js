(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-obstacles.js");

  P.fillObstaclePolygon = function (points) {
    if (!Array.isArray(points) || points.length < 3) return;
    const poly = points.map((p) => P.worldToScreen(Number(p[0]), Number(p[1])));
    let xmin = Infinity;
    let ymin = Infinity;
    let xmax = -Infinity;
    let ymax = -Infinity;
    for (const p of poly) {
      if (p.sx < xmin) xmin = p.sx;
      if (p.sx > xmax) xmax = p.sx;
      if (p.sy < ymin) ymin = p.sy;
      if (p.sy > ymax) ymax = p.sy;
    }
    const g = P.ctx.createLinearGradient(xmin, ymin, xmax, ymax);
    g.addColorStop(0, P.COLORS.grassA);
    g.addColorStop(0.5, P.COLORS.grassB);
    g.addColorStop(1, P.COLORS.grassC);
    P.ctx.beginPath();
    P.ctx.moveTo(poly[0].sx, poly[0].sy);
    for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
    P.ctx.closePath();
    P.ctx.fillStyle = g;
    P.ctx.fill();
    P.ctx.strokeStyle = P.COLORS.grassEdge;
    P.ctx.lineWidth = Math.max(1, P.padScale().scale * 0.06);
    P.ctx.stroke();
  };
})();
