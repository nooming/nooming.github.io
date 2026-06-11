(function () {
  "use strict";

  const nav = window.ParkingOptimizerNav || {};
  const roadModel = window.ParkingRoadModel || {};
  const walkingPlan = nav.walkingPlan || (() => [0, []]);
  const buildRoadSegments = roadModel.buildRoadSegments || (() => []);

  function packResult(s, opts) {
    const paths = [];
    for (let i = 0; i < opts.bestAssign.length; i++) {
      const ti = opts.vehTargets[i];
      const slotXY = opts.slotsPos[opts.bestAssign[i]];
      const bxy = opts.buildingsPos[ti];
      const poly = walkingPlan(
        slotXY,
        bxy,
        opts.obstacles,
        opts.buildingsPos,
        ti,
        opts.boxesByBi[ti],
        opts.navByBi ? opts.navByBi[ti] : null,
        opts.lot
      )[1];
      paths.push(poly.map((p) => [Number(p[0]), Number(p[1])]));
    }
    return {
      scenario: s,
      gbest_value: Number(opts.gbestValue),
      history_best: opts.historyBest.map((v) => Number(v)),
      assign: opts.bestAssign.map((v) => Number(v)),
      veh_targets: opts.vehTargets.map((v) => Number(v)),
      veh_entrances: opts.bestEntrances.map((v) => Number(v)),
      vehicle_breakdown: opts.vehicleBreakdown.map((it) => ({
        vehicle_index: Number(it.vehicle_index),
        slot_index: Number(it.slot_index),
        destination_index: Number(it.destination_index),
        entrance_index: Number(it.entrance_index),
        drive_time: Number(it.drive_time),
        walk_time: Number(it.walk_time),
        penalty: Number(it.penalty),
        total_time: Number(it.total_time),
      })),
      paths,
      road_segments: buildRoadSegments(opts.road).map((seg) => [
        [Number(seg[0][0]), Number(seg[0][1])],
        [Number(seg[1][0]), Number(seg[1][1])],
      ]),
      optimizer: opts.optimizer,
    };
  }

  window.ParkingOptimizerPack = {
    packResult,
  };
})();
