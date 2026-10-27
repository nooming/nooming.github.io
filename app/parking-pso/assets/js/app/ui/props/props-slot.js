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
    P.ensureConstraints();
    const types = ["normal", "accessible", "ev", "visitor"];
    const labels = { normal: "普通", accessible: "无障碍", ev: "充电", visitor: "访客" };
    const cur = P.scenario.slot_types?.[idx] || "normal";
    const wrap = document.createElement("div");
    wrap.className = "prop-grid";
    const lab = document.createElement("label");
    lab.setAttribute("for", "p-slot-type");
    lab.textContent = "车位类型";
    const sel = document.createElement("select");
    sel.id = "p-slot-type";
    types.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = labels[t] || t;
      sel.appendChild(o);
    });
    sel.value = cur;
    sel.addEventListener("change", () => {
      P.scenario.slot_types[idx] = sel.value;
      P.invalidateOptimizationResult();
      P.draw();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    document.getElementById("props-form").appendChild(wrap);
  };
})();
