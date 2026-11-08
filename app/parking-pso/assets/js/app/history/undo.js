(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/history/undo.js");

  const MAX_UNDO = 40;
  P.undoStack = [];
  P.redoStack = [];
  P._undoLast = null;
  P._undoBusy = false;

  function updateButtons() {
    const undo = document.getElementById("btn-undo");
    const redo = document.getElementById("btn-redo");
    if (undo) undo.disabled = P.undoStack.length === 0;
    if (redo) redo.disabled = P.redoStack.length === 0;
  }

  P.updateUndoButtons = updateButtons;

  P.resetUndoHistory = function () {
    P.undoStack = [];
    P.redoStack = [];
    P._undoLast = P.scenario ? JSON.stringify(P.scenario) : null;
    updateButtons();
  };

  P.captureUndoState = function () {
    if (P._undoBusy || !P.scenario) return;
    let json;
    try {
      json = JSON.stringify(P.scenario);
    } catch (_) {
      return;
    }
    if (P._undoLast === null) {
      P._undoLast = json;
      return;
    }
    if (json === P._undoLast) return;
    P.undoStack.push(P._undoLast);
    if (P.undoStack.length > MAX_UNDO) P.undoStack.shift();
    P.redoStack = [];
    P._undoLast = json;
    updateButtons();
  };

  function applySnapshot(json, done) {
    let snapshot;
    try {
      snapshot = JSON.parse(json);
    } catch (_) {
      return false;
    }
    P._undoBusy = true;
    try {
      P.scenario = P.optimizer.normalizeScenario(snapshot);
      P.ensureConstraints?.();
      P.ensureScenarioCollections?.();
      P.sanitizeScenarioGeometry?.();
      P.ensureVehicleDestinationsArray?.();
      P.ensureVehicleEntrancesArray?.();
      P.ensureScenarioCollections?.();
      P.lastResult = null;
      P.autoEntrancePreview = null;
      P.setSelection?.(null);
      P.rebuildVehicleTargetsUI?.();
      P.syncLotInputsFromScenario?.();
      P.updateWorkflowGuide?.();
      P.updateActionGates?.();
      P.draw?.();
      P._undoLast = JSON.stringify(P.scenario);
      if (done) done();
    } finally {
      P._undoBusy = false;
    }
    P.schedulePersistCurrentState?.();
    updateButtons();
    return true;
  }

  P.undo = function () {
    if (!P.undoStack.length || !P.scenario) return false;
    const current = JSON.stringify(P.scenario);
    const previous = P.undoStack.pop();
    P.redoStack.push(current);
    return applySnapshot(previous);
  };

  P.redo = function () {
    if (!P.redoStack.length || !P.scenario) return false;
    const current = JSON.stringify(P.scenario);
    const next = P.redoStack.pop();
    P.undoStack.push(current);
    return applySnapshot(next);
  };

  // commitSceneGeometry 是大多数编辑落盘的统一出口；先执行原逻辑，再记录
  if (typeof P.commitSceneGeometry === "function") {
    const commit = P.commitSceneGeometry;
    P.commitSceneGeometry = function () {
      const result = commit.apply(this, arguments);
      P.captureUndoState();
      return result;
    };
  }

  // 少数入口直接 persist；同样补一次快照，避免漏记
  if (typeof P.schedulePersistCurrentState === "function") {
    const schedule = P.schedulePersistCurrentState;
    P.schedulePersistCurrentState = function () {
      P.captureUndoState();
      return schedule.apply(this, arguments);
    };
  }
  if (typeof P.persistCurrentStateNow === "function") {
    const persist = P.persistCurrentStateNow;
    P.persistCurrentStateNow = function () {
      P.captureUndoState();
      return persist.apply(this, arguments);
    };
  }

  P.resetUndoHistory();
})();
