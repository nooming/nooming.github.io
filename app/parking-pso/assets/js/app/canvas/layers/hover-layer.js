(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/hover-layer.js");

  P.drawHoverBalloon = function () {
    if (!P.hoverTarget) return;
    const lines = P.getTooltipLines(P.hoverTarget);
    if (!lines.length) return;

    const FONT_PX = 12;
    const PAD_X = 10;
    const PAD_Y = 7;
    const LINE_H = 17;
    const ARROW_H = 7;
    const R = 4;

    P.ctx.save();
    const FONT_NORMAL = FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
    let maxW = 0;
    for (let i = 0; i < lines.length; i++) {
      P.ctx.font = i === 0 ? "bold " + FONT_NORMAL : FONT_NORMAL;
      maxW = Math.max(maxW, P.ctx.measureText(lines[i]).width);
    }
    const boxW = maxW + PAD_X * 2 + 12;
    const boxH = lines.length * LINE_H + PAD_Y * 2;

    const { sx, sy } = P.worldToScreen(P.hoverTarget.wx, P.hoverTarget.wy);
    let bx = sx - boxW / 2;
    let by = sy - boxH - ARROW_H - 6;
    let arrowBelow = true;

    if (by < 2) {
      by = sy + ARROW_H + 6;
      arrowBelow = false;
    }
    bx = Math.max(2, Math.min(P.mapCssW - boxW - 2, bx));
    const ax = Math.max(bx + R + 6, Math.min(bx + boxW - R - 6, sx));

    P.ctx.shadowColor = "rgba(0,0,0,0.55)";
    P.ctx.shadowBlur = 10;
    P.ctx.shadowOffsetY = 3;

    P.ctx.beginPath();
    P.ctx.moveTo(bx + R, by);
    if (!arrowBelow) {
      P.ctx.lineTo(ax - 7, by);
      P.ctx.lineTo(ax, by - ARROW_H);
      P.ctx.lineTo(ax + 7, by);
    }
    P.ctx.lineTo(bx + boxW - R, by);
    P.ctx.arcTo(bx + boxW, by, bx + boxW, by + R, R);
    P.ctx.lineTo(bx + boxW, by + boxH - R);
    P.ctx.arcTo(bx + boxW, by + boxH, bx + boxW - R, by + boxH, R);
    if (arrowBelow) {
      P.ctx.lineTo(ax + 7, by + boxH);
      P.ctx.lineTo(ax, by + boxH + ARROW_H);
      P.ctx.lineTo(ax - 7, by + boxH);
    }
    P.ctx.lineTo(bx + R, by + boxH);
    P.ctx.arcTo(bx, by + boxH, bx, by + boxH - R, R);
    P.ctx.lineTo(bx, by + R);
    P.ctx.arcTo(bx, by, bx + R, by, R);
    P.ctx.closePath();
    P.ctx.fillStyle = "rgba(10, 16, 28, 0.95)";
    P.ctx.fill();
    P.ctx.shadowColor = "transparent";
    P.ctx.strokeStyle = "rgba(59,130,246,0.5)";
    P.ctx.lineWidth = 0.9;
    P.ctx.stroke();

    P.ctx.textAlign = "left";
    P.ctx.textBaseline = "top";
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        P.ctx.fillStyle = "#f1f5f9";
        P.ctx.font = "bold " + FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      } else {
        P.ctx.fillStyle = "#94a3b8";
        P.ctx.font = FONT_PX + "px 'Microsoft YaHei','PingFang SC',sans-serif";
      }
      P.ctx.fillText(lines[i], bx + PAD_X, by + PAD_Y + i * LINE_H);
    }
    P.ctx.restore();
  };
})();
