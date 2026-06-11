(function () {
  "use strict";

  const N_PARTICLES_DEFAULT = 40;
  const N_ITER_DEFAULT = 600;
  const W_DEFAULT = 0.7;
  const C1_DEFAULT = 1.5;
  const C2_DEFAULT = 1.5;
  const V_MAX_DEFAULT = 0.25;
  const DEFAULT_ROAD_WIDTH = 6.0;

  function defaultScenario() {
    const lotW = 140.0;
    const lotH = 100.0;
    const nVeh = 12;
    const laneRows = Math.max(1, Math.ceil(nVeh / 2));
    const slots = Array.from({ length: nVeh }, (_, i) => {
      const row = Math.floor(i / 2);
      const t = laneRows <= 1 ? 0.5 : row / (laneRows - 1);
      return [23.25 + (i % 2) * 93.5, 24 + t * 52, 0];
    });
    const buildings = [
      [28.0, 90.0],
      [56.0, 90.0],
      [84.0, 90.0],
      [112.0, 90.0],
      [28.0, 10.0],
      [56.0, 10.0],
      [84.0, 10.0],
      [112.0, 10.0],
    ];
    const inner = { x_min: 28.0, x_max: 112.0, y_min: 18.0, y_max: 82.0 };
    return {
      lot: { width: lotW, height: lotH },
      entrance: [28.0, 18.0],
      entrances: [
        [28.0, 18.0],
        [112.0, 82.0],
      ],
      inner,
      road: {
        centerline: [
          [inner.x_min, inner.y_min],
          [inner.x_max, inner.y_min],
          [inner.x_max, inner.y_max],
          [inner.x_min, inner.y_max],
          [inner.x_min, inner.y_min],
        ],
        width: DEFAULT_ROAD_WIDTH,
        closed: true,
      },
      obstacle: { x_min: 64.0, x_max: 76.0, y_min: 30.0, y_max: 70.0 },
      obstacles: [
        {
          points: [
            [64.0, 30.0],
            [76.0, 30.0],
            [76.0, 70.0],
            [64.0, 70.0],
          ],
        },
      ],
      buildings,
      slots,
      n_veh: nVeh,
      vehicle_destinations: Array.from({ length: nVeh }, (_, i) => i % buildings.length),
      vehicle_entrances: Array.from({ length: nVeh }, (_, i) => (i < nVeh / 2 ? 0 : 1)),
      entrance_mode: "auto",
      pso: {
        n_particles: N_PARTICLES_DEFAULT,
        n_iter: N_ITER_DEFAULT,
        w: W_DEFAULT,
        c1: C1_DEFAULT,
        c2: C2_DEFAULT,
        v_max: V_MAX_DEFAULT,
      },
      constraints: { snap_slots_to_inner_road: true, snap_entrance_to_inner: true },
      slot_types: Array.from({ length: slots.length }, () => "normal"),
      vehicle_requirements: Array.from({ length: nVeh }, () => "normal"),
      soft_constraints: { type_mismatch_penalty: 0 },
      display: {
        length_unit: "m",
        time_unit: "s",
        meters_per_unit: 2,
        scale_bar_m: 20.0,
        coord_note: "平面坐标 1 单位 = 2 m",
      },
    };
  }

  window.ParkingScenarioDefault = {
    defaultScenario,
    N_PARTICLES_DEFAULT,
    N_ITER_DEFAULT,
    W_DEFAULT,
    C1_DEFAULT,
    C2_DEFAULT,
    V_MAX_DEFAULT,
    DEFAULT_ROAD_WIDTH,
  };
})();
