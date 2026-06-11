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
  }

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
    const n = Math.max(1, parseInt(P.scenario.n_veh, 10) || 1);
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
