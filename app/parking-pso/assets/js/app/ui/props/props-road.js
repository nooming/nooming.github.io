(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-road.js");

  P.renderPropsRoad = function () {
    P.propsAddNote("道路使用中心线顶点 + 宽度；支持编辑顶点坐标、宽度和环形/非环形。");
    P.ensureRoadStructure();
    const pts = P.scenario.road?.centerline || [];
    const shapeLabel = document.createElement("label");
    shapeLabel.htmlFor = "p-r-closed";
    shapeLabel.textContent = "道路形态";
    const shapeSel = document.createElement("select");
    shapeSel.id = "p-r-closed";
    shapeSel.innerHTML =
      '<option value="closed">环形（首尾相连）</option><option value="open">非环形（首尾不连）</option>';
    shapeSel.value = P.scenario.road?.closed === false ? "open" : "closed";
    shapeSel.addEventListener("change", () => {
      if (P.tryApplyRoadUpdate(() => P.setRoadClosed(shapeSel.value !== "open"))) {
        P.renderProps();
        P.draw();
      }
    });
    P.propsForm.appendChild(shapeLabel);
    P.propsForm.appendChild(shapeSel);
    P.propsAddNum(
      "道路宽度 (" + P.uLen() + ")",
      "p-r-width",
      P.scenario.road?.width || P.DEFAULT_ROAD_WIDTH,
      () => {
        const nextW = Math.max(
          2.4,
          parseFloat(document.getElementById("p-r-width").value) || P.DEFAULT_ROAD_WIDTH
        );
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.width = nextW;
          })
        ) {
          P.renderProps();
          P.draw();
        }
      }
    );
    pts.forEach((pt, pi) => {
      P.propsAddNum("道路顶点 " + (pi + 1) + " X (" + P.uLen() + ")", "p-rx-" + pi, pt[0], () => {
        const v = parseFloat(document.getElementById("p-rx-" + pi).value) || 0;
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.centerline[pi][0] = v;
            if (P.scenario.road?.closed !== false) {
              P.syncClosedRoadEndpoint(P.scenario.road.centerline, pi);
            }
          })
        ) {
          P.renderProps();
          P.draw();
        }
      });
      P.propsAddNum("道路顶点 " + (pi + 1) + " Y (" + P.uLen() + ")", "p-ry-" + pi, pt[1], () => {
        const v = parseFloat(document.getElementById("p-ry-" + pi).value) || 0;
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.centerline[pi][1] = v;
            if (P.scenario.road?.closed !== false) {
              P.syncClosedRoadEndpoint(P.scenario.road.centerline, pi);
            }
          })
        ) {
          P.renderProps();
          P.draw();
        }
      });
    });
    if (pts.length > 2) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "删除最后道路顶点";
      delBtn.style.gridColumn = "1 / -1";
      delBtn.addEventListener("click", () => {
        if ((P.scenario.road?.centerline || []).length <= 2) return;
        if (
          P.tryApplyRoadUpdate(() => {
            P.scenario.road.centerline.pop();
          })
        ) {
          P.renderProps();
          P.draw();
        }
      });
      P.propsForm.appendChild(delBtn);
    }
  };
})();
