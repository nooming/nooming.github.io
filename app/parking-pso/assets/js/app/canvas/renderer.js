(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/renderer.js");

P.drawWorldGrid = function () {
    const topLeft = P.screenToWorld(0, 0);
    const bottomRight = P.screenToWorld(P.mapCssW, P.mapCssH);
    const x0 = Math.floor(Math.min(topLeft.wx, bottomRight.wx));
    const x1 = Math.ceil(Math.max(topLeft.wx, bottomRight.wx));
    const y0 = Math.floor(Math.min(topLeft.wy, bottomRight.wy));
    const y1 = Math.ceil(Math.max(topLeft.wy, bottomRight.wy));
    const step = P.scaleBarWorldM() >= 10 ? 10 : 5;
    P.ctx.save();
    P.ctx.strokeStyle = "rgba(148, 163, 184, 0.35)";
    P.ctx.lineWidth = 1;
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      const a = P.worldToScreen(x, y0);
      const b = P.worldToScreen(x, y1);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(b.sx, b.sy);
      P.ctx.stroke();
    }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
      const a = P.worldToScreen(x0, y);
      const b = P.worldToScreen(x1, y);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(b.sx, b.sy);
      P.ctx.stroke();
    }
    P.ctx.restore();
  };

P.draw = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    P.ensureLotOrigin();
    P.syncMapCanvasSize();
    const { scale } = P.padScale();
    P.ctx.clearRect(0, 0, P.mapCssW, P.mapCssH);
    P.ctx.fillStyle = "#e8edf2";
    P.ctx.fillRect(0, 0, P.mapCssW, P.mapCssH);
    if (!P.drag) P.drawWorldGrid();
    if (P.drawUnderlay) P.drawUnderlay(scale);
    const tl = P.worldToScreen(P.lotX0(), P.lotY1());
    const br = P.worldToScreen(P.lotX1(), P.lotY0());
    const lotWp = br.sx - tl.sx;
    const lotHp = br.sy - tl.sy;
    const glot = P.ctx.createLinearGradient(tl.sx, tl.sy, tl.sx + lotWp, tl.sy + lotHp);
    glot.addColorStop(0, P.COLORS.lotGradientTop);
    glot.addColorStop(1, P.COLORS.lotGradientBot);
    P.ctx.fillStyle = glot;
    P.ctx.fillRect(tl.sx, tl.sy, lotWp, lotHp);

    if (!P.shouldDrawRoad || P.shouldDrawRoad()) P.drawRoadAndParkingStrips(scale);
    P.drawScenarioObjects(scale);
    P.drawEntrances(scale);
    if (!P.shouldDrawPaths || P.shouldDrawPaths()) P.drawResultPaths(scale);
    if (P.drawPsoReplayOverlay) P.drawPsoReplayOverlay(scale);
    if (P.drawVehicleChainHighlight) P.drawVehicleChainHighlight(scale);
    if (P.drawViolationSlotHighlights) P.drawViolationSlotHighlights(scale);
    if (P.drawUnderlayCalibrationMarkers) P.drawUnderlayCalibrationMarkers(scale);

    P.drawVehicleSlotAssignments();
    if (P.drawSimulationOverlay) P.drawSimulationOverlay(scale);
    P.drawSelectionOutline();
    P.drawMapOverlays();
    if (P.hoverTarget && !P.drag && !P.pendingAdd && !P.panDrag) P.drawHoverBalloon();
    if (!P.drag) P.schedulePersistCurrentState();
  }
})();
