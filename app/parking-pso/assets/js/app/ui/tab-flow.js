(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/tab-flow.js");

P.switchTab = function (tabKey) {
    P.activeTab = tabKey || "overview";
    if (P.tabUtils?.applyTabState) P.tabUtils.applyTabState(P.activeTab);
    else {
      document.querySelectorAll(".side-tab").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.tab === P.activeTab);
      });
      document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === P.activeTab);
      });
    }
    if (P.activeTab === "result") {
      // Result chart may be initialized while hidden; re-measure after tab is visible.
      requestAnimationFrame(() => {
        P.syncChartCanvasSize();
        P.drawChart(P.lastChartSeries, P.lastChartOptimizer);
      });
    }
    P.schedulePersistCurrentState();
  }

P.entranceDisplayName = function (index) {
    const safeIndex = Math.max(0, Number(index) || 0);
    return "入口 " + (safeIndex + 1);
  }

P.notifyObstacleGeometryInvalid = function (reason) {
    const status = document.getElementById("result-status");
    if (!status) return;
    if (reason === "overlap") {
      status.textContent = "花坛不能与其他花坛重叠，请调整位置或形状。";
      return;
    }
    if (reason === "overlap_element") {
      status.textContent = "花坛不能与楼、车位或入口重叠，请调整位置或形状。";
      return;
    }
    if (reason === "overlap_road") {
      status.textContent = "花坛不能与道路重叠，请调整位置或形状。";
      return;
    }
    if (reason === "self_intersect") {
      status.textContent = "花坛多边形不能自交，请调整顶点位置。";
      return;
    }
    status.textContent = "花坛多边形无效：至少需要 3 个不共线顶点。";
  }

P.notifyRoadGeometryInvalid = function (reason) {
    const status = document.getElementById("result-status");
    if (!status) return;
    if (reason === "overlap_obstacle") {
      status.textContent = "道路不能与花坛重叠，请调整道路。";
      return;
    }
    if (reason === "overlap_building") {
      status.textContent = "道路不能与居民楼重叠，请调整道路。";
      return;
    }
    status.textContent = "道路几何无效，请调整道路。";
  }

P.invalidateOptimizationResult = function () {
    P.lastResult = null;
    P.lastChartSeries = [];
    P.drawChart([]);
    P.updateChartCaption("idle");
    P.scheduleAutoEntrancePreviewRefresh();
    P.renderBreakdownSummary();
    P.renderResultTip("");
    P.draw();
  }

})();
