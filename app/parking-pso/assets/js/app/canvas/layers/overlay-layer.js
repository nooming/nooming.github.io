(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/overlay-layer.js");

P.drawResultPaths = function (scale) {
    if (!P.lastResult?.paths?.length) return;
    const baseWidth = Math.max(2.2, scale * 0.085);
    const glowWidth = baseWidth + Math.max(2.4, scale * 0.09);
    for (const poly of P.lastResult.paths) {
      if (poly.length < 2) continue;
      P.ctx.lineCap = "round";
      P.ctx.lineJoin = "round";
      P.ctx.strokeStyle = P.COLORS.pathGlow;
      P.ctx.lineWidth = glowWidth;
      P.ctx.beginPath();
      const p0 = P.worldToScreen(poly[0][0], poly[0][1]);
      P.ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < poly.length; i++) {
        const p = P.worldToScreen(poly[i][0], poly[i][1]);
        P.ctx.lineTo(p.sx, p.sy);
      }
      P.ctx.stroke();

      P.ctx.strokeStyle = P.COLORS.path;
      P.ctx.lineWidth = baseWidth;
      P.ctx.beginPath();
      P.ctx.moveTo(p0.sx, p0.sy);
      for (let i = 1; i < poly.length; i++) {
        const p = P.worldToScreen(poly[i][0], poly[i][1]);
        P.ctx.lineTo(p.sx, p.sy);
      }
      P.ctx.stroke();

      const pend = P.worldToScreen(poly[poly.length - 1][0], poly[poly.length - 1][1]);
      const endR = Math.max(2.8, scale * 0.13);
      P.ctx.beginPath();
      P.ctx.arc(pend.sx, pend.sy, endR, 0, Math.PI * 2);
      P.ctx.fillStyle = P.COLORS.pathEnd;
      P.ctx.fill();
      P.ctx.strokeStyle = "rgba(255,255,255,0.9)";
      P.ctx.lineWidth = Math.max(1, scale * 0.05);
      P.ctx.stroke();
    }
  }

P.drawSelectionOutline = function () {
    if (!P.selection) return;
    P.ctx.strokeStyle = P.COLORS.select;
    P.ctx.lineWidth = 3;
    if (P.selection.kind === "entrance") {
      const e = P.scenario.entrances[P.selection.index ?? 0];
      const ep = P.worldToScreen(e[0], e[1]);
      P.ctx.beginPath();
      P.ctx.arc(ep.sx, ep.sy, P.padScale().scale * 1.18, 0, Math.PI * 2);
      P.ctx.stroke();
    } else if (P.selection.kind === "obstacle") {
      const o = P.scenario.obstacles[P.selection.index ?? 0];
      if (o?.points?.length >= 3) {
        const p0 = P.worldToScreen(o.points[0][0], o.points[0][1]);
        P.ctx.beginPath();
        P.ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < o.points.length; i++) {
          const pi = P.worldToScreen(o.points[i][0], o.points[i][1]);
          P.ctx.lineTo(pi.sx, pi.sy);
        }
        P.ctx.closePath();
        P.ctx.stroke();
        for (let i = 0; i < o.points.length; i++) {
          const v = P.worldToScreen(o.points[i][0], o.points[i][1]);
          P.ctx.beginPath();
          P.ctx.arc(v.sx, v.sy, Math.max(4, P.padScale().scale * 0.18), 0, Math.PI * 2);
          P.ctx.fillStyle = "#ffffff";
          P.ctx.fill();
          P.ctx.strokeStyle = P.COLORS.select;
          P.ctx.lineWidth = 2;
          P.ctx.stroke();
        }
      }
    } else if (P.selection.kind === "road") {
      const pts = P.scenario.road?.centerline || [];
      if (pts.length >= 2) {
        const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
        P.ctx.beginPath();
        P.ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < pts.length; i++) {
          const pi = P.worldToScreen(pts[i][0], pts[i][1]);
          P.ctx.lineTo(pi.sx, pi.sy);
        }
        P.ctx.stroke();
        for (let i = 0; i < pts.length; i++) {
          const v = P.worldToScreen(pts[i][0], pts[i][1]);
          P.ctx.beginPath();
          P.ctx.arc(v.sx, v.sy, Math.max(4, P.padScale().scale * 0.18), 0, Math.PI * 2);
          P.ctx.fillStyle = "#ffffff";
          P.ctx.fill();
          P.ctx.strokeStyle = P.COLORS.select;
          P.ctx.lineWidth = 2;
          P.ctx.stroke();
        }
      }
    } else if (P.selection.kind === "building") {
      const [x, y] = P.scenario.buildings[P.selection.index];
      P.fillRectWorld(
        x - P.B.bw / 2,
        y - P.B.bh / 2,
        P.B.bw,
        P.B.bh,
        "transparent",
        P.COLORS.select,
        3
      );
    } else if (P.selection.kind === "slot") {
      const pose = P.slotPoseOf(P.scenario.slots[P.selection.index]);
      if (!pose) return;
      const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((p) => P.worldToScreen(p[0], p[1]));
      P.ctx.beginPath();
      P.ctx.moveTo(poly[0].sx, poly[0].sy);
      for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
      P.ctx.closePath();
      P.ctx.stroke();
    }
  }

P.drawMapOverlays = function () {
    if (!P.scenario) return;
    const { offsetX, offsetY, scale } = P.padScale();
    /** 比例尺世界 y：越小越靠地块底边（屏幕下方）；文字在横线上方，避免裁切 */
    const y0 = 1.25;
    const x0 = 1.15;
    const Lm = P.scaleBarWorldM();
    const pA = P.worldToScreen(x0, y0);
    const pB = P.worldToScreen(x0 + Lm, y0);
    P.ctx.save();
    P.ctx.strokeStyle = "#5c6b82";
    P.ctx.fillStyle = "#b4c2d6";
    P.ctx.lineWidth = 2.5;
    P.ctx.lineCap = "butt";
    P.ctx.beginPath();
    P.ctx.moveTo(pA.sx, pA.sy);
    P.ctx.lineTo(pB.sx, pB.sy);
    P.ctx.stroke();
    const tick = Math.max(4, scale * 0.12);
    P.ctx.beginPath();
    P.ctx.moveTo(pA.sx, pA.sy - tick);
    P.ctx.lineTo(pA.sx, pA.sy);
    P.ctx.moveTo(pB.sx, pB.sy - tick);
    P.ctx.lineTo(pB.sx, pB.sy);
    P.ctx.stroke();
    const midX = (pA.sx + pB.sx) / 2;
    const label = Lm + " " + P.uLen();
    const fsScale = Math.max(12, Math.min(20, scale * 0.42));
    P.ctx.font = `700 ${fsScale}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    P.ctx.textAlign = "center";
    P.ctx.textBaseline = "bottom";
    const gap = Math.max(6, fsScale * 0.35);
    const labelY = pA.sy - tick - gap;
    P.ctx.lineWidth = Math.max(2.8, scale * 0.1);
    P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
    P.ctx.fillStyle = "#ffffff";
    P.ctx.strokeText(label, midX, labelY);
    P.ctx.fillText(label, midX, labelY);
    const fsAxis = Math.max(11, Math.min(15, scale * 0.32));
    P.ctx.font = `700 ${fsAxis}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    P.ctx.lineWidth = Math.max(2.2, scale * 0.085);
    P.ctx.textAlign = "right";
    P.ctx.textBaseline = "bottom";
    const xAx = offsetX + P.lotW() * scale - 4;
    const yAx = offsetY + P.lotH() * scale - 4;
    const xStr = "X → (" + P.uLen() + ")";
    P.ctx.strokeText(xStr, xAx, yAx);
    P.ctx.fillText(xStr, xAx, yAx);
    P.ctx.textAlign = "left";
    P.ctx.textBaseline = "top";
    const yStr = "Y ↑ (" + P.uLen() + ")";
    P.ctx.strokeText(yStr, offsetX + 6, offsetY + 4);
    P.ctx.fillText(yStr, offsetX + 6, offsetY + 4);
    P.ctx.restore();

    const cap = document.getElementById("map-unit-caption");
    if (cap) {
      cap.textContent =
        (P.scenario.display?.coord_note || "") + " · 比例尺见图中线段";
    }
    const lotHint = document.getElementById("lot-dim-hint");
    if (lotHint) {
      lotHint.textContent =
        "地块范围：0–" +
        P.fmtDim(P.lotW()) +
        " " +
        P.uLen() +
        " × 0–" +
        P.fmtDim(P.lotH()) +
        " " +
        P.uLen();
    }
  }
})();
