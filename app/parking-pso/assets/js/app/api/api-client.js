(function () {
  "use strict";

  const PK_PREFIX = "/api/parking";

  function apiBase() {
    if (typeof window.PARKING_API_BASE === "string" && window.PARKING_API_BASE) {
      return window.PARKING_API_BASE.replace(/\/$/, "");
    }
    const h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1") {
      return "http://127.0.0.1:5000";
    }
    return "https://noomings-backend.zeabur.app";
  }

  async function request(path, options) {
    const base = apiBase();
    const url = (base || "") + path;
    const opts = options || {};
    const method = (opts.method || "GET").toUpperCase();
    const headers = { ...(opts.headers || {}) };
    if (method !== "GET" && method !== "HEAD" && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
      ...opts,
      method,
      headers: Object.keys(headers).length ? headers : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || "API " + res.status);
    }
    return data;
  }

  function wsUrlFor(path) {
    const base = apiBase();
    if (base) {
      const u = new URL(base, window.location.origin);
      const proto = u.protocol === "https:" ? "wss:" : "ws:";
      return proto + "//" + u.host + path;
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return proto + "//" + window.location.host + path;
  }

  window.ParkingApiClient = {
    apiBase,
    async health() {
      return request("/api/health");
    },
    async optimize(scenario, method, seed) {
      return request(PK_PREFIX + "/optimize", {
        method: "POST",
        body: JSON.stringify({ scenario, method, seed }),
      });
    },
    async listScenarios() {
      return request(PK_PREFIX + "/scenarios");
    },
    async saveScenario(name, scenario, metrics) {
      return request(PK_PREFIX + "/scenarios", {
        method: "POST",
        body: JSON.stringify({ name, scenario, metrics }),
      });
    },
    async getScenario(id) {
      return request(PK_PREFIX + "/scenarios/" + encodeURIComponent(id));
    },
    async deleteScenario(id) {
      return request(PK_PREFIX + "/scenarios/" + encodeURIComponent(id), { method: "DELETE" });
    },
    async compareScenarioIds(ids) {
      return request(PK_PREFIX + "/compare", {
        method: "POST",
        body: JSON.stringify({ scenario_ids: ids }),
      });
    },
    async autoSlots(scenario, count) {
      return request(PK_PREFIX + "/plan/auto-slots", {
        method: "POST",
        body: JSON.stringify({ scenario, count }),
      });
    },
    async suggestPlans(scenario) {
      return request(PK_PREFIX + "/plan/suggest", {
        method: "POST",
        body: JSON.stringify({ scenario }),
      });
    },
    async simulate(result, schedule, asyncMode) {
      return request(PK_PREFIX + "/simulate", {
        method: "POST",
        body: JSON.stringify({ result, schedule, async: asyncMode !== false }),
      });
    },
    async simulateRolling(scenario, schedule, asyncMode) {
      return request(PK_PREFIX + "/simulate-rolling", {
        method: "POST",
        body: JSON.stringify({ scenario, schedule, async: asyncMode !== false }),
      });
    },
    async precomputeWarm(scenario, asyncMode) {
      return request(PK_PREFIX + "/precompute-warm", {
        method: "POST",
        body: JSON.stringify({ scenario, async: asyncMode !== false }),
      });
    },
    async monteCarloRolling(scenario, schedule, runs, seed, asyncMode) {
      return request(PK_PREFIX + "/monte-carlo-rolling", {
        method: "POST",
        body: JSON.stringify({
          scenario,
          schedule,
          runs: runs ?? 20,
          seed: seed ?? 42,
          include_static: true,
          async: asyncMode !== false,
        }),
      });
    },
    async getJob(jobId) {
      return request(PK_PREFIX + "/jobs/" + encodeURIComponent(jobId));
    },
    watchJob(jobId, onMessage) {
      return new Promise((resolve, reject) => {
        let ws;
        try {
          ws = new WebSocket(
            wsUrlFor(PK_PREFIX + "/jobs/" + encodeURIComponent(jobId) + "/stream")
          );
        } catch (e) {
          reject(e);
          return;
        }
        ws.onmessage = (ev) => {
          let data = {};
          try {
            data = JSON.parse(ev.data);
          } catch (_) {
            /* ignore */
          }
          if (onMessage) onMessage(data);
          if (data.status === "completed") {
            ws.close();
            resolve(data);
          } else if (data.status === "failed" || data.status === "missing") {
            ws.close();
            reject(new Error(data.error || data.status || "job failed"));
          }
        };
        ws.onerror = () => {
          try {
            ws.close();
          } catch (_) {
            /* ignore */
          }
          reject(new Error("websocket error"));
        };
      });
    },
  };
})();
