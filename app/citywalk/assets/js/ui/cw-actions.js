// ========== Citywalk · 结果可操作化（导航闭环 / 反馈 / 天气联动 / 历史收藏） ==========
// 由 applyRouteResult（cw-route.js）在出路线后调用；按钮在 app.js 绑定。

// ---------- 导航闭环：高德深链 ----------
function amapNavUrl(toLng, toLat, toName, fromLng, fromLat) {
    const parts = [
        `to=${toLng},${toLat},${encodeURIComponent(toName || '终点')}`,
        'mode=walk',
        'policy=1',
        'coordinate=gaode',
        'callnative=1',
        'src=citywalk',
    ];
    if (typeof fromLng === 'number' && typeof fromLat === 'number') {
        parts.unshift(`from=${fromLng},${fromLat},${encodeURIComponent('起点')}`);
    }
    return 'https://uri.amap.com/navigation?' + parts.join('&');
}

// 单个打卡点的「导航到这」链接（从用户当前位置步行前往）
function amapPoiNavUrl(poi) {
    if (!poi || !Array.isArray(poi.location) || poi.location.length !== 2) return '';
    return amapNavUrl(poi.location[0], poi.location[1], poi.name || '打卡点');
}

// 整条路线：在高德打开步行导航（起点 → 终点）
function openRouteInAmap() {
    if (!CW.routeData || !CW.routeData.success || !CW.startPoint || !CW.endPoint) {
        showToast('请先规划一条路线');
        return;
    }
    const url = amapNavUrl(
        CW.endPoint.lng, CW.endPoint.lat, CW.endPoint.address || '终点',
        CW.startPoint.lng, CW.startPoint.lat
    );
    window.open(url, '_blank', 'noopener');
}

// ---------- ① 景点增强：出路线后懒加载图片+描述 ----------
function enrichPoiList(pois) {
    if (!Array.isArray(pois) || pois.length === 0) return;
    const items = document.querySelectorAll('#poiList .poi-item');
    pois.slice(0, 6).forEach((poi, i) => {
        const item = items[i];
        if (!item || !poi || !Array.isArray(poi.location) || poi.location.length !== 2) return;
        fetch(`${CW_API}/poi/enrich`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                name: poi.name,
                city: CW.currentCity,
                category: poi.type || poi.category || '',
                lng: poi.location[0],
                lat: poi.location[1],
            }),
        })
            .then(r => r.json())
            .then(data => { if (data && data.success) renderPoiEnrichment(item, data); })
            .catch(() => { /* 增强失败静默降级，不影响主流程 */ });
    });
}

function renderPoiEnrichment(item, data) {
    const body = item.querySelector('.poi-item-body');
    if (!body || item.querySelector('.poi-enrich')) return;
    const hasDesc = !!(data.description && data.description.trim());
    const photos = Array.isArray(data.photos) ? data.photos.slice(0, 3) : [];
    if (!hasDesc && photos.length === 0) return;

    const wrap = document.createElement('div');
    wrap.className = 'poi-enrich';

    if (hasDesc) {
        const d = document.createElement('div');
        d.className = 'poi-desc';
        d.textContent = data.description.trim(); // textContent 防注入
        wrap.appendChild(d);
    }
    if (photos.length) {
        const row = document.createElement('div');
        row.className = 'poi-photos';
        photos.forEach(url => {
            const img = document.createElement('img');
            img.className = 'poi-photo';
            img.loading = 'lazy';
            img.referrerPolicy = 'no-referrer';
            img.alt = '';
            img.onerror = () => img.remove(); // 防盗链/失效图自动移除
            img.src = url;
            row.appendChild(img);
        });
        wrap.appendChild(row);
    }
    // 导航链接之前插入，保持「描述/图 → 导航」的视觉顺序
    const nav = body.querySelector('.poi-nav');
    if (nav) body.insertBefore(wrap, nav);
    else body.appendChild(wrap);
}

// ---------- 结果·可执行反馈 ----------
const INDOOR_POI_TYPES = ['咖啡甜品', '商场'];

function syncResultNotesVisibility() {
    const details = document.getElementById('resultNotesDetails');
    if (!details) return;
    const hint = document.getElementById('routeEndHint');
    const fb = document.getElementById('routeFeedback');
    const wx = document.getElementById('weatherNudge');
    const hasHint = hint && hint.style.display !== 'none' && (hint.textContent || '').trim();
    const hasFb = fb && fb.style.display !== 'none' && (fb.innerHTML || '').trim();
    const hasWx = wx && wx.style.display !== 'none';
    if (hasHint || hasFb || hasWx) {
        details.hidden = false;
    } else {
        details.hidden = true;
        details.removeAttribute('open');
    }
}

function renderRouteFeedback(data) {
    const el = document.getElementById('routeFeedback');
    if (!el) return;
    const lines = [];

    const poiType = CW.selectedPoiType || '无偏好';
    const poiCount = Array.isArray(data.pois) ? data.pois.length : 0;
    if (poiType !== '无偏好') {
        lines.push(poiCount > 0
            ? `已按「<b>${poiType}</b>」为你筛选，沿途 <b>${poiCount}</b> 个打卡点。`
            : `按「<b>${poiType}</b>」筛选后这一带暂无合适打卡点，可换个区域或选「无偏好」。`);
    }

    // 计划 vs 实际偏差的可执行建议
    const planMin = data.plan_time_min;
    const walk = data.duration || 0;
    const pois = Array.isArray(data.pois) ? data.pois : [];
    const stay = pois.reduce((s, p) => s + (p.stay_time || 5), 0);
    const activity = typeof data.activity_total_min === 'number'
        ? data.activity_total_min
        : (typeof data.estimated_total_min === 'number' ? data.estimated_total_min : (walk + stay));
    const freeMin = Number(data.free_time_min);
    const tip = (data.route_tip || '').trim();
    const tipHasPlanGap = /比计划少约|超出计划约|预计比计划/.test(tip);
    const tipExplainsFree = /自由安排/.test(tip) && /与计划/.test(tip);
    if (typeof planMin === 'number' && planMin > 0 && !tipHasPlanGap && !tipExplainsFree) {
        const gap = planMin - activity;
        if (Number.isFinite(freeMin) && freeMin >= 15) {
            lines.push(
                `预计 <b>${activity}</b> 分钟为步行与打卡，约 <b>${Math.round(freeMin)}</b> 分钟可自由安排，合计与计划 <b>${planMin}</b> 分钟一致。`
            );
        } else if (gap >= 20) {
            lines.push(`预计 <b>${activity}</b> 分钟，比计划少约 <b>${gap}</b> 分钟——想多逛可切「氛围优先」或延长时间。`);
        } else if (gap <= -20) {
            lines.push(`预计 <b>${activity}</b> 分钟，超出计划约 <b>${-gap}</b> 分钟——想省力可切「省力直达」或缩短时间。`);
        }
    }

    if (lines.length === 0) {
        el.style.display = 'none';
        el.innerHTML = '';
        syncResultNotesVisibility();
        return;
    }
    el.innerHTML = lines.join('<br>');
    el.style.display = 'block';
    syncResultNotesVisibility();
}

// ---------- 结果·天气联动 ----------
function renderWeatherNudge(data) {
    const el = document.getElementById('weatherNudge');
    if (!el) return;
    el.style.display = 'none';
    el.innerHTML = '';

    if (!CW.liveWeatherData || CW.liveWeatherData.weather == null) return;
    if (INDOOR_POI_TYPES.includes(CW.selectedPoiType)) return; // 已是室内偏好

    const wx = String(CW.liveWeatherData.weather);
    const t = parseInt(CW.liveWeatherData.temperature, 10);
    let reason = '';
    if (wx.includes('雨') || wx.includes('雪')) reason = `今天${wx}`;
    else if (!isNaN(t) && t >= 32) reason = `今天较热（${t}℃）`;
    else if (!isNaN(t) && t <= 3) reason = `今天较冷（${t}℃）`;
    if (!reason) {
        syncResultNotesVisibility();
        return;
    }

    el.innerHTML = `
        <span class="weather-nudge-text">${reason}，要不要改走偏室内的「咖啡甜品」路线？</span>
        <button type="button" class="weather-nudge-btn" id="btnWeatherIndoor">改室内</button>`;
    el.style.display = 'flex';
    const btn = document.getElementById('btnWeatherIndoor');
    if (btn) btn.addEventListener('click', applyWeatherIndoorRoute);
    syncResultNotesVisibility();
}

function applyWeatherIndoorRoute() {
    CW.selectedPoiType = '咖啡甜品';
    document.querySelectorAll('.poi-type-group .poi-type-btn:not(.route-style-btn)').forEach(b => {
        const on = b.getAttribute('data-type') === '咖啡甜品';
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const nudge = document.getElementById('weatherNudge');
    if (nudge) nudge.style.display = 'none';
    if (CW.startPoint && CW.endPoint) {
        showToast('已切到室内偏好，正在重规划');
        generateRoute();
    } else {
        showToast('已切到「咖啡甜品」偏好');
    }
}

// ---------- 路线历史 / 收藏（localStorage） ----------
const CW_HISTORY_KEY = 'cw_route_history_v1';
const CW_HISTORY_MAX = 12;

function loadRouteHistory() {
    try {
        const raw = localStorage.getItem(CW_HISTORY_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
    } catch (_) {
        return [];
    }
}

function saveRouteHistory(list) {
    try {
        localStorage.setItem(CW_HISTORY_KEY, JSON.stringify(list.slice(0, CW_HISTORY_MAX)));
    } catch (_) { /* 隐私模式/超额，忽略 */ }
}

function shortPlaceName(name, maxLen) {
    const s = String(name || '').trim();
    if (s.length <= maxLen) return s;
    return s.slice(0, maxLen) + '…';
}

function addRouteToHistory(data) {
    if (!CW.startPoint) return;
    const isLoop = data.mode === 'loop' || CW.planMode === 'loop';
    if (!isLoop && !CW.endPoint) return;
    const pois = Array.isArray(data.pois) ? data.pois : [];
    const startName = CW.startPoint.address || '起点';
    const endName = isLoop ? '' : (CW.endPoint?.address || '终点');
    const rec = {
        id: 'r' + Date.now(),
        ts: Date.now(),
        mode: isLoop ? 'loop' : 'route',
        city: CW.currentCity,
        start: { lng: CW.startPoint.lng, lat: CW.startPoint.lat, address: CW.startPoint.address || '' },
        end: isLoop
            ? { lng: CW.startPoint.lng, lat: CW.startPoint.lat, address: CW.startPoint.address || '' }
            : { lng: CW.endPoint.lng, lat: CW.endPoint.lat, address: CW.endPoint.address || '' },
        startName,
        endName,
        poiType: CW.selectedPoiType,
        routeStyle: CW.selectedRouteStyle,
        planTime: parseInt(document.getElementById('planTimeSlider')?.value, 10) || 60,
        distanceKm: (data.distance / 1000).toFixed(2),
        poiCount: pois.length,
        fav: false,
    };
    const list = loadRouteHistory();
    const dupIdx = list.findIndex(r => {
        if (r.mode === 'loop' || rec.mode === 'loop') {
            return r.city === rec.city && r.mode === rec.mode && r.startName === rec.startName;
        }
        return r.city === rec.city && r.startName === rec.startName && r.endName === rec.endName;
    });
    if (dupIdx >= 0) {
        rec.fav = list[dupIdx].fav;
        list.splice(dupIdx, 1);
    }
    list.unshift(rec);
    // 收藏置顶、其余按时间，整体不超上限
    saveRouteHistory(list);
    renderRecentRoutes();
}

function renderRecentRoutes() {
    const wrap = document.getElementById('recentRoutes');
    const listEl = document.getElementById('recentRoutesList');
    const detailsEl = document.getElementById('manualHistoryDetails');
    if (!wrap || !listEl) return;

    const list = loadRouteHistory()
        .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.ts - a.ts)
        .slice(0, 6);

    if (list.length === 0) {
        listEl.innerHTML = '';
        if (detailsEl) detailsEl.style.display = 'none';
        return;
    }

    listEl.innerHTML = '';
    list.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'recent-route-item';
        const date = new Date(rec.ts);
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const isLoop = rec.mode === 'loop';
        const title = isLoop
            ? `${rec.city} · 探索 · ${shortPlaceName(rec.startName, 18)}`
            : `${rec.city} · ${shortPlaceName(rec.startName, 12)} → ${shortPlaceName(rec.endName, 12)}`;
        item.innerHTML = `
            <button type="button" class="recent-route-fav" data-id="${rec.id}" title="收藏" aria-label="收藏">${rec.fav ? '⭐' : '☆'}</button>
            <div class="recent-route-main" data-id="${rec.id}" role="button" tabindex="0">
                <div class="recent-route-title">${title}</div>
                <div class="recent-route-sub">${rec.poiType || '无偏好'} · ${rec.distanceKm}km · ${rec.poiCount}点 · ${dateStr}</div>
            </div>
            <button type="button" class="recent-route-del" data-id="${rec.id}" title="删除" aria-label="删除">✕</button>`;
        listEl.appendChild(item);
    });
    if (detailsEl) detailsEl.style.display = '';
}

function toggleFavoriteRoute(id) {
    const list = loadRouteHistory();
    const rec = list.find(r => r.id === id);
    if (rec) {
        rec.fav = !rec.fav;
        saveRouteHistory(list);
        renderRecentRoutes();
    }
}

function deleteRouteFromHistory(id) {
    const list = loadRouteHistory().filter(r => r.id !== id);
    saveRouteHistory(list);
    renderRecentRoutes();
}

function clearRouteHistory() {
    saveRouteHistory([]);
    renderRecentRoutes();
}

function restoreRouteFromHistory(id) {
    const rec = loadRouteHistory().find(r => r.id === id);
    if (!rec) return;

    CW.currentCity = rec.city;
    const cityEl = document.getElementById('currentCity');
    if (cityEl) cityEl.textContent = CW.currentCity;
    if (CITY_COORDS[CW.currentCity]) {
        CW.currentCityCenter = CITY_COORDS[CW.currentCity];
        if (CW.map) CW.map.setCenter(CW.currentCityCenter);
    }
    getCityWeather(CW.currentCity, true);

    const isLoop = rec.mode === 'loop';
    if (typeof switchPlanMode === 'function') {
        switchPlanMode(isLoop ? 'loop' : 'route');
    }

    applyAgentParsedParams({
        poi_type: rec.poiType,
        route_style: rec.routeStyle,
        plan_time: rec.planTime,
    });

    setStartPoint({ lng: rec.start.lng, lat: rec.start.lat, address: rec.start.address });
    if (rec.start.address) {
        if (typeof setPickupStatusText === 'function') setPickupStatusText('startValue', rec.start.address);
        else document.getElementById('startValue').textContent = rec.start.address;
    }
    if (!isLoop) {
        setEndPoint({ lng: rec.end.lng, lat: rec.end.lat, address: rec.end.address });
        if (rec.end.address) {
            if (typeof setPickupStatusText === 'function') setPickupStatusText('endValue', rec.end.address);
            else document.getElementById('endValue').textContent = rec.end.address;
        }
    }

    if (typeof switchPanelTab === 'function') switchPanelTab('manual');
    CW.lastPlanTab = 'manual';
    showToast('已载入历史路线，正在重新规划');
    generateRoute();
}
