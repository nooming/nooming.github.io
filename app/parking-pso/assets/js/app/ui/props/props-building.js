(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-building.js");

  P.renderPropsBuilding = function () {
    const [x, y] = P.scenario.buildings[P.selection.index];
    P.propsAddNum("楼中心 X (" + P.uLen() + ")", "p-bx", x, () => {
      const v = P.clampBuildingCenter(
        parseFloat(document.getElementById("p-bx").value) || 0,
        parseFloat(document.getElementById("p-by").value) || 0
      );
      if (P.canPlaceBuilding(v.wx, v.wy, P.selection.index)) {
        P.scenario.buildings[P.selection.index][0] = v.wx;
      }
      P.draw();
    });
    P.propsAddNum("楼中心 Y (" + P.uLen() + ")", "p-by", y, () => {
      const v = P.clampBuildingCenter(
        parseFloat(document.getElementById("p-bx").value) || 0,
        parseFloat(document.getElementById("p-by").value) || 0
      );
      if (P.canPlaceBuilding(v.wx, v.wy, P.selection.index)) {
        P.scenario.buildings[P.selection.index][1] = v.wy;
      }
      P.draw();
    });
  };
})();
