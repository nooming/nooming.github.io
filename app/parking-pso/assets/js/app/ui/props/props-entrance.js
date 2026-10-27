(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-entrance.js");

  P.renderPropsEntrance = function () {
    P.propsAddNote(
      "入口为道路上的一点（无单独引道线段）；拖拽松手或改数后会自动贴到道路中心线。"
    );
    const entIndex = P.selection.index ?? 0;
    const e = P.scenario.entrances[entIndex];
    const applyEntrance = () => {
      const oldX = P.scenario.entrances[entIndex][0];
      const oldY = P.scenario.entrances[entIndex][1];
      const sx = parseFloat(document.getElementById("p-ex").value) || 0;
      const sy = parseFloat(document.getElementById("p-ey").value) || 0;
      const s = P.snapEntranceToInner(sx, sy);
      if (!P.canPlaceEntrance(s.wx, s.wy)) {
        P.scenario.entrances[entIndex][0] = oldX;
        P.scenario.entrances[entIndex][1] = oldY;
      } else {
        P.scenario.entrances[entIndex][0] = s.wx;
        P.scenario.entrances[entIndex][1] = s.wy;
      }
      P.ensureScenarioCollections();
      P.invalidateOptimizationResult();
      P.renderProps();
    };
    P.propsAddNum("入口 X (" + P.uLen() + ")", "p-ex", e[0], applyEntrance);
    P.propsAddNum("入口 Y (" + P.uLen() + ")", "p-ey", e[1], applyEntrance);
  };
})();
