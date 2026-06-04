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
    const chat = document.getElementById('resultChatDetails');
    if (chat) chat.open = true;
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

    renderPoiList(pois);

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

    // 整条路线「在高德地图打开」依赖起终点；环线模式无终点，隐藏该按钮（逐点「导航到这」仍可用）。
    const routeActions = document.getElementById('routeActions');
    if (routeActions) routeActions.style.display = data.mode === 'loop' ? 'none' : 'block';

    if (resultHeader && typeof resultHeader.scrollIntoView === 'function') {
        resultHeader.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
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
    if (CW.routeLine) CW.map.remove(CW.routeLine);
    clearPoiMarkers();

    CW.startMarker = null;
    CW.endMarker = null;
    CW.routeLine = null;
    CW.routeData = null;

    document.getElementById('startCard').className = 'status-card';
    document.getElementById('endCard').className = 'status-card';
    setPickupStatusText('startValue', '点击地图选择');
    setPickupStatusText('endValue', '点击地图选择');
    const resultArea = document.getElementById('resultArea');
    if (resultArea) resultArea.style.display = 'none';
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
    document.querySelectorAll('.poi-type-group .poi-type-btn:not(.route-style-btn)')
        .forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const defaultPoi = document.querySelector('.poi-type-btn[data-type="无偏好"]');
    if (defaultPoi) { defaultPoi.classList.add('active'); defaultPoi.setAttribute('aria-pressed', 'true'); }
    CW.selectedPoiType = "无偏好";

    document.querySelectorAll('.route-style-btn')
        .forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
    const defaultStyle = document.querySelector('.route-style-btn[data-style="balanced"]');
    if (defaultStyle) { defaultStyle.classList.add('active'); defaultStyle.setAttribute('aria-pressed', 'true'); }
    CW.selectedRouteStyle = "balanced";

    CW.agentSessionId = null;

    const chatLog = document.getElementById('agentChatLog');
    if (chatLog) chatLog.innerHTML = '';

    updateBtnStatus();
}

function generateRoute() {
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

    const start = [parseFloat(CW.startPoint.lng.toFixed(6)), parseFloat(CW.startPoint.lat.toFixed(6))];
    const payload = {
        start: start,
        plan_time: planTime,
        poi_type: CW.selectedPoiType.trim(),
        route_style: CW.selectedRouteStyle,
        ambience_profile: CW.selectedPoiType.trim(),
        visit_pace: 'checkin',
        city: CW.currentCity,
        mode: isLoop ? 'loop' : 'route',
    };
    if (!isLoop) {
        payload.end = [
            parseFloat(CW.endPoint.lng.toFixed(6)),
            parseFloat(CW.endPoint.lat.toFixed(6)),
        ];
    }

    showLoadingSteps();

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 120000);

    fetch(`${API_BASE_URL}/plan`, {
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
        hideLoadingSteps();
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
        showToast(errorMsg);
        console.error('路线规划错误：', error);
    });
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

    if (CW.routeLine) CW.map.remove(CW.routeLine);
    const routeColor = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
    CW.routeLine = new AMap.Polyline({
        path: data.path,
        strokeColor: routeColor,
        strokeWeight: 6,
        strokeOpacity: 0.9,
        strokeStyle: 'solid',
        lineJoin: 'round',
        lineCap: 'round',
        zIndex: 50,
        showDir: true
    });
    CW.map.add(CW.routeLine);

    addPoiMarkers(data.pois);

    const fitTargets = [CW.startMarker, CW.routeLine, ...CW.poiMarkers].filter(Boolean);
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

function renderPoiList(pois) {
    const poiList = document.getElementById('poiList');
    if (!poiList) return;
    poiList.innerHTML = '';

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
        const poiItem = document.createElement('div');
        poiItem.className = 'poi-item';
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
        const safeIcon = cwEscapeHtml(poi.icon || '📍');
        const safeName = cwEscapeHtml(poiName);
        const safeType = cwEscapeHtml(poiType);
        const safeReason = cwEscapeHtml(reason);
        const seedTag = poi.is_seed ? '<span class="poi-seed-tag">种草</span> ' : '';
        const optionalTag = poi.optional ? '<span class="poi-optional-tag">可选</span> ' : '';
        poiItem.innerHTML = `
            <div class="poi-item-content">
                <span class="poi-item-icon">${safeIcon}</span>
                <div class="poi-item-body">
                    <strong class="poi-item-name">${index+1}. ${seedTag}${optionalTag}${safeName}</strong>
                    <div class="poi-item-type">${safeType}</div>
                    <div class="poi-item-reason">${safeReason}${score ? ` · 氛围分 ${score}` : ''}${poi.stay_time ? ` · 建议停留 ${poi.stay_time} 分钟` : ''}</div>
                    ${navLink}
                </div>
            </div>`;
        // 导航链接不应触发列表项的高亮/居中
        const navEl = poiItem.querySelector('.poi-nav');
        if (navEl) navEl.addEventListener('click', (e) => e.stopPropagation());
        poiList.appendChild(poiItem);
    });
}

// 加载动画：诚实表达「处理中」——循环高亮当前环节，不伪造按时完成的进度。
// 真正完成（拿到结果）时再由 hideLoadingSteps 统一标记完成。
const LOADING_STEP_IDS = ['step1', 'step2', 'step3', 'step4'];

function showLoadingSteps() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');

    LOADING_STEP_IDS.forEach(id => {
        const step = document.getElementById(id);
        if (step) step.className = 'loading-step';
    });

    let i = 0;
    function tick() {
        LOADING_STEP_IDS.forEach((id, idx) => {
            const step = document.getElementById(id);
            if (step) step.classList.toggle('active', idx === i);
        });
        i = (i + 1) % LOADING_STEP_IDS.length;
    }
    tick();
    if (window.loadingProgressInterval) clearInterval(window.loadingProgressInterval);
    window.loadingProgressInterval = setInterval(tick, 900);
}

function hideLoadingSteps() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    if (window.loadingProgressInterval) {
        clearInterval(window.loadingProgressInterval);
        window.loadingProgressInterval = null;
    }

    LOADING_STEP_IDS.forEach(id => {
        const step = document.getElementById(id);
        if (step) {
            step.classList.remove('active');
            step.classList.add('done');
        }
    });

    setTimeout(() => {
        overlay.style.display = 'none';
        overlay.setAttribute('aria-hidden', 'true');
    }, 400);
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
