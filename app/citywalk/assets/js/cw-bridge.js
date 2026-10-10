/**
 * WanderWalk ↔ 社区桥接：Citywalk 路线规划结果写入 sessionStorage，社区页 ?import=1 消费。
 */
(function (global) {
    const PENDING_KEY = 'citywalk_pending_route_v1';
    const MSG_COMPLETE = 'CITYWALK_ROUTE_COMPLETE';
    const MSG_LEGACY_COMPLETE = 'WANDERWALK_CITYWALK_COMPLETED';

    function readLabel(elId, fallback) {
        const el = document.getElementById(elId);
        const t = el && el.textContent ? String(el.textContent).trim() : '';
        if (!t || t === '点击地图选择') return fallback || '';
        return t;
    }

    function buildRouteTitle(data, startLabel, endLabel) {
        const pois = Array.isArray(data.pois) ? data.pois : [];
        if (startLabel && endLabel && startLabel !== endLabel) {
            return `${startLabel} → ${endLabel}`;
        }
        if (pois.length >= 2) {
            return `${pois[0].name || '起点'} → ${pois[pois.length - 1].name || '终点'}`;
        }
        if (pois.length === 1) return pois[0].name || 'Citywalk 路线';
        return data.mode === 'loop' ? '环线探索' : 'Citywalk 路线';
    }

    function buildRoutePayloadFromCW() {
        if (typeof CW === 'undefined' || !CW.routeData) return null;
        const data = CW.routeData;
        const pois = Array.isArray(data.pois) ? data.pois : [];
        const walkMin = Number(data.duration) || 0;
        const stayMin = pois.reduce((s, p) => s + (Number(p.stay_time) || 5), 0);
        const activityMin = typeof data.activity_total_min === 'number'
            ? data.activity_total_min
            : (typeof data.estimated_total_min === 'number'
                ? data.estimated_total_min
                : walkMin + stayMin);
        const planMin = Number(data.plan_time_min);
        const distanceM = Number(data.distance) || 0;
        const startLabel = readLabel('startValue', CW.startPoint && CW.startPoint.address);
        const endLabel = readLabel('endValue', CW.endPoint && CW.endPoint.address);
        const routeId = `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
        const eventId = `cw-ev-${routeId}`;

        return {
            v: 1,
            routeId,
            eventId,
            city: CW.currentCity || '',
            title: buildRouteTitle(data, startLabel, endLabel),
            startLabel: startLabel || '',
            endLabel: endLabel || '',
            mode: data.mode || CW.planMode || 'route',
            distance_m: distanceM,
            distance_km: (distanceM / 1000).toFixed(2),
            duration_walk_min: walkMin,
            activity_min: activityMin,
            plan_min: Number.isFinite(planMin) ? planMin : null,
            stop_count: pois.length,
            stops: pois.map((p, i) => ({
                index: i + 1,
                name: p.name || `站点 ${i + 1}`,
                lng: Array.isArray(p.location) ? p.location[0] : undefined,
                lat: Array.isArray(p.location) ? p.location[1] : undefined,
                stay_min: Number(p.stay_time) || 5,
                optional: !!p.optional,
                poi_type: p.poi_type || p.type || '',
            })),
            createdAt: new Date().toISOString(),
        };
    }

    function savePendingRouteForCommunity(payload) {
        if (!payload) return false;
        try {
            sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.warn('citywalk bridge: sessionStorage failed', e);
            return false;
        }
    }

    function consumePendingRoute() {
        try {
            const raw = sessionStorage.getItem(PENDING_KEY);
            if (!raw) return null;
            sessionStorage.removeItem(PENDING_KEY);
            return JSON.parse(raw);
        } catch (e) {
            sessionStorage.removeItem(PENDING_KEY);
            return null;
        }
    }

    function navigateToCommunityWithImport() {
        const payload = buildRoutePayloadFromCW();
        if (!payload) {
            if (typeof showToast === 'function') showToast('请先完成路线规划');
            return false;
        }
        if (!savePendingRouteForCommunity(payload)) {
            if (typeof showToast === 'function') showToast('无法保存路线摘要，请重试');
            return false;
        }
        const url = new URL('community/', window.location.href);
        url.searchParams.set('import', '1');
        window.location.href = url.pathname + url.search;
        return true;
    }

    function updateRouteSummaryCard(payload) {
        const card = document.getElementById('cwRouteSummaryCard');
        if (!card) return;
        if (!payload) {
            card.hidden = true;
            const btn = document.getElementById('btnRecordCommunity');
            if (btn) btn.disabled = true;
            return;
        }
        card.hidden = false;
        const cityEl = document.getElementById('cwRouteSummaryCity');
        const titleEl = document.getElementById('cwRouteSummaryTitle');
        const metaEl = document.getElementById('cwRouteSummaryMeta');
        if (cityEl) cityEl.textContent = payload.city || '—';
        if (titleEl) titleEl.textContent = payload.title || 'Citywalk 路线';
        if (metaEl) {
            metaEl.innerHTML = [
                `<span>📏 ${payload.distance_km} km</span>`,
                `<span>🕐 约 ${payload.activity_min} 分钟</span>`,
                `<span>📍 ${payload.stop_count} 站</span>`,
            ].join('');
        }
        const btn = document.getElementById('btnRecordCommunity');
        if (btn) btn.disabled = false;
    }

    global.CitywalkBridge = {
        PENDING_KEY,
        MSG_COMPLETE,
        MSG_LEGACY_COMPLETE,
        buildRoutePayloadFromCW,
        savePendingRouteForCommunity,
        consumePendingRoute,
        navigateToCommunityWithImport,
        updateRouteSummaryCard,
    };
})(typeof window !== 'undefined' ? window : globalThis);
