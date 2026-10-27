(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/tab-flow.js");

P.normalizeTabKey = function (tabKey) {
    if (tabKey === "plans" || tabKey === "compare" || tabKey === "schemes") return "overview";
    if (tabKey === "lab" || tabKey === "result") return "overview";
    return tabKey || "overview";
  };

P.switchTab = function (tabKey) {
    P.activeTab = P.normalizeTabKey(tabKey);
    if (P.tabUtils?.applyTabState) P.tabUtils.applyTabState(P.activeTab);
    else {
      document.querySelectorAll(".side-tab").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.tab === P.activeTab);
      });
      document.querySelectorAll("[data-tab-panel]").forEach((panel) => {
        panel.classList.toggle("is-active", panel.dataset.tabPanel === P.activeTab);
      });
    }
    if (P.activeTab === "simulate") {
      P.syncSimArrivalFields?.();
      P.renderSimVehicleQueue?.();
      P.schedulePrecomputeWarmup?.();
      requestAnimationFrame(() => {
        P.syncSimQueueChartSize?.();
        if (P.simState?.timeline) P.drawSimQueueChart?.(P.simState.timeline);
      });
      P.draw();
    } else {
      const warm = document.getElementById("sim-warm-status");
      if (warm) warm.hidden = true;
    }
    P.updateRunBarSummary?.();
    P.updateActionGates?.();
    P.schedulePersistCurrentState();
  }

P.entranceDisplayName = function (index) {
    const safeIndex = Math.max(0, Number(index) || 0);
    return "入口 " + (safeIndex + 1);
  }

P.notifyObstacleGeometryInvalid = function (reason) {
    if (reason === "overlap") {
      P.showWorkspaceMessage?.("花坛不能与其他花坛重叠，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "overlap_element") {
      P.showWorkspaceMessage?.("花坛不能与楼、车位或入口重叠，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "overlap_road") {
      P.showWorkspaceMessage?.("花坛不能与道路重叠，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "outside_lot") {
      P.showWorkspaceMessage?.("花坛不能超出地块边界，请调整位置或形状。", { level: "error" });
      return;
    }
    if (reason === "self_intersect") {
      P.showWorkspaceMessage?.("花坛多边形不能自交，请调整顶点位置。", { level: "error" });
      return;
    }
    P.showWorkspaceMessage?.("花坛多边形无效：至少需要 3 个不共线顶点。", { level: "error" });
  }

P.notifyRoadGeometryInvalid = function (reason) {
    if (reason === "overlap_obstacle") {
      P.showWorkspaceMessage?.("道路不能与花坛重叠，请调整道路。", { level: "error" });
      return;
    }
    if (reason === "overlap_building") {
      P.showWorkspaceMessage?.("道路不能与居民楼重叠，请调整道路。", { level: "error" });
      return;
    }
    if (reason === "outside_lot") {
      P.showWorkspaceMessage?.("道路不能超出地块边界，请调整道路。", { level: "error" });
      return;
    }
    P.showWorkspaceMessage?.("道路几何无效，请调整道路。", { level: "error" });
  }

P.clearOptimizationResultLight = function () {
    P.stopPsoReplay?.();
    P.lastResult = null;
    P.lastChartSeries = [];
    P.drawChart([]);
    P.updateChartCaption("idle");
    P.renderChartMeta?.(null);
    P.renderBreakdownSummary();
    P.renderResultTip("");
    P.showWorkspaceMessage?.("场景已变更，请重新运行优化。", { level: "warn" });
    P.updateActionGates?.();
  }

P.invalidateOptimizationResult = function () {
    P.clearOptimizationResultLight();
    P.draw();
  }

})();
