// ========== Citywalk · 可分享路线链接（无账号） ==========
// 优先短 query；过长则写入 sessionStorage，hash 带 id（同浏览器可复制）。

const CW_SHARE_SS_PREFIX = 'cw_share_payload_';
const CW_SHARE_URL_SOFT_MAX = 1800;

function _cwRoundCoord(n) {
    return parseFloat(Number(n).toFixed(5));
}

function buildShareableRoutePayload() {
    const isLoop = CW.planMode === 'loop' || (CW.routeData && CW.routeData.mode === 'loop');
    const payload = {
        v: 1,
        city: CW.currentCity,
        mode: isLoop ? 'loop' : 'route',
        duration: parseInt(document.getElementById('planTimeSlider')?.value, 10) || 60,
        poi: CW.selectedPoiType || '无偏好',
        style: CW.selectedRouteStyle || 'balanced',
        pace: CW.selectedVisitPace || 'checkin',
        tod: CW.selectedTimeOfDay || 'now',
        locked: !!CW.poiTypeLocked,
    };
    if (CW.startPoint) {
        payload.slng = _cwRoundCoord(CW.startPoint.lng);
        payload.slat = _cwRoundCoord(CW.startPoint.lat);
        if (CW.startPoint.address) payload.sn = String(CW.startPoint.address).slice(0, 40);
    }
    if (!isLoop && CW.endPoint) {
        payload.elng = _cwRoundCoord(CW.endPoint.lng);
        payload.elat = _cwRoundCoord(CW.endPoint.lat);
        if (CW.endPoint.address) payload.en = String(CW.endPoint.address).slice(0, 40);
    }
    const seeds = Array.isArray(CW.pinnedSeeds) ? CW.pinnedSeeds.slice(0, 3) : [];
    if (seeds.length) {
        payload.seeds = seeds.map(s => ({
            n: String(s.name || '').slice(0, 24),
            lng: _cwRoundCoord(s.lng),
            lat: _cwRoundCoord(s.lat),
        })).filter(s => s.n && Number.isFinite(s.lng) && Number.isFinite(s.lat));
    }
    return payload;
}

function encodeShareQuery(payload) {
    const q = new URLSearchParams();
    q.set('cw', '1');
    q.set('city', payload.city || '');
    q.set('mode', payload.mode || 'route');
    q.set('t', String(payload.duration || 60));
    q.set('poi', payload.poi || '无偏好');
    q.set('style', payload.style || 'balanced');
    q.set('pace', payload.pace || 'checkin');
    q.set('tod', payload.tod || 'now');
    if (payload.locked) q.set('plock', '1');
    if (payload.slng != null) q.set('slng', String(payload.slng));
    if (payload.slat != null) q.set('slat', String(payload.slat));
    if (payload.sn) q.set('sn', payload.sn);
    if (payload.elng != null) q.set('elng', String(payload.elng));
    if (payload.elat != null) q.set('elat', String(payload.elat));
    if (payload.en) q.set('en', payload.en);
    if (Array.isArray(payload.seeds) && payload.seeds.length) {
        q.set('seeds', payload.seeds.map(s =>
            `${encodeURIComponent(s.n)}~${s.lng}~${s.lat}`
        ).join('|'));
    }
    return q.toString();
}

function buildShareableRouteUrl() {
    const payload = buildShareableRoutePayload();
    const qs = encodeShareQuery(payload);
    const base = `${location.origin}${location.pathname}`;
    const full = `${base}?${qs}`;
    if (full.length <= CW_SHARE_URL_SOFT_MAX) {
        return full;
    }
    const id = 's' + Date.now().toString(36);
    try {
        sessionStorage.setItem(CW_SHARE_SS_PREFIX + id, JSON.stringify(payload));
    } catch (_) { /* ignore */ }
    return `${base}#cwshare=${id}`;
}

async function copyShareableRouteLink() {
    if (!CW.routeData || !CW.routeData.success) {
        showToast('请先规划一条路线');
        return;
    }
    const url = buildShareableRouteUrl();
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(url);
        } else {
            const ta = document.createElement('textarea');
            ta.value = url;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
        }
        showToast('链接已复制，可分享给同伴');
    } catch (e) {
        console.warn(e);
        showToast('复制失败，请手动选中地址栏参数');
    }
}

function parseShareSeeds(raw) {
    if (!raw) return [];
    return String(raw).split('|').map(part => {
        const bits = part.split('~');
        if (bits.length < 3) return null;
        const name = decodeURIComponent(bits[0] || '');
        const lng = parseFloat(bits[1]);
        const lat = parseFloat(bits[2]);
        if (!name || !Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        return { name, lng, lat };
    }).filter(Boolean).slice(0, 3);
}

function parseShareableRouteFromLocation() {
    const params = new URLSearchParams(location.search);
    if (params.get('cw') === '1') {
        return {
            city: params.get('city') || '',
            mode: params.get('mode') === 'loop' ? 'loop' : 'route',
            duration: parseInt(params.get('t'), 10) || 60,
            poi: params.get('poi') || '无偏好',
            style: params.get('style') || 'balanced',
            pace: params.get('pace') || 'checkin',
            tod: params.get('tod') || 'now',
            locked: params.get('plock') === '1',
            slng: parseFloat(params.get('slng')),
            slat: parseFloat(params.get('slat')),
            sn: params.get('sn') || '',
            elng: parseFloat(params.get('elng')),
            elat: parseFloat(params.get('elat')),
            en: params.get('en') || '',
            seeds: parseShareSeeds(params.get('seeds')),
        };
    }
    const m = (location.hash || '').match(/cwshare=([A-Za-z0-9_-]+)/);
    if (m) {
        try {
            const raw = sessionStorage.getItem(CW_SHARE_SS_PREFIX + m[1]);
            if (raw) return JSON.parse(raw);
        } catch (_) { /* ignore */ }
    }
    return null;
}

/** 待恢复的分享载荷；起终点须等地图就绪后再落点 */
let _cwPendingSharePayload = null;
let _cwSharePrefsApplied = false;
let _cwShareEndpointsApplied = false;

function sharePayloadNeedsEndpoints(payload) {
    if (!payload) return false;
    if (!(Number.isFinite(payload.slng) && Number.isFinite(payload.slat))) return false;
    if (payload.mode === 'loop') return true;
    return Number.isFinite(payload.elng) && Number.isFinite(payload.elat);
}

function applyShareableRoutePrefs(payload) {
    if (!payload || _cwSharePrefsApplied) return false;
    if (payload.city) {
        CW.currentCity = payload.city;
        const cityEl = document.getElementById('currentCity');
        if (cityEl) cityEl.textContent = CW.currentCity;
        if (CITY_COORDS[CW.currentCity]) {
            CW.currentCityCenter = CITY_COORDS[CW.currentCity];
            if (CW.map) CW.map.setCenter(CW.currentCityCenter);
        }
    }
    if (typeof switchPlanMode === 'function') {
        switchPlanMode(payload.mode === 'loop' ? 'loop' : 'route');
    }
    applyAgentParsedParams({
        poi_type: payload.poi || payload.poi_type,
        route_style: payload.style || payload.route_style,
        plan_time: payload.duration || payload.plan_time,
        visit_pace: payload.pace || payload.visit_pace,
        time_of_day: payload.tod || payload.time_of_day,
    });
    if (payload.locked) CW.poiTypeLocked = true;

    CW.pinnedSeeds = Array.isArray(payload.seeds)
        ? payload.seeds.map(s => ({
            name: s.n || s.name,
            lng: s.lng,
            lat: s.lat,
        })).filter(s => s.name && Number.isFinite(s.lng) && Number.isFinite(s.lat)).slice(0, 3)
        : [];
    if (typeof renderPinnedSeeds === 'function') renderPinnedSeeds();
    updateBtnStatus();
    _cwSharePrefsApplied = true;
    return true;
}

/** 地图就绪后落点；地图缺失时不抛错、不标成功 */
function applyShareableRouteEndpoints(payload) {
    if (!payload || _cwShareEndpointsApplied) return _cwShareEndpointsApplied;
    if (!sharePayloadNeedsEndpoints(payload)) {
        _cwShareEndpointsApplied = true;
        return true;
    }
    if (!CW.map || !window.AMap) return false;

    try {
        if (Number.isFinite(payload.slng) && Number.isFinite(payload.slat)) {
            setStartPoint({
                lng: payload.slng,
                lat: payload.slat,
                address: payload.sn || '',
            });
            if (payload.sn && typeof setPickupStatusText === 'function') {
                setPickupStatusText('startValue', payload.sn);
            }
        }
        if (payload.mode !== 'loop' && Number.isFinite(payload.elng) && Number.isFinite(payload.elat)) {
            setEndPoint({
                lng: payload.elng,
                lat: payload.elat,
                address: payload.en || '',
            });
            if (payload.en && typeof setPickupStatusText === 'function') {
                setPickupStatusText('endValue', payload.en);
            }
        }
        if (payload.city && CITY_COORDS[payload.city] && CW.map) {
            CW.map.setCenter(CITY_COORDS[payload.city]);
        }
        updateBtnStatus();
        _cwShareEndpointsApplied = true;
        return true;
    } catch (e) {
        console.warn('分享起终点落点失败（地图可能未就绪）', e);
        return false;
    }
}

function showShareRestoreBanner(payload) {
    if (!payload) return;
    const banner = document.getElementById('shareRestoreBanner');
    const text = document.getElementById('shareRestoreText');
    if (text) {
        text.textContent = `已载入分享参数：${payload.city || CW.currentCity} · ${payload.duration || 60} 分钟`;
    }
    if (banner) banner.hidden = false;
}

/**
 * 地图就绪后重试起终点落点；成功后再显示横幅。
 * 无坐标的分享仅展示偏好横幅。
 */
function finishShareRestoreAfterMapReady() {
    const payload = _cwPendingSharePayload;
    if (!payload) return;
    applyShareableRoutePrefs(payload);
    const endpointsOk = applyShareableRouteEndpoints(payload);
    if (!endpointsOk) return;
    showShareRestoreBanner(payload);
    // 不自动请求 API
}

function applyShareableRouteForm(payload) {
    if (!payload) return false;
    _cwPendingSharePayload = payload;
    applyShareableRoutePrefs(payload);
    return applyShareableRouteEndpoints(payload);
}

function initShareableRouteFromUrl() {
    const payload = parseShareableRouteFromLocation();
    if (!payload) return;
    _cwPendingSharePayload = payload;
    applyShareableRoutePrefs(payload);
    // 有坐标：等地图就绪再落点并显示横幅；无坐标：直接显示横幅
    if (!sharePayloadNeedsEndpoints(payload)) {
        showShareRestoreBanner(payload);
        return;
    }
    if (CW.map) finishShareRestoreAfterMapReady();
    // 否则由 __cwOnAMapReady / initMap 末尾重试
}
