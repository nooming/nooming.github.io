(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-primitives.js");

  P.fillRectWorld = function (xmin, ymin, w, h, fill, stroke, lineWidth) {
    const tl = P.worldToScreen(xmin, ymin + h);
    const br = P.worldToScreen(xmin + w, ymin);
    const x = tl.sx;
    const y = tl.sy;
    const ww = br.sx - tl.sx;
    const hh = br.sy - tl.sy;
    if (fill && fill !== "transparent") {
      P.ctx.fillStyle = fill;
      P.ctx.fillRect(x, y, ww, hh);
    }
    if (stroke) {
      P.ctx.strokeStyle = stroke;
      P.ctx.lineWidth = lineWidth != null ? lineWidth : 2;
      P.ctx.strokeRect(x, y, ww, hh);
    }
  };

  /** 世界坐标中心点叠字（描边便于压在路面/屋面上） */
  P.drawStackedWorldLabels = function (wx, wy, lines) {
    if (!lines?.length) return;
    const p = P.worldToScreen(wx, wy);
    const scale = P.padScale().scale;
    const fs = Math.max(12, Math.min(20, scale * 0.42));
    const lh = fs * 1.08;
    P.ctx.save();
    P.ctx.font = `700 ${fs}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    P.ctx.textAlign = "center";
    P.ctx.textBaseline = "middle";
    const half = ((lines.length - 1) * lh) / 2;
    for (let i = 0; i < lines.length; i++) {
      const yy = p.sy - half + i * lh;
      P.ctx.lineWidth = Math.max(2.8, scale * 0.1);
      P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
      P.ctx.fillStyle = "#ffffff";
      P.ctx.strokeText(lines[i], p.sx, yy);
      P.ctx.fillText(lines[i], p.sx, yy);
    }
    P.ctx.restore();
  };
})();
