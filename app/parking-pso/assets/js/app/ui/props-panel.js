(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props-panel.js");

  P.renderProps = function () {
    P.propsForm.innerHTML = "";
    if (!P.selection) {
      P.propsEmpty.hidden = false;
      P.propsForm.hidden = true;
      return;
    }
    P.propsEmpty.hidden = true;
    P.propsForm.hidden = false;

    const kind = P.selection.kind;
    if (kind === "entrance") P.renderPropsEntrance();
    else if (kind === "obstacle") P.renderPropsObstacle();
    else if (kind === "road") P.renderPropsRoad();
    else if (kind === "building") P.renderPropsBuilding();
    else if (kind === "slot") P.renderPropsSlot();
  };
})();
