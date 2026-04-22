(function () {
  "use strict";

  const N_PARTICLES_DEFAULT = 40;
  const N_ITER_DEFAULT = 600;
  const W_DEFAULT = 0.7;
  const C1_DEFAULT = 1.5;
  const C2_DEFAULT = 1.5;
  const V_MAX_DEFAULT = 0.25;

  const SLOT_SNAP_MARGIN = 0.45;
  const SLOT_ROAD_INSET = 2.55;
  const SLOT_HALF_BERTH_W = 1.25;
  const BUILDING_FOOTPRINT_W = 11.0;
  const BUILDING_FOOTPRINT_H = 7.0;

  const RESULT_KEYS = [
    "scenario",
    "gbest_value",
    "history_best",
    "assign",
    "veh_targets",
    "paths",
    "road_segments",
    "optimizer",
  ];

  function cloneJson(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function defaultScenario() {
    const lotW = 100.0;
    const lotH = 100.0;
    const inner = {
      x_min: 22.0,
      x_max: 78.0,
      y_min: 18.0,
      y_max: 82.0,
    };
    const slots = [
      [24.55, 21.03],
      [75.45, 21.03],
      [24.55, 32.62],
      [75.45, 32.62],
      [24.55, 44.21],
      [75.45, 44.21],
      [24.55, 55.79],
      [75.45, 55.79],
      [24.55, 67.38],
      [75.45, 67.38],
      [24.55, 78.97],
      [75.45, 78.97],
    ];
    const buildings = [
      [26.0, 90.0],
      [50.0, 90.0],
      [74.0, 90.0],
      [50.0, 10.0],
      [74.0, 10.0],
      [10.0, 26.0],
      [10.0, 50.0],
      [10.0, 74.0],
      [90.0, 26.0],
      [90.0, 50.0],
      [90.0, 74.0],
    ];
    const nVeh = 12;
    return {
      lot: { width: lotW, height: lotH },
      entrance: [22.0, 18.0],
      inner,
      obstacle: {
        x_min: 44.0,
        x_max: 56.0,
        y_min: 30.0,
        y_max: 70.0,
      },
      buildings,
      slots,
      n_veh: nVeh,
      vehicle_destinations: Array.from({ length: nVeh }, (_, i) => i % buildings.length),
      pso: {
        n_particles: N_PARTICLES_DEFAULT,
        n_iter: N_ITER_DEFAULT,
        w: W_DEFAULT,
        c1: C1_DEFAULT,
        c2: C2_DEFAULT,
        v_max: V_MAX_DEFAULT,
      },
      constraints: {
        snap_slots_to_inner_road: true,
        snap_entrance_to_inner: true,
      },
      display: {
        length_unit: "m",
        time_unit: "s",
        scale_bar_m: 20.0,
        coord_note: "平面坐标 1 单位 = 1 m",
      },
    };
  }

  function closestPointOnSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    if (l2 < 1e-18) return [x1, y1];
    let t = ((px - x1) * dx + (py - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    return [x1 + t * dx, y1 + t * dy];
  }

  function snapPointToInnerPerimeter(x, y, inner, lotW, lotH) {
    const ix0 = Number(inner.x_min);
    const ix1 = Number(inner.x_max);
    const iy0 = Number(inner.y_min);
    const iy1 = Number(inner.y_max);
    const strips = [
      [ix0, iy0, ix1, iy0],
      [ix1, iy0, ix1, iy1],
      [ix1, iy1, ix0, iy1],
      [ix0, iy1, ix0, iy0],
    ];
    let bestX = x;
    let bestY = y;
    let bestD = 1e30;
    strips.forEach(([x0, y0, x1, y1]) => {
      const [qx, qy] = closestPointOnSegment(x, y, x0, y0, x1, y1);
      const d = (x - qx) ** 2 + (y - qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = qx;
        bestY = qy;
      }
    });
    return [Math.max(0, Math.min(lotW, bestX)), Math.max(0, Math.min(lotH, bestY))];
  }

  function snapSlotToRoad(x, y, inner, lotW, lotH, margin = SLOT_SNAP_MARGIN) {
    const xm = Number(inner.x_min);
    const xM = Number(inner.x_max);
    const ym = Number(inner.y_min);
    const yM = Number(inner.y_max);
    const iw = xM - xm;
    const ih = yM - ym;
    if (iw < 2 * margin + 0.2 || ih < 2 * margin + 0.2) {
      return [Math.max(0, Math.min(lotW, x)), Math.max(0, Math.min(lotH, y))];
    }
    const insetEW = Math.max(0.4, Math.min(SLOT_ROAD_INSET, iw / 2 - margin - 0.1));
    const insetNS = Math.max(0.4, Math.min(SLOT_HALF_BERTH_W + margin, ih / 2 - margin - 0.1));
    const strips = [
      [xm + margin, ym + insetNS, xM - margin, ym + insetNS],
      [xm + margin, yM - insetNS, xM - margin, yM - insetNS],
      [xm + insetEW, ym + margin, xm + insetEW, yM - margin],
      [xM - insetEW, ym + margin, xM - insetEW, yM - margin],
    ];
    let bestX = x;
    let bestY = y;
    let bestD = 1e30;
    strips.forEach(([x0, y0, x1, y1]) => {
      const [qx, qy] = closestPointOnSegment(x, y, x0, y0, x1, y1);
      const d = (x - qx) ** 2 + (y - qy) ** 2;
      if (d < bestD) {
        bestD = d;
        bestX = qx;
        bestY = qy;
      }
    });
    return [Math.max(0, Math.min(lotW, bestX)), Math.max(0, Math.min(lotH, bestY))];
  }

  function normalizeVehicleDestinations(s) {
    const nB = Array.isArray(s.buildings) ? s.buildings.length : 0;
    const nVeh = Math.max(0, parseInt(s.n_veh, 10) || 0);
    if (nB <= 0 || nVeh <= 0) {
      s.vehicle_destinations = [];
      return;
    }
    const raw = Array.isArray(s.vehicle_destinations) ? s.vehicle_destinations : [];
    const out = [];
    for (let i = 0; i < nVeh; i++) {
      const v = parseInt(i < raw.length ? raw[i] : i % nB, 10);
      const bi = Number.isFinite(v) ? v : i % nB;
      out.push(Math.max(0, Math.min(nB - 1, bi)));
    }
    s.vehicle_destinations = out;
  }

  function normalizeScenario(raw) {
    const s = cloneJson(raw || {});
    const def = defaultScenario();
    const lot = s.lot || {};
    const lw = Number(lot.width ?? 100);
    const lh = Number(lot.height ?? 100);
    s.lot = { width: lw, height: lh };
    s.entrance = Array.isArray(s.entrance) ? [Number(s.entrance[0] || 0), Number(s.entrance[1] || 0)] : cloneJson(def.entrance);
    s.inner = s.inner || cloneJson(def.inner);
    s.obstacle = s.obstacle || cloneJson(def.obstacle);
    s.buildings = Array.isArray(s.buildings) ? s.buildings.map((p) => [Number(p[0]), Number(p[1])]) : [];
    s.slots = Array.isArray(s.slots) ? s.slots.map((p) => [Number(p[0]), Number(p[1])]) : [];
    s.constraints = {
      snap_slots_to_inner_road: true,
      snap_entrance_to_inner: true,
    };
    if (s.constraints.snap_entrance_to_inner) {
      s.entrance = snapPointToInnerPerimeter(Number(s.entrance[0]), Number(s.entrance[1]), s.inner, lw, lh);
    }
    if (s.constraints.snap_slots_to_inner_road && s.slots.length) {
      s.slots = s.slots.map((p) => snapSlotToRoad(Number(p[0]), Number(p[1]), s.inner, lw, lh));
    }
    const nVehRaw = parseInt(s.n_veh, 10) || 12;
    if (s.slots.length === 0) s.n_veh = 0;
    else s.n_veh = Math.max(1, Math.min(nVehRaw, s.slots.length));
    const pso = s.pso || {};
    s.pso = {
      n_particles: parseInt(pso.n_particles, 10) || N_PARTICLES_DEFAULT,
      n_iter: parseInt(pso.n_iter, 10) || N_ITER_DEFAULT,
      w: Number(pso.w ?? W_DEFAULT),
      c1: Number(pso.c1 ?? C1_DEFAULT),
      c2: Number(pso.c2 ?? C2_DEFAULT),
      v_max: Number(pso.v_max ?? V_MAX_DEFAULT),
    };
    const disp = s.display || {};
    s.display = {
      length_unit: String(disp.length_unit || "m"),
      time_unit: String(disp.time_unit || "s"),
      scale_bar_m: Number(disp.scale_bar_m ?? 20),
      coord_note: String(disp.coord_note || "平面坐标 1 单位 = 1 m"),
    };
    normalizeVehicleDestinations(s);
    return s;
  }

  function segSegIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const o1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const o2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const o3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const o4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    if (o1 * o2 < 0 && o3 * o4 < 0) return true;
    const tol = 1e-9;
    const onSeg = (x, y, x1, y1, x2, y2) =>
      x >= Math.min(x1, x2) - tol &&
      x <= Math.max(x1, x2) + tol &&
      y >= Math.min(y1, y2) - tol &&
      y <= Math.max(y1, y2) + tol;
    if (Math.abs(o1) <= tol && onSeg(cx, cy, ax, ay, bx, by)) return true;
    if (Math.abs(o2) <= tol && onSeg(dx, dy, ax, ay, bx, by)) return true;
    if (Math.abs(o3) <= tol && onSeg(ax, ay, cx, cy, dx, dy)) return true;
    if (Math.abs(o4) <= tol && onSeg(bx, by, cx, cy, dx, dy)) return true;
    return false;
  }

  function segmentIntersectsAxisRect(p1, p2, rect) {
    const eps = 1e-3;
    const xMin = Number(rect.x_min) + eps;
    const xMax = Number(rect.x_max) - eps;
    const yMin = Number(rect.y_min) + eps;
    const yMax = Number(rect.y_max) - eps;
    if (xMin >= xMax || yMin >= yMax) return false;
    const [p1x, p1y] = p1;
    const [p2x, p2y] = p2;
    const edges = [
      [xMin, yMin, xMax, yMin],
      [xMax, yMin, xMax, yMax],
      [xMax, yMax, xMin, yMax],
      [xMin, yMax, xMin, yMin],
    ];
    for (const [x0, y0, x1, y1] of edges) {
      if (segSegIntersect(p1x, p1y, p2x, p2y, x0, y0, x1, y1)) return true;
    }
    const midx = 0.5 * (p1x + p2x);
    const midy = 0.5 * (p1y + p2y);
    return midx > xMin && midx < xMax && midy > yMin && midy < yMax;
  }

  function segmentClearBoxes(p1, p2, boxes) {
    for (let i = 0; i < boxes.length; i++) {
      if (segmentIntersectsAxisRect(p1, p2, boxes[i])) return false;
    }
    return true;
  }

  function buildingAxisBox(cx, cy) {
    const hw = BUILDING_FOOTPRINT_W / 2;
    const hh = BUILDING_FOOTPRINT_H / 2;
    return { x_min: cx - hw, x_max: cx + hw, y_min: cy - hh, y_max: cy + hh };
  }

  function walkBlockingBoxes(obs, buildingsPos, destBi) {
    const boxes = [obs];
    for (let i = 0; i < buildingsPos.length; i++) {
      if (i === destBi) continue;
      boxes.push(buildingAxisBox(buildingsPos[i][0], buildingsPos[i][1]));
    }
    return boxes;
  }

  function pointInsideRect(p, r, eps = 1e-2) {
    return (
      p[0] > Number(r.x_min) + eps &&
      p[0] < Number(r.x_max) - eps &&
      p[1] > Number(r.y_min) + eps &&
      p[1] < Number(r.y_max) - eps
    );
  }

  function dedupValidCorners(boxes) {
    const seen = new Set();
    const out = [];
    boxes.forEach((b) => {
      const corners = [
        [Number(b.x_min), Number(b.y_min)],
        [Number(b.x_min), Number(b.y_max)],
        [Number(b.x_max), Number(b.y_min)],
        [Number(b.x_max), Number(b.y_max)],
      ];
      corners.forEach((c) => {
        const key = `${Math.round(c[0] * 1000) / 1000},${Math.round(c[1] * 1000) / 1000}`;
        if (seen.has(key)) return;
        seen.add(key);
        for (let i = 0; i < boxes.length; i++) {
          if (pointInsideRect(c, boxes[i])) return;
        }
        out.push(c);
      });
    });
    return out;
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

  function visibilityGraphShortestPath(s, t, boxes) {
    const corners = dedupValidCorners(boxes);
    const nodes = [s.slice(), ...corners.map((c) => c.slice()), t.slice()];
    const n = nodes.length;
    const goal = n - 1;
    const adj = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (segmentClearBoxes(nodes[i], nodes[j], boxes)) {
          const w = Math.hypot(nodes[i][0] - nodes[j][0], nodes[i][1] - nodes[j][1]);
          adj[i].push([j, w]);
          adj[j].push([i, w]);
        }
      }
    }
    const dist = Array.from({ length: n }, () => Infinity);
    const parent = Array.from({ length: n }, () => -1);
    const used = Array.from({ length: n }, () => false);
    dist[0] = 0;
    for (let step = 0; step < n; step++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!used[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u < 0 || u === goal) break;
      used[u] = true;
      for (let i = 0; i < adj[u].length; i++) {
        const [v, w] = adj[u][i];
        const nd = dist[u] + w;
        if (nd < dist[v]) {
          dist[v] = nd;
          parent[v] = u;
        }
      }
    }
    if (!Number.isFinite(dist[goal])) return null;
    const seq = [];
    for (let cur = goal; cur >= 0; cur = parent[cur]) {
      seq.push(cur);
      if (cur === 0) break;
    }
    seq.reverse();
    const raw = seq.map((i) => nodes[i]);
    const simp = simplifyColinearPolyline(raw);
    return [polylineLength(simp), simp];
  }

  function walkingPlan(slotXY, buildingXY, obs, buildingsPos, destBi, boxesInput) {
    const boxes = boxesInput || walkBlockingBoxes(obs, buildingsPos, destBi);
    const s = [Number(slotXY[0]), Number(slotXY[1])];
    const t = [Number(buildingXY[0]), Number(buildingXY[1])];
    if (segmentClearBoxes(s, t, boxes)) return [Math.hypot(s[0] - t[0], s[1] - t[1]), [s, t]];
    const vg = visibilityGraphShortestPath(s, t, boxes);
    if (vg) return vg;
    const margin = 0.5;
    const xLeft = Number(obs.x_min) - margin;
    const xRight = Number(obs.x_max) + margin;
    const sidePolylines = (xSide) => {
      const slotY = s[1];
      const by = t[1];
      const out = [];
      if (by <= Number(obs.y_min) - margin || by >= Number(obs.y_max) + margin) {
        const pts = [s, [xSide, slotY], [xSide, by], t];
        if (polylineSegmentsClear(pts, boxes)) out.push(pts);
        return out;
      }
      const yUp = Number(obs.y_max) + margin;
      const yDown = Number(obs.y_min) - margin;
      const up = [s, [xSide, slotY], [xSide, yUp], [t[0], yUp], t];
      const down = [s, [xSide, slotY], [xSide, yDown], [t[0], yDown], t];
      if (polylineSegmentsClear(up, boxes)) out.push(up);
      if (polylineSegmentsClear(down, boxes)) out.push(down);
      return out;
    };
    const cands = [...sidePolylines(xLeft), ...sidePolylines(xRight)];
    if (cands.length) {
      let best = cands[0];
      let bestLen = polylineLength(best);
      for (let i = 1; i < cands.length; i++) {
        const len = polylineLength(cands[i]);
        if (len < bestLen) {
          bestLen = len;
          best = cands[i];
        }
      }
      return [bestLen, best];
    }
    return [Math.hypot(s[0] - t[0], s[1] - t[1]), [s, t]];
  }

  function buildRoadSegments(inner) {
    const ix0 = Number(inner.x_min);
    const ix1 = Number(inner.x_max);
    const iy0 = Number(inner.y_min);
    const iy1 = Number(inner.y_max);
    return [
      [[ix0, iy0], [ix1, iy0]],
      [[ix1, iy0], [ix1, iy1]],
      [[ix1, iy1], [ix0, iy1]],
      [[ix0, iy1], [ix0, iy0]],
    ];
  }

  function arcLengthFromBLCCW(px, py, inner) {
    const ix0 = Number(inner.x_min);
    const ix1 = Number(inner.x_max);
    const iy0 = Number(inner.y_min);
    const iy1 = Number(inner.y_max);
    const w = ix1 - ix0;
    const h = iy1 - iy0;
    const L = 2 * w + 2 * h;
    if (L < 1e-9) return 0;
    const tol = 0.04;
    if (Math.abs(py - iy0) <= tol && px >= ix0 - tol && px <= ix1 + tol) return Math.max(0, Math.min(w, px - ix0));
    if (Math.abs(px - ix1) <= tol && py >= iy0 - tol && py <= iy1 + tol) return w + Math.max(0, Math.min(h, py - iy0));
    if (Math.abs(py - iy1) <= tol && px >= ix0 - tol && px <= ix1 + tol) return w + h + Math.max(0, Math.min(w, ix1 - px));
    if (Math.abs(px - ix0) <= tol && py >= iy0 - tol && py <= iy1 + tol) return w + h + w + Math.max(0, Math.min(h, iy1 - py));
    const [qx, qy] = snapPointToInnerPerimeter(px, py, inner, 1e9, 1e9);
    return arcLengthFromBLCCW(qx, qy, inner);
  }

  function perimeterDistanceBetween(ax, ay, bx, by, inner) {
    const [qax, qay] = snapPointToInnerPerimeter(ax, ay, inner, 1e9, 1e9);
    const [qbx, qby] = snapPointToInnerPerimeter(bx, by, inner, 1e9, 1e9);
    const ix0 = Number(inner.x_min);
    const ix1 = Number(inner.x_max);
    const iy0 = Number(inner.y_min);
    const iy1 = Number(inner.y_max);
    const L = 2 * (ix1 - ix0) + 2 * (iy1 - iy0);
    if (L < 1e-9) return 0;
    const s1 = arcLengthFromBLCCW(qax, qay, inner);
    const s2 = arcLengthFromBLCCW(qbx, qby, inner);
    const d = Math.abs(s1 - s2);
    return Math.min(d, L - d);
  }

  function drivingDistanceFromEntrance(slotXY, inner, entrance) {
    const ix0 = Number(inner.x_min);
    const ix1 = Number(inner.x_max);
    const iy0 = Number(inner.y_min);
    const iy1 = Number(inner.y_max);
    const ex = Number(entrance[0]);
    const ey = Number(entrance[1]);
    const sx = Number(slotXY[0]);
    const sy = Number(slotXY[1]);
    const midX = (ix0 + ix1) / 2;
    const syc = Math.min(Math.max(sy, iy0), iy1);
    if (sx < midX) return perimeterDistanceBetween(ex, ey, ix0, syc, inner) + Math.abs(sx - ix0);
    return perimeterDistanceBetween(ex, ey, ix1, syc, inner) + Math.abs(ix1 - sx);
  }

  function precomputeFromNormalized(s) {
    const inner = s.inner;
    const obs = s.obstacle;
    const slotsPos = s.slots.map((p) => [Number(p[0]), Number(p[1])]);
    const buildingsPos = s.buildings.map((p) => [Number(p[0]), Number(p[1])]);
    const nSlot = slotsPos.length;
    const nB = buildingsPos.length;
    const entrance = [Number(s.entrance[0]), Number(s.entrance[1])];
    if (!nSlot || !nB) return { driveDist: [], walkMat: [], boxesByBi: [], slotsPos, buildingsPos, nSlot, nB };
    const driveDist = slotsPos.map((slot) => drivingDistanceFromEntrance(slot, inner, entrance));
    const boxesByBi = Array.from({ length: nB }, (_, bi) => walkBlockingBoxes(obs, buildingsPos, bi));
    const walkMat = Array.from({ length: nSlot }, () => Array.from({ length: nB }, () => 0));
    for (let si = 0; si < nSlot; si++) {
      for (let bi = 0; bi < nB; bi++) {
        walkMat[si][bi] = walkingPlan(slotsPos[si], buildingsPos[bi], obs, buildingsPos, bi, boxesByBi[bi])[0];
      }
    }
    return { driveDist, walkMat, boxesByBi, slotsPos, buildingsPos, nSlot, nB };
  }

  function decodeParticle(position, nVeh, nSlot) {
    const order = position
      .map((v, idx) => [v, idx])
      .sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]))
      .map((x) => x[1]);
    const assign = Array.from({ length: nVeh }, () => 0);
    for (let k = 0; k < nVeh; k++) {
      const vehIdx = order[k];
      assign[vehIdx] = k;
    }
    return assign;
  }

  function hungarianRect(cost) {
    const n = cost.length;
    const m = cost[0].length;
    const u = Array(n + 1).fill(0);
    const v = Array(m + 1).fill(0);
    const p = Array(m + 1).fill(0);
    const way = Array(m + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = Array(m + 1).fill(Infinity);
      const used = Array(m + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = Infinity;
        let j1 = 0;
        for (let j = 1; j <= m; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
        for (let j = 0; j <= m; j++) {
          if (used[j]) {
            u[p[j]] += delta;
            v[j] -= delta;
          } else {
            minv[j] -= delta;
          }
        }
        j0 = j1;
      } while (p[j0] !== 0);
      do {
        const j1 = way[j0];
        p[j0] = p[j1];
        j0 = j1;
      } while (j0 !== 0);
    }
    const colForRow = Array(n).fill(-1);
    for (let j = 1; j <= m; j++) {
      if (p[j] > 0) colForRow[p[j] - 1] = j - 1;
    }
    return colForRow;
  }

  function makeRng(seed) {
    if (seed === null || seed === undefined || Number.isNaN(Number(seed))) {
      return { random: () => Math.random() };
    }
    let t = (Number(seed) >>> 0) || 1;
    return {
      random: () => {
        t += 0x6d2b79f5;
        let z = t;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
      },
    };
  }

  function gaussian(rng) {
    const u1 = Math.max(1e-12, rng.random());
    const u2 = rng.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function packResult(s, opts) {
    const paths = [];
    for (let i = 0; i < opts.bestAssign.length; i++) {
      const ti = opts.vehTargets[i];
      const slotXY = opts.slotsPos[opts.bestAssign[i]];
      const bxy = opts.buildingsPos[ti];
      const poly = walkingPlan(slotXY, bxy, opts.obs, opts.buildingsPos, ti, opts.boxesByBi[ti])[1];
      paths.push(poly.map((p) => [Number(p[0]), Number(p[1])]));
    }
    return {
      scenario: s,
      gbest_value: Number(opts.gbestValue),
      history_best: opts.historyBest.map((v) => Number(v)),
      assign: opts.bestAssign.map((v) => Number(v)),
      veh_targets: opts.vehTargets.map((v) => Number(v)),
      paths,
      road_segments: buildRoadSegments(opts.inner).map((seg) => [
        [Number(seg[0][0]), Number(seg[0][1])],
        [Number(seg[1][0]), Number(seg[1][1])],
      ]),
      optimizer: opts.optimizer,
    };
  }

  function runOptimize(scenarioInput, options) {
    const methodRaw = String((options && options.method) || "exact").trim().toLowerCase();
    const method = methodRaw === "pso" ? "pso" : "exact";
    const seed = options && Object.prototype.hasOwnProperty.call(options, "seed") ? options.seed : null;
    const s = normalizeScenario(scenarioInput);
    const inner = s.inner;
    const obs = s.obstacle;
    const prep = precomputeFromNormalized(s);
    const nSlot = prep.nSlot;
    const nB = prep.nB;
    const err = {
      error: "需要至少一个车位、一栋楼，且车辆数大于 0。",
      scenario: s,
      gbest_value: null,
      history_best: [],
      assign: [],
      veh_targets: [],
      paths: [],
      road_segments: [],
      optimizer: method,
    };
    if (!nSlot || !nB || !s.n_veh) return err;
    const nVeh = Math.min(Number(s.n_veh), nSlot);
    s.n_veh = nVeh;
    normalizeVehicleDestinations(s);
    const vehTargets = s.vehicle_destinations.slice(0, nVeh);
    const vCar = 10.0;
    const vWalk = 1.5;

    if (method === "exact") {
      const cost = Array.from({ length: nVeh }, (_, i) =>
        Array.from({ length: nSlot }, (_, j) => prep.driveDist[j] / vCar + prep.walkMat[j][vehTargets[i]] / vWalk)
      );
      const bestAssign = hungarianRect(cost);
      let gbestValue = 0;
      for (let i = 0; i < nVeh; i++) gbestValue += cost[i][bestAssign[i]];
      return packResult(s, {
        gbestValue,
        historyBest: [gbestValue],
        bestAssign,
        slotsPos: prep.slotsPos,
        buildingsPos: prep.buildingsPos,
        obs,
        vehTargets,
        boxesByBi: prep.boxesByBi,
        inner,
        optimizer: "exact",
      });
    }

    const rng = makeRng(seed);
    const pso = s.pso || {};
    const nParticles = Math.max(2, Number(pso.n_particles) || N_PARTICLES_DEFAULT);
    const nIter = Math.max(1, Number(pso.n_iter) || N_ITER_DEFAULT);
    const w = Number(pso.w ?? W_DEFAULT);
    const c1 = Number(pso.c1 ?? C1_DEFAULT);
    const c2 = Number(pso.c2 ?? C2_DEFAULT);
    const vMax = Number(pso.v_max ?? V_MAX_DEFAULT);

    function objective(position) {
      const assign = decodeParticle(position, nVeh, nSlot);
      let driveTotal = 0;
      let walkTotal = 0;
      for (let i = 0; i < nVeh; i++) {
        const slotIndex = assign[i];
        driveTotal += prep.driveDist[slotIndex] / vCar;
        walkTotal += prep.walkMat[slotIndex][vehTargets[i]] / vWalk;
      }
      return driveTotal + walkTotal;
    }

    const positions = Array.from({ length: nParticles }, () =>
      Array.from({ length: nVeh }, () => rng.random())
    );
    const velocities = Array.from({ length: nParticles }, () =>
      Array.from({ length: nVeh }, () => gaussian(rng) * 0.1)
    );
    const pbestPositions = positions.map((p) => p.slice());
    const pbestValues = positions.map((p) => objective(p));
    let gbestIdx = 0;
    for (let i = 1; i < nParticles; i++) {
      if (pbestValues[i] < pbestValues[gbestIdx]) gbestIdx = i;
    }
    let gbestPosition = pbestPositions[gbestIdx].slice();
    let gbestValue = pbestValues[gbestIdx];
    const historyBest = [gbestValue];

    for (let it = 0; it < nIter; it++) {
      for (let i = 0; i < nParticles; i++) {
        for (let d = 0; d < nVeh; d++) {
          const r1 = rng.random();
          const r2 = rng.random();
          velocities[i][d] =
            w * velocities[i][d] +
            c1 * r1 * (pbestPositions[i][d] - positions[i][d]) +
            c2 * r2 * (gbestPosition[d] - positions[i][d]);
          velocities[i][d] = Math.max(-vMax, Math.min(vMax, velocities[i][d]));
          positions[i][d] = Math.max(0, Math.min(1, positions[i][d] + velocities[i][d]));
        }
        const val = objective(positions[i]);
        if (val < pbestValues[i]) {
          pbestValues[i] = val;
          pbestPositions[i] = positions[i].slice();
        }
      }
      gbestIdx = 0;
      for (let i = 1; i < nParticles; i++) {
        if (pbestValues[i] < pbestValues[gbestIdx]) gbestIdx = i;
      }
      if (pbestValues[gbestIdx] < gbestValue) {
        gbestValue = pbestValues[gbestIdx];
        gbestPosition = pbestPositions[gbestIdx].slice();
      }
      historyBest.push(gbestValue);
    }

    const bestAssign = decodeParticle(gbestPosition, nVeh, nSlot);
    return packResult(s, {
      gbestValue,
      historyBest,
      bestAssign,
      slotsPos: prep.slotsPos,
      buildingsPos: prep.buildingsPos,
      obs,
      vehTargets,
      boxesByBi: prep.boxesByBi,
      inner,
      optimizer: "pso",
    });
  }

  window.ParkingOptimizer = {
    RESULT_KEYS,
    defaultScenario,
    normalizeScenario,
    runOptimize,
  };
})();
