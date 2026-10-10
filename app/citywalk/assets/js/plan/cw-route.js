// ========== Citywalk · 路线规划模块 ==========

const PLAN_TIME_MIN = 30;
const PLAN_TIME_MAX = 240;

/** 将后端 route_tip 转为用户向展示（兼容未重启的旧响应） */
function formatRouteTipForDisplay(tip) {
    let t = String(tip ?? '').trim();
    if (!t) return t;
    t = t.replace(
        /地图「终」为目的地（\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*）/g,
        '地图「终」为目的地'
    );
    t = t.replace(/地图「终」为目的地（([^）]{1,80})）/g, (_m, inner) => {
        const label = String(inner ?? '').trim();
        if (/^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/.test(label)) {
            return '地图「终」为目的地';
        }
        return label ? `地图「终」为「${label}」` : '地图「终」为目的地';
    });
    t = t.replace(/路线沿氛围节点串点逛弄，已控制大幅折返。?/g, '已按「氛围优先」串联沿途，尽量避免绕远。');
    t = t.replace(/打卡点较多，步行路线仅串联部分节点以保障响应速度。?/g,
        '打卡点较多，地图上步行线展示其中一段；完整顺序见下方列表。');
    t = t.replace(/已展示起终点最短路线；打卡列表仍可参考，请稍后重试完整串点。?/g,
        '当前为起终点示意路线；打卡顺序请参考下方列表，稍后可重新规划。');
    t = t.replace(/预计比计划少约\s*\d+\s*分钟[^。]*。?/g, '');
    t = t.replace(/起终点较近，各点已按约\s*\d+\s*分钟估算[^。]*。?/g,
        '各站停留已按行程估算；若仍觉得偏短，可在店内多留一会儿。');
    return t.replace(/\s{2,}/g, ' ').trim();
}

function openResultChatOnPlan() {
    // 对话输入默认可见（不再依赖两层折叠）
    const chat = document.getElementById('resultChatDetails');
    if (chat) {
        chat.hidden = false;
        if ('open' in chat) chat.open = true;
    }
}

function expandControlPanelForResult() {
    const controlPanel = document.querySelector('.control-panel');
    if (controlPanel && window.matchMedia('(max-width: 768px)').matches) {
        controlPanel.classList.add('expanded');
    }
}

function resolvePlanTimeMin(data) {
    const fromApi = Number(data && data.plan_time_min);
    if (Number.isFinite(fromApi) && fromApi > 0) return fromApi;
    const submitted = Number(CW.submittedPlanTimeMin);
    if (Number.isFinite(submitted) && submitted > 0) return submitted;
    return null;
}

/** 写入结果区 DOM 并切换到「路线结果」Tab（地图绘线完成后调用） */
function presentRouteToUser(data) {
    const pois = Array.isArray(data.pois) ? data.pois : [];
    const walkDuration = data.duration || 0;
    const poiStayTime = pois.reduce((sum, p) => sum + (p.stay_time || 5), 0);
    const activityMin = typeof data.activity_total_min === 'number'
        ? data.activity_total_min
        : (typeof data.estimated_total_min === 'number'
            ? data.estimated_total_min
            : (walkDuration + poiStayTime));
    const freeMin = Number(data.free_time_min);
    const planMin = resolvePlanTimeMin(data);
    const submitted = Number(CW.submittedPlanTimeMin);
    if (Number.isFinite(submitted) && planMin !== null && Math.abs(planMin - submitted) >= 5) {
        console.warn('计划时长与滑块不一致', { planMin, submitted });
    }

    const distanceEl = document.getElementById('distanceValue');
    const planEl = document.getElementById('durationPlanValue');
    const estEl = document.getElementById('durationEstValue');
    const freeEl = document.getElementById('durationFreeValue');
    const durationLegacy = document.getElementById('durationValue');
    const poiCountEl = document.getElementById('poiCountValue');
    if (distanceEl) distanceEl.textContent = (data.distance / 1000).toFixed(2) + ' km';
    if (planEl && estEl) {
        planEl.textContent = (planMin !== null) ? `计划 ${planMin} 分钟` : '计划 --';
        estEl.textContent = `预计 ${activityMin} 分钟（步行+打卡）`;
        if (freeEl) {
            if (Number.isFinite(freeMin) && freeMin > 10) {
                freeEl.textContent = `含自由安排约 ${Math.round(freeMin)} 分钟`;
                freeEl.style.display = 'block';
            } else {
                freeEl.textContent = '';
                freeEl.style.display = 'none';
            }
        }
    } else if (durationLegacy) {
        const freeSuffix = (Number.isFinite(freeMin) && freeMin > 10)
            ? ` · 自由 ${Math.round(freeMin)} 分`
            : '';
        durationLegacy.textContent = (planMin !== null)
            ? `计划 ${planMin} 分钟 · 预计 ${activityMin} 分钟${freeSuffix}`
            : (activityMin + ' 分钟');
    }
    if (poiCountEl) poiCountEl.textContent = pois.length + '个';

    if (typeof renderResultNarrative === 'function') {
        renderResultNarrative(data, pois, planMin, activityMin, freeMin);
    }

    CW.skippedPoiKeys = {};
    CW.walkProgressIndex = -1;
    renderPoiList(pois);
    if (typeof updateNextStopButton === 'function') updateNextStopButton();

    const routeEndHint = document.getElementById('routeEndHint');
    if (routeEndHint) {
        try {
            if (data.route_tip) {
                routeEndHint.textContent = formatRouteTipForDisplay(data.route_tip);
                routeEndHint.style.display = 'block';
            } else if (pois.length > 0) {
                routeEndHint.textContent =
                    '地图「终」为目的地；编号 1–' + pois.length + ' 为沿途打卡，路线最后将抵达终点。';
                routeEndHint.style.display = 'block';
            } else {
                routeEndHint.style.display = 'none';
                routeEndHint.textContent = '';
            }
            if (typeof syncResultNotesVisibility === 'function') syncResultNotesVisibility();
        } catch (e) {
            console.error('路线说明渲染失败：', e);
            routeEndHint.style.display = 'none';
            routeEndHint.textContent = '';
        }
    }

    const resultHeader = document.querySelector('.result-header');
    if (resultHeader) {
        resultHeader.textContent = data.mode === 'loop' ? '探索路线规划完成' : '路线规划完成';
    }

    const resultAreaEl = document.getElementById('resultArea');
    if (resultAreaEl) resultAreaEl.style.display = 'block';

    if (typeof setResultTabAvailable === 'function') setResultTabAvailable(true);
    openResultChatOnPlan();
    expandControlPanelForResult();
    if (typeof switchPanelTab === 'function') {
        switchPanelTab('result', { auto: true, force: true });
    }

    // 起终点导航仅在直线路线可用；「下一站」环线与直线均提供
    const routeActions = document.getElementById('routeActions');
    const btnOpenAmap = document.getElementById('btnOpenAmap');
    if (routeActions) routeActions.style.display = 'block';
    if (btnOpenAmap) btnOpenAmap.style.display = data.mode === 'loop' ? 'none' : '';

    if (typeof window.CitywalkBridge !== 'undefined') {
        const summaryPayload = window.CitywalkBridge.buildRoutePayloadFromCW();
        window.CitywalkBridge.updateRouteSummaryCard(summaryPayload);
    }

    if (resultHeader && typeof resultHeader.scrollIntoView === 'function') {
        resultHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

function renderResultNarrative(data, pois, planMin, activityMin, freeMin) {
    const el = document.getElementById('resultNarrative');
    if (!el) return;
    const list = Array.isArray(pois) ? pois : [];
    const optionalCount = list.filter(p => p && p.optional).length;
    const reasons = list
        .map(p => (p && p.recommendation_reason) ? String(p.recommendation_reason).trim() : '')
        .filter(Boolean);
    const why = reasons[0]
        ? reasons[0].slice(0, 48) + (reasons[0].length > 48 ? '…' : '')
        : (CW.selectedPoiType && CW.selectedPoiType !== '无偏好'
            ? `按「${CW.selectedPoiType}」偏好串联`
            : '沿途综合氛围与绕路成本筛选');
    const tip = data && data.route_tip ? formatRouteTipForDisplay(data.route_tip) : '';
    const parts = [];
    parts.push(`为何这些站：${why}`);
    if (optionalCount > 0) {
        parts.push(`其中 ${optionalCount} 个标「可选」，可按体力跳过`);
    }
    if (planMin != null) {
        let timeLine = `计划 ${planMin} 分钟 · 预计步行+打卡约 ${activityMin} 分钟`;
        if (Number.isFinite(freeMin) && freeMin > 10) {
            timeLine += ` · 自由安排约 ${Math.round(freeMin)} 分钟`;
        }
        parts.push(timeLine);
    }
    if (tip && tip.indexOf('已保留你指定的站点') !== -1) {
        parts.push('已保留你指定的站点，预计会超过计划时长');
    } else if (tip && tip.length < 60) {
        parts.push(tip);
    }
    el.textContent = parts.join('。') + '。';
}

function ensureResultTabVisible() {
    if (typeof setResultTabAvailable === 'function') setResultTabAvailable(true);
    expandControlPanelForResult();
    if (typeof switchPanelTab === 'function') {
        switchPanelTab('result', { force: true });
    }
}

function setPickupStatusText(elementId, text) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const t = text || '';
    el.textContent = t;
    el.title = t;
}

function syncPanelSharedPlanMode() {
    const shared = document.getElementById('panel-shared');
    if (!shared) return;
    shared.classList.remove('plan-mode-route', 'plan-mode-loop');
    shared.classList.add(CW.planMode === 'loop' ? 'plan-mode-loop' : 'plan-mode-route');
}

function switchPlanMode(mode) {
    const m = mode === 'loop' ? 'loop' : 'route';
    const prev = CW.planMode;
    CW.planMode = m;

    const btnRoute = document.getElementById('modeBtnRoute');
    const btnLoop = document.getElementById('modeBtnLoop');
    const endCard = document.getElementById('endCard');
    const startLabel = document.querySelector('#startCard .label');
    const tipsText = document.querySelector('#planModeTips .tips-box-text');
    const routeStyleBlock = document.getElementById('routeStyleTitle');

    if (btnRoute) btnRoute.classList.toggle('plan-mode-btn--active', m === 'route');
    if (btnLoop) btnLoop.classList.toggle('plan-mode-btn--active', m === 'loop');
    if (endCard) endCard.style.display = m === 'loop' ? 'none' : '';
    if (startLabel) {
        startLabel.textContent = m === 'loop' ? '🎯 探索中心' : '📍 起点';
    }
    if (tipsText) {
        tipsText.textContent = m === 'loop'
            ? '请在地图上选择探索中心，将生成环线漫步路线'
            : '自然语言描述需求？请使用「智能规划」';
    }
    const styleGroup = document.querySelector('.route-style-group');
    if (routeStyleBlock) routeStyleBlock.style.display = m === 'loop' ? 'none' : '';
    if (styleGroup) styleGroup.style.display = m === 'loop' ? 'none' : '';

    syncPanelSharedPlanMode();

    if (m === 'loop' && prev === 'route') {
        CW.endPoint = null;
        if (CW.map && CW.endMarker) CW.map.remove(CW.endMarker);
        CW.endMarker = null;
        const endCardEl = document.getElementById('endCard');
        if (endCardEl) endCardEl.className = 'status-card';
        setPickupStatusText('endValue', '点击地图选择');
    }

    updateBtnStatus();
    if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
}

function updateBtnStatus() {
    const btn = document.getElementById('btnPlan');
    const agentBtn = document.getElementById('btnAgentPlan');
    const planTimeSlider = document.getElementById('planTimeSlider');
    const planTime = parseInt(planTimeSlider.value, 10);

    const isTimeValid = !isNaN(planTime) && planTime >= PLAN_TIME_MIN && planTime <= PLAN_TIME_MAX;
    let isPointValid = false;
    if (CW.planMode === 'loop') {
        isPointValid = !!CW.startPoint;
    } else {
        isPointValid = !!CW.startPoint && !!CW.endPoint;
    }

    if (isPointValid && isTimeValid) {
        btn.disabled = false;
        btn.innerText = CW.planMode === 'loop' ? '生成探索路线' : '生成路线';
    } else {
        btn.disabled = true;
        if (!isTimeValid) {
            btn.innerText = '设置游玩时长';
        } else if (CW.planMode === 'loop') {
            btn.innerText = '请先选择探索中心';
        } else {
            btn.innerText = '先在地图上选起终点';
        }
    }

    if (agentBtn) {
        const canAgent = isTimeValid && (
            typeof agentPlanCanSubmit === 'function' ? agentPlanCanSubmit() : false
        );
        agentBtn.disabled = !canAgent;
        agentBtn.title = canAgent
            ? ''
            : '请填写上方需求描述，或在地图选起终点';
    }
}

function resetSelection() {
    CW.startPoint = null;
    CW.endPoint = null;
    if (CW.startMarker) CW.map.remove(CW.startMarker);
    if (CW.endMarker) CW.map.remove(CW.endMarker);
    clearRouteOverlays();
    clearPoiMarkers();

    CW.startMarker = null;
    CW.endMarker = null;
    CW.routeData = null;
    CW.removedPoiNames = [];
    CW.addingRouteStop = false;
    const resetPanel = document.querySelector('.control-panel');
    if (resetPanel) resetPanel.classList.remove('result-adding-stop', 'search-focused');

    document.getElementById('startCard').className = 'status-card';
    document.getElementById('endCard').className = 'status-card';
    setPickupStatusText('startValue', '点击地图选择');
    setPickupStatusText('endValue', '点击地图选择');
    const resultArea = document.getElementById('resultArea');
    if (resultArea) resultArea.style.display = 'none';
    if (typeof window.CitywalkBridge !== 'undefined') {
        window.CitywalkBridge.updateRouteSummaryCard(null);
    }
    if (typeof setResultTabAvailable === 'function') {
        setResultTabAvailable(false);
        if (CW.activePanelTab === 'result' && typeof switchPanelTab === 'function') {
            switchPanelTab('manual');
        }
    }
    document.getElementById('poiList').innerHTML = '';
    const routeEndHintReset = document.getElementById('routeEndHint');
    if (routeEndHintReset) {
        routeEndHintReset.style.display = 'none';
        routeEndHintReset.textContent = '';
    }
    const routeFeedbackReset = document.getElementById('routeFeedback');
    if (routeFeedbackReset) {
        routeFeedbackReset.style.display = 'none';
        routeFeedbackReset.innerHTML = '';
    }
    const weatherNudgeReset = document.getElementById('weatherNudge');
    if (weatherNudgeReset) {
        weatherNudgeReset.style.display = 'none';
        weatherNudgeReset.innerHTML = '';
    }
    const resultNotesReset = document.getElementById('resultNotesDetails');
    if (resultNotesReset) {
        resultNotesReset.hidden = true;
        resultNotesReset.removeAttribute('open');
    }

    const planTimeSlider = document.getElementById('planTimeSlider');
    planTimeSlider.value = 60;
    document.getElementById('planTimeValue').textContent = '60 分钟';
    document.querySelectorAll('.poi-type-group .poi-type-btn:not(.route-style-btn):not(.visit-pace-btn):not(.time-of-day-btn)')
        .forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const defaultPoi = document.querySelector('.poi-type-btn[data-type="无偏好"]');
    if (defaultPoi) { defaultPoi.classList.add('active'); defaultPoi.setAttribute('aria-pressed', 'true'); }
    CW.selectedPoiType = "无偏好";
    CW.poiTypeLocked = false;

    document.querySelectorAll('.route-style-btn')
        .forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const defaultStyle = document.querySelector('.route-style-btn[data-style="balanced"]');
    if (defaultStyle) { defaultStyle.classList.add('active'); defaultStyle.setAttribute('aria-pressed', 'true'); }
    CW.selectedRouteStyle = "balanced";

    document.querySelectorAll('.visit-pace-btn')
        .forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const defaultPace = document.querySelector('.visit-pace-btn[data-pace="checkin"]');
    if (defaultPace) { defaultPace.classList.add('active'); defaultPace.setAttribute('aria-pressed', 'true'); }
    CW.selectedVisitPace = 'checkin';

    document.querySelectorAll('.time-of-day-btn')
        .forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const defaultTod = document.querySelector('.time-of-day-btn[data-tod="now"]');
    if (defaultTod) { defaultTod.classList.add('active'); defaultTod.setAttribute('aria-pressed', 'true'); }
    CW.selectedTimeOfDay = 'now';

    CW.pinnedSeeds = [];
    CW.skippedPoiKeys = {};
    if (typeof renderPinnedSeeds === 'function') renderPinnedSeeds();

    const narrativeReset = document.getElementById('resultNarrative');
    if (narrativeReset) narrativeReset.textContent = '';
    const weatherResultReset = document.getElementById('weatherNudgeResult');
    if (weatherResultReset) {
        weatherResultReset.style.display = 'none';
        weatherResultReset.innerHTML = '';
    }

    CW.agentSessionId = null;

    const chatLog = document.getElementById('agentChatLog');
    if (chatLog) chatLog.innerHTML = '';

    updateBtnStatus();
}

function generateRoute(options) {
    const opts = options || {};
    if (!opts.keepEdits) {
        CW.removedPoiNames = [];
        CW.addingRouteStop = false;
        const panel = document.querySelector('.control-panel');
        if (panel) panel.classList.remove('result-adding-stop');
    }
    CW.lastPlanTab = 'manual';
    const isLoop = CW.planMode === 'loop';
    if (!CW.startPoint) {
        showToast(isLoop ? '请先选择探索中心' : '先选好起点和终点吧');
        return;
    }
    if (!isLoop && !CW.endPoint) {
        showToast('先选好起点和终点吧');
        return;
    }

    const planTimeSlider = document.getElementById('planTimeSlider');
    let planTime = parseInt(planTimeSlider.value, 10);

    if (isNaN(planTime) || planTime < PLAN_TIME_MIN || planTime > PLAN_TIME_MAX) {
        showToast(`游玩时长请设在 ${PLAN_TIME_MIN}–${PLAN_TIME_MAX} 分钟之间`);
        return;
    }

    let poiType = (CW.selectedPoiType || '无偏好').trim();
    const tod = CW.selectedTimeOfDay || 'now';
    // 手动规划无 LLM：时段且未锁定偏好时，轻量偏置
    if ((tod === 'evening' || tod === 'night') && poiType === '无偏好' && !CW.poiTypeLocked) {
        poiType = '咖啡甜品';
    } else if (tod === 'morning' && poiType === '无偏好' && !CW.poiTypeLocked) {
        poiType = '自然';
    }

    const start = [parseFloat(CW.startPoint.lng.toFixed(6)), parseFloat(CW.startPoint.lat.toFixed(6))];
    const payload = {
        start: start,
        plan_time: planTime,
        poi_type: poiType,
        route_style: CW.selectedRouteStyle,
        ambience_profile: poiType,
        visit_pace: CW.selectedVisitPace || 'checkin',
        time_of_day: tod,
        city: CW.currentCity,
        mode: isLoop ? 'loop' : 'route',
    };
    if (!isLoop) {
        payload.end = [
            parseFloat(CW.endPoint.lng.toFixed(6)),
            parseFloat(CW.endPoint.lat.toFixed(6)),
        ];
    }
    if (Array.isArray(opts.seed_pois)) {
        if (opts.seed_pois.length > 0) payload.seed_pois = opts.seed_pois;
    } else {
        const seeds = typeof getCombinedPlanSeeds === 'function' ? getCombinedPlanSeeds() : [];
        if (seeds.length > 0) payload.seed_pois = seeds;
    }
    if (opts.keepEdits && Array.isArray(opts.excluded_poi_names) && opts.excluded_poi_names.length > 0) {
        payload.excluded_poi_names = opts.excluded_poi_names;
    }

    showLoadingSteps();

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 120000);

    fetch(`${CW_API}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        return response.json().catch(() => { throw new Error("后端返回数据格式错误"); })
            .then(data => ({ response, data }));
    })
    .then(({ response, data }) => {
        hideLoadingSteps();
        if (data && data.quota_exceeded) {
            const sec = data.retry_after || 30;
            showToast(data.message || `地图服务繁忙，请约 ${sec} 秒后再试`, 6000);
            return;
        }
        if (!response.ok) {
            const detail = (data && data.message) || `HTTP错误：${response.status}`;
            throw new Error(detail);
        }
        applyRouteResult(data);
    })
    .catch(error => {
        clearTimeout(timeoutId);
        let errorMsg = '';
        if (error.name === 'AbortError') {
            errorMsg = "规划用时有点久，试试缩短路线或稍后再来";
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = "网络好像不太顺畅，稍后再试一次吧";
        } else if (error.message.includes('JSON')) {
            errorMsg = "出了点小状况，请再试一次";
        } else {
            errorMsg = "路线没能规划出来，请再试一次";
        }
        if (typeof showLoadingFailure === 'function') {
            showLoadingFailure(errorMsg, generateRoute);
        } else {
            hideLoadingSteps();
            showToast(errorMsg);
        }
        console.error('路线规划错误：', error);
    });
}

function clearRouteOverlays() {
    const lines = Array.isArray(CW.routeLines) ? CW.routeLines.slice() : [];
    if (CW.routeLine && lines.indexOf(CW.routeLine) < 0) lines.push(CW.routeLine);
    lines.forEach((line) => {
        try {
            if (CW.map && line) CW.map.remove(line);
        } catch (e) { /* 覆盖物已不在地图上 */ }
    });
    clearRouteArrowMarkers();
    CW.routeLines = [];
    CW.routeLine = null;
    CW.routeRetrace = null;
    CW.routeArrowPath = null;
    CW.routeArrowSpans = null;
}

function cwMeters(a, b) {
    const R = 6371000;
    const rad = Math.PI / 180;
    const dLat = (b[1] - a[1]) * rad;
    const dLng = (b[0] - a[0]) * rad;
    const lat1 = a[1] * rad;
    const lat2 = b[1] * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function cwLngLat(p) {
    if (!p) return null;
    if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])];
    if (typeof p.lng === 'number' && typeof p.lat === 'number') return [p.lng, p.lat];
    if (typeof p.getLng === 'function') return [p.getLng(), p.getLat()];
    return null;
}

const RETRACE_CORRIDOR_M = 36;
const RETRACE_GAP_M = 18;
const RETRACE_MIN_M = 55;
// 终点附近这一小段是抵达，不是沿已画实线折返
const ARRIVAL_NEAR_M = 70;
const ARRIVAL_TAIL_M = 36;

function distToSegmentM(point, a, b) {
    const ab = cwMeters(a, b);
    if (ab < 0.4) return cwMeters(point, a);
    const ac = cwMeters(a, point);
    const bc = cwMeters(b, point);
    const t = Math.max(0, Math.min(1, (ac * ac + ab * ab - bc * bc) / (2 * ab * ab)));
    const proj = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    return cwMeters(point, proj);
}

function distToPathM(point, path) {
    let best = Infinity;
    for (let i = 0; i < path.length - 1; i++) {
        const d = distToSegmentM(point, path[i], path[i + 1]);
        if (d < best) best = d;
    }
    return best;
}

function pathCum(pts) {
    const c = new Array(pts.length);
    c[0] = 0;
    for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + cwMeters(pts[i - 1], pts[i]);
    return c;
}

function dirBetween(a, b) {
    const lat = ((a[1] + b[1]) * 0.5) * Math.PI / 180;
    const dx = (b[0] - a[0]) * Math.cos(lat);
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) return null;
    return [dx / len, dy / len];
}

function dirAt(pts, cum, i) {
    const target = 10;
    let a = i;
    let b = i;
    while (a > 0 && cum[i] - cum[a] < target) a--;
    while (b < pts.length - 1 && cum[b] - cum[i] < target) b++;
    if (a === b) return null;
    return dirBetween(pts[a], pts[b]);
}

function oppositeSegmentIndex(pts, cum, i) {
    const limit = cum[i] - RETRACE_GAP_M;
    if (limit < 20) return -1;
    const dir = dirAt(pts, cum, i);
    if (!dir) return -1;
    const lat = pts[i][1];
    const lng = pts[i][0];
    const cosLat = Math.cos(lat * Math.PI / 180) || 1;
    const padLat = 70 / 111320;
    const padLng = 70 / (111320 * cosLat);
    let best = -1;
    for (let j = 0; j < pts.length - 1 && cum[j] <= limit; j++) {
        if (cum[j + 1] > limit) continue;
        const a = pts[j];
        const b = pts[j + 1];
        if (a[1] < lat - padLat && b[1] < lat - padLat) continue;
        if (a[1] > lat + padLat && b[1] > lat + padLat) continue;
        if (a[0] < lng - padLng && b[0] < lng - padLng) continue;
        if (a[0] > lng + padLng && b[0] > lng + padLng) continue;
        if (distToSegmentM(pts[i], a, b) > RETRACE_CORRIDOR_M) continue;
        const segDir = dirBetween(a, b);
        if (!segDir) continue;
        if (dir[0] * segDir[0] + dir[1] * segDir[1] < -0.25) best = j;
    }
    return best;
}

function isRetraceVertex(pts, cum, i) {
    return oppositeSegmentIndex(pts, cum, i) >= 0;
}

function retracesSolidPrefix(pts, cum, i, spanStart) {
    const partner = oppositeSegmentIndex(pts, cum, i);
    return partner >= 0 && partner < spanStart;
}

function arrivalJoinIndex(pts, cum, spanStart, last) {
    const dest = pts[last];
    let end = last;
    while (end > spanStart) {
        const nearDest = cwMeters(pts[end], dest) <= ARRIVAL_NEAR_M;
        const onSolid = retracesSolidPrefix(pts, cum, end, spanStart);
        if (onSolid && !nearDest) break;
        end--;
    }
    if (end >= last) {
        while (end > spanStart && cum[last] - cum[end] < ARRIVAL_TAIL_M) end--;
    }
    if (end >= last) end = Math.max(spanStart, last - 1);
    return end;
}

function trimDestinationArrival(pts, spans) {
    if (!spans || !spans.length) return [];
    const last = pts.length - 1;
    const cum = pathCum(pts);
    const out = [];
    spans.forEach((sp) => {
        let end = sp.end;
        const reachesEnd = end >= last || (cum[last] - cum[Math.min(end, last)] <= ARRIVAL_TAIL_M);
        if (reachesEnd) end = Math.min(end, arrivalJoinIndex(pts, cum, sp.start, last));
        if (end > sp.start && cum[end] - cum[sp.start] >= RETRACE_MIN_M) {
            out.push({ start: sp.start, end: end });
        }
    });
    return out;
}

function spansFromMarks(mark, cum) {
    const spans = [];
    let start = -1;
    let last = -1;
    for (let i = 0; i < mark.length; i++) {
        if (mark[i]) {
            if (start < 0) start = i;
            last = i;
        } else if (start >= 0 && cum[i] - cum[last] > 32) {
            if (cum[last] - cum[start] >= RETRACE_MIN_M) spans.push({ start, end: last });
            start = -1;
            last = -1;
        }
    }
    if (start >= 0 && cum[last] - cum[start] >= RETRACE_MIN_M) spans.push({ start, end: last });
    return spans;
}

function halfRetraceSpan(pts) {
    let far = 0;
    let farD = -1;
    for (let i = 0; i < pts.length; i++) {
        const d = cwMeters(pts[0], pts[i]);
        if (d > farD) {
            farD = d;
            far = i;
        }
    }
    if (far < 2 || far >= pts.length - 1 || farD < 40) return null;
    const outbound = pts.slice(0, far + 1);
    const inbound = pts.slice(far);
    const samples = [];
    const step = Math.max(1, Math.floor(inbound.length / 24));
    for (let i = step; i < inbound.length; i += step) samples.push(distToPathM(inbound[i], outbound));
    if (samples.length < 2) return null;
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    if (median > RETRACE_CORRIDOR_M) return null;
    return [{ start: far, end: pts.length - 1 }];
}

function findRetraceSpans(pts) {
    if (!pts || pts.length < 6) return [];
    const byHalf = halfRetraceSpan(pts);
    if (byHalf) {
        const trimmed = trimDestinationArrival(pts, byHalf);
        if (trimmed.length) return trimmed;
    }
    const cum = pathCum(pts);
    if (cum[cum.length - 1] < RETRACE_MIN_M + RETRACE_GAP_M) return [];
    const mark = new Array(pts.length).fill(false);
    let nextCheck = RETRACE_GAP_M;
    for (let i = 1; i < pts.length; i++) {
        if (cum[i] + 0.01 < nextCheck && i !== pts.length - 1) continue;
        nextCheck = cum[i] + 8;
        if (isRetraceVertex(pts, cum, i)) mark[i] = true;
    }
    return trimDestinationArrival(pts, spansFromMarks(mark, cum));
}

function solidRanges(pointCount, spans) {
    const ranges = [];
    let cursor = 0;
    spans.slice().sort((a, b) => a.start - b.start).forEach((sp) => {
        const a = Math.max(0, Math.min(pointCount - 1, sp.start));
        const b = Math.max(0, Math.min(pointCount - 1, sp.end));
        if (a > cursor) ranges.push([cursor, a]);
        cursor = Math.max(cursor, b);
    });
    if (cursor < pointCount - 1) ranges.push([cursor, pointCount - 1]);
    return ranges.filter(([a, b]) => b > a);
}

function screenPoint(lnglat) {
    if (!CW.map || typeof CW.map.lngLatToContainer !== 'function') return null;
    const p = CW.map.lngLatToContainer(lnglat);
    if (!p) return null;
    const x = typeof p.getX === 'function' ? p.getX() : p.x;
    const y = typeof p.getY === 'function' ? p.getY() : p.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

function screenToLngLat(x, y) {
    if (!CW.map || typeof CW.map.containerToLngLat !== 'function' || typeof AMap === 'undefined') return null;
    const ll = CW.map.containerToLngLat(new AMap.Pixel(x, y));
    if (!ll) return null;
    const lng = typeof ll.getLng === 'function' ? ll.getLng() : ll.lng;
    const lat = typeof ll.getLat === 'function' ? ll.getLat() : ll.lat;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    return [lng, lat];
}

function makeRouteLine(path, options) {
    return new AMap.Polyline(Object.assign({
        path: path,
        lineJoin: 'round',
        lineCap: 'round',
    }, options));
}

const ARROW_SPACING_PX = 80;
const ARROW_RIGHT_PX = 10;
const ARROW_ZINDEX = 70;

function clearRouteArrowMarkers() {
    const marks = Array.isArray(CW.routeArrows) ? CW.routeArrows.slice() : [];
    marks.forEach((marker) => {
        try {
            if (CW.map && marker) CW.map.remove(marker);
        } catch (e) { /* 覆盖物已不在地图上 */ }
    });
    CW.routeArrows = [];
}

function screenCumDist(pts) {
    const c = new Array(pts.length);
    c[0] = 0;
    for (let i = 1; i < pts.length; i++) {
        c[i] = c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    return c;
}

function screenPointAt(pts, cum, dist) {
    const last = pts.length - 1;
    if (dist <= 0) return pts[0];
    if (dist >= cum[last]) return pts[last];
    let lo = 1;
    let hi = last;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < dist) lo = mid + 1;
        else hi = mid;
    }
    const span = cum[lo] - cum[lo - 1];
    const t = span > 1e-4 ? (dist - cum[lo - 1]) / span : 0;
    return {
        x: pts[lo - 1].x + (pts[lo].x - pts[lo - 1].x) * t,
        y: pts[lo - 1].y + (pts[lo].y - pts[lo - 1].y) * t,
    };
}

function screenTravelDir(pts, cum, dist) {
    const total = cum[cum.length - 1];
    const reach = 32;
    const a = screenPointAt(pts, cum, Math.max(0, dist - reach));
    const b = screenPointAt(pts, cum, Math.min(total, dist + reach));
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return null;
    return { x: dx / len, y: dy / len };
}

function projectRun(pts) {
    if (!pts || pts.length < 2) return null;
    const out = [];
    for (let i = 0; i < pts.length; i++) {
        const q = screenPoint(pts[i]);
        if (!q) return null;
        if (out.length && Math.hypot(q.x - out[out.length - 1].x, q.y - out[out.length - 1].y) < 0.4) continue;
        out.push(q);
    }
    return out.length >= 2 ? out : null;
}

function arrowsAlongRun(pts) {
    const screen = projectRun(pts);
    if (!screen) return [];
    const cum = screenCumDist(screen);
    const total = cum[cum.length - 1];
    if (!(total >= 48)) return [];
    const count = Math.max(1, Math.round((total - 36) / ARROW_SPACING_PX));
    const span = (count - 1) * ARROW_SPACING_PX;
    const start = (total - span) / 2;
    const arrows = [];
    for (let i = 0; i < count; i++) {
        const d = start + i * ARROW_SPACING_PX;
        const at = screenPointAt(screen, cum, d);
        const dir = screenTravelDir(screen, cum, d);
        if (!dir) continue;
        // 屏幕 y 向下：行进方向右侧为 (-dy, dx)，箭头不压在中线上
        const ll = screenToLngLat(
            at.x + (-dir.y) * ARROW_RIGHT_PX,
            at.y + dir.x * ARROW_RIGHT_PX
        );
        if (!ll) continue;
        arrows.push({
            position: ll,
            angle: Math.atan2(dir.x, -dir.y) * 180 / Math.PI,
        });
    }
    return arrows;
}

function routeArrowRuns(pts, spans) {
    if (!spans || !spans.length) return [pts];
    const runs = [];
    solidRanges(pts.length, spans).forEach(([a, b]) => {
        const piece = pts.slice(a, b + 1);
        if (piece.length >= 2) runs.push(piece);
    });
    spans.forEach((sp) => {
        const piece = pts.slice(sp.start, sp.end + 1);
        if (piece.length >= 2) runs.push(piece);
    });
    return runs.length ? runs : [pts];
}

function makeRouteArrow(position, angle) {
    const el = document.createElement('div');
    el.className = 'cw-route-chevron';
    el.style.transform = 'rotate(' + angle.toFixed(1) + 'deg)';
    el.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">'
        + '<path d="M2.2 8.4 L6 3.1 L9.8 8.4" fill="none" stroke="#1e293b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>'
        + '<path d="M2.2 8.4 L6 3.1 L9.8 8.4" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
        + '</svg>';
    return new AMap.Marker({
        position: position,
        content: el,
        anchor: 'center',
        zIndex: ARROW_ZINDEX,
        clickable: false,
        bubble: true,
    });
}

function routeStrokeOptions(primary) {
    return {
        strokeColor: primary,
        strokeWeight: 6,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        showDir: true,
        dirColor: '#ffffff',
        zIndex: 50,
    };
}

function drawRouteArrows() {
    clearRouteArrowMarkers();
    const pts = CW.routeArrowPath;
    if (!pts || pts.length < 2 || !CW.map || typeof AMap === 'undefined') return;
    const markers = [];
    routeArrowRuns(pts, CW.routeArrowSpans).forEach((run) => {
        arrowsAlongRun(run).forEach((arrow) => {
            markers.push(makeRouteArrow(arrow.position, arrow.angle));
        });
    });
    if (!markers.length) return;
    CW.map.add(markers);
    CW.routeArrows = markers;
}

function refreshRouteArrows() {
    if (!CW.routeArrowPath || !CW.map) return;
    drawRouteArrows();
}

function ensureRouteArrowZoom() {
    if (!CW.map || typeof CW.map.on !== 'function') return;
    if (CW._routeArrowZoomMap === CW.map && CW._onRouteArrowZoom) return;
    if (CW._routeArrowZoomMap && CW._onRouteArrowZoom && typeof CW._routeArrowZoomMap.off === 'function') {
        try { CW._routeArrowZoomMap.off('zoomend', CW._onRouteArrowZoom); } catch (e) { /* 旧地图已销毁 */ }
    }
    CW._onRouteArrowZoom = function () { refreshRouteArrows(); };
    CW._routeArrowZoomMap = CW.map;
    CW.map.on('zoomend', CW._onRouteArrowZoom);
}

function drawPlannedRoute(path, mode) {
    clearRouteOverlays();
    if (!CW.map || typeof AMap === 'undefined') return;
    const primary = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
    const pts = (path || []).map(cwLngLat).filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    const linePath = pts.length >= 2 ? pts : (path || []);
    if (!linePath || linePath.length < 2) return;
    const line = makeRouteLine(linePath, routeStrokeOptions(primary));
    CW.map.add(line);
    CW.routeLines = [line];
    CW.routeLine = line;
    CW.routeRetrace = null;
    if (pts.length < 2) return;
    CW.routeArrowPath = pts;
    CW.routeArrowSpans = findRetraceSpans(pts);
    ensureRouteArrowZoom();
    drawRouteArrows();
}

function reorderRoutePoisAndReplan(fromIndex, toIndex) {
    if (!CW.routeData || !Array.isArray(CW.routeData.pois)) return;
    const arr = CW.routeData.pois;
    const from = Number(fromIndex);
    const to = Number(toIndex);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return;
    if (from === to) return;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
    replanFromResultStops(collectKeptStopSeeds(null));
}

function bindPoiListDragReorder(poiList) {
    if (!poiList || poiList.dataset.dragBound === '1') return;
    poiList.dataset.dragBound = '1';
    let dragFrom = null;

    poiList.addEventListener('dragstart', (e) => {
        const item = e.target.closest('.poi-item[data-poi-index]');
        if (!item || !e.target.closest('.poi-drag-handle')) {
            e.preventDefault();
            return;
        }
        dragFrom = item.dataset.poiIndex;
        item.classList.add('poi-item--dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', dragFrom);
        }
    });

    poiList.addEventListener('dragend', (e) => {
        const item = e.target.closest('.poi-item[data-poi-index]');
        if (item) item.classList.remove('poi-item--dragging');
        poiList.querySelectorAll('.poi-item--drag-over').forEach((el) => el.classList.remove('poi-item--drag-over'));
        dragFrom = null;
    });

    poiList.addEventListener('dragover', (e) => {
        const item = e.target.closest('.poi-item[data-poi-index]');
        if (!item) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        poiList.querySelectorAll('.poi-item--drag-over').forEach((el) => {
            if (el !== item) el.classList.remove('poi-item--drag-over');
        });
        item.classList.add('poi-item--drag-over');
    });

    poiList.addEventListener('dragleave', (e) => {
        const item = e.target.closest('.poi-item[data-poi-index]');
        if (item) item.classList.remove('poi-item--drag-over');
    });

    poiList.addEventListener('drop', (e) => {
        e.preventDefault();
        const item = e.target.closest('.poi-item[data-poi-index]');
        if (!item) return;
        item.classList.remove('poi-item--drag-over');
        const from = dragFrom != null ? dragFrom : (e.dataTransfer && e.dataTransfer.getData('text/plain'));
        const to = item.dataset.poiIndex;
        if (from != null && to != null) reorderRoutePoisAndReplan(from, to);
    });
}

function renderRouteStopEditor(poiList) {
    const bar = document.createElement('div');
    bar.className = 'poi-edit-bar';
    const hint = document.createElement('p');
    hint.className = 'poi-edit-hint';
    hint.textContent = '拖动 ⋮⋮ 可调整站点顺序，将自动重新规划步行线';
    bar.appendChild(hint);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'poi-add-stop';
    btn.textContent = CW.addingRouteStop ? '取消添加' : '添加一站';
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleAddRouteStop();
    });
    bar.appendChild(btn);
    if (CW.addingRouteStop) {
        const hint = document.createElement('p');
        hint.className = 'poi-add-hint';
        hint.textContent = '搜索或长按地图，再点「加入此站」';
        bar.appendChild(hint);
    }
    poiList.appendChild(bar);
}

function toggleAddRouteStop() {
    const panel = document.querySelector('.control-panel');
    if (CW.addingRouteStop) {
        CW.addingRouteStop = false;
        if (panel) panel.classList.remove('result-adding-stop');
        if (CW.routeData && Array.isArray(CW.routeData.pois)) renderPoiList(CW.routeData.pois);
        return;
    }
    CW.addingRouteStop = true;
    if (panel) {
        panel.classList.add('result-adding-stop');
        if (window.matchMedia('(max-width: 768px)').matches) panel.classList.add('expanded');
    }
    if (CW.routeData && Array.isArray(CW.routeData.pois)) renderPoiList(CW.routeData.pois);
    const input = document.getElementById('searchInput');
    const narrow = window.matchMedia('(max-width: 768px) and (min-height: 501px)').matches;
    if (input && !narrow) input.focus();
}

function collectKeptStopSeeds(extraSpot) {
    const pois = (CW.routeData && Array.isArray(CW.routeData.pois)) ? CW.routeData.pois : [];
    const removed = new Set(CW.removedPoiNames || []);
    const seeds = [];
    const seen = new Set();
    pois.forEach((p) => {
        if (!p || !p.name || removed.has(p.name) || seen.has(p.name)) return;
        if (!Array.isArray(p.location) || p.location.length < 2) return;
        seen.add(p.name);
        seeds.push({
            name: p.name,
            lng: Number(p.location[0]),
            lat: Number(p.location[1]),
            reason: p.is_seed ? (p.recommendation_reason || '必去点') : '用户保留',
            category: p.type || p.category || '',
        });
    });
    if (extraSpot && extraSpot.name && !seen.has(extraSpot.name)) {
        seeds.push({
            name: extraSpot.name,
            lng: Number(extraSpot.lng),
            lat: Number(extraSpot.lat),
            reason: extraSpot.reason || '用户添加',
            category: extraSpot.category || '',
        });
    }
    return seeds;
}

function replanFromResultStops(seeds) {
    const excluded = (CW.removedPoiNames || []).filter((name) =>
        !(seeds || []).some((s) => s && s.name === name)
    );
    generateRoute({
        keepEdits: true,
        seed_pois: seeds || [],
        excluded_poi_names: excluded,
    });
}

function removeRouteStopAndReplan(index) {
    const pois = CW.routeData && Array.isArray(CW.routeData.pois) ? CW.routeData.pois : null;
    const poi = pois && pois[index];
    if (!poi) return;
    const name = poi.name || '';
    if (name) {
        if (!Array.isArray(CW.removedPoiNames)) CW.removedPoiNames = [];
        if (!CW.removedPoiNames.includes(name)) CW.removedPoiNames.push(name);
    }
    replanFromResultStops(collectKeptStopSeeds(null));
}

function addStopToRouteAndReplan(spot) {
    if (!spot || typeof spot.lng !== 'number' || typeof spot.lat !== 'number' || !CW.routeData) {
        if (typeof showToast === 'function') showToast('无法加入：缺少坐标');
        return;
    }
    const name = spot.name || '地图点';
    CW.addingRouteStop = false;
    const panel = document.querySelector('.control-panel');
    if (panel) panel.classList.remove('result-adding-stop');
    CW.removedPoiNames = (CW.removedPoiNames || []).filter((n) => n !== name);
    if (CW.infoWindow) CW.infoWindow.close();
    replanFromResultStops(collectKeptStopSeeds({
        name: name,
        lng: spot.lng,
        lat: spot.lat,
        reason: '用户添加',
        category: spot.category || '',
    }));
}

function applyRouteResult(data) {
    if (!data.success) {
        showToast(data.message || '这条路线没能规划出来，换个起终点试试');
        return;
    }

    if (!CW.map || typeof AMap === 'undefined') {
        showToast('地图还在加载，请稍后再试');
        return;
    }

    if (!Array.isArray(data.path) || data.path.length === 0) {
        showToast('这条路线没能规划出来，换个起终点试试');
        return;
    }

    if (!CW.startPoint) {
        showToast('探索中心还没准备好，请重试');
        return;
    }
    if (data.mode !== 'loop' && !CW.endPoint) {
        showToast('起点和终点还没准备好，请重试');
        return;
    }

    CW.routeData = data;

    if (data.degraded_route) {
        showToast(data.message || '已展示基础路线，完整串点请稍后重试', 4500);
    }
    if (Array.isArray(data.walking_segment_issues) && data.walking_segment_issues.length > 0) {
        const n = data.walking_segment_issues.length;
        showToast(n === 1 ? '有一段步行线未能拉取，已在说明里标注' : `有 ${n} 段步行线未能拉取，详见路线说明`, 5000);
    }

    drawPlannedRoute(data.path, data.mode);

    addPoiMarkers(data.pois);

    const fitTargets = [CW.startMarker, ...(CW.routeLines || []), ...CW.poiMarkers].filter(Boolean);
    if (CW.endMarker && data.mode !== 'loop') fitTargets.splice(1, 0, CW.endMarker);
    CW.map.setFitView(fitTargets, {
        padding: [50, 50, 50, 50],
        animate: true
    });

    const pois = Array.isArray(data.pois) ? data.pois : [];
    try {
        presentRouteToUser(data);
    } catch (e) {
        console.error('结果区渲染失败：', e);
        showToast('路线已在地图上生成，请查看「路线结果」', 5000);
        ensureResultTabVisible();
    }

    if (typeof renderRouteFeedback === 'function') renderRouteFeedback(data);
    if (typeof renderWeatherNudge === 'function') renderWeatherNudge(data);
    if (typeof addRouteToHistory === 'function') addRouteToHistory(data);
    if (typeof enrichPoiList === 'function') enrichPoiList(pois);

    getCityWeather(CW.currentCity, true);

    if (data.agent_message) {
        showToast(data.agent_message, 4500);
    }
}

function poiSkipKey(poi, index) {
    if (poi && poi.id) return String(poi.id);
    if (poi && Array.isArray(poi.location) && poi.location.length === 2) {
        return `${poi.name || ''}@${poi.location[0]},${poi.location[1]}`;
    }
    return `idx:${index}`;
}

function isPoiSkipped(poi, index) {
    return !!(CW.skippedPoiKeys && CW.skippedPoiKeys[poiSkipKey(poi, index)]);
}

function getActiveRoutePois() {
    const pois = (CW.routeData && Array.isArray(CW.routeData.pois)) ? CW.routeData.pois : [];
    return pois
        .map((poi, index) => ({ poi, index }))
        .filter(({ poi, index }) => poi && !isPoiSkipped(poi, index));
}

function renderPoiList(pois) {
    const poiList = document.getElementById('poiList');
    if (!poiList) return;
    poiList.innerHTML = '';
    renderRouteStopEditor(poiList);
    bindPoiListDragReorder(poiList);

    if (!Array.isArray(pois) || pois.length === 0) {
        poiList.innerHTML = `
            <div class="poi-item poi-empty">
                🗺️ 本次路线沿途暂无推荐打卡点，不妨随心漫步，说不定会有意外惊喜～
            </div>`;
        return;
    }

    pois.forEach((poi, index) => {
        const poiName = poi.name || '未知名称';
        const poiType = poi.type || '未知类型';
        const reason  = poi.recommendation_reason || '综合氛围与绕路成本推荐';
        const score   = (typeof poi.final_score === 'number') ? poi.final_score.toFixed(1) : null;
        const skipped = isPoiSkipped(poi, index);
        const poiItem = document.createElement('div');
        poiItem.className = 'poi-item' + (skipped ? ' poi-item--skipped' : '');
        poiItem.dataset.poiIndex = String(index);
        poiItem.setAttribute('role', 'button');
        poiItem.tabIndex = 0;
        poiItem.setAttribute('aria-label', `第 ${index + 1} 个打卡点 ${poiName}，在地图上定位`);
        const activatePoiItem = () => {
            poiList.querySelectorAll('.poi-item.active').forEach(el => el.classList.remove('active'));
            poiItem.classList.add('active');
            if (typeof highlightPoiMarker === 'function') highlightPoiMarker(index);
            if (poi.location && Array.isArray(poi.location) && poi.location.length === 2) {
                CW.map.setCenter(poi.location);
                CW.map.setZoom(17);
            }
        };
        poiItem.addEventListener('click', activatePoiItem);
        poiItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activatePoiItem();
            }
        });
        const navUrl = (typeof amapPoiNavUrl === 'function') ? amapPoiNavUrl(poi) : '';
        const navLink = navUrl
            ? `<a class="poi-nav" href="${navUrl}" target="_blank" rel="noopener">🧭 导航到这</a>`
            : '';
        const skipBtn = poi.optional
            ? `<button type="button" class="poi-skip-btn" data-poi-index="${index}">${skipped ? '恢复此站' : '跳过此站'}</button>`
            : '';
        const removeBtn = `<button type="button" class="poi-remove-btn" data-poi-index="${index}">移除此站</button>`;
        const safeIcon = cwEscapeHtml(poi.icon || '📍');
        const safeName = cwEscapeHtml(poiName);
        const safeType = cwEscapeHtml(poiType);
        const safeReason = cwEscapeHtml(reason);
        const seedTag = poi.is_seed ? '<span class="poi-seed-tag">种草</span> ' : '';
        const optionalTag = poi.optional ? '<span class="poi-optional-tag">可选</span> ' : '';
        const skippedTag = skipped ? '<span class="poi-skipped-tag">已跳过</span> ' : '';
        poiItem.innerHTML = `
            <button type="button" class="poi-drag-handle" draggable="true" aria-label="拖动调整第 ${index + 1} 站顺序" title="拖动排序">⋮⋮</button>
            <div class="poi-item-content">
                <span class="poi-item-icon">${safeIcon}</span>
                <div class="poi-item-body">
                    <strong class="poi-item-name">${index+1}. ${seedTag}${optionalTag}${skippedTag}${safeName}</strong>
                    <div class="poi-item-type">${safeType}</div>
                    <div class="poi-item-reason">${safeReason}${score ? ` · 氛围分 ${score}` : ''}${poi.stay_time ? ` · 建议停留 ${poi.stay_time} 分钟` : ''}</div>
                    <div class="poi-item-actions">${navLink}${skipBtn}${removeBtn}</div>
                </div>
            </div>`;
        const navEl = poiItem.querySelector('.poi-nav');
        if (navEl) navEl.addEventListener('click', (e) => e.stopPropagation());
        const skipEl = poiItem.querySelector('.poi-skip-btn');
        if (skipEl) {
            skipEl.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSkipOptionalPoi(index);
            });
        }
        const removeEl = poiItem.querySelector('.poi-remove-btn');
        if (removeEl) {
            removeEl.addEventListener('click', (e) => {
                e.stopPropagation();
                removeRouteStopAndReplan(index);
            });
        }
        const dragHandle = poiItem.querySelector('.poi-drag-handle');
        if (dragHandle) {
            dragHandle.addEventListener('click', (e) => e.stopPropagation());
        }
        poiList.appendChild(poiItem);
    });
}

function toggleSkipOptionalPoi(index) {
    if (!CW.routeData || !Array.isArray(CW.routeData.pois)) return;
    const poi = CW.routeData.pois[index];
    if (!poi || !poi.optional) return;
    const key = poiSkipKey(poi, index);
    if (!CW.skippedPoiKeys) CW.skippedPoiKeys = {};
    if (CW.skippedPoiKeys[key]) delete CW.skippedPoiKeys[key];
    else CW.skippedPoiKeys[key] = true;
    renderPoiList(CW.routeData.pois);
    if (typeof updateNextStopButton === 'function') updateNextStopButton();
    showToast(CW.skippedPoiKeys[key] ? '已跳过该可选站' : '已恢复该站');
}

// 诚实加载：单一状态文案，不伪造「优化打卡顺序」等进度
function showLoadingSteps(message) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const title = document.getElementById('loadingTitle');
    const sub = document.getElementById('loadingSub');
    const retry = document.getElementById('btnLoadingRetry');
    if (title) title.textContent = message || '正在规划步行路线，可能需要十几秒';
    if (sub) {
        sub.textContent = '请稍候，结果就绪后会自动展示';
        sub.hidden = false;
    }
    if (retry) {
        retry.hidden = true;
        retry.onclick = null;
    }
    CW.loadingRetryHandler = null;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
}

function hideLoadingSteps() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
    const retry = document.getElementById('btnLoadingRetry');
    if (retry) {
        retry.hidden = true;
        retry.onclick = null;
    }
}

function showLoadingFailure(message, retryFn) {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    const title = document.getElementById('loadingTitle');
    const sub = document.getElementById('loadingSub');
    const retry = document.getElementById('btnLoadingRetry');
    if (title) title.textContent = message || '规划未成功，请重试';
    if (sub) {
        sub.textContent = '可检查网络后重试，或缩短路线再试';
        sub.hidden = false;
    }
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    if (retry) {
        if (typeof retryFn === 'function') {
            retry.hidden = false;
            CW.loadingRetryHandler = retryFn;
            retry.onclick = () => {
                hideLoadingSteps();
                retryFn();
            };
        } else {
            retry.hidden = true;
        }
    }
}

// 按消息内容自动判定语义类型（可被第三参显式覆盖）
function classifyToast(message) {
    const s = String(message || '');
    // 错误：覆盖软化后的措辞（"不太顺畅/没能/换个…试试/稍后再试"等）
    if (/失败|错误|无法|不可用|超时|出错|异常|没能|没找到|联系不上|开小差|小状况|暂不支持|不太顺畅|稍后再[试来]|再试试|请再试|请重试|换个|想久了|❌/.test(s)) return 'error';
    if (/成功|完成|已复制|已切换|已生成|已保存|已更新|✅|🎉/.test(s)) return 'success';
    return 'info';
}

function showToast(message, duration = 3000, type) {
    clearTimeout(CW.debounceTimer);
    const toast = document.getElementById('errorToast');
    toast.textContent = message;
    toast.classList.remove('toast-success', 'toast-error', 'toast-info');
    toast.classList.add('toast-' + (type || classifyToast(message)));
    toast.classList.add('show');
    CW.debounceTimer = setTimeout(() => { toast.classList.remove('show'); }, duration);
}
