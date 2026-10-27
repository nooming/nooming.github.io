(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/underlay-layer.js");

  P._underlayImage = null;
  P._underlayImageSrc = "";

  P.ensureUnderlayImage = function (dataUrl) {
    if (!dataUrl) {
      P._underlayImage = null;
      P._underlayImageSrc = "";
      return;
    }
    if (P._underlayImage && P._underlayImageSrc === dataUrl) return;
    const img = new Image();
    img.onload = () => P.draw();
    img.src = dataUrl;
    P._underlayImage = img;
    P._underlayImageSrc = dataUrl;
  };

  P.shouldDrawUnderlay = function () {
    return P.layerVisibility?.underlay !== false;
  };

  P.drawUnderlay = function (scale) {
    if (!P.shouldDrawUnderlay() || !P.scenario) return;
    const u = P.scenario.display?.underlay;
    if (!u?.dataUrl) return;
    const wa = u.worldA;
    const wb = u.worldB;
    const ia = u.imageA;
    const ib = u.imageB;
    if (!wa || !wb || !ia || !ib) return;

    P.ensureUnderlayImage(u.dataUrl);
    const img = P._underlayImage;
    if (!img || !img.complete || !img.naturalWidth) return;

    const wx0 = Number(wa[0]);
    const wy0 = Number(wa[1]);
    const wx1 = Number(wb[0]);
    const wy1 = Number(wb[1]);
    const iu0 = Number(ia[0]);
    const iv0 = Number(ia[1]);
    const iu1 = Number(ib[0]);
    const iv1 = Number(ib[1]);
    const di = Math.hypot(iu1 - iu0, iv1 - iv0);
    const dw = Math.hypot(wx1 - wx0, wy1 - wy0);
    if (di < 1e-6 || dw < 1e-6) return;

    const pxPerImgPx = (dw / di) * scale;
    const rot = Math.atan2(wy1 - wy0, wx1 - wx0) - Math.atan2(iv1 - iv0, iu1 - iu0);
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const anchor = P.worldToScreen(wx0, wy0);

    P.ctx.save();
    P.ctx.globalAlpha = Number.isFinite(Number(u.opacity)) ? Number(u.opacity) : 0.55;
    P.ctx.setTransform(
      pxPerImgPx * cos,
      pxPerImgPx * sin,
      -pxPerImgPx * sin,
      pxPerImgPx * cos,
      anchor.sx - pxPerImgPx * (iu0 * cos - iv0 * sin),
      anchor.sy - pxPerImgPx * (iu0 * sin + iv0 * cos)
    );
    P.ctx.drawImage(img, 0, 0);
    P.ctx.restore();
  };

  P.drawUnderlayCalibrationMarkers = function (scale) {
    const cal = P.underlayCalibrating;
    if (!cal?.worldPts?.length) return;
    P.ctx.save();
    P.ctx.fillStyle = "#f59e0b";
    P.ctx.strokeStyle = "#ffffff";
    P.ctx.lineWidth = Math.max(2, scale * 0.08);
    cal.worldPts.forEach((pt, i) => {
      const p = P.worldToScreen(pt[0], pt[1]);
      const r = Math.max(5, scale * 0.2);
      P.ctx.beginPath();
      P.ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      P.ctx.fill();
      P.ctx.stroke();
      P.ctx.font = `700 ${Math.max(11, scale * 0.35)}px sans-serif`;
      P.ctx.textAlign = "center";
      P.ctx.textBaseline = "bottom";
      P.ctx.fillText(String.fromCharCode(65 + i), p.sx, p.sy - r - 2);
    });
    if (cal.worldPts.length >= 2) {
      const a = P.worldToScreen(cal.worldPts[0][0], cal.worldPts[0][1]);
      const b = P.worldToScreen(cal.worldPts[1][0], cal.worldPts[1][1]);
      P.ctx.strokeStyle = "#f59e0b";
      P.ctx.setLineDash([6, 4]);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(b.sx, b.sy);
      P.ctx.stroke();
      P.ctx.setLineDash([]);
    }
    P.ctx.restore();
  };
})();
