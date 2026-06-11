(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-drafts.js");

  P.drawDraftShapes = function (scale) {
    if (P.pendingAdd === "obstacle" && Array.isArray(P.obstacleDraftPoints) && P.obstacleDraftPoints.length) {
      const pts = P.obstacleDraftPoints.slice();
      if (P.obstacleDraftHover) pts.push(P.obstacleDraftHover);
      P.ctx.beginPath();
      const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
      P.ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < pts.length; i++) {
        const p = P.worldToScreen(pts[i][0], pts[i][1]);
        P.ctx.lineTo(p.sx, p.sy);
      }
      P.ctx.strokeStyle = "rgba(15,23,42,0.8)";
      P.ctx.lineWidth = Math.max(1.4, scale * 0.05);
      P.ctx.setLineDash([Math.max(4, scale * 0.08), Math.max(3, scale * 0.06)]);
      P.ctx.stroke();
      P.ctx.setLineDash([]);
      for (let i = 0; i < P.obstacleDraftPoints.length; i++) {
        const p = P.worldToScreen(P.obstacleDraftPoints[i][0], P.obstacleDraftPoints[i][1]);
        P.ctx.beginPath();
        P.ctx.arc(p.sx, p.sy, Math.max(4, scale * 0.15), 0, Math.PI * 2);
        P.ctx.fillStyle = i === 0 && P.obstacleDraftSnapStart ? "#f59e0b" : "#0f766e";
        P.ctx.fill();
      }
    }
    if (P.pendingAdd === "road" && Array.isArray(P.roadDraftPoints) && P.roadDraftPoints.length) {
      const pts = P.roadDraftPoints.slice();
      if (P.roadDraftHover) pts.push(P.roadDraftHover);
      P.ctx.beginPath();
      const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
      P.ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < pts.length; i++) {
        const p = P.worldToScreen(pts[i][0], pts[i][1]);
        P.ctx.lineTo(p.sx, p.sy);
      }
      P.ctx.strokeStyle = "rgba(30,64,175,0.9)";
      P.ctx.lineWidth = Math.max(2, scale * 0.06);
      P.ctx.setLineDash([Math.max(5, scale * 0.09), Math.max(3, scale * 0.06)]);
      P.ctx.stroke();
      P.ctx.setLineDash([]);
      for (let i = 0; i < P.roadDraftPoints.length; i++) {
        const p = P.worldToScreen(P.roadDraftPoints[i][0], P.roadDraftPoints[i][1]);
        P.ctx.beginPath();
        P.ctx.arc(p.sx, p.sy, Math.max(4, scale * 0.15), 0, Math.PI * 2);
        P.ctx.fillStyle = i === 0 && P.roadDraftSnapStart ? "#f59e0b" : "#1d4ed8";
        P.ctx.fill();
      }
    }
  };
})();
