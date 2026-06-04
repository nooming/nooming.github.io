// ========== Citywalk · 智能体自然语言规划 ==========

function showAgentPlanFailureToast(data, fallback) {
    if (data && data.quota_exceeded) {
        const sec = data.retry_after || 30;
        showToast(
            (data.message && String(data.message).trim())
                || `地图服务繁忙，请约 ${sec} 秒后再试`,
            6000
        );
        return;
    }
    const msg = (data && data.message && String(data.message).trim()) || fallback;
    showToast(msg, 5000);
}

async function parseAgentResponse(response) {
    let data = null;
    try {
        data = await response.json();
    } catch (_) {
        data = null;
    }
    if (!response.ok) {
        const msg = (data && data.message) ? data.message : `请求失败：HTTP ${response.status}`;
        throw new Error(msg);
    }
    if (!data || typeof data !== 'object') {
        throw new Error('后端返回数据格式错误');
    }
    return data;
}

function buildAgentContext() {
    const planTime = parseInt(document.getElementById('planTimeSlider')?.value, 10) || 60;
    const ctx = {
        plan_params: {
            city: CW.currentCity,
            start: CW.startPoint?.address || document.getElementById('startValue')?.textContent || '',
            end: CW.endPoint?.address || document.getElementById('endValue')?.textContent || '',
            plan_time: planTime,
            poi_type: CW.selectedPoiType,
            route_style: CW.selectedRouteStyle,
            visit_pace: 'checkin',
        },
        route_summary: {},
    };
    if (CW.routeData && CW.routeData.success) {
        const pois = Array.isArray(CW.routeData.pois) ? CW.routeData.pois : [];
        ctx.route_summary = {
            distance_m: CW.routeData.distance,
            duration_min: CW.routeData.duration,
            poi_count: pois.length,
            poi_names: pois.map(p => p.name).filter(Boolean),
            // 结构化明细：让 explain/replan 能基于真实数据回答（理由、停留、序号）
            pois: pois.map((p, i) => ({
                index: i + 1,
                name: p.name,
                type: p.type || p.category,
                reason: p.recommendation_reason,
                stay_time: p.stay_time,
            })).filter(p => p.name),
        };
    }
    return ctx;
}

function appendAgentChatMessage(role, text) {
    const log = document.getElementById('agentChatLog');
    if (!log || !text) return;
    const div = document.createElement('div');
    div.className = 'agent-chat-msg ' + (role === 'user' ? 'user' : 'assistant');
    div.textContent = (role === 'user' ? '你：' : '助手：') + text;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
}

async function sendAgentChat() {
    const input = document.getElementById('agentChatInput');
    const message = (input?.value || '').trim();
    if (!message) {
        showToast('请输入对话内容');
        return;
    }

    const btn = document.getElementById('btnAgentChat');
    if (btn) {
        btn.disabled = true;
    }
    appendAgentChatMessage('user', message);
    if (input) input.value = '';

    try {
        const response = await fetch(`${API_BASE_URL}/agent/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                message: message,
                session_id: CW.agentSessionId,
                context: buildAgentContext(),
            }),
        });

        const data = await parseAgentResponse(response);

        if (data.session_id) {
            CW.agentSessionId = data.session_id;
        }

        if (data.agent_status === 'clarify') {
            appendAgentChatMessage('assistant', data.message || '请补充信息');
            showToast(data.message || '请补充信息', 4500);
            return;
        }

        if (data.agent_status === 'error') {
            appendAgentChatMessage('assistant', data.message || '对话暂时不可用，稍后再试');
            showToast(data.message || '对话暂时不可用，稍后再试', 4500);
            return;
        }

        // 页面操作指令：把对话变成「遥控器」，复用已有功能函数
        if (data.agent_status === 'ui_command') {
            appendAgentChatMessage('assistant', data.message || '好的');
            dispatchAgentUiCommand(data.command, data.args || {});
            return;
        }

        if (data.agent_status === 'replan' && data.parsed) {
            appendAgentChatMessage('assistant', data.agent_message || data.message || '已为你重新规划');
            // 端点先成功再套用参数，避免地理编码失败时只改了一半
            try {
                await setEndpointsFromParsed(data.parsed);
                applyAgentParsedParams(data.parsed, data);
                if (data.success) {
                    applyRouteResult(data);
                } else {
                    showToast(data.message || '这条路线没能规划出来，换个起终点试试');
                }
            } catch (e) {
                showToast(e.message || '没能更新起点或终点，请再试一次');
            }
            return;
        }

        appendAgentChatMessage('assistant', data.message || data.agent_message || '好的');
        if (data.message && data.agent_status !== 'reply') {
            showToast(data.message, 3500);
        }
    } catch (err) {
        console.error(err);
        appendAgentChatMessage('assistant', '对话出了点小状况，请再说一次');
        showToast(err.message || '对话出了点小状况，请再说一次');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function fetchAgentGuideText() {
    if (!CW.routeData || !CW.routeData.success) {
        return null;
    }
    const walkDuration = CW.routeData.duration || 0;
    const pois = Array.isArray(CW.routeData.pois) ? CW.routeData.pois : [];
    const poiStayTime = pois.reduce((sum, p) => sum + (p.stay_time || 5), 0);
    const planTime = document.getElementById('planTimeValue')?.textContent || '60 分钟';

    const payload = {
        city: CW.currentCity,
        poi_type: CW.selectedPoiType || '无偏好',
        plan_time: planTime,
        distance_km: (CW.routeData.distance / 1000).toFixed(2),
        duration_min: walkDuration + poiStayTime,
        pois: pois.map((p, i) => ({
            index: i + 1,
            name: p.name,
            type: p.type,
            reason: p.recommendation_reason || '',
        })),
        weather: CW.liveWeatherData ? {
            weather: CW.liveWeatherData.weather,
            temperature: CW.liveWeatherData.temperature,
            windDirection: CW.liveWeatherData.windDirection,
            windPower: CW.liveWeatherData.windPower,
            humidity: CW.liveWeatherData.humidity,
        } : null,
    };

    const response = await fetch(`${API_BASE_URL}/agent/guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => null);
    if (data && data.success && data.guide_text) {
        return data.guide_text;
    }
    return null;
}

function getSubmittedPlanTimeMin() {
    const t = parseInt(document.getElementById('planTimeSlider')?.value, 10);
    return (Number.isFinite(t) && t >= 30 && t <= 240) ? t : 60;
}

/** 智能规划 / 灵感规划共用请求体（地图、模式、时长、勾选种草点） */
function buildAgentPlanPayload(query, cityHint) {
    const isLoop = CW.planMode === 'loop';
    const planTime = getSubmittedPlanTimeMin();
    CW.submittedPlanTimeMin = planTime;
    const payload = {
        query: query,
        city: cityHint,
        plan_time: planTime,
        plan_time_min: planTime,
        mode: isLoop ? 'loop' : 'route',
        poi_type: (CW.selectedPoiType || '无偏好').trim(),
        route_style: CW.selectedRouteStyle || 'balanced',
        visit_pace: 'checkin',
    };
    if (CW.startPoint) {
        payload.start = [
            parseFloat(Number(CW.startPoint.lng).toFixed(6)),
            parseFloat(Number(CW.startPoint.lat).toFixed(6)),
        ];
        if (CW.startPoint.address) payload.start_label = CW.startPoint.address;
    }
    if (!isLoop && CW.endPoint) {
        payload.end = [
            parseFloat(Number(CW.endPoint.lng).toFixed(6)),
            parseFloat(Number(CW.endPoint.lat).toFixed(6)),
        ];
        if (CW.endPoint.address) payload.end_label = CW.endPoint.address;
    }
    const seeds = typeof getSelectedInspirationSeeds === 'function'
        ? getSelectedInspirationSeeds() : [];
    if (seeds.length > 0) {
        payload.selected_spots = seeds;
    }
    return payload;
}

function applyAgentParsedParams(parsed, routeData) {
    if (!parsed) return;

    if (parsed.city) {
        CW.currentCity = parsed.city;
        document.getElementById('currentCity').textContent = CW.currentCity;
        if (CITY_COORDS[CW.currentCity]) {
            CW.currentCityCenter = CITY_COORDS[CW.currentCity];
            if (CW.map) CW.map.setCenter(CW.currentCityCenter);
        }
    }

    const planFromRoute = routeData && Number(routeData.plan_time_min);
    const planRaw = (Number.isFinite(planFromRoute) && planFromRoute > 0)
        ? planFromRoute
        : parsed.plan_time;
    if (planRaw) {
        const slider = document.getElementById('planTimeSlider');
        const t = Math.max(30, Math.min(240, parseInt(planRaw, 10)));
        if (slider) slider.value = t;
        const planEl = document.getElementById('planTimeValue');
        if (planEl) planEl.textContent = t + ' 分钟';
    }

    if (parsed.poi_type) {
        CW.selectedPoiType = normalizePoiType(parsed.poi_type);
        document.querySelectorAll('.poi-type-group .poi-type-btn:not(.route-style-btn)').forEach(b => {
            const on = b.getAttribute('data-type') === CW.selectedPoiType;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }

    if (parsed.route_style) {
        CW.selectedRouteStyle = parsed.route_style;
        document.querySelectorAll('.route-style-btn').forEach(b => {
            const on = b.getAttribute('data-style') === parsed.route_style;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
    }
}

function geocodeAddressToPoint(address, city) {
    return new Promise((resolve, reject) => {
        if (!window.AMap) {
            reject(new Error('地图未加载'));
            return;
        }
        AMap.plugin('AMap.Geocoder', function() {
            const geocoder = new AMap.Geocoder({ city: city || '全国' });
            geocoder.getLocation(address, function(status, result) {
                if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                    const loc = result.geocodes[0].location;
                    resolve({
                        lng: parseFloat(loc.lng.toFixed(6)),
                        lat: parseFloat(loc.lat.toFixed(6)),
                        address: result.geocodes[0].formattedAddress || address
                    });
                } else {
                    reject(new Error(`无法定位：${address}`));
                }
            });
        });
    });
}

async function resolveAddressToPoint(address, city) {
    try {
        return await geocodeAddressToPoint(address, city);
    } catch (_) {
        const response = await fetch(`${API_BASE_URL}/resolve_location`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                address: address,
                city: city || '',
            }),
        });
        const data = await response.json().catch(() => null);
        if (data && data.success && typeof data.lng === 'number' && typeof data.lat === 'number') {
            return {
                lng: parseFloat(data.lng.toFixed(6)),
                lat: parseFloat(data.lat.toFixed(6)),
                address: address,
            };
        }
        const msg = (data && data.message) ? data.message : `无法定位：${address}`;
        throw new Error(msg);
    }
}

async function setEndpointsFromParsed(parsed, routeData) {
    const city = parsed.city || CW.currentCity;
    const isLoop = (routeData && routeData.mode === 'loop') || CW.planMode === 'loop';
    if (isLoop && typeof switchPlanMode === 'function') {
        switchPlanMode('loop');
    }

    async function resolvePoint(coords, address) {
        if (Array.isArray(coords) && coords.length === 2
            && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
            return { lng: coords[0], lat: coords[1], address: address || '' };
        }
        if (address) {
            return resolveAddressToPoint(address, city);
        }
        throw new Error('缺少起终点坐标或地址');
    }

    const startPt = await resolvePoint(parsed.start_coords, parsed.start);
    setStartPoint(startPt);
    if (startPt.address) {
        if (typeof setPickupStatusText === 'function') setPickupStatusText('startValue', startPt.address);
        else {
            const el = document.getElementById('startValue');
            if (el) el.textContent = startPt.address;
        }
        CW.startPoint.address = startPt.address;
    }

    if (!isLoop) {
        const endPt = await resolvePoint(parsed.end_coords, parsed.end);
        setEndPoint(endPt);
        if (endPt.address) {
            if (typeof setPickupStatusText === 'function') setPickupStatusText('endValue', endPt.address);
            else {
                const el = document.getElementById('endValue');
                if (el) el.textContent = endPt.address;
            }
            CW.endPoint.address = endPt.address;
        }
    }

    updateBtnStatus();
}

function agentMapEndpointsReady() {
    if (CW.planMode === 'loop') {
        return !!CW.startPoint;
    }
    return !!(CW.startPoint && CW.endPoint);
}

/** 智能规划按钮是否可点：有自然语言描述，或地图起终点已就绪 */
function agentPlanCanSubmit() {
    const input = document.getElementById('agentQueryInput');
    const hasQuery = !!(input && input.value && input.value.trim());
    if (hasQuery) return true;
    return agentMapEndpointsReady();
}

async function generateSmartRoute() {
    CW.lastPlanTab = 'agent';
    const input = document.getElementById('agentQueryInput');
    const queryRaw = (input && input.value || '').trim();
    const hasMap = agentMapEndpointsReady();
    if (!queryRaw && !hasMap) {
        showToast('请描述需求，或在地图上选好起终点');
        if (input) input.focus();
        return;
    }
    const query = queryRaw || (hasMap ? '沿地图所选起终点漫步，无特别偏好' : '');

    const seeds = typeof getSelectedInspirationSeeds === 'function'
        ? getSelectedInspirationSeeds() : [];
    const useInspire = !!document.getElementById('inspireToggle')?.checked;
    const needInspired = useInspire || seeds.length > 0;

    const btn = document.getElementById('btnAgentPlan');
    if (btn) {
        btn.disabled = true;
        btn.textContent = needInspired ? '灵感规划中…' : '智能理解中...';
    }

    showLoadingSteps();

    if (!CW.cityLocateReady) {
        showToast('正在识别您所在城市，请稍候…', 2500);
        await locateUserCity();
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 150000);

    const cityHint = CW.cityLocateReady ? CW.currentCity : '';
    const planEndpoint = needInspired ? '/agent/plan_inspired' : '/agent/plan_once';
    const body = buildAgentPlanPayload(query, cityHint);

    try {
        const response = await fetch(`${API_BASE_URL}${planEndpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await parseAgentResponse(response);

        hideLoadingSteps();
        await applyInspiredPlanResponse(data, needInspired);
    } catch (error) {
        clearTimeout(timeoutId);
        hideLoadingSteps();
        let errorMsg = '';
        if (error.name === 'AbortError') {
            errorMsg = '智能规划想久了，描述短一点或稍后再来';
        } else if (error.message && error.message.includes('Failed to fetch')) {
            errorMsg = '智能规划暂时联系不上，稍后再试试';
        } else if (error.message && String(error.message).trim()) {
            errorMsg = String(error.message).trim();
        } else {
            errorMsg = '智能规划没成功，请再试一次';
        }
        showToast(errorMsg);
        console.error('智能规划错误：', error);
    } finally {
        if (btn) btn.textContent = '智能规划路线';
        if (typeof updateBtnStatus === 'function') updateBtnStatus();
    }
}

// 共用：把 /agent/plan_once|plan_inspired 的响应套用到页面。
// 智能规划（generateSmartRoute）与灵感卡片规划（planWithSelectedInspiration）共用，避免复制。
async function applyInspiredPlanResponse(data, useInspire) {
    const cityBeforePlan = CW.currentCity;

    if (data.agent_status === 'clarify') {
        showToast(data.message || '请补充起点、终点或游玩时长', 5000);
        if (data.parsed) applyAgentParsedParams(data.parsed, data);
        const q = document.getElementById('agentQueryInput');
        if (q) q.focus();
        return;
    }
    if (data.agent_status === 'error') {
        showToast(data.message || '智能规划暂时不可用，稍后再试', 5000);
        return;
    }
    if (data.agent_status === 'plan_failed' || (!data.success && !data.parsed)) {
        console.error('智能规划失败响应：', data);
        showAgentPlanFailureToast(data, '智能规划没成功，请再试一次');
        if (data.parsed) applyAgentParsedParams(data.parsed, data);
        return;
    }
    if (!data.parsed) {
        showToast('没太理解你的描述，换个说法再试试');
        return;
    }

    if (data.session_id) {
        CW.agentSessionId = data.session_id;
    }

    try {
        await setEndpointsFromParsed(data.parsed, data);
    } catch (geoErr) {
        console.error(geoErr);
        showToast(geoErr.message || '没能定位起点或终点，换个说法再试试');
        const q = document.getElementById('agentQueryInput');
        if (q) q.focus();
        return;
    }

    applyAgentParsedParams(data.parsed, data);

    if (!data.success) {
        showToast(data.message || '这条路线没能规划出来，换个起终点试试');
        return;
    }

    applyRouteResult(data);
    if (CW.activePanelTab !== 'result') {
        showToast('路线已生成，请点击「路线结果」查看', 4500);
    }
    const plannedCity = data.parsed && data.parsed.city;
    if (plannedCity && cityBeforePlan && plannedCity !== cityBeforePlan) {
        showToast(`已切换到 ${plannedCity} 并完成规划`, 3500);
    }
    const insp = data.inspiration;
    const matched = (insp && Array.isArray(insp.seed_matched_names)) ? insp.seed_matched_names : [];
    const userSel = (insp && Array.isArray(insp.user_selected_names)) ? insp.user_selected_names : [];
    if (userSel.length > 0) {
        const missing = userSel.filter(n => !matched.includes(n));
        if (missing.length === 0) {
            showToast(`✨ 已纳入种草点：${userSel.slice(0, 3).join('、')}${userSel.length > 3 ? ' 等' : ''}`, 4000);
        } else {
            showToast(`部分种草点因绕路未串入（${missing.join('、')}），其余已纳入`, 5000);
        }
    } else if (insp && insp.seed_poi_count > 0) {
        showToast(`✨ 已为你串入 ${insp.seed_poi_count} 个种草点`, 3500);
    } else if (useInspire && insp && Array.isArray(insp.spots) && insp.spots.length === 0) {
        showToast('这次没找到合适的种草点，已按常规规划', 3500);
    }
}

// ===== D1：把对话指令分发到已有的网站功能（对话即遥控器）=====
function dispatchAgentUiCommand(command, args) {
    const a = args || {};
    switch (command) {
        case 'generate_guide':
            if (!CW.routeData || !CW.routeData.success) {
                showToast('请先规划一条路线，再生成攻略');
                return;
            }
            generatePlanText();
            break;
        case 'generate_share_image':
            if (!CW.routeData || !CW.routeData.success) {
                showToast('请先规划一条路线，再生成分享图');
                return;
            }
            generateShareImage();
            break;
        case 'highlight_poi': {
            const pois = (CW.routeData && Array.isArray(CW.routeData.pois)) ? CW.routeData.pois : [];
            if (!pois.length) {
                showToast('当前还没有打卡点可以指认');
                return;
            }
            const idx = parseInt(a.index, 10) - 1;
            if (isNaN(idx) || idx < 0 || idx >= pois.length) {
                showToast(`只有 ${pois.length} 个打卡点，没有这个序号`);
                return;
            }
            highlightPoiFromAgent(idx);
            break;
        }
        case 'switch_city':
            if (a.city) quickSwitchCity(a.city);
            break;
        case 'reset':
            resetSelection();
            showToast('已清空选择，可以重新开始');
            break;
        default:
            // 未知/不支持的指令：静默忽略，前面已显示助手文字回复
            break;
    }
}

// 在地图上高亮第 index 个打卡点（复用列表点击的视觉语言）
function highlightPoiFromAgent(index) {
    const poiList = document.getElementById('poiList');
    if (poiList) {
        const items = poiList.querySelectorAll('.poi-item');
        items.forEach(el => el.classList.remove('active'));
        if (items[index]) {
            items[index].classList.add('active');
            items[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }
    if (typeof highlightPoiMarker === 'function') highlightPoiMarker(index);
    const poi = CW.routeData.pois[index];
    if (poi && Array.isArray(poi.location) && poi.location.length === 2 && CW.map) {
        CW.map.setCenter(poi.location);
        CW.map.setZoom(17);
    }
}

