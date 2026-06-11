(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;
  const roadModel = window.ParkingRoadModel || {};
  const roadFromInner = roadModel.roadFromInner || (() => null);
  const DEFAULT_ROAD_WIDTH = roadModel.DEFAULT_ROAD_WIDTH || 6.0;

  function arcLengthFromBLCCW(px, py, roadOrInner) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    if (!geometry?.projectPointToRoad) return 0;
    const proj = geometry.projectPointToRoad(px, py, { road });
    return Number(proj?.along || 0);
  }

  function perimeterDistanceBetween(ax, ay, bx, by, roadOrInner) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    if (geometry?.roadDistanceBetweenPoints) {
      return geometry.roadDistanceBetweenPoints([ax, ay], [bx, by], { road });
    }
    return Math.abs(arcLengthFromBLCCW(ax, ay, road) - arcLengthFromBLCCW(bx, by, road));
  }

  function drivingDistanceFromEntrance(slotXY, roadOrInner, entrance) {
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    const ex = Number(entrance[0]);
    const ey = Number(entrance[1]);
    const sx = Number(slotXY[0]);
    const sy = Number(slotXY[1]);
    const pSlot = geometry?.projectPointToRoad ? geometry.projectPointToRoad(sx, sy, { road }) : null;
    if (!pSlot) return 0;
    const onRoadDist = perimeterDistanceBetween(ex, ey, pSlot.point[0], pSlot.point[1], road);
    return onRoadDist + pSlot.distance;
  }

  window.ParkingOptimizerPathCost = {
    drivingDistanceFromEntrance,
    perimeterDistanceBetween,
  };
})();
