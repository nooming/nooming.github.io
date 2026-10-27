(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/ui/underlay-panel.js");

  P.underlayCalibrating = null;

  P.ensureUnderlayDisplay = function () {
    if (!P.scenario) return null;
    P.scenario.display = P.scenario.display || {};
    if (!P.scenario.display.underlay || typeof P.scenario.display.underlay !== "object") {
      P.scenario.display.underlay = {
        dataUrl: "",
        opacity: 0.55,
        imageSize: null,
        worldA: null,
        worldB: null,
        imageA: null,
        imageB: null,
      };
    }
    return P.scenario.display.underlay;
  };

  P.setUnderlayStatus = function (text) {
    const el = document.getElementById("underlay-status");
    if (el) el.textContent = text || "";
  };

  P.wireUnderlayPanel = function () {
    const fileEl = document.getElementById("underlay-file");
    const opacityEl = document.getElementById("underlay-opacity");
    const btnStart = document.getElementById("btn-underlay-calibrate");
    const btnConfirm = document.getElementById("btn-underlay-confirm");
    const btnClear = document.getElementById("btn-underlay-clear");

    fileEl?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file || !P.scenario) return;
      if (file.size > 2 * 1024 * 1024) {
        P.setUnderlayStatus("图片建议小于 2MB，过大可能影响保存与加载。");
      }
      const reader = new FileReader();
      reader.onload = () => {
        const u = P.ensureUnderlayDisplay();
        u.dataUrl = String(reader.result || "");
        const img = new Image();
        img.onload = () => {
          u.imageSize = [img.naturalWidth, img.naturalHeight];
          u.worldA = null;
          u.worldB = null;
          u.imageA = [0, img.naturalHeight];
          u.imageB = [img.naturalWidth, 0];
          P.underlayCalibrating = null;
          P.mapCanvas?.classList.remove("is-underlay-calibrating");
          P.setUnderlayStatus("已加载底图。点击「开始校准」在画布上选取两个世界坐标点。");
          P.ensureUnderlayImage?.(u.dataUrl);
          P.schedulePersistCurrentState?.();
          P.draw();
        };
        img.src = u.dataUrl;
      };
      reader.readAsDataURL(file);
    });

    opacityEl?.addEventListener("input", () => {
      const u = P.ensureUnderlayDisplay();
      u.opacity = Math.max(0.05, Math.min(1, Number(opacityEl.value) || 0.55));
      P.draw();
      P.schedulePersistCurrentState?.();
    });

    btnStart?.addEventListener("click", () => {
      const u = P.ensureUnderlayDisplay();
      if (!u.dataUrl) {
        P.setUnderlayStatus("请先上传底图。");
        return;
      }
      P.underlayCalibrating = { step: "world", worldPts: [] };
      P.mapCanvas?.classList.add("is-underlay-calibrating");
      P.setUnderlayStatus("校准中：在画布上依次点击两个已知世界坐标点（A、B）。");
      P.switchTab?.("scene");
      P.draw();
    });

    btnConfirm?.addEventListener("click", () => {
      const u = P.ensureUnderlayDisplay();
      const cal = P.underlayCalibrating;
      if (!u.dataUrl || !cal?.worldPts || cal.worldPts.length < 2) {
        P.setUnderlayStatus("请先完成两个世界坐标点的选取。");
        return;
      }
      const size = u.imageSize || [1, 1];
      u.worldA = cal.worldPts[0].slice();
      u.worldB = cal.worldPts[1].slice();
      if (!u.imageA) u.imageA = [0, size[1]];
      if (!u.imageB) u.imageB = [size[0], 0];
      P.underlayCalibrating = null;
      P.mapCanvas?.classList.remove("is-underlay-calibrating");
      P.setUnderlayStatus("底图校准已保存。可调整透明度或清除底图。");
      P.schedulePersistCurrentState?.();
      P.draw();
    });

    btnClear?.addEventListener("click", () => {
      if (!P.scenario) return;
      P.scenario.display.underlay = {
        dataUrl: "",
        opacity: 0.55,
        imageSize: null,
        worldA: null,
        worldB: null,
        imageA: null,
        imageB: null,
      };
      P.underlayCalibrating = null;
      P.mapCanvas?.classList.remove("is-underlay-calibrating");
      if (fileEl) fileEl.value = "";
      if (opacityEl) opacityEl.value = "0.55";
      P.ensureUnderlayImage?.("");
      P.setUnderlayStatus("底图已清除。");
      P.schedulePersistCurrentState?.();
      P.draw();
    });
  };

  P.syncUnderlayPanelFromScenario = function () {
    const u = P.scenario?.display?.underlay;
    const opacityEl = document.getElementById("underlay-opacity");
    if (opacityEl && u) opacityEl.value = String(u.opacity ?? 0.55);
    if (u?.dataUrl && u.worldA && u.worldB) {
      P.setUnderlayStatus("底图已校准。可重新校准或清除。");
    } else if (u?.dataUrl) {
      P.setUnderlayStatus("底图已加载，尚未校准。");
    }
  };

  P.handleUnderlayCalibrationClick = function (wx, wy) {
    const cal = P.underlayCalibrating;
    if (!cal || cal.step !== "world") return false;
    cal.worldPts.push([wx, wy]);
    if (cal.worldPts.length === 1) {
      P.setUnderlayStatus("已选 A 点，请再点击 B 点。");
    } else if (cal.worldPts.length >= 2) {
      cal.worldPts.length = 2;
      const u = P.ensureUnderlayDisplay();
      const size = u.imageSize || [1, 1];
      u.imageA = [0, size[1]];
      u.imageB = [size[0], 0];
      P.setUnderlayStatus("世界坐标已选齐。点击「确认校准」完成（图像点默认左下→右上）。");
    }
    P.draw();
    return true;
  };
})();
