(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layer-controls.js");

  P.layerVisibility = P.layerVisibility || {
    underlay: true,
    road: true,
    strip: true,
    path: true,
    sim: true,
  };

  P.highlightVehicleIndex = null;

  P.setHighlightVehicle = function (vi) {
    const n = P.lastResult?.assign?.length ?? 0;
    if (!Number.isFinite(vi) || vi < 0 || vi >= n) {
      P.highlightVehicleIndex = null;
    } else {
      P.highlightVehicleIndex = vi === P.highlightVehicleIndex ? null : vi;
    }
    P.draw();
  };

  P.wireLayerControls = function () {
    const map = {
      "layer-underlay": "underlay",
      "layer-road": "road",
      "layer-strip": "strip",
      "layer-path": "path",
    };
    Object.keys(map).forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        P.layerVisibility[map[id]] = !!el.checked;
        P.draw();
      });
    });
  };

  P.shouldDrawRoad = function () {
    return P.layerVisibility.road !== false;
  };

  P.shouldDrawUnderlay = function () {
    return P.layerVisibility.underlay !== false;
  };

  P.shouldDrawStrip = function () {
    return P.layerVisibility.strip !== false;
  };

  P.shouldDrawPaths = function () {
    return P.layerVisibility.path !== false;
  };
})();
