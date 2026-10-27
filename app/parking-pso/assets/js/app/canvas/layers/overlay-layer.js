(function () {
  "use strict";
  const P = window.ParkingApp;
  if (!P) throw new Error("ParkingApp missing: app/canvas/layers/overlay-layer.js");

  function strokePathPoly(poly, scale, style) {
    if (poly.length < 2) return;
    const baseWidth = style.baseWidth ?? Math.max(2.2, scale * 0.085);
    const glowWidth = style.glowWidth ?? baseWidth + Math.max(2.4, scale * 0.09);
    P.ctx.lineCap = "round";
    P.ctx.lineJoin = "round";
    P.ctx.strokeStyle = style.glow || P.COLORS.pathGlow;
    P.ctx.lineWidth = glowWidth;
    P.ctx.beginPath();
    const p0 = P.worldToScreen(poly[0][0], poly[0][1]);
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    P.ctx.strokeStyle = style.stroke || P.COLORS.path;
    P.ctx.lineWidth = baseWidth;
    P.ctx.beginPath();
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    if (style.endDot !== false) {
      const pend = P.worldToScreen(poly[poly.length - 1][0], poly[poly.length - 1][1]);
      const endR = Math.max(2.8, scale * 0.13);
      P.ctx.beginPath();
      P.ctx.arc(pend.sx, pend.sy, endR, 0, Math.PI * 2);
      P.ctx.fillStyle = style.endFill || P.COLORS.pathEnd;
      P.ctx.fill();
      P.ctx.strokeStyle = "rgba(255,255,255,0.9)";
      P.ctx.lineWidth = Math.max(1, scale * 0.05);
      P.ctx.stroke();
    }
  }

  function strokeDashedPathPoly(poly, scale, style) {
    if (poly.length < 2) return;
    const baseWidth = style.baseWidth ?? Math.max(2, scale * 0.075);
    const dash = style.dash ?? [Math.max(5, scale * 0.18), Math.max(4, scale * 0.12)];
    P.ctx.lineCap = "round";
    P.ctx.lineJoin = "round";
    P.ctx.setLineDash(dash);
    P.ctx.strokeStyle = style.glow || "rgba(168,85,247,0.35)";
    P.ctx.lineWidth = baseWidth + Math.max(2, scale * 0.08);
    P.ctx.beginPath();
    const p0 = P.worldToScreen(poly[0][0], poly[0][1]);
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    P.ctx.strokeStyle = style.stroke || "#06b6d4";
    P.ctx.lineWidth = baseWidth;
    P.ctx.beginPath();
    P.ctx.moveTo(p0.sx, p0.sy);
    for (let i = 1; i < poly.length; i++) {
      const p = P.worldToScreen(poly[i][0], poly[i][1]);
      P.ctx.lineTo(p.sx, p.sy);
    }
    P.ctx.stroke();
    P.ctx.setLineDash([]);
    if (style.endDot !== false) {
      const pend = P.worldToScreen(poly[poly.length - 1][0], poly[poly.length - 1][1]);
      const endR = Math.max(2.5, scale * 0.11);
      P.ctx.beginPath();
      P.ctx.arc(pend.sx, pend.sy, endR, 0, Math.PI * 2);
      P.ctx.fillStyle = style.endFill || "#a855f7";
      P.ctx.fill();
    }
  }

P.drawDrivePaths = function (scale) {
    if (!P.lastResult?.drive_paths?.length) return;
    const hi = P.highlightVehicleIndex;
    const dim = {
      glow: "rgba(168,85,247,0.12)",
      stroke: "rgba(6,182,212,0.28)",
      endFill: "rgba(168,85,247,0.35)",
      baseWidth: Math.max(1.4, scale * 0.055),
    };
    const bright = {
      glow: "rgba(168,85,247,0.55)",
      stroke: "#a855f7",
      endFill: "#c084fc",
      baseWidth: Math.max(2.8, scale * 0.1),
    };
    P.lastResult.drive_paths.forEach((poly, vi) => {
      if (!poly?.length) return;
      if (hi != null && vi !== hi) strokeDashedPathPoly(poly, scale, dim);
      else if (hi == null) strokeDashedPathPoly(poly, scale, {});
    });
    if (hi != null && P.lastResult.drive_paths[hi]?.length) {
      strokeDashedPathPoly(P.lastResult.drive_paths[hi], scale, bright);
    }
  };

P.drawPsoReplayOverlay = function (scale) {
    const replay = P.psoReplay;
    if (!replay?.samples?.length || !P.scenario?.slots?.length) return;
    const sample = replay.samples[replay.frameIndex ?? 0];
    const assign = sample?.assign;
    if (!Array.isArray(assign)) return;
    const alpha = 0.35 + 0.45 * ((replay.frameIndex ?? 0) / Math.max(1, replay.samples.length - 1));
    P.ctx.save();
    P.ctx.globalAlpha = alpha;
    P.ctx.strokeStyle = "#f59e0b";
    P.ctx.lineWidth = Math.max(1.5, scale * 0.06);
    P.ctx.setLineDash([Math.max(4, scale * 0.12), Math.max(3, scale * 0.08)]);
    for (let vi = 0; vi < assign.length; vi++) {
      const si = assign[vi];
      const bi = P.lastResult?.veh_targets?.[vi] ?? P.scenario.vehicle_destinations?.[vi];
      if (!Number.isFinite(si) || !Number.isFinite(bi)) continue;
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      const b = P.scenario.buildings?.[bi];
      if (!pose || !b) continue;
      const a = P.worldToScreen(pose.x, pose.y);
      const bpt = P.worldToScreen(b[0], b[1]);
      P.ctx.beginPath();
      P.ctx.moveTo(a.sx, a.sy);
      P.ctx.lineTo(bpt.sx, bpt.sy);
      P.ctx.stroke();
    }
    P.ctx.setLineDash([]);
    P.ctx.globalAlpha = 1;
    P.ctx.restore();
    const label = "PSO 回放 · 迭代 " + (sample.iter ?? replay.frameIndex);
    P.ctx.save();
    P.ctx.font = '11px "Segoe UI", "Microsoft YaHei", sans-serif';
    P.ctx.fillStyle = "rgba(245, 158, 11, 0.95)";
    P.ctx.textAlign = "left";
    P.ctx.textBaseline = "top";
    P.ctx.fillText(label, 12, 12);
    P.ctx.restore();
  };

P.drawResultPaths = function (scale) {
    P.drawDrivePaths(scale);
    if (!P.lastResult?.paths?.length) return;
    const hi = P.highlightVehicleIndex;
    const dim = {
      glow: "rgba(59,130,246,0.12)",
      stroke: "rgba(59,130,246,0.22)",
      endFill: "rgba(59,130,246,0.35)",
      baseWidth: Math.max(1.6, scale * 0.06),
    };
    const bright = {
      glow: "rgba(250,204,21,0.55)",
      stroke: "#f59e0b",
      endFill: "#fbbf24",
      baseWidth: Math.max(3.2, scale * 0.12),
      glowWidth: Math.max(5, scale * 0.18),
    };
    P.lastResult.paths.forEach((poly, vi) => {
      if (hi != null && vi !== hi) strokePathPoly(poly, scale, dim);
      else if (hi == null) strokePathPoly(poly, scale, {});
    });
    if (hi != null && P.lastResult.paths[hi]) {
      strokePathPoly(P.lastResult.paths[hi], scale, bright);
    }
  }

P.drawViolationSlotHighlights = function (scale) {
    const items = P.lastResult?.vehicle_breakdown;
    if (!Array.isArray(items) || !P.scenario?.slots?.length) return;
    const violators = items.filter((it) => Number(it.penalty || 0) > 0);
    if (!violators.length) return;
    for (const it of violators) {
      const si = Number(it.slot_index);
      if (!Number.isFinite(si) || si < 0 || si >= P.scenario.slots.length) continue;
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      if (!pose) continue;
      const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((pt) =>
        P.worldToScreen(pt[0], pt[1])
      );
      P.ctx.strokeStyle = "#ef4444";
      P.ctx.lineWidth = Math.max(3, scale * 0.12);
      P.ctx.beginPath();
      P.ctx.moveTo(poly[0].sx, poly[0].sy);
      for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
      P.ctx.closePath();
      P.ctx.stroke();
    }
  };

P.drawVehicleChainHighlight = function (scale) {
    const vi = P.highlightVehicleIndex;
    if (vi == null || !P.lastResult || !P.scenario) return;
    const si = P.lastResult.assign?.[vi];
    const bi = P.lastResult.veh_targets?.[vi];
    const ei = P.lastResult.veh_entrances?.[vi];
    const ring = Math.max(6, scale * 0.35);
    const drawRing = (wx, wy, color) => {
      const p = P.worldToScreen(wx, wy);
      P.ctx.beginPath();
      P.ctx.arc(p.sx, p.sy, ring, 0, Math.PI * 2);
      P.ctx.strokeStyle = color;
      P.ctx.lineWidth = Math.max(2.5, scale * 0.1);
      P.ctx.stroke();
    };
    if (Number.isFinite(ei) && P.scenario.entrances?.[ei]) {
      const e = P.scenario.entrances[ei];
      drawRing(e[0], e[1], "#22c55e");
      P.drawStackedWorldLabels(e[0], e[1], ["入口 " + (ei + 1)]);
    }
    if (Number.isFinite(si) && P.scenario.slots?.[si]) {
      const pose = P.slotPoseOf(P.scenario.slots[si]);
      if (pose) {
        const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((pt) =>
          P.worldToScreen(pt[0], pt[1])
        );
        P.ctx.strokeStyle = "#f59e0b";
        P.ctx.lineWidth = Math.max(3, scale * 0.12);
        P.ctx.beginPath();
        P.ctx.moveTo(poly[0].sx, poly[0].sy);
        for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
        P.ctx.closePath();
        P.ctx.stroke();
      }
    }
    if (Number.isFinite(bi) && P.scenario.buildings?.[bi]) {
      const [bx, by] = P.scenario.buildings[bi];
      P.fillRectWorld(
        bx - P.B.bw / 2,
        by - P.B.bh / 2,
        P.B.bw,
        P.B.bh,
        "rgba(251,191,36,0.18)",
        "#f59e0b",
        Math.max(3, scale * 0.1)
      );
      P.drawStackedWorldLabels(bx, by, ["楼 " + (bi + 1)]);
    }
  }

P.drawSelectionOutline = function () {
    if (!P.selection) return;
    P.ctx.strokeStyle = P.COLORS.select;
    P.ctx.lineWidth = 3;
    if (P.selection.kind === "entrance") {
      const e = P.scenario.entrances[P.selection.index ?? 0];
      const ep = P.worldToScreen(e[0], e[1]);
      P.ctx.beginPath();
      P.ctx.arc(ep.sx, ep.sy, P.padScale().scale * 1.18, 0, Math.PI * 2);
      P.ctx.stroke();
    } else if (P.selection.kind === "obstacle") {
      const o = P.scenario.obstacles[P.selection.index ?? 0];
      if (o?.points?.length >= 3) {
        const p0 = P.worldToScreen(o.points[0][0], o.points[0][1]);
        P.ctx.beginPath();
        P.ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < o.points.length; i++) {
          const pi = P.worldToScreen(o.points[i][0], o.points[i][1]);
          P.ctx.lineTo(pi.sx, pi.sy);
        }
        P.ctx.closePath();
        P.ctx.stroke();
        for (let i = 0; i < o.points.length; i++) {
          const v = P.worldToScreen(o.points[i][0], o.points[i][1]);
          P.ctx.beginPath();
          P.ctx.arc(v.sx, v.sy, Math.max(4, P.padScale().scale * 0.18), 0, Math.PI * 2);
          P.ctx.fillStyle = "#ffffff";
          P.ctx.fill();
          P.ctx.strokeStyle = P.COLORS.select;
          P.ctx.lineWidth = 2;
          P.ctx.stroke();
        }
      }
    } else if (P.selection.kind === "road") {
      const pts = P.scenario.road?.centerline || [];
      if (pts.length >= 2) {
        const p0 = P.worldToScreen(pts[0][0], pts[0][1]);
        P.ctx.beginPath();
        P.ctx.moveTo(p0.sx, p0.sy);
        for (let i = 1; i < pts.length; i++) {
          const pi = P.worldToScreen(pts[i][0], pts[i][1]);
          P.ctx.lineTo(pi.sx, pi.sy);
        }
        P.ctx.stroke();
        for (let i = 0; i < pts.length; i++) {
          const v = P.worldToScreen(pts[i][0], pts[i][1]);
          P.ctx.beginPath();
          P.ctx.arc(v.sx, v.sy, Math.max(4, P.padScale().scale * 0.18), 0, Math.PI * 2);
          P.ctx.fillStyle = "#ffffff";
          P.ctx.fill();
          P.ctx.strokeStyle = P.COLORS.select;
          P.ctx.lineWidth = 2;
          P.ctx.stroke();
        }
      }
    } else if (P.selection.kind === "building") {
      const [x, y] = P.scenario.buildings[P.selection.index];
      P.fillRectWorld(
        x - P.B.bw / 2,
        y - P.B.bh / 2,
        P.B.bw,
        P.B.bh,
        "transparent",
        P.COLORS.select,
        3
      );
    } else if (P.selection.kind === "slot") {
      const pose = P.slotPoseOf(P.scenario.slots[P.selection.index]);
      if (!pose) return;
      const poly = P.slotPolygonAt(pose.x, pose.y, pose.theta).map((p) => P.worldToScreen(p[0], p[1]));
      P.ctx.beginPath();
      P.ctx.moveTo(poly[0].sx, poly[0].sy);
      for (let i = 1; i < poly.length; i++) P.ctx.lineTo(poly[i].sx, poly[i].sy);
      P.ctx.closePath();
      P.ctx.stroke();
    }
  }

P.drawMapOverlays = function () {
    if (!P.scenario) return;
    const { scale } = P.padScale();
    const Lm = P.scaleBarWorldM();
    const barPx = Lm * scale;
    const pad = 14;
    const yLine = P.mapCssH - pad;
    const xBar0 = pad;
    const xBar1 = pad + barPx;
    P.ctx.save();
    P.ctx.strokeStyle = "#5c6b82";
    P.ctx.fillStyle = "#b4c2d6";
    P.ctx.lineWidth = 2.5;
    P.ctx.lineCap = "butt";
    P.ctx.beginPath();
    P.ctx.moveTo(xBar0, yLine);
    P.ctx.lineTo(xBar1, yLine);
    P.ctx.stroke();
    const tick = 5;
    P.ctx.beginPath();
    P.ctx.moveTo(xBar0, yLine - tick);
    P.ctx.lineTo(xBar0, yLine);
    P.ctx.moveTo(xBar1, yLine - tick);
    P.ctx.lineTo(xBar1, yLine);
    P.ctx.stroke();
    const midX = (xBar0 + xBar1) / 2;
    const label = P.fmtDim(Lm) + " " + P.uLen();
    const fsScale = Math.max(11, Math.min(14, scale * 0.35));
    P.ctx.font = `700 ${fsScale}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    P.ctx.textAlign = "center";
    P.ctx.textBaseline = "bottom";
    const gap = 6;
    const labelY = yLine - tick - gap;
    P.ctx.lineWidth = 2.5;
    P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
    P.ctx.fillStyle = "#ffffff";
    P.ctx.strokeText(label, midX, labelY);
    P.ctx.fillText(label, midX, labelY);
    if (P.pendingAdd) {
      const labels = {
        entrance: "入口",
        road: "道路",
        obstacle: "花坛",
        building: "居民楼",
        slot: "车位",
      };
      const hint = "绘制" + (labels[P.pendingAdd] || P.pendingAdd) + " · Esc 取消";
      P.ctx.font = `700 12px "Segoe UI", "Microsoft YaHei", sans-serif`;
      P.ctx.textAlign = "left";
      P.ctx.textBaseline = "top";
      P.ctx.lineWidth = 2.5;
      P.ctx.strokeStyle = "rgba(0,0,0,0.62)";
      P.ctx.fillStyle = "#ffffff";
      P.ctx.strokeText(hint, pad, pad);
      P.ctx.fillText(hint, pad, pad);
    }
    P.ctx.restore();

    const cap = document.getElementById("map-unit-caption");
    if (cap) {
      cap.textContent =
        (P.scenario.display?.coord_note || "") + " · 比例尺见画布左下角";
    }
    const lotHint = document.getElementById("lot-dim-hint");
    if (lotHint) {
      const ox = P.fmtDim(P.lotX0());
      const oy = P.fmtDim(P.lotY0());
      const zoomPct = Math.round((P.viewZoom ?? 1) * 100);
      lotHint.textContent =
        "地块 " +
        P.fmtDim(P.lotW()) +
        " × " +
        P.fmtDim(P.lotH()) +
        " " +
        P.uLen() +
        "（原点 " +
        ox +
        "," +
        oy +
        "）· 缩放 " +
        zoomPct +
        "% · 右键拖动画布，滚轮缩放";
    }
  }
})();
