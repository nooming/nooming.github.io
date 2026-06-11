(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/props/props-obstacle.js");

  P.renderPropsObstacle = function () {
    const obsIndex = P.selection.index ?? 0;
    const getObstacle = () => P.scenario?.obstacles?.[obsIndex];
    const o = getObstacle();
    if (!o) {
      P.propsAddNote("当前花坛不可用，请重新选择花坛。");
      return;
    }
    P.propsAddNote("花坛为多边形：可编辑各顶点坐标，至少保留 3 个点；支持画布直接拖拽顶点。");
    (o?.points || []).forEach((pt, pi) => {
      P.propsAddNum("顶点 " + (pi + 1) + " X (" + P.uLen() + ")", "p-opx-" + pi, pt[0], () => {
        const cur = getObstacle();
        if (!cur || !cur.points?.[pi]) return;
        const old = (cur.points || []).map((p) => [p[0], p[1]]);
        cur.points[pi][0] = parseFloat(document.getElementById("p-opx-" + pi).value) || 0;
        if (!P.normalizeObstacleInner()) {
          cur.points = old;
          P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
          P.renderProps();
          P.draw();
          return;
        }
        P.invalidateOptimizationResult();
        P.renderProps();
      });
      P.propsAddNum("顶点 " + (pi + 1) + " Y (" + P.uLen() + ")", "p-opy-" + pi, pt[1], () => {
        const cur = getObstacle();
        if (!cur || !cur.points?.[pi]) return;
        const old = (cur.points || []).map((p) => [p[0], p[1]]);
        cur.points[pi][1] = parseFloat(document.getElementById("p-opy-" + pi).value) || 0;
        if (!P.normalizeObstacleInner()) {
          cur.points = old;
          P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
          P.renderProps();
          P.draw();
          return;
        }
        P.invalidateOptimizationResult();
        P.renderProps();
      });
    });
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.textContent = "新增顶点";
    addBtn.style.gridColumn = "1 / -1";
    addBtn.addEventListener("click", () => {
      const cur = getObstacle();
      if (!cur) return;
      const pts = cur.points || [];
      const old = pts.map((p) => [p[0], p[1]]);
      if (!pts.length) {
        cur.points = [
          [50, 50],
          [54, 50],
          [52, 54],
        ];
      } else if (pts.length === 1) {
        cur.points.push([pts[0][0] + 2, pts[0][1]]);
      } else {
        const a = pts[pts.length - 1];
        const b = pts[0];
        cur.points.push([(a[0] + b[0]) / 2 + 1.2, (a[1] + b[1]) / 2 + 1.2]);
      }
      if (!P.normalizeObstacleInner()) {
        cur.points = old;
        P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
        P.renderProps();
        P.draw();
        return;
      }
      P.invalidateOptimizationResult();
      P.renderProps();
    });
    P.propsForm.appendChild(addBtn);
    if ((o?.points || []).length > 3) {
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.textContent = "删除最后顶点";
      delBtn.style.gridColumn = "1 / -1";
      delBtn.addEventListener("click", () => {
        const cur = getObstacle();
        if (!cur || !Array.isArray(cur.points) || cur.points.length <= 3) return;
        const old = cur.points.map((p) => [p[0], p[1]]);
        cur.points.pop();
        if (!P.normalizeObstacleInner()) {
          cur.points = old;
          P.notifyObstacleGeometryInvalid(P.obstacleNormalizeError || "self_intersect");
          P.renderProps();
          P.draw();
          return;
        }
        P.invalidateOptimizationResult();
        P.renderProps();
      });
      P.propsForm.appendChild(delBtn);
    }
  };
})();
