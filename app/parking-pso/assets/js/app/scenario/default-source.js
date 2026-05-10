(function () {
  "use strict";

  async function getDefaultScenarioSource(fallbackScenarioFactory) {
    try {
      const res = await fetch("assets/data/default-scenario.json", { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (error) {
      console.warn("default scenario fetch failed, fallback in use", error);
      return typeof fallbackScenarioFactory === "function" ? fallbackScenarioFactory() : null;
    }
  }

  window.ParkingScenarioSource = {
    getDefaultScenarioSource,
  };
})();
