(function () {
  "use strict";

  function createStateStorage(config) {
    const storageKey = String(config.storageKey || "");
    const debounceMs = Math.max(0, Number(config.debounceMs) || 0);
    const onPersist = typeof config.onPersist === "function" ? config.onPersist : null;
    let timer = null;

    function readState() {
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_) {
        return null;
      }
    }

    function persistNow(payload) {
      if (!payload) return;
      let ok = false;
      try {
        localStorage.setItem(storageKey, JSON.stringify(payload));
        ok = true;
      } catch (e) {
        console.warn("状态保存失败:", e?.message || e);
      }
      if (onPersist) {
        try { onPersist(ok); } catch (_) { /* ignore */ }
      }
    }

    function schedule(payloadFactory) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const payload = typeof payloadFactory === "function" ? payloadFactory() : null;
        persistNow(payload);
      }, debounceMs);
    }

    function clear() {
      clearTimeout(timer);
      timer = null;
      try {
        localStorage.removeItem(storageKey);
      } catch (_) {
        // ignore storage clear errors
      }
    }

    return {
      readState,
      persistNow,
      schedule,
      clear,
    };
  }

  function createSnapshotStorage(storageKey, maxItems) {
    const key = String(storageKey || "");
    const cap = Math.max(1, Number(maxItems) || 20);

    function readItems() {
      try {
        const raw = localStorage.getItem(key);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (_) {
        return [];
      }
    }

    function writeItems(items) {
      const safe = Array.isArray(items) ? items.slice(0, cap) : [];
      try {
        localStorage.setItem(key, JSON.stringify(safe));
        return { ok: true, count: safe.length };
      } catch (error) {
        return {
          ok: false,
          count: safe.length,
          error: error instanceof Error ? error.message : String(error || "unknown storage error"),
        };
      }
    }

    return {
      readItems,
      writeItems,
    };
  }

  window.ParkingAppStorage = {
    createStateStorage,
    createSnapshotStorage,
  };
})();
