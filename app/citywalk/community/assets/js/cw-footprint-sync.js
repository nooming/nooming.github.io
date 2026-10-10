/**
 * WanderWalk 账号云同步：足迹、收藏、规划导入、继续上次、积分
 */
(function (global) {
    const SYNC_META_KEY = 'citywalk_footprint_sync_meta_v1';
    const STORAGE_KEYS = {
        walked: 'citywalk_walked_routes_v1',
        favoriteRoutes: 'citywalk_favorite_routes_v1',
        favoriteSpots: 'citywalk_favorite_spots_v1',
        planned: 'citywalk_planned_routes_v1',
        routeHistory: 'cw_route_history_v1',
        pointsTotal: 'citywalk_points_total_v1',
        pointsEvents: 'citywalk_completion_events_v1',
    };

    let _syncing = false;
    let _applyingCloud = false;

    function readMeta() {
        try {
            const raw = localStorage.getItem(SYNC_META_KEY);
            return raw ? JSON.parse(raw) : { updated_at: 0 };
        } catch (_) {
            return { updated_at: 0 };
        }
    }

    function writeMeta(meta) {
        try {
            localStorage.setItem(SYNC_META_KEY, JSON.stringify(meta));
        } catch (_) { /* ignore */ }
    }

    function readJsonArray(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }

    function readJsonObject(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function readPointsTotal() {
        try {
            const n = Number(localStorage.getItem(STORAGE_KEYS.pointsTotal));
            return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
        } catch (_) {
            return 0;
        }
    }

    function collectPayload() {
        return {
            walked: typeof walkedRoutes !== 'undefined'
                ? walkedRoutes
                : readJsonArray(STORAGE_KEYS.walked),
            favorite_routes: typeof favoriteRouteIds !== 'undefined'
                ? favoriteRouteIds
                : readJsonArray(STORAGE_KEYS.favoriteRoutes),
            favorite_spots: typeof favoriteSpotKeys !== 'undefined'
                ? favoriteSpotKeys
                : readJsonArray(STORAGE_KEYS.favoriteSpots),
            planned_routes: typeof plannedRouteCatalog !== 'undefined'
                ? plannedRouteCatalog
                : readJsonObject(STORAGE_KEYS.planned),
            route_history: readJsonArray(STORAGE_KEYS.routeHistory),
            points_total: typeof totalWalkPoints !== 'undefined'
                ? totalWalkPoints
                : readPointsTotal(),
            points_events: typeof completionEvents !== 'undefined'
                ? completionEvents
                : readJsonArray(STORAGE_KEYS.pointsEvents),
        };
    }

    function payloadHasLocalData(payload) {
        if (!payload) return false;
        return !!(payload.walked && payload.walked.length)
            || !!(payload.favorite_routes && payload.favorite_routes.length)
            || !!(payload.favorite_spots && payload.favorite_spots.length)
            || !!(payload.planned_routes && Object.keys(payload.planned_routes).length)
            || !!(payload.route_history && payload.route_history.length)
            || (Number(payload.points_total) > 0)
            || !!(payload.points_events && payload.points_events.length);
    }

    function applyCloudAccountData(fp) {
        if (!fp) return;
        _applyingCloud = true;
        try {
            if (Array.isArray(fp.walked)) {
                if (typeof walkedRoutes !== 'undefined') walkedRoutes = fp.walked;
                try { localStorage.setItem(STORAGE_KEYS.walked, JSON.stringify(fp.walked)); } catch (_) { /* ignore */ }
            }
            if (Array.isArray(fp.favorite_routes)) {
                if (typeof favoriteRouteIds !== 'undefined') favoriteRouteIds = fp.favorite_routes;
                try { localStorage.setItem(STORAGE_KEYS.favoriteRoutes, JSON.stringify(fp.favorite_routes)); } catch (_) { /* ignore */ }
            }
            if (Array.isArray(fp.favorite_spots)) {
                if (typeof favoriteSpotKeys !== 'undefined') favoriteSpotKeys = fp.favorite_spots;
                try { localStorage.setItem(STORAGE_KEYS.favoriteSpots, JSON.stringify(fp.favorite_spots)); } catch (_) { /* ignore */ }
            }
            if (fp.planned_routes && typeof fp.planned_routes === 'object') {
                if (typeof plannedRouteCatalog !== 'undefined') plannedRouteCatalog = fp.planned_routes;
                try { localStorage.setItem(STORAGE_KEYS.planned, JSON.stringify(fp.planned_routes)); } catch (_) { /* ignore */ }
                if (typeof routeSpots !== 'undefined') {
                    Object.keys(fp.planned_routes).forEach(function (id) {
                        const entry = fp.planned_routes[id];
                        if (entry && entry.routeSpot && !routeSpots[id]) routeSpots[id] = entry.routeSpot;
                    });
                }
            }
            if (Array.isArray(fp.route_history)) {
                try { localStorage.setItem(STORAGE_KEYS.routeHistory, JSON.stringify(fp.route_history)); } catch (_) { /* ignore */ }
            }
            if (typeof fp.points_total === 'number' || fp.points_total != null) {
                const pt = Math.max(0, Math.floor(Number(fp.points_total) || 0));
                if (typeof totalWalkPoints !== 'undefined') totalWalkPoints = pt;
                try { localStorage.setItem(STORAGE_KEYS.pointsTotal, String(pt)); } catch (_) { /* ignore */ }
            }
            if (Array.isArray(fp.points_events)) {
                if (typeof completionEvents !== 'undefined') completionEvents = fp.points_events;
                try { localStorage.setItem(STORAGE_KEYS.pointsEvents, JSON.stringify(fp.points_events)); } catch (_) { /* ignore */ }
            }
            writeMeta({ updated_at: fp.updated_at || Date.now() / 1000 });
            if (typeof renderFootprints === 'function') renderFootprints();
            if (typeof renderRoutes === 'function') renderRoutes();
            if (typeof renderPointsBoard === 'function') renderPointsBoard();
            if (typeof renderRecentRoutes === 'function') renderRecentRoutes();
        } finally {
            _applyingCloud = false;
        }
    }

    async function pullFromCloud(opts) {
        const silent = opts && opts.silent;
        if (!global.CitywalkAuth || !CitywalkAuth.isLoggedIn()) return false;
        if (_syncing) return false;
        _syncing = true;
        try {
            const token = CitywalkAuth.getToken();
            const res = await fetch(`${CitywalkAuth.CW_API}/user/footprints`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.success) {
                if (!silent && typeof showToast === 'function') {
                    showToast(body.message || '同步失败');
                }
                return false;
            }
            const fp = body.footprints;
            const localMeta = readMeta();
            const serverTs = Number(fp.updated_at) || 0;
            const localTs = Number(localMeta.updated_at) || 0;
            const localPayload = collectPayload();
            const hasLocal = payloadHasLocalData(localPayload);
            if (serverTs === 0 && hasLocal) {
                await pushToCloud({ force: true });
                if (!silent && typeof showToast === 'function') showToast('本地数据已上传到账号');
                return true;
            }
            if (serverTs > localTs) {
                applyCloudAccountData(fp);
            } else if (serverTs < localTs && hasLocal) {
                await pushToCloud({ silent: true });
            }
            if (!silent && typeof showToast === 'function') showToast('已从云端同步');
            return true;
        } catch (e) {
            console.warn('account sync pull', e);
            if (!silent && typeof showToast === 'function') showToast('无法连接同步服务');
            return false;
        } finally {
            _syncing = false;
        }
    }

    async function pushToCloud(opts) {
        if (!global.CitywalkAuth || !CitywalkAuth.isLoggedIn()) return false;
        if (_syncing) return false;
        _syncing = true;
        try {
            const payload = collectPayload();
            const token = CitywalkAuth.getToken();
            const res = await fetch(`${CitywalkAuth.CW_API}/user/footprints`, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.success) {
                if (!(opts && opts.silent) && typeof showToast === 'function') {
                    showToast(body.message || '上传失败');
                }
                return false;
            }
            const fp = body.footprints;
            writeMeta({ updated_at: fp.updated_at || Date.now() / 1000 });
            return true;
        } catch (e) {
            console.warn('account sync push', e);
            return false;
        } finally {
            _syncing = false;
        }
    }

    let _debounce = null;
    function schedulePush() {
        if (_applyingCloud) return;
        if (!global.CitywalkAuth || !CitywalkAuth.isLoggedIn()) return;
        clearTimeout(_debounce);
        _debounce = setTimeout(function () {
            pushToCloud({ silent: true });
        }, 800);
    }

    async function onLoggedIn(opts) {
        if (opts && opts.uploadLocalFirst) {
            const pushed = await pushToCloud({ silent: true });
            if (pushed) {
                if (typeof showToast === 'function') showToast('本地数据已上传');
                return;
            }
        }
        await pullFromCloud({ silent: false });
    }

    global.CitywalkFootprintSync = {
        STORAGE_KEYS,
        pullFromCloud,
        pushToCloud,
        schedulePush,
        onLoggedIn,
    };
})(typeof window !== 'undefined' ? window : globalThis);
