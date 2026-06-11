(function () {
  "use strict";

  const nav = window.ParkingOptimizerNav || {};
  const pathCost = window.ParkingOptimizerPathCost || {};
  const roadModel = window.ParkingRoadModel || {};
  const roadFromInner = roadModel.roadFromInner || (() => null);
  const DEFAULT_ROAD_WIDTH = roadModel.DEFAULT_ROAD_WIDTH || 6.0;

  const walkBlockingBoxes = nav.walkBlockingBoxes || (() => []);
  const recommendNavStep = nav.recommendNavStep || (() => 1.2);
  const buildNavigationGrid = nav.buildNavigationGrid || (() => ({}));
  const walkingPlan = nav.walkingPlan || (() => [0, []]);
  const drivingDistanceFromEntrance = pathCost.drivingDistanceFromEntrance || (() => 0);

  function vehicleSlotPenalty(s, vehIdx, slotIdx) {
    const req = s.vehicle_requirements?.[vehIdx] || "normal";
    if (req === "normal") return 0;
    const slotType = s.slot_types?.[slotIdx] || "normal";
    if (slotType === req) return 0;
    return Number(s.soft_constraints?.type_mismatch_penalty || 0);
  }

  function precomputeFromNormalized(s) {
    const road = s.road || roadFromInner(s.inner, DEFAULT_ROAD_WIDTH);
    const obstacles = s.obstacles;
    const lot = s.lot || { width: 100, height: 100 };
    const metersPerUnit = Number(s?.display?.meters_per_unit) > 0 ? Number(s.display.meters_per_unit) : 2;
    const slotsPos = s.slots.map((p) => [Number(p[0]), Number(p[1])]);
    const buildingsPos = s.buildings.map((p) => [Number(p[0]), Number(p[1])]);
    const nSlot = slotsPos.length;
    const nB = buildingsPos.length;
    const entrancesPos = s.entrances.map((p) => [Number(p[0]), Number(p[1])]);
    if (!nSlot || !nB) {
      return {
        driveDistByEntrance: [],
        walkMat: [],
        boxesByBi: [],
        navByBi: [],
        slotsPos,
        buildingsPos,
        entrancesPos,
        nSlot,
        nB,
      };
    }
    const driveDistByEntrance = slotsPos.map((slot) =>
      entrancesPos.map((ent) => drivingDistanceFromEntrance(slot, road, ent) * metersPerUnit)
    );
    const boxesByBi = Array.from({ length: nB }, (_, bi) =>
      walkBlockingBoxes(obstacles, buildingsPos, bi)
    );
    const navByBi = Array.from({ length: nB }, (_, bi) => {
      const lw = Number(lot.width || 100);
      const lh = Number(lot.height || 100);
      const step = recommendNavStep(lw, lh, boxesByBi[bi].length);
      return buildNavigationGrid(boxesByBi[bi], lw, lh, step);
    });
    const walkMat = Array.from({ length: nSlot }, () => Array.from({ length: nB }, () => 0));
    for (let si = 0; si < nSlot; si++) {
      for (let bi = 0; bi < nB; bi++) {
        walkMat[si][bi] =
          walkingPlan(
            slotsPos[si],
            buildingsPos[bi],
            obstacles,
            buildingsPos,
            bi,
            boxesByBi[bi],
            navByBi[bi],
            lot
          )[0] * metersPerUnit;
      }
    }
    return {
      driveDistByEntrance,
      walkMat,
      boxesByBi,
      navByBi,
      slotsPos,
      buildingsPos,
      entrancesPos,
      nSlot,
      nB,
      road,
    };
  }

  window.ParkingOptimizerCost = {
    vehicleSlotPenalty,
    precomputeFromNormalized,
  };
})();
