// ========== Citywalk · 路线规划模块 ==========

function updateBtnStatus() {
    const btn = document.getElementById('btnPlan');
    const planTimeSlider = document.getElementById('planTimeSlider');
    const planTime = parseInt(planTimeSlider.value);

    const isTimeValid = !isNaN(planTime) && planTime >= 30 && planTime <= 180;
    const isPointValid = !!startPoint && !!endPoint;

    if (isPointValid && isTimeValid) {
        btn.disabled = false;
        btn.innerText = "生成路线";
    } else {
        btn.disabled = true;
        btn.innerText = !isPointValid ? "等待选择起终点" : "请设置游玩时间";
    }
}

function resetSelection() {
    startPoint = null;
    endPoint = null;
    if (startMarker) map.remove(startMarker);
    if (endMarker) map.remove(endMarker);
    if (routeLine) map.remove(routeLine);
    clearPoiMarkers();

    startMarker = null;
    endMarker = null;
    routeLine = null;
    routeData = null;

    document.getElementById('startCard').className = 'status-card';
    document.getElementById('endCard').className = 'status-card';
    document.getElementById('startValue').textContent = "点击地图选择";
    document.getElementById('endValue').textContent = "点击地图选择";
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('btnGeneratePlan').style.display = 'none';
    document.getElementById('btnShareImage').style.display = 'none';
    document.getElementById('poiList').innerHTML = '';

    const planTimeSlider = document.getElementById('planTimeSlider');
    planTimeSlider.value = 60;
    document.getElementById('planTimeValue').textContent = '60 分钟';
    document.querySelectorAll('.poi-type-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.poi-type-btn[data-type="无偏好"]').classList.add('active');
    selectedPoiType = "无偏好";

    updateBtnStatus();
}

function generateRoute() {
    if (!startPoint || !endPoint) {
        showToast("请先选择起终点");
        return;
    }

    const planTimeSlider = document.getElementById('planTimeSlider');
    let planTime = parseInt(planTimeSlider.value, 10);

    if (isNaN(planTime) || planTime < 30 || planTime > 180) {
        showToast("请设置30-180分钟的游玩时间");
        return;
    }

    const start = [parseFloat(startPoint.lng.toFixed(6)), parseFloat(startPoint.lat.toFixed(6))];
    const end   = [parseFloat(endPoint.lng.toFixed(6)),   parseFloat(endPoint.lat.toFixed(6))];

    showLoadingSteps();

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 120000);

    fetch(`${API_BASE_URL}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            start: start,
            end: end,
            plan_time: planTime,
            poi_type: selectedPoiType.trim(),
            route_style: selectedRouteStyle,
            ambience_profile: selectedPoiType.trim(),
            city: currentCity
        }),
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) {
            return response.json().then(errData => {
                const detail = errData.message || errData.error || `HTTP错误：${response.status}`;
                throw new Error(detail);
            }).catch(() => { throw new Error(`HTTP错误：${response.status}`); });
        }
        return response.json().catch(() => { throw new Error("后端返回数据格式错误"); });
    })
    .then(data => {
        hideLoadingSteps();
        if (!data.success) {
            showToast(`路线规划失败：${data.message || '未知错误'}`);
            return;
        }

        // 校验路径字段，防止 undefined 导致地图崩溃
        if (!Array.isArray(data.path) || data.path.length === 0) {
            showToast('路线规划失败：返回路径数据异常，请重试');
            return;
        }

        routeData = data;

        if (routeLine) map.remove(routeLine);
        const routeColor = currentTheme ? currentTheme.primary : '#ff7e5f';
        routeLine = new AMap.Polyline({
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
        map.add(routeLine);

        addPoiMarkers(data.pois);

        map.setFitView([startMarker, endMarker, routeLine, ...poiMarkers], {
            padding: [50, 50, 50, 50],
            animate: true
        });

        document.getElementById('distanceValue').textContent =
            (data.distance / 1000).toFixed(2) + ' km';

        const walkDuration  = data.duration || 0;
        const pois          = Array.isArray(data.pois) ? data.pois : [];
        const poiStayTime   = pois.reduce((sum, p) => sum + (p.stay_time || 5), 0);
        const totalDuration = walkDuration + poiStayTime;
        document.getElementById('durationValue').textContent  = totalDuration + ' 分钟';
        document.getElementById('poiCountValue').textContent  = pois.length + '个';

        renderPoiList(pois);

        document.getElementById('resultArea').style.display       = 'block';
        document.getElementById('btnGeneratePlan').style.display  = 'block';
        document.getElementById('btnShareImage').style.display    = 'block';

        getCityWeather(currentCity, true);
    })
    .catch(error => {
        clearTimeout(timeoutId);
        hideLoadingSteps();
        let errorMsg = '';
        if (error.name === 'AbortError') {
            errorMsg = "请求超时（2分钟），请检查后端服务是否运行或缩短路线距离";
        } else if (error.message.includes('Failed to fetch')) {
            errorMsg = "无法连接到后端服务，请确认：1.后端已启动 2.地址端口正确 3.已配置跨域";
        } else if (error.message.includes('JSON')) {
            errorMsg = "后端返回数据格式错误，请检查接口返回值";
        } else {
            errorMsg = `请求失败：${error.message}`;
        }
        showToast(errorMsg);
        console.error('路线规划错误：', error);
    });
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
        poiItem.onclick = () => {
            if (poi.location && Array.isArray(poi.location) && poi.location.length === 2) {
                map.setCenter(poi.location);
                map.setZoom(17);
            }
        };
        poiItem.innerHTML = `
            <div class="poi-item-content">
                <span class="poi-item-icon">${poi.icon || '📍'}</span>
                <div class="poi-item-body">
                    <strong class="poi-item-name">${index+1}. ${poiName}</strong>
                    <div class="poi-item-type">${poiType}</div>
                    <div class="poi-item-reason">${reason}${score ? ` · 氛围分 ${score}` : ''}</div>
                </div>
            </div>`;
        poiList.appendChild(poiItem);
    });
}

// 分步骤加载动画
function showLoadingSteps() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    ['step1', 'step2', 'step3', 'step4'].forEach((stepId, index) => {
        const step = document.getElementById(stepId);
        step.className = 'loading-step';
        if (index === 0) setTimeout(() => step.classList.add('active'), 100);
    });

    let currentStep = 1;
    window.loadingProgressInterval = setInterval(() => {
        if (currentStep < 4) {
            document.getElementById(`step${currentStep}`).classList.replace('active', 'done');
            currentStep++;
            document.getElementById(`step${currentStep}`).classList.add('active');
        }
    }, 1500);
}

function hideLoadingSteps() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    if (window.loadingProgressInterval) clearInterval(window.loadingProgressInterval);

    ['step1', 'step2', 'step3', 'step4'].forEach(stepId => {
        const step = document.getElementById(stepId);
        step.classList.remove('active');
        step.classList.add('done');
    });

    setTimeout(() => { overlay.style.display = 'none'; }, 800);
}

function showToast(message, duration = 3000) {
    clearTimeout(debounceTimer);
    const toast = document.getElementById('errorToast');
    toast.textContent = message;
    toast.classList.add('show');
    debounceTimer = setTimeout(() => { toast.classList.remove('show'); }, duration);
}
