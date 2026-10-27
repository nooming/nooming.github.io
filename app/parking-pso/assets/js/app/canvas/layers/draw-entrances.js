(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/draw-entrances.js");

  P.drawEntrances = function (scale) {
    for (let ei = 0; ei < P.scenario.entrances.length; ei++) {
      const e = P.scenario.entrances[ei];
      const ep = P.worldToScreen(e[0], e[1]);
      const er = Math.max(8, scale * 0.42);
      P.ctx.beginPath();
      P.ctx.arc(ep.sx, ep.sy, er, 0, Math.PI * 2);
      P.ctx.fillStyle = P.COLORS.entranceFill;
      P.ctx.fill();
      P.ctx.strokeStyle = P.COLORS.entranceStroke;
      P.ctx.lineWidth = Math.max(1.5, scale * 0.05);
      P.ctx.stroke();
      const fs = Math.max(10, Math.min(16, scale * 0.36));
      P.ctx.fillStyle = "#ffffff";
      P.ctx.font = `700 ${fs}px "Segoe UI", "Microsoft YaHei", sans-serif`;
      P.ctx.textAlign = "center";
      P.ctx.textBaseline = "middle";
      P.ctx.fillText(String(ei + 1), ep.sx, ep.sy + 0.4);
    }
  };
})();
