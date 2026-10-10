/**
 * 社区足迹/收藏：登录后云同步（替代仅 localStorage）
 * 依赖 community.js 中的 walkedRoutes、favoriteRouteIds 等全局变量。
 */
(function (global) {
    const SYNC_META_KEY = 'citywalk_footprint_sync_meta_v1';
    let _syncing = false;

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

    function collectPayload() {
        return {
            walked: typeof walkedRoutes !== 'undefined' ? walkedRoutes : [],
            favorite_routes: typeof favoriteRouteIds !== 'undefined' ? favoriteRouteIds : [],
            favorite_spots: typeof favoriteSpotKeys !== 'undefined' ? favoriteSpotKeys : [],
            planned_routes: typeof plannedRouteCatalog !== 'undefined' ? plannedRouteCatalog : {},
        };
    }

    function applyCloudFootprints(fp) {
        if (!fp) return;
        if (Array.isArray(fp.walked)) walkedRoutes = fp.walked;
        if (Array.isArray(fp.favorite_routes)) favoriteRouteIds = fp.favorite_routes;
        if (Array.isArray(fp.favorite_spots)) favoriteSpotKeys = fp.favorite_spots;
        if (fp.planned_routes && typeof fp.planned_routes === 'object') {
            plannedRouteCatalog = fp.planned_routes;
            Object.keys(plannedRouteCatalog).forEach(function (id) {
                const entry = plannedRouteCatalog[id];
                if (entry && entry.routeSpot && typeof routeSpots !== 'undefined' && !routeSpots[id]) {
                    routeSpots[id] = entry.routeSpot;
                }
            });
        }
        if (typeof saveArray === 'function') {
            saveArray(FOOTPRINT_STORAGE.walked, walkedRoutes);
            saveArray(FOOTPRINT_STORAGE.favoriteRoutes, favoriteRouteIds);
            saveArray(FOOTPRINT_STORAGE.favoriteSpots, favoriteSpotKeys);
        }
        if (typeof savePlannedCatalog === 'function') savePlannedCatalog();
        writeMeta({ updated_at: fp.updated_at || Date.now() / 1000 });
        if (typeof renderFootprints === 'function') renderFootprints();
        if (typeof renderRoutes === 'function') renderRoutes();
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
            const hasLocal = (localPayload.walked && localPayload.walked.length)
                || (localPayload.favorite_routes && localPayload.favorite_routes.length)
                || (localPayload.favorite_spots && localPayload.favorite_spots.length)
                || (localPayload.planned_routes && Object.keys(localPayload.planned_routes).length);
            if (serverTs === 0 && hasLocal) {
                await pushToCloud({ force: true });
                if (!silent && typeof showToast === 'function') showToast('本地足迹已上传到账号');
                return true;
            }
            if (serverTs > localTs) {
                applyCloudFootprints(fp);
            } else if (serverTs < localTs && hasLocal) {
                await pushToCloud({ silent: true });
            }
            if (!silent && typeof showToast === 'function') showToast('已从云端载入足迹');
            return true;
        } catch (e) {
            console.warn('footprint pull', e);
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
                    showToast(body.message || '上传足迹失败');
                }
                return false;
            }
            const fp = body.footprints;
            writeMeta({ updated_at: fp.updated_at || Date.now() / 1000 });
            return true;
        } catch (e) {
            console.warn('footprint push', e);
            return false;
        } finally {
            _syncing = false;
        }
    }

    let _debounce = null;
    function schedulePush() {
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
                if (typeof showToast === 'function') showToast('本地足迹已上传');
                return;
            }
        }
        await pullFromCloud({ silent: false });
    }

    global.CitywalkFootprintSync = {
        pullFromCloud,
        pushToCloud,
        schedulePush,
        onLoggedIn,
    };
})(typeof window !== 'undefined' ? window : globalThis);
