(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/vehicle-panel.js");

P.ensureVehicleDestinationsArray = function () {
    if (!P.scenario) return;
    P.ensureScenarioCollections();
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const nb = P.scenario.buildings?.length ?? 0;
    if (!Array.isArray(P.scenario.vehicle_destinations)) {
      P.scenario.vehicle_destinations = Array.from({ length: n }, (_, i) =>
        nb > 0 ? i % nb : 0
      );
      return;
    }
    while (P.scenario.vehicle_destinations.length < n) {
      const i = P.scenario.vehicle_destinations.length;
      P.scenario.vehicle_destinations.push(nb > 0 ? i % nb : 0);
    }
    if (P.scenario.vehicle_destinations.length > n) {
      P.scenario.vehicle_destinations.length = n;
    }
    if (nb > 0) {
      P.scenario.vehicle_destinations = P.scenario.vehicle_destinations.map((d) => {
        let v = parseInt(d, 10);
        if (!Number.isFinite(v)) v = 0;
        return Math.max(0, Math.min(nb - 1, v));
      });
    }
    P.ensureVehicleEntrancesArray();
    P.ensureVehicleArrivalSecArray?.();
  }

P.ensureVehicleArrivalSecArray = function () {
    if (!P.scenario) return;
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    if (!Array.isArray(P.scenario.vehicle_arrival_sec)) {
      P.scenario.vehicle_arrival_sec = Array.from({ length: n }, (_, i) => i * 2);
      return;
    }
    while (P.scenario.vehicle_arrival_sec.length < n) {
      const i = P.scenario.vehicle_arrival_sec.length;
      const prev = i > 0 ? Number(P.scenario.vehicle_arrival_sec[i - 1]) : 0;
      P.scenario.vehicle_arrival_sec.push(Number.isFinite(prev) ? prev + 2 : i * 2);
    }
    if (P.scenario.vehicle_arrival_sec.length > n) {
      P.scenario.vehicle_arrival_sec.length = n;
    }
  };

P.getVehicleArrivalMode = function () {
    const el = document.getElementById("veh-arrival-mode");
    return el?.value === "gap" ? "gap" : "absolute";
  };

P.resolveVehicleArrivalsSec = function () {
    P.ensureVehicleArrivalSecArray();
    const raw = (P.scenario?.vehicle_arrival_sec || []).map((v) =>
      Math.max(0, Number(v) || 0)
    );
    if (P.getVehicleArrivalMode() !== "gap") return raw;
    const out = [];
    let t = 0;
    for (let i = 0; i < raw.length; i++) {
      if (i === 0) t = raw[0];
      else t += raw[i];
      out.push(t);
    }
    return out;
  };

P.fillVehicleArrivalsFromBurst = function (gapSec) {
    if (!P.scenario) return;
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const gap = Math.max(0.1, Number(gapSec) || 2);
    const mode = P.getVehicleArrivalMode();
    P.scenario.vehicle_arrival_sec = Array.from({ length: n }, (_, i) =>
      mode === "gap" ? (i === 0 ? 0 : gap) : i * gap
    );
    P.rebuildVehicleTargetsUI();
    P.schedulePersistCurrentState?.();
  };

P.fillVehicleArrivalsFromUniform = function () {
    if (!P.scenario) return;
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const durEl = document.getElementById("sim-duration-min");
    const duration_s = (durEl ? parseFloat(durEl.value) || 20 : 20) * 60;
    const step = duration_s / Math.max(1, n);
    const mode = P.getVehicleArrivalMode();
    P.scenario.vehicle_arrival_sec = Array.from({ length: n }, (_, i) =>
      mode === "gap" ? (i === 0 ? 0 : step) : i * step
    );
    P.rebuildVehicleTargetsUI();
    P.schedulePersistCurrentState?.();
  };

P.adjustVehicleDestinationsAfterBuildingRemoved = function (removedIndex) {
    if (!P.scenario || !Array.isArray(P.scenario.vehicle_destinations)) return;
    const nb = P.scenario.buildings.length;
    P.scenario.vehicle_destinations = P.scenario.vehicle_destinations.map((d) => {
      let v = parseInt(d, 10);
      if (!Number.isFinite(v)) v = 0;
      if (v === removedIndex) return Math.max(0, removedIndex - 1);
      if (v > removedIndex) return v - 1;
      return v;
    });
    if (nb > 0) {
      P.scenario.vehicle_destinations = P.scenario.vehicle_destinations.map((d) =>
        Math.max(0, Math.min(nb - 1, d))
      );
    }
  }

P.ensureVehiclePageInRange = function (totalVehicles) {
    const total = Math.max(1, totalVehicles);
    const pageCount = Math.max(1, Math.ceil(total / P.VEHICLE_PAGE_SIZE));
    if (!Number.isFinite(P.vehiclePage) || P.vehiclePage < 0) P.vehiclePage = 0;
    if (P.vehiclePage >= pageCount) P.vehiclePage = pageCount - 1;
    return pageCount;
  }

P.updateVehiclePager = function (totalVehicles, pageCount) {
    const status = document.getElementById("veh-page-status");
    const btnPrev = document.getElementById("btn-veh-page-prev");
    const btnNext = document.getElementById("btn-veh-page-next");
    if (status) status.textContent = pageCount > 0 ? P.vehiclePage + 1 + " / " + pageCount : "1 / 1";
    if (btnPrev) btnPrev.disabled = P.vehiclePage <= 0;
    if (btnNext) btnNext.disabled = P.vehiclePage >= pageCount - 1 || totalVehicles <= P.VEHICLE_PAGE_SIZE;
  }

P.rebuildVehicleTargetsUI = function () {
    const el = document.getElementById("vehicle-targets-list");
    if (!el || !P.scenario) return;
    P.ensureVehicleDestinationsArray();
    P.ensureVehicleEntrancesArray();
    P.ensureVehicleArrivalSecArray();
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
    const arrivalMode = P.getVehicleArrivalMode();
    const arrivalLab =
      arrivalMode === "gap" ? "间隔(s)" : "到达(s)";
    const nb = P.scenario.buildings?.length ?? 0;
    const ne = P.scenario.entrances?.length ?? 1;
    const pageCount = P.ensureVehiclePageInRange(n);
    const start = P.vehiclePage * P.VEHICLE_PAGE_SIZE;
    const end = Math.min(n, start + P.VEHICLE_PAGE_SIZE);
    const modeEl = document.getElementById("entrance-mode");
    if (modeEl) modeEl.value = P.scenario.entrance_mode || "auto";
    el.innerHTML = "";
    for (let i = start; i < end; i++) {
      const row = document.createElement("div");
      row.className = "vehicle-target-row";
      const lab = document.createElement("label");
      lab.textContent = "车 " + (i + 1);
      lab.setAttribute("for", "veh-dest-" + i);
      lab.className = "vehicle-link-label";
      lab.title = "点击高亮入口→车位→楼链路";
      lab.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (P.setHighlightVehicle) P.setHighlightVehicle(i);
      });
      const breakdown = P.lastResult?.vehicle_breakdown?.[i];
      if (breakdown && Number(breakdown.penalty || 0) > 0) {
        const badge = document.createElement("span");
        badge.className = "vehicle-violation-badge";
        badge.textContent = "违约";
        badge.title = "类型约束违约，罚分 " + Number(breakdown.penalty).toFixed(2);
        lab.appendChild(badge);
      }
      const sel = document.createElement("select");
      sel.id = "veh-dest-" + i;
      if (nb === 0) {
        const opt = document.createElement("option");
        opt.value = "0";
        opt.textContent = "（请先添加居民楼）";
        sel.appendChild(opt);
        sel.disabled = true;
      } else {
        for (let b = 0; b < nb; b++) {
          const opt = document.createElement("option");
          opt.value = String(b);
          opt.textContent = "楼 " + (b + 1);
          sel.appendChild(opt);
        }
        const dest = P.scenario.vehicle_destinations[i] ?? 0;
        sel.value = String(Math.max(0, Math.min(nb - 1, dest)));
        sel.addEventListener("change", () => {
          const v = parseInt(sel.value, 10);
          P.scenario.vehicle_destinations[i] = Number.isFinite(v) ? v : 0;
          P.invalidateOptimizationResult();
        });
      }
      row.appendChild(lab);
      row.appendChild(sel);
      const elab = document.createElement("label");
      elab.textContent = "入口";
      elab.setAttribute("for", "veh-ent-" + i);
      const eSel = document.createElement("select");
      eSel.id = "veh-ent-" + i;
      for (let ei = 0; ei < ne; ei++) {
        const opt = document.createElement("option");
        opt.value = String(ei);
        opt.textContent = P.entranceDisplayName(ei);
        eSel.appendChild(opt);
      }
      const autoEntrances = Array.isArray(P.lastResult?.veh_entrances)
        ? P.lastResult.veh_entrances
        : Array.isArray(P.autoEntrancePreview)
        ? P.autoEntrancePreview
        : null;
      const autoResolved = autoEntrances && Number.isFinite(autoEntrances[i]) ? autoEntrances[i] : null;
      const displayEntranceIndex =
        P.scenario.entrance_mode === "fixed"
          ? P.scenario.vehicle_entrances[i] ?? 0
          : autoResolved != null
          ? autoResolved
          : P.scenario.vehicle_entrances[i] ?? 0;
      eSel.value = String(Math.max(0, Math.min(ne - 1, Number(displayEntranceIndex) || 0)));
      eSel.disabled = P.scenario.entrance_mode !== "fixed";
      if (P.scenario.entrance_mode !== "fixed") {
        eSel.title =
          autoResolved != null
            ? Array.isArray(P.lastResult?.veh_entrances)
              ? "自动策略当前结果：入口 " + (autoResolved + 1)
              : "自动策略即时预估：入口 " + (autoResolved + 1)
            : "自动策略：入口变化后将自动刷新预估";
      }
      eSel.addEventListener("change", () => {
        const v = parseInt(eSel.value, 10);
        P.scenario.vehicle_entrances[i] = Number.isFinite(v) ? v : 0;
        P.invalidateOptimizationResult();
      });
      row.appendChild(elab);
      row.appendChild(eSel);
      const rlab = document.createElement("label");
      rlab.textContent = "需求";
      rlab.setAttribute("for", "veh-req-" + i);
      const rSel = document.createElement("select");
      rSel.id = "veh-req-" + i;
      ["normal", "accessible", "ev", "visitor"].forEach((t) => {
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = { normal: "普通", accessible: "无障碍", ev: "充电", visitor: "访客" }[t] || t;
        rSel.appendChild(opt);
      });
      P.ensureConstraints();
      rSel.value = P.scenario.vehicle_requirements?.[i] || "normal";
      rSel.addEventListener("change", () => {
        P.scenario.vehicle_requirements[i] = rSel.value;
        P.invalidateOptimizationResult();
      });
      row.appendChild(rlab);
      row.appendChild(rSel);
      const alab = document.createElement("label");
      alab.textContent = arrivalLab;
      alab.setAttribute("for", "veh-arr-" + i);
      const aIn = document.createElement("input");
      aIn.type = "number";
      aIn.id = "veh-arr-" + i;
      aIn.min = "0";
      aIn.step = "0.5";
      aIn.className = "vehicle-arrival-input";
      const av = P.scenario.vehicle_arrival_sec[i];
      aIn.value = String(Number.isFinite(Number(av)) ? Number(av) : i * 2);
      aIn.title =
        arrivalMode === "gap"
          ? i === 0
            ? "第 1 辆的到达时刻（秒）"
            : "与上一辆之间的间隔（秒）"
          : "到达时刻（秒，从仿真 0 起）";
      aIn.addEventListener("change", () => {
        const v = parseFloat(aIn.value);
        P.scenario.vehicle_arrival_sec[i] = Number.isFinite(v) ? Math.max(0, v) : 0;
        P.schedulePersistCurrentState?.();
      });
      row.appendChild(alab);
      row.appendChild(aIn);
      el.appendChild(row);
    }
    P.updateVehiclePager(n, pageCount);
  }

P.randomizeVehicleDestinations = function () {
    if (!P.scenario) return;
    const nb = P.scenario.buildings?.length ?? 0;
    if (nb === 0) return;
    P.ensureVehicleDestinationsArray();
    const n = P.scenario.vehicle_destinations.length;
    for (let i = 0; i < n; i++) {
      P.scenario.vehicle_destinations[i] = Math.floor(Math.random() * nb);
    }
    P.rebuildVehicleTargetsUI();
    P.invalidateOptimizationResult();
  }

P.computeAutoEntrancePreview = function () {
    if (!P.scenario || !P.optimizer || typeof P.optimizer.runOptimize !== "function") return null;
    const base = JSON.parse(JSON.stringify(P.scenario));
    const data = P.normalizeOptimizeResult(P.optimizer.runOptimize(base, { method: "exact" }), "exact", P.scenario);
    if (!Array.isArray(data.veh_entrances) || !data.veh_entrances.length) return null;
    return data.veh_entrances.slice();
  }

P.scheduleAutoEntrancePreviewRefresh = function () {
    clearTimeout(P.autoEntrancePreviewTimer);
    P.autoEntrancePreviewVersion += 1;
    const version = P.autoEntrancePreviewVersion;
    P.autoEntrancePreview = null;
    if (!P.scenario || P.scenario.entrance_mode === "fixed") return;
    P.autoEntrancePreviewTimer = setTimeout(() => {
      if (version !== P.autoEntrancePreviewVersion) return;
      try {
        P.autoEntrancePreview = P.computeAutoEntrancePreview();
      } catch (_) {
        P.autoEntrancePreview = null;
      }
      if (version !== P.autoEntrancePreviewVersion) return;
      if (!P.lastResult) P.rebuildVehicleTargetsUI();
    }, 120);
  }
})();
