(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/renderer.js");

P.draw = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    P.syncMapCanvasSize();
    const { offsetX, offsetY, scale } = P.padScale();
    P.ctx.clearRect(0, 0, P.mapCssW, P.mapCssH);
    const lotX = offsetX;
    const lotY = offsetY;
    const lotWp = P.lotW() * scale;
    const lotHp = P.lotH() * scale;
    const glot = P.ctx.createLinearGradient(lotX, lotY, lotX + lotWp, lotY + lotHp);
    glot.addColorStop(0, P.COLORS.lotGradientTop);
    glot.addColorStop(1, P.COLORS.lotGradientBot);
    P.ctx.fillStyle = glot;
    P.ctx.fillRect(lotX, lotY, lotWp, lotHp);

    P.drawRoadAndParkingStrips(scale);
    P.drawScenarioObjects(scale);
    P.drawEntrances(scale);
    P.drawResultPaths(scale);

    P.drawVehicleSlotAssignments();
    P.drawSelectionOutline();
    P.drawMapOverlays();
    if (P.hoverTarget && !P.drag && !P.pendingAdd) P.drawHoverBalloon();
    P.schedulePersistCurrentState();
  }
})();
