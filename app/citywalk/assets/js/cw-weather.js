// ========== Citywalk · 天气模块 ==========

function getWeatherQueryMeta(city) {
    if (!city || typeof city !== 'string') {
        return { keys: ['北京市'], proxyNeighborName: null, loadingHint: null };
    }
    const c = city.trim();
    if (c === '香港' || c === '香港特别行政区') {
        return {
            keys: ['深圳市', '440300'],
            proxyNeighborName: '深圳',
            loadingHint: `正在获取深圳市天气（${c}邻近城市·供参考）…`
        };
    }
    if (c === '澳门' || c === '澳门特别行政区') {
        return {
            keys: ['珠海市', '440400'],
            proxyNeighborName: '珠海',
            loadingHint: `正在获取珠海市天气（${c}邻近城市·供参考）…`
        };
    }
    let keys;
    if (c.includes('特别行政区')) keys = [c];
    else if (c.endsWith('市') || c.endsWith('州')) keys = [c];
    else keys = [c + '市'];
    return { keys: keys, proxyNeighborName: null, loadingHint: null };
}

function weatherCardDescFromStoredLiveData(d) {
    if (!d) return '';
    const w = d.windDirection || '--';
    const p = d.windPower != null ? d.windPower : '--';
    const h = d.humidity != null ? d.humidity : '--';
    const base = `风向${w} ${p}级 | 湿度${h}%`;
    if (d.proxyNeighborName) {
        const dest = liveWeatherForCity || currentCity || '';
        return `${d.proxyNeighborName}市天气 · 供${dest}参考 | ${base} | 刚刚更新`;
    }
    return `${base} | 刚刚更新`;
}

function getCityWeather(city, forceRefresh = false) {
    if (!city) city = currentCity;
    if (!forceRefresh && liveWeatherData && liveWeatherForCity === city) {
        updateWeatherUI(
            `${liveWeatherData.weather} ${liveWeatherData.temperature}℃`,
            weatherCardDescFromStoredLiveData(liveWeatherData),
            getWeatherIcon(liveWeatherData.weather)
        );
        return;
    }

    if (!window.AMap || !AMap.Weather) {
        updateWeatherUI("天气加载失败", "无法获取天气数据", "⛅");
        return;
    }

    const meta = getWeatherQueryMeta(city);
    updateWeatherUI(
        "加载中...",
        meta.loadingHint || `正在获取${city}实时天气`,
        "🌤️"
    );

    // 记录本次请求的版本号，防止过期响应覆盖新结果
    const myRequestId = ++weatherRequestId;

    function showUnavailable() {
        updateWeatherUI(
            "天气暂不可用",
            "该地区暂无高德实时天气或名称不匹配，请出门前查看当地预报",
            "⛅"
        );
    }

    function applyLiveWeather(data, proxyNeighborName) {
        if (weatherRequestId !== myRequestId) return; // 丢弃过期响应
        liveWeatherForCity = city;
        liveWeatherData = {
            temperature: data.temperature,
            weather: data.weather,
            windDirection: data.windDirection || '--',
            windPower: data.windPower != null ? data.windPower : '--',
            humidity: data.humidity != null ? data.humidity : '--',
            updateTime: new Date(),
            proxyNeighborName: proxyNeighborName || null
        };
        updateWeatherUI(
            `${data.weather} ${data.temperature}℃`,
            weatherCardDescFromStoredLiveData(liveWeatherData),
            getWeatherIcon(data.weather)
        );
    }

    function tryWeatherKeys(keys, proxyNeighborName, onAllFailed) {
        const DEADLINE_MS = 10000;
        let settled = false;
        let pending = keys.length;
        const deadlineTimer = setTimeout(function() {
            if (settled) return;
            settled = true;
            onAllFailed();
        }, DEADLINE_MS);

        keys.forEach(function(district) {
            const weatherApi = new AMap.Weather();
            weatherApi.getLive(district, function(err, data) {
                if (settled) return;
                pending--;
                if (!err && data && isValidLiveWeatherPayload(data)) {
                    settled = true;
                    clearTimeout(deadlineTimer);
                    applyLiveWeather(data, proxyNeighborName);
                    return;
                }
                if (pending === 0) {
                    settled = true;
                    clearTimeout(deadlineTimer);
                    onAllFailed();
                }
            });
        });
    }

    tryWeatherKeys(meta.keys, meta.proxyNeighborName, showUnavailable);
}

let _weatherRefreshInterval = null;
function startWeatherRefresh() {
    if (_weatherRefreshInterval) clearInterval(_weatherRefreshInterval);
    getCityWeather(currentCity, true);
    _weatherRefreshInterval = setInterval(function() {
        getCityWeather(currentCity, true);
    }, 5 * 60 * 1000);
}

function isValidLiveWeatherPayload(data) {
    if (!data || typeof data !== 'object') return false;
    const w = data.weather;
    const t = data.temperature;
    if (w == null || String(w).trim() === '') return false;
    if (t == null || String(t).trim() === '') return false;
    return true;
}

function getWeatherIcon(weather) {
    const s = weather == null ? '' : String(weather);
    if (s.includes('晴')) return '☀️';
    if (s.includes('云')) return '☁️';
    if (s.includes('雨')) return '🌧️';
    if (s.includes('雪')) return '❄️';
    if (s.includes('风')) return '🌬️';
    return '⛅';
}

function updateWeatherUI(title, desc, icon) {
    document.getElementById('weatherIcon').textContent = icon;
    document.getElementById('weatherTitle').textContent = title;
    document.getElementById('weatherDesc').textContent = desc;
}
