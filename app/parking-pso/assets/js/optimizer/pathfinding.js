(function () {
  "use strict";

  const nav = window.ParkingOptimizerNav || {};
  const segmentClearBoxes = nav.segmentClearBoxes || (() => true);
  const buildNavigationGrid = nav.buildNavigationGrid;
  const recommendNavStep = nav.recommendNavStep;
  const nearestVisibleGridNodes = nav.nearestVisibleGridNodes;

  const BUILDING_FOOTPRINT_W = 18.0;
  const BUILDING_FOOTPRINT_H = 12.0;
  const UNREACHABLE_WALK_DIST = 1e6;

  function buildingAxisBox(cx, cy) {
    const hw = BUILDING_FOOTPRINT_W / 2;
    const hh = BUILDING_FOOTPRINT_H / 2;
    return [
      [cx - hw, cy - hh],
      [cx + hw, cy - hh],
      [cx + hw, cy + hh],
      [cx - hw, cy + hh],
    ];
  }

  function walkBlockingBoxes(obstacles, buildingsPos, destBi) {
    const boxes = (Array.isArray(obstacles) ? obstacles : [])
      .map((o) =>
        Array.isArray(o?.points) ? o.points.map((p) => [Number(p[0]), Number(p[1])]) : null
      )
      .filter((o) => Array.isArray(o) && o.length >= 3);
    for (let i = 0; i < buildingsPos.length; i++) {
      if (i === destBi) continue;
      boxes.push(buildingAxisBox(buildingsPos[i][0], buildingsPos[i][1]));
    }
    return boxes;
  }

  function polylineLength(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return d;
  }

  function polylineSegmentsClear(pts, boxes) {
    for (let i = 1; i < pts.length; i++) {
      if (!segmentClearBoxes(pts[i - 1], pts[i], boxes)) return false;
    }
    return true;
  }

  function simplifyColinearPolyline(pts) {
    if (pts.length <= 2) return pts.slice();
    const out = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = out[out.length - 1];
      const b = pts[i];
      const c = pts[i + 1];
      const v1x = b[0] - a[0];
      const v1y = b[1] - a[1];
      const v2x = c[0] - b[0];
      const v2y = c[1] - b[1];
      const cross = v1x * v2y - v1y * v2x;
      if (Math.abs(cross) > 1e-5) out.push(b);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function minHeapPush(heap, item) {
    heap.push(item);
    let i = heap.length - 1;
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  }

  function minHeapPop(heap) {
    if (!heap.length) return null;
    const top = heap[0];
    const tail = heap.pop();
    if (heap.length) {
      heap[0] = tail;
      let i = 0;
      while (true) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  }

  function aStarBetweenNodes(startIdx, goalIdx, grid) {
    if (startIdx === goalIdx) return [0, [startIdx]];
    const n = grid.nodeCount;
    const g = Array.from({ length: n }, () => Infinity);
    const f = Array.from({ length: n }, () => Infinity);
    const parent = Array.from({ length: n }, () => -1);
    const closed = new Uint8Array(n);
    const goalPt = grid.points[goalIdx];
    g[startIdx] = 0;
    f[startIdx] = Math.hypot(
      grid.points[startIdx][0] - goalPt[0],
      grid.points[startIdx][1] - goalPt[1]
    );
    const heap = [];
    minHeapPush(heap, [f[startIdx], startIdx]);
    while (heap.length) {
      const cur = minHeapPop(heap);
      const u = cur[1];
      if (closed[u]) continue;
      closed[u] = 1;
      if (u === goalIdx) break;
      const nbrs = grid.adj[u];
      for (let i = 0; i < nbrs.length; i++) {
        const v = nbrs[i][0];
        const w = nbrs[i][1];
        if (closed[v]) continue;
        const ng = g[u] + w;
        if (ng >= g[v]) continue;
        g[v] = ng;
        parent[v] = u;
        f[v] = ng + Math.hypot(grid.points[v][0] - goalPt[0], grid.points[v][1] - goalPt[1]);
        minHeapPush(heap, [f[v], v]);
      }
    }
    if (!Number.isFinite(g[goalIdx])) return null;
    const seq = [];
    for (let cur = goalIdx; cur >= 0; cur = parent[cur]) {
      seq.push(cur);
      if (cur === startIdx) break;
    }
    seq.reverse();
    return [g[goalIdx], seq];
  }

  function simplifyPathWithCollision(path, obstacles) {
    if (!Array.isArray(path) || path.length <= 2) return path ? path.slice() : [];
    const out = [path[0]];
    let anchor = 0;
    while (anchor < path.length - 1) {
      let best = anchor + 1;
      for (let j = path.length - 1; j > anchor + 1; j--) {
        if (segmentClearBoxes(path[anchor], path[j], obstacles)) {
          best = j;
          break;
        }
      }
      out.push(path[best]);
      anchor = best;
    }
    return simplifyColinearPolyline(out);
  }

  function walkingPlan(slotXY, buildingXY, obstacles, buildingsPos, destBi, boxesInput, navInput, lotInput) {
    const boxes = boxesInput || walkBlockingBoxes(obstacles, buildingsPos, destBi);
    const s = [Number(slotXY[0]), Number(slotXY[1])];
    const t = [Number(buildingXY[0]), Number(buildingXY[1])];
    if (segmentClearBoxes(s, t, boxes)) return [Math.hypot(s[0] - t[0], s[1] - t[1]), [s, t]];
    const lotW = Math.max(1, Number(lotInput?.width || 100));
    const lotH = Math.max(1, Number(lotInput?.height || 100));
    const grid =
      navInput || buildNavigationGrid(boxes, lotW, lotH, recommendNavStep(lotW, lotH, boxes.length));
    const sNodes = nearestVisibleGridNodes(s, grid, boxes, 6, 7);
    const tNodes = nearestVisibleGridNodes(t, grid, boxes, 6, 7);
    if (!sNodes.length || !tNodes.length) return [UNREACHABLE_WALK_DIST, [s]];
    let bestDist = Infinity;
    let bestPath = null;
    for (let i = 0; i < sNodes.length; i++) {
      const [si, ds] = sNodes[i];
      for (let j = 0; j < tNodes.length; j++) {
        const [ti, dt] = tNodes[j];
        const ast = aStarBetweenNodes(si, ti, grid);
        if (!ast) continue;
        const [dgrid, idxSeq] = ast;
        const pts = [s, ...idxSeq.map((idx) => grid.points[idx]), t];
        const simp = simplifyPathWithCollision(pts, boxes);
        if (!polylineSegmentsClear(simp, boxes)) continue;
        const d = ds + dgrid + dt;
        if (d < bestDist) {
          bestDist = d;
          bestPath = simp;
        }
      }
    }
    if (!bestPath) return [UNREACHABLE_WALK_DIST, [s]];
    return [polylineLength(bestPath), bestPath];
  }

  window.ParkingOptimizerNav = {
    ...nav,
    UNREACHABLE_WALK_DIST,
    walkBlockingBoxes,
    recommendNavStep,
    buildNavigationGrid,
    walkingPlan,
    segmentClearBoxes,
    polylineLength,
  };
})();
