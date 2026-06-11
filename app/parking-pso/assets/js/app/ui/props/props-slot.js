(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-slot.js");

  P.renderPropsSlot = function () {
    const pose = P.slotPoseOf(P.scenario.slots[P.selection.index]);
    if (!pose) return;
    const x = pose.x;
    const y = pose.y;
    const idx = P.selection.index;
    const applySlotFromInputs = () => {
      P.scenario.slots[idx][0] = parseFloat(document.getElementById("p-sx").value) || 0;
      P.scenario.slots[idx][1] = parseFloat(document.getElementById("p-sy").value) || 0;
      if (!P.applySnapToSlot(idx)) return;
      P.renderProps();
      P.draw();
    };
    P.propsAddNum("车位中心 X (" + P.uLen() + ")", "p-sx", x, applySlotFromInputs);
    P.propsAddNum("车位中心 Y (" + P.uLen() + ")", "p-sy", y, applySlotFromInputs);
    P.propsAddNum("车位角度 (deg)", "p-st", (P.normalizeAngle(pose.theta) * 180) / Math.PI, () => {
      const deg = parseFloat(document.getElementById("p-st").value) || 0;
      P.scenario.slots[idx][2] = P.normalizeAngle((deg * Math.PI) / 180);
      P.draw();
    });
  };
})();
