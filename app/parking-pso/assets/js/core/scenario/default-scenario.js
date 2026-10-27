(function () {
  "use strict";

  const N_PARTICLES_DEFAULT = 40;
  const N_ITER_DEFAULT = 600;
  const W_DEFAULT = 0.7;
  const C1_DEFAULT = 1.5;
  const C2_DEFAULT = 1.5;
  const V_MAX_DEFAULT = 0.25;
  const DEFAULT_ROAD_WIDTH = 6.0;

  const CONTENT_X0 = 23.25;
  const CONTENT_Y0 = 10.0;
  const CONTENT_SPAN_X = 93.5;
  const CONTENT_SPAN_Y = 80.0;
  const INNER_W = 84.0;
  const INNER_H = 64.0;
  const SLOT_Y0 = 24.0;
  const BUILDING_XS = [28.0, 56.0, 84.0, 112.0];
  const BUILDING_YS = [10.0, 90.0];
  const OBSTACLE_X0 = 64.0;
  const OBSTACLE_X1 = 76.0;
  const OBSTACLE_Y0 = 30.0;
  const OBSTACLE_Y1 = 70.0;

  function defaultScenario() {
    const lotW = 180.0;
    const lotH = 140.0;
    const offX = (lotW - CONTENT_SPAN_X) / 2 - CONTENT_X0;
    const offY = (lotH - CONTENT_SPAN_Y) / 2 - CONTENT_Y0;

    const inner = {
      x_min: (lotW - INNER_W) / 2,
      x_max: (lotW + INNER_W) / 2,
      y_min: (lotH - INNER_H) / 2,
      y_max: (lotH + INNER_H) / 2,
    };

    const nVeh = 12;
    const laneRows = Math.max(1, Math.ceil(nVeh / 2));
    const slots = Array.from({ length: nVeh }, (_, i) => {
      const row = Math.floor(i / 2);
      const t = laneRows <= 1 ? 0.5 : row / (laneRows - 1);
      return [
        CONTENT_X0 + offX + (i % 2) * CONTENT_SPAN_X,
        SLOT_Y0 + offY + t * 52,
        0,
      ];
    });

    const buildings = [];
    for (const y of BUILDING_YS) {
      for (const x of BUILDING_XS) {
        buildings.push([x + offX, y + offY]);
      }
    }

    const obstacle = {
      x_min: OBSTACLE_X0 + offX,
      x_max: OBSTACLE_X1 + offX,
      y_min: OBSTACLE_Y0 + offY,
      y_max: OBSTACLE_Y1 + offY,
    };

    return {
      lot: { width: lotW, height: lotH },
      entrance: [inner.x_min, inner.y_min],
      entrances: [
        [inner.x_min, inner.y_min],
        [inner.x_max, inner.y_max],
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
      obstacle,
      obstacles: [
        {
          points: [
            [obstacle.x_min, obstacle.y_min],
            [obstacle.x_max, obstacle.y_min],
            [obstacle.x_max, obstacle.y_max],
            [obstacle.x_min, obstacle.y_max],
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
