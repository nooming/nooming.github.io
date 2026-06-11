(function () {
  "use strict";

  const geometry = window.ParkingGeometry || null;
  const scenarioDefault = window.ParkingScenarioDefault || {};
  const roadModel = window.ParkingRoadModel || {};
  const roadSnap = window.ParkingRoad || {};

  const defaultScenario = scenarioDefault.defaultScenario || (() => ({}));
  const N_PARTICLES_DEFAULT = scenarioDefault.N_PARTICLES_DEFAULT || 40;
  const N_ITER_DEFAULT = scenarioDefault.N_ITER_DEFAULT || 600;
  const W_DEFAULT = scenarioDefault.W_DEFAULT || 0.7;
  const C1_DEFAULT = scenarioDefault.C1_DEFAULT || 1.5;
  const C2_DEFAULT = scenarioDefault.C2_DEFAULT || 1.5;
  const V_MAX_DEFAULT = scenarioDefault.V_MAX_DEFAULT || 0.25;

  const cloneJson = roadModel.cloneJson || ((v) => JSON.parse(JSON.stringify(v)));
  const normalizeRoad = roadModel.normalizeRoad || ((r) => r);
  const innerFromRoad = roadModel.innerFromRoad || (() => null);
  const snapPointToInnerPerimeter = roadSnap.snapPointToInnerPerimeter || ((x, y) => [x, y]);
  const snapSlotToRoad = roadSnap.snapSlotToRoad || ((x, y) => [x, y, 0]);
  const normalizeAngle = roadSnap.normalizeAngle || ((t) => t);

  function normalizeSlotEntry(rawSlot) {
    const x = Number(rawSlot?.[0]);
    const y = Number(rawSlot?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return [x, y, normalizeAngle(rawSlot?.[2] ?? 0)];
  }

  function polygonSelfIntersects(poly) {
    return geometry?.polygonSelfIntersects ? geometry.polygonSelfIntersects(poly) : false;
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

  function normalizeVehicleEntrances(s) {
    const nVeh = Math.max(0, parseInt(s.n_veh, 10) || 0);
    const nE = Array.isArray(s.entrances) && s.entrances.length ? s.entrances.length : 1;
    const raw = Array.isArray(s.vehicle_entrances) ? s.vehicle_entrances : [];
    const out = [];
    for (let i = 0; i < nVeh; i++) {
      const v = parseInt(i < raw.length ? raw[i] : 0, 10);
      out.push(Number.isFinite(v) ? Math.max(0, Math.min(nE - 1, v)) : 0);
    }
    s.vehicle_entrances = out;
    s.entrance_mode = String(s.entrance_mode || "auto").toLowerCase() === "fixed" ? "fixed" : "auto";
  }

  function normalizeSlotAndVehicleTypes(s) {
    const nSlot = Array.isArray(s.slots) ? s.slots.length : 0;
    const nVeh = Math.max(0, parseInt(s.n_veh, 10) || 0);
    const slotTypesRaw = Array.isArray(s.slot_types) ? s.slot_types : [];
    const reqRaw = Array.isArray(s.vehicle_requirements) ? s.vehicle_requirements : [];
    s.slot_types = Array.from({ length: nSlot }, (_, i) =>
      String(slotTypesRaw[i] || "normal").trim().toLowerCase() || "normal"
    );
    s.vehicle_requirements = Array.from({ length: nVeh }, (_, i) =>
      String(reqRaw[i] || "normal").trim().toLowerCase() || "normal"
    );
    const soft = s.soft_constraints || {};
    s.soft_constraints = {
      type_mismatch_penalty: Math.max(0, Number(soft.type_mismatch_penalty || 0)),
    };
  }

  function normalizeScenario(raw) {
    const s = cloneJson(raw || {});
    const def = defaultScenario();
    const lot = s.lot || {};
    const lw = Number(lot.width ?? 100);
    const lh = Number(lot.height ?? 100);
    s.lot = { width: lw, height: lh };
    s.entrance = Array.isArray(s.entrance)
      ? [Number(s.entrance[0] || 0), Number(s.entrance[1] || 0)]
      : cloneJson(def.entrance);
    s.inner = s.inner || cloneJson(def.inner);
    s.road = normalizeRoad(s.road, s.inner, () => def.road);
    s.inner = innerFromRoad(s.road) || cloneJson(def.inner);
    s.obstacle = s.obstacle || null;
    const rawEntrances = Array.isArray(s.entrances) && s.entrances.length ? s.entrances : [s.entrance];
    s.entrances = rawEntrances.map((p) => [Number(p?.[0] || 0), Number(p?.[1] || 0)]);
    const normalizeObstacle = (o) => {
      if (!o || typeof o !== "object") return null;
      let pts = [];
      if (Array.isArray(o.points) && o.points.length) {
        pts = o.points.map((p) => [Number(p?.[0]), Number(p?.[1])]);
      } else if (
        Number.isFinite(Number(o.x_min)) &&
        Number.isFinite(Number(o.x_max)) &&
        Number.isFinite(Number(o.y_min)) &&
        Number.isFinite(Number(o.y_max))
      ) {
        const x0 = Math.min(Number(o.x_min), Number(o.x_max));
        const x1 = Math.max(Number(o.x_min), Number(o.x_max));
        const y0 = Math.min(Number(o.y_min), Number(o.y_max));
        const y1 = Math.max(Number(o.y_min), Number(o.y_max));
        pts = [
          [x0, y0],
          [x1, y0],
          [x1, y1],
          [x0, y1],
        ];
      }
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const x = Number(pts[i]?.[0]);
        const y = Number(pts[i]?.[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        if (!out.length || Math.hypot(out[out.length - 1][0] - x, out[out.length - 1][1] - y) > 1e-6) {
          out.push([x, y]);
        }
      }
      if (out.length >= 2) {
        const f0 = out[0];
        const fn = out[out.length - 1];
        if (Math.hypot(f0[0] - fn[0], f0[1] - fn[1]) < 1e-6) out.pop();
      }
      if (out.length < 3) return null;
      if (polygonSelfIntersects(out)) return null;
      let area = 0;
      for (let i = 0; i < out.length; i++) {
        const a = out[i];
        const b = out[(i + 1) % out.length];
        area += a[0] * b[1] - b[0] * a[1];
      }
      if (Math.abs(area) < 0.1) return null;
      return { points: out };
    };
    const rawObstacles = Array.isArray(s.obstacles) && s.obstacles.length ? s.obstacles : [s.obstacle];
    s.obstacles = rawObstacles.map((o) => normalizeObstacle(o)).filter((o) => !!o);
    s.buildings = Array.isArray(s.buildings) ? s.buildings.map((p) => [Number(p[0]), Number(p[1])]) : [];
    s.slots = Array.isArray(s.slots)
      ? s.slots.map((p) => normalizeSlotEntry(p)).filter((p) => !!p)
      : [];
    s.constraints = {
      snap_slots_to_inner_road: true,
      snap_entrance_to_inner: true,
    };
    if (s.constraints.snap_entrance_to_inner) {
      s.entrances = s.entrances.map((p) =>
        snapPointToInnerPerimeter(Number(p[0]), Number(p[1]), s.road, lw, lh)
      );
    }
    s.entrance = s.entrances[0] || cloneJson(def.entrance);
    const p0 = s.obstacles[0]?.points || [];
    let xmin = Infinity;
    let xmax = -Infinity;
    let ymin = Infinity;
    let ymax = -Infinity;
    for (let i = 0; i < p0.length; i++) {
      xmin = Math.min(xmin, Number(p0[i][0]));
      xmax = Math.max(xmax, Number(p0[i][0]));
      ymin = Math.min(ymin, Number(p0[i][1]));
      ymax = Math.max(ymax, Number(p0[i][1]));
    }
    s.obstacle =
      Number.isFinite(xmin) && Number.isFinite(xmax) && Number.isFinite(ymin) && Number.isFinite(ymax)
        ? { x_min: xmin, x_max: xmax, y_min: ymin, y_max: ymax }
        : null;
    if (s.constraints.snap_slots_to_inner_road && s.slots.length) {
      s.slots = s.slots.map((p) => {
        const snapped = snapSlotToRoad(Number(p[0]), Number(p[1]), s.road, lw, lh);
        return [snapped[0], snapped[1], normalizeAngle(snapped[2] ?? p[2] ?? 0)];
      });
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
    const metersPerUnit = Number(disp.meters_per_unit ?? 2);
    s.display = {
      length_unit: String(disp.length_unit || "m"),
      time_unit: String(disp.time_unit || "s"),
      meters_per_unit: Number.isFinite(metersPerUnit) && metersPerUnit > 0 ? metersPerUnit : 2,
      scale_bar_m: Number(disp.scale_bar_m ?? 20),
      coord_note: String(disp.coord_note || "平面坐标 1 单位 = 2 m"),
    };
    normalizeVehicleDestinations(s);
    normalizeVehicleEntrances(s);
    normalizeSlotAndVehicleTypes(s);
    return s;
  }

  window.ParkingScenario = {
    defaultScenario,
    normalizeScenario,
    normalizeVehicleDestinations,
    normalizeVehicleEntrances,
    normalizeSlotEntry,
  };
})();
