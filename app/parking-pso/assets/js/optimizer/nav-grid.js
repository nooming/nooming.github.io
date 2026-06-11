(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;

  const NAV_GRID_STEP = 1.2;
  const NAV_GRID_STEP_MAX = 1.8;

  function pointInPolygon(p, poly, includeBoundary = true) {
    return geometry?.pointInPolygon ? geometry.pointInPolygon(p, poly, includeBoundary) : false;
  }

  function segmentIntersectsPolygon(p1, p2, poly) {
    return geometry?.segmentIntersectsPolygon
      ? geometry.segmentIntersectsPolygon(p1, p2, poly)
      : false;
  }

  function segmentClearBoxes(p1, p2, boxes) {
    for (let i = 0; i < boxes.length; i++) {
      if (segmentIntersectsPolygon(p1, p2, boxes[i])) return false;
    }
    return true;
  }

  function pointInsideAnyObstacle(p, obstacles) {
    for (let i = 0; i < obstacles.length; i++) {
      if (pointInPolygon(p, obstacles[i], true)) return true;
    }
    return false;
  }

  function navGridIdx(i, j, nx) {
    return j * nx + i;
  }

  function recommendNavStep(lotW, lotH, obstacleCount) {
    const area = Math.max(1, Number(lotW) * Number(lotH));
    const obsFactor = Math.max(0, Number(obstacleCount) || 0);
    const densePenalty = Math.min(0.5, obsFactor * 0.04);
    const areaPenalty = Math.min(0.4, Math.max(0, area - 12000) / 30000);
    return Math.max(NAV_GRID_STEP, Math.min(NAV_GRID_STEP_MAX, NAV_GRID_STEP + densePenalty + areaPenalty));
  }

  function buildNavigationGrid(obstacles, lotW, lotH, step = NAV_GRID_STEP) {
    const nx = Math.max(2, Math.floor(lotW / step) + 1);
    const ny = Math.max(2, Math.floor(lotH / step) + 1);
    const valid = new Uint8Array(nx * ny);
    const points = Array(nx * ny);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = navGridIdx(i, j, nx);
        const x = Math.min(lotW, i * step);
        const y = Math.min(lotH, j * step);
        points[idx] = [x, y];
        valid[idx] = pointInsideAnyObstacle([x, y], obstacles) ? 0 : 1;
      }
    }
    const adj = Array.from({ length: nx * ny }, () => []);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = navGridIdx(i, j, nx);
        if (!valid[idx]) continue;
        const p = points[idx];
        for (let d = 0; d < dirs.length; d++) {
          const ni = i + dirs[d][0];
          const nj = j + dirs[d][1];
          if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue;
          const nidx = navGridIdx(ni, nj, nx);
          if (!valid[nidx]) continue;
          const q = points[nidx];
          if (!segmentClearBoxes(p, q, obstacles)) continue;
          adj[idx].push([nidx, Math.hypot(q[0] - p[0], q[1] - p[1])]);
        }
      }
    }
    return { nx, ny, step, valid, points, adj, nodeCount: nx * ny };
  }

  function nearestVisibleGridNodes(point, nav, obstacles, maxNodes = 6, maxPx = 6) {
    if (pointInsideAnyObstacle(point, obstacles)) return [];
    const [px, py] = point;
    const ci = Math.max(0, Math.min(nav.nx - 1, Math.round(px / nav.step)));
    const cj = Math.max(0, Math.min(nav.ny - 1, Math.round(py / nav.step)));
    const cands = [];
    for (let r = 0; r <= maxPx; r++) {
      const i0 = Math.max(0, ci - r);
      const i1 = Math.min(nav.nx - 1, ci + r);
      const j0 = Math.max(0, cj - r);
      const j1 = Math.min(nav.ny - 1, cj + r);
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          if (r > 0 && i > i0 && i < i1 && j > j0 && j < j1) continue;
          const idx = navGridIdx(i, j, nav.nx);
          if (!nav.valid[idx]) continue;
          const q = nav.points[idx];
          if (!segmentClearBoxes(point, q, obstacles)) continue;
          cands.push([idx, Math.hypot(q[0] - px, q[1] - py)]);
        }
      }
      if (cands.length >= maxNodes) break;
    }
    if (!cands.length) {
      for (let idx = 0; idx < nav.nodeCount; idx++) {
        if (!nav.valid[idx]) continue;
        const q = nav.points[idx];
        if (!segmentClearBoxes(point, q, obstacles)) continue;
        cands.push([idx, Math.hypot(q[0] - px, q[1] - py)]);
      }
    }
    cands.sort((a, b) => a[1] - b[1]);
    return cands.slice(0, maxNodes);
  }

  window.ParkingOptimizerNav = {
    recommendNavStep,
    buildNavigationGrid,
    nearestVisibleGridNodes,
    segmentClearBoxes,
  };
})();
