(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/interaction/pointer.js");

  P.setSelection = function (sel) {
    P.selection = sel;
    document.querySelectorAll(".toolbar button").forEach((b) => {
      if (b.id === "btn-add-building") b.classList.toggle("active", P.pendingAdd === "building");
      if (b.id === "btn-add-slot") b.classList.toggle("active", P.pendingAdd === "slot");
      if (b.id === "btn-add-entrance") b.classList.toggle("active", P.pendingAdd === "entrance");
      if (b.id === "btn-add-obstacle") b.classList.toggle("active", P.pendingAdd === "obstacle");
      if (b.id === "btn-add-road") b.classList.toggle("active", P.pendingAdd === "road");
    });
    P.syncDeleteButton?.();
    P.renderProps();
    P.draw();
  };

  P.handlePendingAddPointerDown = function (wx, wy, ev) {
    if (P.pendingAdd === "entrance") {
      const c = P.clampWorld(wx, wy);
      const s = P.snapEntranceToInner(c.wx, c.wy);
      if (!P.canPlaceEntrance(s.wx, s.wy)) return true;
      P.scenario.entrances.push([s.wx, s.wy]);
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.invalidateOptimizationResult();
      P.pendingAdd = null;
      P.setSelection({ kind: "entrance", index: P.scenario.entrances.length - 1 });
      P.commitSceneGeometry();
      return true;
    }
    if (P.pendingAdd === "obstacle") {
      const snap = P.obstacleDraftSnap(wx, wy);
      if (snap.snapToStart && P.obstacleDraftPoints?.length >= 3) {
        P.finalizeObstacleDraft();
      } else if (ev.detail >= 2) {
        P.appendObstacleDraftPoint(snap.wx, snap.wy);
        P.finalizeObstacleDraft();
      } else {
        P.appendObstacleDraftPoint(snap.wx, snap.wy);
        P.draw();
      }
      return true;
    }
    if (P.pendingAdd === "road") {
      const snap = P.roadDraftSnap(wx, wy);
      if (snap.snapToStart && P.roadDraftPoints?.length >= 2) {
        P.finalizeRoadDraft();
      } else if (ev.detail >= 2) {
        P.appendRoadDraftPoint(snap.wx, snap.wy);
        P.finalizeRoadDraft();
      } else {
        P.appendRoadDraftPoint(snap.wx, snap.wy);
        P.draw();
      }
      return true;
    }
    if (P.pendingAdd === "building") {
      const c = P.clampBuildingCenter(wx, wy);
      if (!P.canPlaceBuilding(c.wx, c.wy)) return true;
      P.scenario.buildings.push([c.wx, c.wy]);
      P.ensureVehicleDestinationsArray();
      P.rebuildVehicleTargetsUI();
      P.pendingAdd = null;
      P.setSelection({ kind: "building", index: P.scenario.buildings.length - 1 });
      P.commitSceneGeometry();
      return true;
    }
    if (P.pendingAdd === "slot") {
      const c = P.clampWorld(wx, wy);
      const p = P.suggestUniformSlotPosition(c.wx, c.wy, -1);
      if (!p) return true;
      P.scenario.slots.push([p.wx, p.wy, P.normalizeAngle(p.theta)]);
      const si = P.scenario.slots.length - 1;
      P.pendingAdd = null;
      P.setSelection({ kind: "slot", index: si });
      P.commitSceneGeometry();
      return true;
    }
    return false;
  };

  P.pointerDown = function (ev) {
    if (!P.scenario) return;
    if (P.touchPinching) return;
    P.ensureScenarioCollections();

    const isPan = ev.button === 2;
    if (isPan) {
      ev.preventDefault();
      const { sx, sy } = P.eventToScreen(ev);
      P.panDrag = {
        startSx: sx,
        startSy: sy,
        origPanX: P.viewPanX ?? 0,
        origPanY: P.viewPanY ?? 0,
      };
      P.mapCanvas.classList.add("is-panning");
      return;
    }

    const { wx, wy } = P.eventToWorld(ev);

    if (P.handleUnderlayCalibrationClick?.(wx, wy)) return;

    if (P.handlePendingAddPointerDown(wx, wy, ev)) return;

    // 触屏：从空白处拖拽平移地图；点在对象上仍进入拖拽 / 选择
    if (ev.pointerType === "touch" && !P.pendingAdd && !P.pickAt(wx, wy)) {
      ev.preventDefault();
      const { sx, sy } = P.eventToScreen(ev);
      P.panDrag = {
        startSx: sx,
        startSy: sy,
        origPanX: P.viewPanX ?? 0,
        origPanY: P.viewPanY ?? 0,
      };
      P.mapCanvas.classList.add("is-panning");
      return;
    }

    const nearVertex = P.pickAnyObstacleVertex(wx, wy, 16);
    if (nearVertex) {
      const oi = nearVertex.obstacleIndex;
      const vi = nearVertex.vertexIndex;
      P.setSelection({ kind: "obstacle", index: oi });
      P.drag = {
        kind: "obstacle-vertex",
        index: oi,
        vertexIndex: vi,
        ox: 0,
        oy: 0,
        origPoints: (P.scenario.obstacles[oi].points || []).map((p) => [p[0], p[1]]),
      };
      return;
    }
    const mouseS = P.worldToScreen(wx, wy);
    const ents = P.scenario.entrances || [];
    for (let i = ents.length - 1; i >= 0; i--) {
      const ep = P.worldToScreen(ents[i][0], ents[i][1]);
      if (Math.hypot(mouseS.sx - ep.sx, mouseS.sy - ep.sy) < 16) {
        P.setSelection({ kind: "entrance", index: i });
        P.drag = { kind: "entrance", index: i, ox: 0, oy: 0 };
        return;
      }
    }
    const roadVertex = P.pickRoadVertex(wx, wy, 16);
    if (roadVertex != null) {
      P.setSelection({ kind: "road" });
      P.drag = {
        kind: "road-vertex",
        vertexIndex: roadVertex,
        ox: 0,
        oy: 0,
        origPoints: (P.scenario.road.centerline || []).map((p) => [p[0], p[1]]),
      };
      return;
    }

    const hit = P.pickAt(wx, wy);
    if (!hit) {
      P.setSelection(null);
      return;
    }
    P.setSelection(hit);
    P.beginDragForHit(hit, wx, wy);
  };

  P.pointerMove = function (ev) {
    if (P.panDrag) {
      const { sx, sy } = P.eventToScreen(ev);
      P.viewPanX = P.panDrag.origPanX + (sx - P.panDrag.startSx);
      P.viewPanY = P.panDrag.origPanY + (sy - P.panDrag.startSy);
      P.draw();
      return;
    }

    let { wx, wy } = P.eventToWorld(ev);
    const cw = P.clampWorld(wx, wy);
    wx = cw.wx;
    wy = cw.wy;
    if (P.pendingAdd === "obstacle" && P.obstacleDraftPoints?.length) {
      const snap = P.obstacleDraftSnap(wx, wy);
      P.obstacleDraftHover = [snap.wx, snap.wy];
      P.obstacleDraftSnapStart = !!snap.snapToStart;
      P.draw();
      if (!P.drag || !P.scenario) return;
    }
    if (P.pendingAdd === "road" && P.roadDraftPoints?.length) {
      const snap = P.roadDraftSnap(wx, wy);
      P.roadDraftHover = [snap.wx, snap.wy];
      P.roadDraftSnapStart = !!snap.snapToStart;
      P.draw();
      if (!P.drag || !P.scenario) return;
    }
    if (!P.drag || !P.scenario) {
      if (!P.drag && !P.panDrag && P.scenario && !P.pendingAdd) {
        const newHover = P.getHoveredElement(wx, wy);
        const changed =
          newHover?.type !== P.hoverTarget?.type || newHover?.index !== P.hoverTarget?.index;
        if (changed) {
          P.hoverTarget = newHover;
          if (!P.hoverRafPending) {
            P.hoverRafPending = true;
            requestAnimationFrame(() => {
              P.hoverRafPending = false;
              P.draw();
            });
          }
        }
      }
      return;
    }
    P.updateDragFromPointer(wx, wy);
  };

  P.pointerUp = function () {
    if (P.panDrag) {
      P.panDrag = null;
      P.mapCanvas.classList.remove("is-panning");
      P.schedulePersistCurrentState?.();
      return;
    }
    P.finishDragFromPointer();
  };

  P.deleteSelected = function () {
    if (!P.selection) return;
    if (P.selection.kind === "building") {
      const ri = P.selection.index;
      P.scenario.buildings.splice(ri, 1);
      P.adjustVehicleDestinationsAfterBuildingRemoved(ri);
      P.rebuildVehicleTargetsUI();
      P.setSelection(null);
    } else if (P.selection.kind === "slot") {
      const si = P.selection.index;
      P.scenario.slots.splice(si, 1);
      if (Array.isArray(P.scenario.slot_types)) P.scenario.slot_types.splice(si, 1);
      P.setSelection(null);
    } else if (P.selection.kind === "entrance") {
      if (P.scenario.entrances.length <= 1) return;
      const ei = P.selection.index ?? 0;
      P.scenario.entrances.splice(ei, 1);
      if (Array.isArray(P.scenario.vehicle_entrances)) {
        const maxIndex = Math.max(0, P.scenario.entrances.length - 1);
        P.scenario.vehicle_entrances = P.scenario.vehicle_entrances.map((v) => {
          const n = Number(v) || 0;
          if (n === ei) return 0;
          return Math.max(0, Math.min(maxIndex, n > ei ? n - 1 : n));
        });
      }
      P.ensureScenarioCollections();
      P.ensureVehicleEntrancesArray();
      P.rebuildVehicleTargetsUI();
      P.setSelection(null);
    } else if (P.selection.kind === "obstacle") {
      P.scenario.obstacles.splice(P.selection.index ?? 0, 1);
      P.normalizeObstacleInner();
      P.setSelection(null);
    }
    P.invalidateOptimizationResult();
  };
})();
