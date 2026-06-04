// ========== Citywalk · 全局状态与常量 ==========
// 所有模块共享此文件中声明的状态（无需 import，后续 <script> 标签按顺序加载）。
// 可变状态统一收敛到单一命名空间对象 CW，避免散落的裸 let 全局（任务8）。

const CW = {
    // --- 地图与标记 ---
    map: null,
    startPoint: null,
    endPoint: null,
    startMarker: null,
    endMarker: null,
    routeLine: null,
    poiMarkers: [],
    infoWindow: null,
    searchMarker: null,

    // --- 业务状态 ---
    selectedPoiType: "无偏好",
    selectedRouteStyle: "balanced",
    routeData: null,
    debounceTimer: null,
    agentSessionId: null,
    inspireCandidates: [],   // 灵感卡片当前候选点（带坐标）
    submittedPlanTimeMin: null, // 最近一次智能规划提交的滑块时长
    planMode: 'route',         // route | loop（探索模式）
    lastPlanTab: 'agent',      // 上次规划所在 Tab，供「返回修改选点」

    // --- 天气 ---
    liveWeatherData: null,
    liveWeatherForCity: null,
    weatherRequestId: 0, // 防止并发天气响应乱序

    // --- 城市与主题 ---
    currentTheme: null,
    currentCity: "北京",
    currentCityCenter: [116.4074, 39.9042],
    cityLocateReady: false,
    cityLocatePromise: null,
};

/** 与后端 MAX_CITYWALK_SPAN_M 一致 */
const MAX_CITYWALK_SPAN_M = 25000;

// --- HTML 转义（单一来源）：凡用 innerHTML 拼接高德/LLM 文本处都应过它防注入 ---
// cw-share.js 的 _shareEscape 复用此函数，避免重复实现。
function cwEscapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// --- POI 类型别名（前端单一来源；镜像后端 citywalk.py 的 POI_TYPE_ALIASES）---
// 之前 cw-agent.js / app.js 各写过一份，已收敛到此处统一引用。
const POI_TYPE_ALIASES = { '咖啡': '咖啡甜品', '甜品': '咖啡甜品', '烘焙': '咖啡甜品' };
function normalizePoiType(t) {
    const s = (t == null ? '' : String(t)).trim();
    return POI_TYPE_ALIASES[s] || s;
}

// --- 城市坐标表 ---
const CITY_COORDS = {
    "北京": [116.4074, 39.9042],
    "上海": [121.4737, 31.2304],
    "广州": [113.2644, 23.1291],
    "深圳": [114.0579, 22.5431],
    "成都": [104.0668, 30.5728],
    "杭州": [120.1551, 30.2741],
    "南京": [118.7969, 32.0603],
    "武汉": [114.3054, 30.5931],
    "西安": [108.9398, 34.3416],
    "重庆": [106.5516, 29.5630],
    "天津": [117.2009, 39.0842],
    "苏州": [120.5853, 31.2989],
    "香港": [114.1694, 22.3193],
    "澳门": [113.5491, 22.1987]
};

// --- API 地址（根据运行环境自动切换）---
const _h = window.location.hostname;
const API_BASE_URL =
    _h === 'localhost' || _h === '127.0.0.1' || _h === '[::1]' || _h === '::1'
        ? 'http://localhost:5000'
        : 'https://noomings-backend.zeabur.app';

// --- 主题配色方案 ---
const colorThemes = [
    { name: '日落橙', primary: '#ff7e5f', primaryLight: '#feb47b', primaryDark: '#e85d40', primaryRgb: '255,126,95' },
    { name: '薄荷绿', primary: '#11998e', primaryLight: '#38ef7d', primaryDark: '#0d7a6e', primaryRgb: '17,153,142' },
    { name: '珊瑚粉', primary: '#ff6b6b', primaryLight: '#feca57', primaryDark: '#ee5a5a', primaryRgb: '255,107,107' },
    { name: '深海蓝', primary: '#4facfe', primaryLight: '#00f2fe', primaryDark: '#3d9be5', primaryRgb: '79,172,254' },
    { name: '紫罗兰', primary: '#a18cd1', primaryLight: '#fbc2eb', primaryDark: '#8a7bc8', primaryRgb: '161,140,209' },
    { name: '樱花粉', primary: '#f093fb', primaryLight: '#f5576c', primaryDark: '#e07ce8', primaryRgb: '240,147,251' },
    { name: '森林绿', primary: '#56ab2f', primaryLight: '#a8e063', primaryDark: '#4a9a28', primaryRgb: '86,171,47' },
    { name: '焦糖棕', primary: '#8B4513', primaryLight: '#D2691E', primaryDark: '#6d360f', primaryRgb: '139,69,19' }
];
