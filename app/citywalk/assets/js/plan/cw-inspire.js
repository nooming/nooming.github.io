// ========== Citywalk · 灵感卡片（手动勾选种草点再规划） ==========
// 与 cw-agent.js 的一键「灵感种草」开关并存：这里先把候选点摊开成卡片，
// 用户勾选想去的，再用选中的点规划（复用 /agent/plan_inspired 的 selected_spots）。

// 已渲染的候选点（带坐标），与卡片一一对应；勾选态由卡片 DOM 的 checkbox 维护。
// 状态存于 CW.inspireCandidates（见 cw-state.js）。

async function fetchInspirationCards() {
    const input = document.getElementById('agentQueryInput');
    const query = (input && input.value || '').trim();
    if (!query) {
        showToast('请先描述出行偏好（如「武康路附近，小众咖啡馆」）');
        if (input) input.focus();
        return;
    }

    const btn = document.getElementById('btnInspireCards');
    const wrap = document.getElementById('inspireCards');
    if (btn) { btn.disabled = true; btn.textContent = '寻找灵感中…'; }
    if (wrap) {
        wrap.hidden = false;
        wrap.innerHTML = '<div class="inspire-loading">✨ 正在为你找候选点…</div>';
    }

    if (!CW.cityLocateReady) {
        await locateUserCity();
    }
    const cityHint = CW.cityLocateReady ? CW.currentCity : '';

    try {
        const response = await fetch(`${API_BASE_URL}/agent/inspire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({ query: query, city: cityHint }),
        });
        const data = await response.json().catch(() => null);
        if (!data || !data.success) {
            renderInspirationEmpty((data && data.message) || '灵感推荐暂时不可用，稍后再试');
            return;
        }
        renderInspirationCards(data);
    } catch (err) {
        console.error('获取灵感卡片失败：', err);
        renderInspirationEmpty('没能联系上灵感服务，稍后再试');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '浏览推荐地点'; }
    }
}

function renderInspirationEmpty(message) {
    const wrap = document.getElementById('inspireCards');
    if (!wrap) return;
    CW.inspireCandidates = [];
    wrap.hidden = false;
    wrap.innerHTML = '';
    const empty = document.createElement('div');
    empty.className = 'inspire-empty';
    empty.textContent = message || '这次没找到合适的候选点，换个说法或片区再试试';
    wrap.appendChild(empty);
}

function renderInspirationCards(data) {
    const wrap = document.getElementById('inspireCards');
    if (!wrap) return;

    const spots = Array.isArray(data.spots) ? data.spots.filter(
        s => s && s.name && typeof s.lng === 'number' && typeof s.lat === 'number'
    ) : [];
    CW.inspireCandidates = spots;

    if (spots.length === 0) {
        renderInspirationEmpty('这次没找到可定位的候选点，换个说法或片区再试试');
        return;
    }

    wrap.hidden = false;
    wrap.innerHTML = '';

    // 主题/关键词小标题（若有）——用 textContent 防注入
    const themes = Array.isArray(data.themes) ? data.themes : [];
    const head = document.createElement('div');
    head.className = 'inspire-head';
    head.textContent = themes.length
        ? `灵感主题：${themes.join(' · ')}　勾选想去的点`
        : '勾选想去的点，再用选中的点规划';
    wrap.appendChild(head);

    const list = document.createElement('div');
    list.className = 'inspire-card-list';
    spots.forEach((spot, i) => list.appendChild(buildInspireCard(spot, i)));
    wrap.appendChild(list);

    const foot = document.createElement('div');
    foot.className = 'inspire-foot';
    const planBtn = document.createElement('button');
    planBtn.type = 'button';
    planBtn.className = 'btn btn-agent-plan';
    planBtn.id = 'btnPlanInspired';
    planBtn.textContent = '用选中的点规划';
    planBtn.addEventListener('click', planWithSelectedInspiration);
    foot.appendChild(planBtn);
    wrap.appendChild(foot);
}

function buildInspireCard(spot, index) {
    const id = `inspireCard${index}`;
    const label = document.createElement('label');
    label.className = 'inspire-card';
    label.setAttribute('for', id);

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'inspire-card-cb';
    cb.id = id;
    cb.dataset.index = String(index);
    cb.addEventListener('change', () => {
        label.classList.toggle('selected', cb.checked);
    });

    const body = document.createElement('div');
    body.className = 'inspire-card-body';

    const title = document.createElement('div');
    title.className = 'inspire-card-title';
    title.textContent = spot.name; // 防注入

    if (spot.category) {
        const tag = document.createElement('span');
        tag.className = 'inspire-card-tag';
        tag.textContent = spot.category;
        title.appendChild(tag);
    }
    body.appendChild(title);

    if (spot.reason) {
        const reason = document.createElement('div');
        reason.className = 'inspire-card-reason';
        reason.textContent = spot.reason;
        body.appendChild(reason);
    }

    label.appendChild(cb);
    label.appendChild(body);
    return label;
}

function getSelectedInspirationSeeds() {
    const wrap = document.getElementById('inspireCards');
    if (!wrap) return [];
    const seeds = [];
    wrap.querySelectorAll('.inspire-card-cb:checked').forEach(cb => {
        const idx = parseInt(cb.dataset.index, 10);
        const spot = CW.inspireCandidates[idx];
        if (spot) {
            seeds.push({
                name: spot.name,
                reason: spot.reason || '',
                category: spot.category || '',
                lng: spot.lng,
                lat: spot.lat,
            });
        }
    });
    return seeds;
}

async function planWithSelectedInspiration() {
    const seeds = getSelectedInspirationSeeds();
    if (seeds.length === 0) {
        showToast('请先勾选至少一个想去的点');
        return;
    }
    const input = document.getElementById('agentQueryInput');
    const query = (input && input.value || '').trim();
    if (!query) {
        showToast('请描述起点、终点或时长，再使用选中的地点规划');
        if (input) input.focus();
        return;
    }

    const btn = document.getElementById('btnPlanInspired');
    if (btn) { btn.disabled = true; btn.textContent = '规划中…'; }
    showLoadingSteps();

    if (!CW.cityLocateReady) {
        await locateUserCity();
    }
    const cityHint = CW.cityLocateReady ? CW.currentCity : '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 150000);

    try {
        const body = typeof buildAgentPlanPayload === 'function'
            ? buildAgentPlanPayload(query, cityHint)
            : {
                query: query,
                city: cityHint,
                plan_time: parseInt(document.getElementById('planTimeSlider')?.value, 10) || 60,
                plan_time_min: parseInt(document.getElementById('planTimeSlider')?.value, 10) || 60,
                selected_spots: seeds,
            };
        body.selected_spots = seeds;
        const response = await fetch(`${API_BASE_URL}/agent/plan_inspired`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const data = await parseAgentResponse(response);
        hideLoadingSteps();
        await applyInspiredPlanResponse(data, true);
    } catch (error) {
        clearTimeout(timeoutId);
        hideLoadingSteps();
        let msg = '规划没成功，请再试一次';
        if (error.name === 'AbortError') msg = '规划想久了，描述短一点或稍后再来';
        else if (error.message && error.message.includes('Failed to fetch')) msg = '暂时联系不上服务，稍后再试';
        showToast(msg);
        console.error('灵感卡片规划错误：', error);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '用选中的点规划'; }
    }
}
