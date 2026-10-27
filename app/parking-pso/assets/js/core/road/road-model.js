(function () {
  "use strict";

  const scenarioDefault = window.ParkingScenarioDefault || {};
  const DEFAULT_ROAD_WIDTH = scenarioDefault.DEFAULT_ROAD_WIDTH || 6.0;

  function cloneJson(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function roadFromInner(inner, fallbackWidth = DEFAULT_ROAD_WIDTH) {
    const ix0 = Number(inner?.x_min);
    const ix1 = Number(inner?.x_max);
    const iy0 = Number(inner?.y_min);
    const iy1 = Number(inner?.y_max);
    if (![ix0, ix1, iy0, iy1].every((v) => Number.isFinite(v))) return null;
    return {
      centerline: [
        [ix0, iy0],
        [ix1, iy0],
        [ix1, iy1],
        [ix0, iy1],
        [ix0, iy0],
      ],
      width: Number.isFinite(Number(fallbackWidth)) ? Number(fallbackWidth) : DEFAULT_ROAD_WIDTH,
      closed: true,
    };
  }

  function innerFromRoad(road) {
    const pts = Array.isArray(road?.centerline) ? road.centerline : [];
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const x = Number(pts[i]?.[0]);
      const y = Number(pts[i]?.[1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      xmin = Math.min(xmin, x);
      xmax = Math.max(xmax, x);
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    if (![xmin, xmax, ymin, ymax].every((v) => Number.isFinite(v))) return null;
    return { x_min: xmin, x_max: xmax, y_min: ymin, y_max: ymax };
  }

  function normalizeRoad(roadRaw, innerRaw, fallbackRoadFactory) {
    const fallbackRoad =
      typeof fallbackRoadFactory === "function" ? fallbackRoadFactory() : null;
    let road = roadRaw && typeof roadRaw === "object" ? cloneJson(roadRaw) : null;
    if (!road || !Array.isArray(road.centerline) || road.centerline.length < 2) {
      road = roadFromInner(innerRaw || {}, road?.width);
    }
    if (!road) return cloneJson(fallbackRoad || roadFromInner({}, DEFAULT_ROAD_WIDTH));
    const centerline = Array.isArray(road.centerline) ? road.centerline : [];
    const norm = centerline
      .map((p) => [Number(p?.[0]), Number(p?.[1])])
      .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const clean = [];
    for (let i = 0; i < norm.length; i++) {
      if (
        !clean.length ||
        Math.hypot(clean[clean.length - 1][0] - norm[i][0], clean[clean.length - 1][1] - norm[i][1]) >
          1e-6
      ) {
        clean.push(norm[i]);
      }
    }
    if (clean.length < 2) return cloneJson(fallbackRoad || roadFromInner({}, DEFAULT_ROAD_WIDTH));
    road.centerline = clean;
    road.width = Math.max(2.4, Number(road.width ?? DEFAULT_ROAD_WIDTH) || DEFAULT_ROAD_WIDTH);
    road.closed = road.closed !== false;
    return road;
  }

  function buildRoadSegments(roadOrInner) {
    const geometry = window.ParkingGeometry || null;
    const road = roadOrInner?.centerline
      ? roadOrInner
      : roadFromInner(roadOrInner || {}, DEFAULT_ROAD_WIDTH);
    if (geometry?.buildRoadSegments) return geometry.buildRoadSegments({ road });
    return [];
  }

  window.ParkingRoadModel = {
    DEFAULT_ROAD_WIDTH,
    cloneJson,
    roadFromInner,
    innerFromRoad,
    normalizeRoad,
    buildRoadSegments,
  };
})();
