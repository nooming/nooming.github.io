// ========== Citywalk · 分享长图模块 ==========
// 离屏构建 4:5 分享卡 → html2canvas 合成 → 下载 PNG。
// 布局/字号/阴影等静态样式见 styles.css 的 .cw-share-* 类；
// 仅「随主题变化的渐变色 / 背景图」按当次主题内联（html2canvas 对 CSS 变量支持不稳）。

// 按需懒加载 html2canvas（首屏不加载，点「生成分享图」时再注入）
function ensureHtml2canvas() {
    return new Promise((resolve, reject) => {
        if (window.html2canvas) { resolve(window.html2canvas); return; }
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = () => window.html2canvas ? resolve(window.html2canvas) : reject(new Error('html2canvas 加载失败'));
        s.onerror = () => reject(new Error('html2canvas 加载失败'));
        document.head.appendChild(s);
    });
}

// 主题名称映射（POI 偏好 → 文艺主题名）
const SHARE_THEME_NAMES = {
    '无偏好': '城市漫游',
    '自然': '绿意寻踪',
    '历史': '时光漫步',
    '文创': '文艺探索',
    '花店': '花香之旅',
    '咖啡甜品': '咖啡甜品时光',
    '咖啡': '咖啡甜品时光',
    '甜品': '咖啡甜品时光',
    '烘焙': '咖啡甜品时光',
    '商场': '都市探索'
};

const SHARE_SLOGANS = [
    '用脚步丈量城市的温度',
    '在街角遇见生活的美好',
    '每一步都是新的发现',
    '与城市来一场浪漫邂逅',
    '慢下来，看见不一样的风景',
    '漫步城市，发现不一样的自己',
    '最好的风景，永远在路上',
    '城市的每一个角落都有故事',
    '走街串巷，品味人间烟火',
    '今日份的美好已送达',
    '生活明朗，万物可爱',
    '保持热爱，奔赴山海',
    '不负春光，野蛮生长',
    '心之所向，素履以往'
];

// 轻量转义，避免 POI 名称中的特殊字符破坏卡片结构（复用 cw-state.js 的单一实现）
function _shareEscape(s) {
    return cwEscapeHtml(s);
}

// 向后端请求卫星地图背景（优先 data URL，避免 html2canvas 画布跨域污染）
async function _fetchShareBackground() {
    try {
        const firstPoiName = (CW.routeData.pois && CW.routeData.pois[0] && CW.routeData.pois[0].name) || '';
        const resp = await fetch(`${CW_API}/search_image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
                city: CW.currentCity,
                poi_name: firstPoiName,
                start_lng: CW.startPoint ? CW.startPoint.lng : null,
                start_lat: CW.startPoint ? CW.startPoint.lat : null
            })
        });
        const imgData = await resp.json().catch(() => null);
        if (imgData && imgData.success) {
            return imgData.image_data_url || imgData.image_url || null;
        }
    } catch (e) {
        console.warn('地图背景获取失败，使用默认渐变背景', e);
    }
    return null;
}

// 生成分享长图（后端卫星地图为背景，html2canvas 合成）
async function generateShareImage() {
    if (!CW.routeData || !CW.routeData.success) {
        showToast('请先生成一条路线吧');
        return;
    }

    showToast('🎨 正在生成地图，请稍候');

    // ===== 背景 =====
    const mapImageUrl = await _fetchShareBackground();
    showToast(mapImageUrl ? '地图就绪，正在合成长图' : '没取到地图，先用默认背景');

    // ===== 数据 =====
    const poiType = CW.selectedPoiType || '无偏好';
    const distance = (CW.routeData.distance / 1000).toFixed(2);
    const walkDuration = CW.routeData.duration || 0;
    const pois = Array.isArray(CW.routeData.pois) ? CW.routeData.pois : [];
    const poiCount = pois.length;
    const stayDuration = pois.reduce((sum, p) => sum + (p.stay_time || 5), 0);
    const duration = walkDuration + stayDuration;
    const now = new Date();
    const themeName = SHARE_THEME_NAMES[poiType] || '城市漫游';
    const areaName = CW.currentCity;

    // 天气
    let weatherText = '适宜出行';
    let weatherIcon = '🌤️';
    if (CW.liveWeatherData) {
        const px = CW.liveWeatherData.proxyNeighborName
            ? `（${CW.liveWeatherData.proxyNeighborName}市实况，${CW.currentCity}参考）`
            : '';
        weatherText = `${px}${CW.liveWeatherData.weather} ${CW.liveWeatherData.temperature}℃`;
        weatherIcon = getWeatherIcon(CW.liveWeatherData.weather);
    }

    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });

    // 主题色（复用 cw-state.js 的全局 colorThemes；secondary/gradient 由 primary/primaryLight 派生）
    const baseTheme = CW.currentTheme || colorThemes[Math.floor(Math.random() * colorThemes.length)];
    const primary = baseTheme.primary;
    const secondary = baseTheme.primaryLight;
    const topGrad = `linear-gradient(180deg, ${primary}e6 0%, ${secondary}b3 50%, transparent 100%)`;
    const randomSlogan = SHARE_SLOGANS[Math.floor(Math.random() * SHARE_SLOGANS.length)];

    // POI 气泡
    let poisHtml = '';
    if (poiCount > 0) {
        poisHtml = '<div class="cw-share-pois">';
        pois.slice(0, 4).forEach((poi) => {
            const poiIcon = _shareEscape(poi.icon || '📍');
            const poiName = _shareEscape((poi.name || '未知').slice(0, 6));
            poisHtml += `<div class="cw-share-poi"><span class="cw-share-poi-icon">${poiIcon}</span><span class="cw-share-poi-name">${poiName}</span></div>`;
        });
        if (poiCount > 4) {
            poisHtml += `<div class="cw-share-poi-more" style="background: linear-gradient(135deg, ${primary}, ${secondary});"><span>+${poiCount - 4}</span></div>`;
        }
        poisHtml += '</div>';
    }

    // ===== 离屏卡片 =====
    const bgStyle = mapImageUrl
        ? `background-image: url('${mapImageUrl}');`
        : `background: linear-gradient(135deg, ${primary}22, ${secondary}44);`;

    const shareCard = document.createElement('div');
    shareCard.className = 'cw-share-card';
    shareCard.innerHTML = `
        <div class="cw-share-bg" style="${bgStyle}">
            ${mapImageUrl ? '<div class="cw-share-bg-dim"></div>' : ''}
        </div>
        <div class="cw-share-top-grad" style="background: ${topGrad};"></div>
        <div class="cw-share-bottom-grad" style="background: linear-gradient(0deg, ${primary}ee 0%, ${secondary}aa 30%, transparent 100%);"></div>

        <div class="cw-share-header">
            <div class="cw-share-eyebrow">🚶 CITYWALK · ${_shareEscape(areaName)}</div>
            <h1 class="cw-share-title">${_shareEscape(themeName)}</h1>
            <div class="cw-share-subtitle">${dateStr} · ${weatherIcon} ${_shareEscape(weatherText)}</div>
        </div>

        <div class="cw-share-slogan-wrap">
            <div class="cw-share-slogan" style="background: linear-gradient(180deg, ${primary}cc, ${secondary}aa);">${randomSlogan}</div>
        </div>

        <div class="cw-share-footer">
            <div class="cw-share-stats">
                <div class="cw-share-stat">
                    <div class="cw-share-stat-num">${distance}<span class="cw-share-stat-unit">km</span></div>
                    <div class="cw-share-stat-label">总距离</div>
                </div>
                <div class="cw-share-stat-divider"></div>
                <div class="cw-share-stat">
                    <div class="cw-share-stat-num">${duration}<span class="cw-share-stat-unit">min</span></div>
                    <div class="cw-share-stat-label">预计用时</div>
                </div>
                <div class="cw-share-stat-divider"></div>
                <div class="cw-share-stat">
                    <div class="cw-share-stat-num">${poiCount}<span class="cw-share-stat-unit">个</span></div>
                    <div class="cw-share-stat-label">打卡点</div>
                </div>
            </div>
            ${poisHtml}
        </div>
    `;

    document.body.appendChild(shareCard);

    // ===== 合成并下载 =====
    try {
        await ensureHtml2canvas();
        const scale = Math.min(3, Math.max(2, Math.round(window.devicePixelRatio || 2)));
        const canvas = await html2canvas(shareCard, {
            scale: scale,
            backgroundColor: null,
            useCORS: true,
            logging: false,
            width: 400,
            height: 500
        });

        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Citywalk-${areaName}-${themeName}-${now.getTime()}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToast('🎉 长图已生成，去分享吧');
        }, 'image/png', 0.95);

        document.body.removeChild(shareCard);
    } catch (err) {
        console.error('生成图片失败:', err);
        if (shareCard.parentNode) document.body.removeChild(shareCard);
        showToast('图片没能生成，请再试一次');
    }
}
