(function () {
  "use strict";

  function decodeParticle(position, nVeh, nSlot) {
    const entries = position.map((v, i) => ({
      v,
      i,
      want: Math.min(nSlot - 1, Math.max(0, Math.floor(v * nSlot))),
    }));
    entries.sort((a, b) => a.v - b.v);
    const used = new Set();
    const assign = new Array(nVeh).fill(0);
    for (const { i, want } of entries) {
      let slot = want;
      for (let delta = 0; delta <= nSlot; delta++) {
        if (!used.has(want + delta) && want + delta < nSlot) {
          slot = want + delta;
          break;
        }
        if (!used.has(want - delta) && want - delta >= 0) {
          slot = want - delta;
          break;
        }
      }
      assign[i] = slot;
      used.add(slot);
    }
    return assign;
  }

  function makeRng(seed) {
    if (seed === null || seed === undefined || Number.isNaN(Number(seed))) {
      return { random: () => Math.random() };
    }
    let t = (Number(seed) >>> 0) || 1;
    return {
      random: () => {
        t += 0x6d2b79f5;
        let z = t;
        z = Math.imul(z ^ (z >>> 15), z | 1);
        z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
        return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
      },
    };
  }

  function gaussian(rng) {
    const u1 = Math.max(1e-12, rng.random());
    const u2 = rng.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  function encodeAssignToPosition(assign, nSlot) {
    return assign.map((slotIdx) => (slotIdx + 0.5) / nSlot);
  }

  window.ParkingOptimizerPso = {
    decodeParticle,
    makeRng,
    gaussian,
    encodeAssignToPosition,
  };
})();
