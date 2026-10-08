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

function getNextStopNavTarget() {
    const pois = (CW.routeData && Array.isArray(CW.routeData.pois)) ? CW.routeData.pois : [];
    if (!pois.length) return null;
    const progress = Number.isFinite(CW.walkProgressIndex) ? CW.walkProgressIndex : -1;
    let nextIndex = -1;
    for (let i = progress + 1; i < pois.length; i++) {
        const poi = pois[i];
        if (!poi) continue;
        if (typeof isPoiSkipped === 'function' && isPoiSkipped(poi, i)) continue;
        if (!Array.isArray(poi.location) || poi.location.length !== 2) continue;
        nextIndex = i;
        break;
    }
    if (nextIndex < 0) return null;

    let fromLng = CW.startPoint ? CW.startPoint.lng : null;
    let fromLat = CW.startPoint ? CW.startPoint.lat : null;
    if (progress >= 0) {
        for (let i = progress; i >= 0; i--) {
            const prev = pois[i];
            if (!prev || (typeof isPoiSkipped === 'function' && isPoiSkipped(prev, i))) continue;
            if (Array.isArray(prev.location) && prev.location.length === 2) {
                fromLng = prev.location[0];
                fromLat = prev.location[1];
                break;
            }
        }
    }
    const poi = pois[nextIndex];
    return {
        toLng: poi.location[0],
        toLat: poi.location[1],
        toName: poi.name || '下一站',
        fromLng,
        fromLat,
        index: nextIndex,
    };
}

function updateNextStopButton() {
    const btn = document.getElementById('btnNextStop');
    const actions = document.getElementById('routeActions');
    if (!btn) return;
    const target = getNextStopNavTarget();
    if (!target) {
        btn.disabled = true;
        btn.textContent = '🚶 暂无下一站';
        if (actions && CW.routeData) actions.style.display = 'block';
        return;
    }
    btn.disabled = false;
    btn.textContent = `🚶 下一站：${String(target.toName).slice(0, 12)}`;
}

function openNextStopInAmap() {
    const target = getNextStopNavTarget();
    if (!target) {
        showToast('当前没有可前往的下一站');
        return;
    }
    const url = amapNavUrl(
        target.toLng, target.toLat, target.toName,
        target.fromLng, target.fromLat
    );
    CW.walkProgressIndex = target.index;
    updateNextStopButton();
    window.open(url, '_blank', 'noopener');
}

// ---------- 必去点（seed） ----------
const CW_PIN_MAX = 3;

function getCombinedPlanSeeds() {
    const pinned = Array.isArray(CW.pinnedSeeds) ? CW.pinnedSeeds.slice(0, CW_PIN_MAX) : [];
    const insp = typeof getSelectedInspirationSeeds === 'function' ? getSelectedInspirationSeeds() : [];
    const out = [];
    const seen = new Set();
    function pushSeed(s) {
        if (!s || !s.name) return;
        const key = `${s.name}|${s.lng}|${s.lat}`;
        if (seen.has(key)) return;
        if (typeof s.lng !== 'number' || typeof s.lat !== 'number') return;
        seen.add(key);
        out.push({
            name: s.name,
            reason: s.reason || '必去点',
            category: s.category || '',
            lng: s.lng,
            lat: s.lat,
        });
    }
    pinned.forEach(pushSeed);
    insp.forEach(pushSeed);
    return out;
}

function renderPinnedSeeds() {
    const panel = document.getElementById('pinnedSeedsPanel');
    const list = document.getElementById('pinnedSeedsList');
    if (!panel || !list) return;
    const seeds = Array.isArray(CW.pinnedSeeds) ? CW.pinnedSeeds : [];
    if (seeds.length === 0) {
        panel.hidden = true;
        list.innerHTML = '';
        return;
    }
    panel.hidden = false;
    list.innerHTML = '';
    seeds.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'pinned-seed-item';
        const name = document.createElement('span');
        name.className = 'pinned-seed-name';
        name.textContent = s.name || '未命名';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'pinned-seed-del';
        del.setAttribute('aria-label', '移除必去点');
        del.textContent = '✕';
        del.addEventListener('click', () => removePinnedSeed(i));
        row.appendChild(name);
        row.appendChild(del);
        list.appendChild(row);
    });
}

function confirmPinnedOrRouteStop(spot) {
    if (CW.addingRouteStop && CW.routeData && typeof addStopToRouteAndReplan === 'function') {
        addStopToRouteAndReplan(spot);
        return;
    }
    pinMustGoSpot(spot);
}

function pinMustGoSpot(spot) {
    if (!spot || typeof spot.lng !== 'number' || typeof spot.lat !== 'number') {
        showToast('无法订为必去：缺少坐标');
        return false;
    }
    if (!Array.isArray(CW.pinnedSeeds)) CW.pinnedSeeds = [];
    const exists = CW.pinnedSeeds.some(s =>
        s.name === spot.name && Math.abs(s.lng - spot.lng) < 1e-5 && Math.abs(s.lat - spot.lat) < 1e-5
    );
    if (exists) {
        showToast('该点已在必去列表');
        return false;
    }
    if (CW.pinnedSeeds.length >= CW_PIN_MAX) {
        showToast(`必去点最多 ${CW_PIN_MAX} 个，请先移除再添加`);
        return false;
    }
    CW.pinnedSeeds.push({
        name: spot.name || '必去点',
        lng: spot.lng,
        lat: spot.lat,
        reason: spot.reason || '用户指定必去',
        category: spot.category || '',
    });
    renderPinnedSeeds();
    showToast(`已订为必去：${spot.name || '地点'}`);
    return true;
}

function removePinnedSeed(index) {
    if (!Array.isArray(CW.pinnedSeeds)) return;
    CW.pinnedSeeds.splice(index, 1);
    renderPinnedSeeds();
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
    const elNotes = document.getElementById('weatherNudge');
    const elResult = document.getElementById('weatherNudgeResult');
    [elNotes, elResult].forEach(el => {
        if (!el) return;
        el.style.display = 'none';
        el.innerHTML = '';
    });

    if (!CW.liveWeatherData || CW.liveWeatherData.weather == null) {
        syncResultNotesVisibility();
        return;
    }
    if (INDOOR_POI_TYPES.includes(CW.selectedPoiType)) {
        syncResultNotesVisibility();
        return;
    }

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

    const html = `
        <span class="weather-nudge-text">${reason}，建议改走偏室内的「咖啡甜品」路线</span>
        <button type="button" class="weather-nudge-btn" data-weather-indoor="1">改室内重规划</button>`;

    // 结果统计旁优先展示，便于发现；notes 内保留一份（隐藏以免重复）
    if (elResult) {
        elResult.innerHTML = html;
        elResult.style.display = 'flex';
        const btn = elResult.querySelector('[data-weather-indoor]');
        if (btn) btn.addEventListener('click', applyWeatherIndoorRoute);
    }
    if (elNotes) {
        elNotes.style.display = 'none';
        elNotes.innerHTML = '';
    }
    syncResultNotesVisibility();
}

function applyWeatherIndoorRoute() {
    CW.selectedPoiType = '咖啡甜品';
    CW.poiTypeLocked = true;
    document.querySelectorAll('.poi-type-group .poi-type-btn:not(.route-style-btn):not(.visit-pace-btn):not(.time-of-day-btn)').forEach(b => {
        const on = b.getAttribute('data-type') === '咖啡甜品';
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const nudge = document.getElementById('weatherNudge');
    if (nudge) nudge.style.display = 'none';
    const nudgeR = document.getElementById('weatherNudgeResult');
    if (nudgeR) nudgeR.style.display = 'none';
    if (CW.startPoint && (CW.planMode === 'loop' || CW.endPoint)) {
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
        visitPace: CW.selectedVisitPace || 'checkin',
        timeOfDay: CW.selectedTimeOfDay || 'now',
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

const CW_HISTORY_PREVIEW = 1;
let cwHistoryExpanded = false;

/** 将唯一的最近路线节点挂到当前规划 Tab 的主操作按钮下方；结果 Tab 不挂载。 */
function placeRecentRoutesBlock(tabName) {
    const wrap = document.getElementById('recentRoutesMain');
    if (!wrap) return;
    const name = tabName || CW.activePanelTab || 'agent';
    if (name === 'result') {
        // 留在上一规划 Tab 内，随该面板一并隐藏，不进入结果叙事区
        return;
    }
    if (name === 'manual') {
        const resetBtn = document.getElementById('btnReset');
        const manualPanel = document.getElementById('tab-panel-manual');
        if (resetBtn && resetBtn.parentNode) {
            resetBtn.parentNode.insertBefore(wrap, resetBtn.nextSibling);
        } else if (manualPanel) {
            manualPanel.appendChild(wrap);
        }
        return;
    }
    const agentBtn = document.getElementById('btnAgentPlan');
    const agentBox = document.querySelector('#tab-panel-agent .agent-box')
        || document.getElementById('tab-panel-agent');
    if (agentBtn && agentBtn.parentNode) {
        agentBtn.parentNode.insertBefore(wrap, agentBtn.nextSibling);
    } else if (agentBox) {
        agentBox.appendChild(wrap);
    }
}

function renderRecentRoutes() {
    const mainWrap = document.getElementById('recentRoutesMain');
    const mainList = document.getElementById('recentRoutesListMain');
    const expandBtn = document.getElementById('btnExpandRecent');
    const labelEl = document.getElementById('recentRoutesLabel');

    const list = loadRouteHistory()
        .sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0) || b.ts - a.ts);

    if (list.length === 0) {
        cwHistoryExpanded = false;
        if (mainWrap) mainWrap.hidden = true;
        if (mainList) mainList.innerHTML = '';
        if (expandBtn) expandBtn.hidden = true;
        if (labelEl) labelEl.textContent = '继续上次';
        return;
    }

    const canExpand = list.length > CW_HISTORY_PREVIEW;
    if (!canExpand) cwHistoryExpanded = false;
    const limit = (canExpand && cwHistoryExpanded) ? list.length : Math.min(list.length, CW_HISTORY_PREVIEW);

    if (labelEl) {
        labelEl.textContent = cwHistoryExpanded ? '最近路线' : '继续上次';
    }

    if (mainList) {
        mainList.innerHTML = '';
        list.slice(0, limit).forEach(rec => {
            const item = document.createElement('div');
            item.className = 'recent-route-item' + (cwHistoryExpanded ? '' : ' recent-route-item--resume');
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
                    <div class="recent-route-sub">${rec.poiType || '无偏好'} · ${rec.visitPace === 'relaxed' ? '慢慢逛' : '密集打卡'} · ${rec.distanceKm}km · ${rec.poiCount}点 · ${dateStr}</div>
                </div>
                <button type="button" class="recent-route-del" data-id="${rec.id}" title="删除" aria-label="删除">✕</button>`;
            mainList.appendChild(item);
        });
    }

    if (expandBtn) {
        if (canExpand) {
            expandBtn.hidden = false;
            expandBtn.textContent = cwHistoryExpanded ? '收起' : '全部';
        } else {
            expandBtn.hidden = true;
        }
    }

    // 结果 Tab 下宿主面板已隐藏；有历史时在规划 Tab 显示
    if (mainWrap) {
        mainWrap.hidden = CW.activePanelTab === 'result';
        mainWrap.classList.toggle('recent-routes--expanded', !!cwHistoryExpanded);
    }
}

function toggleRecentRoutesExpand() {
    cwHistoryExpanded = !cwHistoryExpanded;
    renderRecentRoutes();
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
        visit_pace: rec.visitPace || 'checkin',
        time_of_day: rec.timeOfDay || 'now',
    });
    if (rec.poiType && rec.poiType !== '无偏好') CW.poiTypeLocked = true;

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
