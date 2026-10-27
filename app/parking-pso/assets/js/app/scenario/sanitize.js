(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/scenario/sanitize.js");

P.sanitizeScenarioGeometry = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    P.ensureRoadStructure();
    P.normalizeObstacleInner();
    const rawBuildings = Array.isArray(P.scenario.buildings) ? P.scenario.buildings.slice() : [];
    const rawSlots = Array.isArray(P.scenario.slots) ? P.scenario.slots.slice() : [];
    P.scenario.slots = [];
    P.scenario.buildings = [];
    for (const b of rawBuildings) {
      const bx = Number(b?.[0]);
      const by = Number(b?.[1]);
      if (!Number.isFinite(bx) || !Number.isFinite(by)) continue;
      const p = P.findNearestValidBuildingPosition(bx, by, -1);
      if (p) P.scenario.buildings.push([p.wx, p.wy]);
    }
    for (let ei = 0; ei < P.scenario.entrances.length; ei++) {
      const cur = P.scenario.entrances[ei];
      const es = P.snapEntranceToInner(cur?.[0] ?? 0, cur?.[1] ?? 0);
      if (P.canPlaceEntrance(es.wx, es.wy)) {
        P.scenario.entrances[ei][0] = es.wx;
        P.scenario.entrances[ei][1] = es.wy;
      } else {
        const altE = P.nearestValidEntrancePoint(es.wx, es.wy);
        if (altE) {
          P.scenario.entrances[ei][0] = altE.wx;
          P.scenario.entrances[ei][1] = altE.wy;
        }
      }
    }
    for (const s of rawSlots) {
      const sx = Number(s?.[0]);
      const sy = Number(s?.[1]);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
      const p = P.suggestUniformSlotPosition(sx, sy, -1);
      if (p) P.scenario.slots.push([p.wx, p.wy, P.normalizeAngle(p.theta ?? s?.[2] ?? 0)]);
    }
    P.ensureScenarioCollections();
    P.ensureVehicleEntrancesArray();
  }
})();
