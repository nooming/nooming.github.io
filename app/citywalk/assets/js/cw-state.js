// ========== Citywalk · 全局状态与常量 ==========
// 所有模块共享此文件中声明的变量（无需 import，后续 <script> 标签按顺序加载）

// --- 地图与标记 ---
let map = null;
let startPoint = null;
let endPoint = null;
let startMarker = null;
let endMarker = null;
let routeLine = null;
let poiMarkers = [];
let infoWindow = null;
let searchMarker = null;

// --- 业务状态 ---
let selectedPoiType = "无偏好";
let selectedRouteStyle = "balanced";
let routeData = null;
let debounceTimer = null;

// --- 天气 ---
let liveWeatherData = null;
let liveWeatherForCity = null;
let weatherRequestId = 0; // 防止并发天气响应乱序

// --- 城市与主题 ---
let currentTheme = null;
let currentCity = "北京";
let currentCityCenter = [116.4074, 39.9042];

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
    { name: '日落橙', primary: '#ff7e5f', primaryLight: '#feb47b', primaryDark: '#e85d40' },
    { name: '薄荷绿', primary: '#11998e', primaryLight: '#38ef7d', primaryDark: '#0d7a6e' },
    { name: '珊瑚粉', primary: '#ff6b6b', primaryLight: '#feca57', primaryDark: '#ee5a5a' },
    { name: '深海蓝', primary: '#4facfe', primaryLight: '#00f2fe', primaryDark: '#3d9be5' },
    { name: '紫罗兰', primary: '#a18cd1', primaryLight: '#fbc2eb', primaryDark: '#8a7bc8' },
    { name: '樱花粉', primary: '#f093fb', primaryLight: '#f5576c', primaryDark: '#e07ce8' },
    { name: '森林绿', primary: '#56ab2f', primaryLight: '#a8e063', primaryDark: '#4a9a28' },
    { name: '焦糖棕', primary: '#8B4513', primaryLight: '#D2691E', primaryDark: '#6d360f' }
];
