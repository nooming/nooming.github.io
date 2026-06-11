(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-buildings.js");

  /** 居民楼 footprint：阴影 + 屋面渐变 + 窗格 */
  P.drawBuildingWorld = function (cx, cy) {
    const xmin = cx - P.B.bw / 2;
    const ymin = cy - P.B.bh / 2;
    const w = P.B.bw;
    const h = P.B.bh;
    const tl = P.worldToScreen(xmin, ymin + h);
    const br = P.worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    const scale = P.padScale().scale;
    const sh = Math.max(2, scale * 0.14);
    P.ctx.fillStyle = P.COLORS.buildingShadow;
    P.ctx.fillRect(x + sh, y + sh, ww, hh);
    const g = P.ctx.createLinearGradient(x, y, x + ww, y + hh);
    g.addColorStop(0, P.COLORS.buildingRoofHi);
    g.addColorStop(0.55, P.COLORS.buildingRoofLo);
    g.addColorStop(1, "#6b7784");
    P.ctx.fillStyle = g;
    P.ctx.fillRect(x, y, ww, hh);
    P.ctx.strokeStyle = P.COLORS.buildingStroke;
    P.ctx.lineWidth = Math.max(1.2, scale * 0.055);
    P.ctx.strokeRect(x, y, ww, hh);
    const cols = Math.max(3, Math.min(8, Math.round(w / 2.2)));
    const rows = Math.max(2, Math.min(6, Math.round(h / 2.4)));
    P.ctx.strokeStyle = P.COLORS.buildingMullion;
    P.ctx.lineWidth = Math.max(0.55, scale * 0.018);
    for (let i = 1; i < cols; i++) {
      const wx = xmin + (i * w) / cols;
      const p1 = P.worldToScreen(wx, ymin);
      const p2 = P.worldToScreen(wx, ymin + h);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      const wy = ymin + (j * h) / rows;
      const p1 = P.worldToScreen(xmin, wy);
      const p2 = P.worldToScreen(xmin + w, wy);
      P.ctx.beginPath();
      P.ctx.moveTo(p1.sx, p1.sy);
      P.ctx.lineTo(p2.sx, p2.sy);
      P.ctx.stroke();
    }
    P.ctx.strokeStyle = "rgba(255,255,255,0.2)";
    P.ctx.lineWidth = Math.max(0.5, scale * 0.012);
    P.ctx.strokeRect(x + scale * 0.06, y + scale * 0.06, ww - scale * 0.12, hh - scale * 0.12);
  };
})();
