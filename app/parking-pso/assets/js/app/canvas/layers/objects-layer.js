(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/objects-layer.js");

  P.drawScenarioObjects = function (scale) {
    for (const o of P.scenario.obstacles) {
      P.fillObstaclePolygon(o.points);
    }
    P.drawDraftShapes(scale);
    for (const s of P.scenario.slots) {
      const pose = P.slotPoseOf(s);
      if (!pose) continue;
      P.drawParkingSlotWorld(pose.x, pose.y, pose.theta);
    }
    for (let bi = 0; bi < P.scenario.buildings.length; bi++) {
      const [x, y] = P.scenario.buildings[bi];
      P.drawBuildingWorld(x, y);
      P.drawStackedWorldLabels(x, y, [String(bi + 1)]);
    }
  };
})();
