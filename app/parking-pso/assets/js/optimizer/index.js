(function () {
  "use strict";

  const coreConstants = window.ParkingCoreConstants || null;
  const scenarioModule = window.ParkingScenario || {};
  const costModule = window.ParkingOptimizerCost || {};
  const hungarianModule = window.ParkingOptimizerHungarian || {};
  const psoModule = window.ParkingOptimizerPso || {};
  const packModule = window.ParkingOptimizerPack || {};
  const roadModel = window.ParkingRoadModel || {};
  const scenarioDefault = window.ParkingScenarioDefault || {};

  const RESULT_KEYS = coreConstants?.RESULT_KEYS || [
    "scenario",
    "gbest_value",
    "history_best",
    "assign",
    "veh_targets",
    "veh_entrances",
    "vehicle_breakdown",
    "paths",
    "road_segments",
    "optimizer",
  ];

  const defaultScenario = scenarioModule.defaultScenario || (() => ({}));
  const normalizeScenario = scenarioModule.normalizeScenario || ((raw) => raw);
  const normalizeVehicleDestinations = scenarioModule.normalizeVehicleDestinations || (() => {});
  const precomputeFromNormalized = costModule.precomputeFromNormalized || (() => ({}));
  const vehicleSlotPenalty = costModule.vehicleSlotPenalty || (() => 0);
  const hungarianRect = hungarianModule.hungarianRect || (() => []);
  const decodeParticle = psoModule.decodeParticle || (() => []);
  const makeRng = psoModule.makeRng || (() => ({ random: Math.random }));
  const gaussian = psoModule.gaussian || (() => 0);
  const packResult = packModule.packResult || ((s, opts) => ({ scenario: s, ...opts }));
  const roadFromInner = roadModel.roadFromInner || (() => null);

  const N_PARTICLES_DEFAULT = scenarioDefault.N_PARTICLES_DEFAULT || 40;
  const N_ITER_DEFAULT = scenarioDefault.N_ITER_DEFAULT || 600;
  const W_DEFAULT = scenarioDefault.W_DEFAULT || 0.7;
  const C1_DEFAULT = scenarioDefault.C1_DEFAULT || 1.5;
  const C2_DEFAULT = scenarioDefault.C2_DEFAULT || 1.5;
  const V_MAX_DEFAULT = scenarioDefault.V_MAX_DEFAULT || 0.25;
  const DEFAULT_ROAD_WIDTH = scenarioDefault.DEFAULT_ROAD_WIDTH || 6.0;

  function runOptimize(scenarioInput, options) {
    const methodRaw = String((options && options.method) || "exact").trim().toLowerCase();
    const method = methodRaw === "pso" ? "pso" : "exact";
    const seed = options && Object.prototype.hasOwnProperty.call(options, "seed") ? options.seed : null;
    const s = normalizeScenario(scenarioInput);
    const road = s.road || roadFromInner(s.inner, DEFAULT_ROAD_WIDTH);
    const obstacles = s.obstacles;
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
    const vehEntrances = s.vehicle_entrances.slice(0, nVeh);
    const entranceMode = s.entrance_mode === "fixed" ? "fixed" : "auto";
    const entranceCount = prep.entrancesPos.length || 1;
    const vCar = 10.0;
    const vWalk = 1.5;

    function resolveDriveForVehicle(slotIndex, vehIdx) {
      if (entranceMode === "fixed") {
        const eiRaw = Number(vehEntrances[vehIdx]);
        const ei = Number.isFinite(eiRaw) ? Math.max(0, Math.min(entranceCount - 1, eiRaw)) : 0;
        return { driveTime: prep.driveDistByEntrance[slotIndex][ei] / vCar, entranceIndex: ei };
      }
      let bestEi = 0;
      let bestDrive = prep.driveDistByEntrance[slotIndex][0] / vCar;
      for (let ei = 1; ei < entranceCount; ei++) {
        const cur = prep.driveDistByEntrance[slotIndex][ei] / vCar;
        if (cur < bestDrive) {
          bestDrive = cur;
          bestEi = ei;
        }
      }
      return { driveTime: bestDrive, entranceIndex: bestEi };
    }

    function buildVehicleBreakdown(bestAssign) {
      const bestEntrances = [];
      const items = [];
      for (let i = 0; i < nVeh; i++) {
        const slotIndex = bestAssign[i];
        const drive = resolveDriveForVehicle(slotIndex, i);
        const walkTime = prep.walkMat[slotIndex][vehTargets[i]] / vWalk;
        const penalty = vehicleSlotPenalty(s, i, slotIndex);
        bestEntrances.push(drive.entranceIndex);
        items.push({
          vehicle_index: i,
          slot_index: slotIndex,
          destination_index: vehTargets[i],
          entrance_index: drive.entranceIndex,
          drive_time: drive.driveTime,
          walk_time: walkTime,
          penalty,
          total_time: drive.driveTime + walkTime + penalty,
        });
      }
      return { bestEntrances, items };
    }

    function runExactMethod() {
      const cost = Array.from({ length: nVeh }, (_, i) =>
        Array.from({ length: nSlot }, (_, j) => {
          const drive = resolveDriveForVehicle(j, i).driveTime;
          const walk = prep.walkMat[j][vehTargets[i]] / vWalk;
          const penalty = vehicleSlotPenalty(s, i, j);
          return drive + walk + penalty;
        })
      );
      const bestAssign = hungarianRect(cost);
      let gbestValue = 0;
      for (let i = 0; i < nVeh; i++) gbestValue += cost[i][bestAssign[i]];
      const breakdown = buildVehicleBreakdown(bestAssign);
      return packResult(s, {
        gbestValue,
        historyBest: [gbestValue],
        bestAssign,
        bestEntrances: breakdown.bestEntrances,
        vehicleBreakdown: breakdown.items,
        slotsPos: prep.slotsPos,
        buildingsPos: prep.buildingsPos,
        obstacles,
        vehTargets,
        boxesByBi: prep.boxesByBi,
        navByBi: prep.navByBi,
        lot: s.lot,
        road,
        optimizer: "exact",
      });
    }

    function runPsoMethod() {
      const rng = makeRng(seed);
      const pso = s.pso || {};
      const nParticles = Math.max(2, Number(pso.n_particles) || N_PARTICLES_DEFAULT);
      const nIter = Math.max(1, Number(pso.n_iter) || N_ITER_DEFAULT);
      const wMax = Number(pso.w ?? W_DEFAULT) > 0.5 ? Number(pso.w ?? W_DEFAULT) : 0.9;
      const wMin = 0.4;
      const c1 = Number(pso.c1 ?? C1_DEFAULT);
      const c2 = Number(pso.c2 ?? C2_DEFAULT);
      const vMax = Number(pso.v_max ?? V_MAX_DEFAULT);
      const EARLY_STOP_PATIENCE = Math.max(80, Math.round(nIter * 0.2));

      function objective(position) {
        const assign = decodeParticle(position, nVeh, nSlot);
        let driveTotal = 0;
        let walkTotal = 0;
        for (let i = 0; i < nVeh; i++) {
          const slotIndex = assign[i];
          driveTotal += resolveDriveForVehicle(slotIndex, i).driveTime;
          walkTotal += prep.walkMat[slotIndex][vehTargets[i]] / vWalk;
          walkTotal += vehicleSlotPenalty(s, i, slotIndex);
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
      let noImprovCount = 0;

      for (let it = 0; it < nIter; it++) {
        const w = nIter > 1 ? wMax - (wMax - wMin) * (it / (nIter - 1)) : wMax;
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
          noImprovCount = 0;
        } else {
          noImprovCount++;
          if (noImprovCount >= EARLY_STOP_PATIENCE) break;
        }
        historyBest.push(gbestValue);
      }
      const bestAssign = decodeParticle(gbestPosition, nVeh, nSlot);
      const breakdown = buildVehicleBreakdown(bestAssign);
      return packResult(s, {
        gbestValue,
        historyBest,
        bestAssign,
        bestEntrances: breakdown.bestEntrances,
        vehicleBreakdown: breakdown.items,
        slotsPos: prep.slotsPos,
        buildingsPos: prep.buildingsPos,
        obstacles,
        vehTargets,
        boxesByBi: prep.boxesByBi,
        navByBi: prep.navByBi,
        lot: s.lot,
        road,
        optimizer: "pso",
      });
    }

    return method === "exact" ? runExactMethod() : runPsoMethod();
  }

  window.ParkingOptimizer = {
    RESULT_KEYS,
    defaultScenario,
    normalizeScenario,
    runOptimize,
  };
})();
