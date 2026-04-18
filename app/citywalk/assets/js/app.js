        // ========== Citywalk 前端 · 配置与全局状态 ==========
        // 全局变量
        let map = null;
        let startPoint = null;
        let endPoint = null;
        let startMarker = null;
        let endMarker = null;
        let routeLine = null;
        let poiMarkers = [];
        let infoWindow = null;
        let selectedPoiType = "无偏好";
        let routeData = null;
        let debounceTimer = null;
        let liveWeatherData = null;
        let liveWeatherForCity = null;
        let currentTheme = null;
        let currentCity = "北京"; // 当前城市（默认为北京）
        let currentCityCenter = [116.4074, 39.9042]; // 当前城市中心坐标

        // 主要城市坐标配置
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

        // API 基础地址配置 - 根据环境自动切换（本地含 IPv6 ::1）
        const _h = window.location.hostname;
        const API_BASE_URL =
            _h === 'localhost' || _h === '127.0.0.1' || _h === '[::1]' || _h === '::1'
                ? 'http://localhost:5000'
                : 'https://noomings-backend.zeabur.app';

        const CW_SPRITE = 'assets/icons/cw-sprite.svg';
        const WEATHER_SVG_IDS = {
            sunny: 'cw-sun',
            cloudy: 'cw-cloud',
            rainy: 'cw-rain',
            snowy: 'cw-snow',
            windy: 'cw-wind',
            partly: 'cw-partly'
        };

        function getWeatherIconKey(weather) {
            const s = weather == null ? '' : String(weather);
            if (s.includes('晴')) return 'sunny';
            if (s.includes('云')) return 'cloudy';
            if (s.includes('雨')) return 'rainy';
            if (s.includes('雪')) return 'snowy';
            if (s.includes('风')) return 'windy';
            return 'partly';
        }

        function weatherIconHtml(key) {
            const id = WEATHER_SVG_IDS[key] || WEATHER_SVG_IDS.partly;
            return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" focusable="false" aria-hidden="true"><use href="${CW_SPRITE}#${id}"/></svg>`;
        }

        function cwUseHtml(symbolId, w, h, color) {
            const style = color ? `color:${color};` : '';
            return `<span style="display:inline-flex;width:${w}px;height:${h}px;${style}align-items:center;justify-content:center;flex-shrink:0;"><svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 24 24" focusable="false" aria-hidden="true"><use href="${CW_SPRITE}#${symbolId}"/></svg></span>`;
        }

        // 主题配色方案
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

        // 设置随机主题色
        function setRandomTheme() {
            currentTheme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
            const root = document.documentElement;
            root.style.setProperty('--primary', currentTheme.primary);
            root.style.setProperty('--primary-light', currentTheme.primaryLight);
            root.style.setProperty('--primary-dark', currentTheme.primaryDark);
            console.log('当前主题:', currentTheme.name);
        }

        // 页面加载时设置随机主题
        setRandomTheme();

        // 地图加载失败处理
        function mapLoadError() {
            showToast("地图加载失败，请刷新");
        }

        // ========== 天气（获取 / 刷新 / 渲染） ==========
        /**
         * 高德 getLive 支持「城市名」或区域编码 adcode（如 110000）。
         * 港澳：不查本地关键字，直接使用邻近内地城市（香港→深圳，澳门→珠海）并行请求。
         */
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

        /**
         * 获取当前选中城市的实时天气
         * @param {string} city 城市名（与面板「当前城市」一致，如 北京、上海）
         * @param {boolean} forceRefresh 为 true 时忽略缓存重新请求
         */
        function getCityWeather(city, forceRefresh = false) {
            if (!city) city = currentCity;
            if (!forceRefresh && liveWeatherData && liveWeatherForCity === city) {
                updateWeatherUI(
                    `${liveWeatherData.weather} ${liveWeatherData.temperature}℃`,
                    weatherCardDescFromStoredLiveData(liveWeatherData),
                    getWeatherIconKey(liveWeatherData.weather)
                );
                return;
            }

            if (!window.AMap || !AMap.Weather) {
                updateWeatherUI("天气加载失败", "无法获取天气数据", "partly");
                return;
            }

            const meta = getWeatherQueryMeta(city);
            updateWeatherUI(
                "加载中...",
                meta.loadingHint || `正在获取${city}实时天气`,
                "partly"
            );

            function showUnavailable() {
                updateWeatherUI(
                    "天气暂不可用",
                    "该地区暂无高德实时天气或名称不匹配，请出门前查看当地预报",
                    "partly"
                );
            }

            function applyLiveWeather(data, proxyNeighborName) {
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
                    getWeatherIconKey(data.weather)
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

        function startWeatherRefresh() {
            getCityWeather(currentCity, true);
            setInterval(function() {
                getCityWeather(currentCity, true);
            }, 5 * 60 * 1000);
        }

        /** 高德港澳等区域可能返回空对象，字段全缺，不能当成功 */
        function isValidLiveWeatherPayload(data) {
            if (!data || typeof data !== 'object') return false;
            const w = data.weather;
            const t = data.temperature;
            if (w == null || String(w).trim() === '') return false;
            if (t == null || String(t).trim() === '') return false;
            return true;
        }

        // 更新天气卡片 UI（第三参数为 getWeatherIconKey 结果或原始 weather 文案）
        function updateWeatherUI(title, desc, weatherKeyOrLabel) {
            const key =
                weatherKeyOrLabel && WEATHER_SVG_IDS[weatherKeyOrLabel]
                    ? weatherKeyOrLabel
                    : getWeatherIconKey(weatherKeyOrLabel);
            const el = document.getElementById('weatherIcon');
            if (el) el.innerHTML = weatherIconHtml(key);
            document.getElementById('weatherTitle').textContent = title;
            document.getElementById('weatherDesc').textContent = desc;
        }

        // ========== 地图初始化与基础交互 ==========
        // IP 定位获取当前城市
        async function locateUserCity() {
            try {
                const response = await fetch(`${API_BASE_URL}/locate_city`);
                const data = await response.json();
                if (data.success && data.city) {
                    currentCity = data.city;
                    currentCityCenter = data.center || CITY_COORDS[data.city] || [116.4074, 39.9042];
                    document.getElementById('currentCity').textContent = currentCity;
                    // 更新地图中心
                    if (map) {
                        map.setCenter(currentCityCenter);
                    }
                    // 更新天气（定位城市变化后强制拉取）
                    getCityWeather(currentCity, true);
                    console.log(`定位到城市：${currentCity}`, currentCityCenter);
                }
            } catch (e) {
                console.error('IP定位失败：', e);
                document.getElementById('currentCity').textContent = currentCity;
                getCityWeather(currentCity, true);
            }
        }

        // 切换城市
        function switchCity() {
            const cityInput = document.getElementById('cityInput');
            const city = cityInput.value.trim();
            if (!city) {
                showToast('请填写城市名');
                return;
            }
            quickSwitchCity(city);
        }

        // 快速切换城市
        async function quickSwitchCity(city) {
            if (!city || !city.trim()) {
                showToast('城市名无效');
                return;
            }
            
            const cityName = city.trim();
            
            // 检查是否是已知城市（预置坐标）
            if (CITY_COORDS[cityName]) {
                currentCity = cityName;
                currentCityCenter = CITY_COORDS[cityName];
                applyCitySwitch(currentCity, currentCityCenter);
                return;
            }
            
            // 未知城市，使用高德地理编码获取坐标
            showToast(`定位中：${cityName}`);
            
            try {
                const coords = await geocodeCity(cityName);
                if (coords) {
                    currentCity = cityName;
                    currentCityCenter = coords;
                    applyCitySwitch(currentCity, currentCityCenter);
                } else {
                    showToast(`未找到城市：${cityName}`);
                }
            } catch (e) {
                console.error('城市定位失败：', e);
                showToast(`定位失败：${cityName}`);
            }
        }
        
        // 使用高德地理编码获取城市坐标
        function geocodeCity(cityName) {
            return new Promise((resolve, reject) => {
                if (!window.AMap) {
                    reject(new Error('高德地图未加载'));
                    return;
                }
                
                AMap.plugin('AMap.Geocoder', function() {
                    const geocoder = new AMap.Geocoder({
                        city: '全国'
                    });
                    
                    geocoder.getLocation(cityName, function(status, result) {
                        if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                            const location = result.geocodes[0].location;
                            resolve([location.lng, location.lat]);
                        } else {
                            resolve(null);
                        }
                    });
                });
            });
        }
        
        // 应用城市切换
        function applyCitySwitch(cityName, center) {
            document.getElementById('currentCity').textContent = cityName;
            document.getElementById('cityInput').value = '';
            
            // 更新地图中心
            if (map) {
                map.setCenter(center);
                map.setZoom(13);
            }
            
            // 更新天气（切换城市后强制拉取）
            getCityWeather(cityName, true);
            
            // 重置路线选择
            resetSelection();
            
            showToast(`已切换：${cityName}`);
        }

        // 初始化地图
        function initMap() {
            if (!window.AMap) {
                showToast("地图加载失败，检查网络或 Key");
                return;
            }

            try {
                map = new AMap.Map('container', {
                    zoom: 13,
                    center: currentCityCenter,
                    viewMode: '2D',
                    clickEnable: true,
                    dragEnable: true,
                    resizeEnable: true
                });

                infoWindow = new AMap.InfoWindow({
                    offset: new AMap.Pixel(0, -30)
                });

                // 地图点击选点逻辑
                map.on('click', function(e) {
                    const lng = e.lnglat.lng;
                    const lat = e.lnglat.lat;
                    const point = {
                        lng: parseFloat(lng.toFixed(6)),
                        lat: parseFloat(lat.toFixed(6))
                    };

                    if (!startPoint) {
                        setStartPoint(point);
                    } else if (!endPoint) {
                        setEndPoint(point);
                    } else {
                        if (confirm("已选择起终点，是否重新选择？")) {
                            resetSelection();
                            setStartPoint(point);
                        }
                    }
                });

                startWeatherRefresh();
                locateUserCity();

                console.log("地图初始化成功");
            } catch (e) {
                showToast(`地图初始化失败：${e.message}`);
                console.error("地图初始化错误：", e);
            }
        }

        // 显示提示框（防抖）
        function showToast(message, duration = 3000) {
            clearTimeout(debounceTimer);
            const toast = document.getElementById('errorToast');
            toast.textContent = message;
            toast.style.display = 'block';

            debounceTimer = setTimeout(() => {
                toast.style.display = 'none';
            }, duration);
        }

        // ========== 路线选择与 POI 标记 ==========
        // 设置起点
        function setStartPoint(point) {
            startPoint = point;
            if (startMarker) map.remove(startMarker);

            startMarker = new AMap.Marker({
                position: [point.lng, point.lat],
                title: '起点',
                icon: new AMap.Icon({
                    size: new AMap.Size(25, 34),
                    image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_r.png',
                    imageSize: new AMap.Size(25, 34)
                }),
                offset: new AMap.Pixel(-12, -34),
                zIndex: 100
            });
            map.add(startMarker);

            document.getElementById('startCard').className = 'status-card selected';
            document.getElementById('startValue').textContent = '定位中...';

            // 逆地理编码获取地址名称
            reverseGeocode(point.lng, point.lat, function(address) {
                document.getElementById('startValue').textContent = address || `(${point.lng.toFixed(4)}, ${point.lat.toFixed(4)})`;
                startPoint.address = address;
            });

            updateBtnStatus();
        }

        // 设置终点
        function setEndPoint(point) {
            endPoint = point;
            if (endMarker) map.remove(endMarker);

            endMarker = new AMap.Marker({
                position: [point.lng, point.lat],
                title: '终点',
                icon: new AMap.Icon({
                    size: new AMap.Size(25, 34),
                    image: 'https://webapi.amap.com/theme/v1.3/markers/n/mark_b.png',
                    imageSize: new AMap.Size(25, 34)
                }),
                offset: new AMap.Pixel(-12, -34),
                zIndex: 100
            });
            map.add(endMarker);

            document.getElementById('endCard').className = 'status-card selected';
            document.getElementById('endValue').textContent = '定位中...';

            // 逆地理编码获取地址名称
            reverseGeocode(point.lng, point.lat, function(address) {
                document.getElementById('endValue').textContent = address || `(${point.lng.toFixed(4)}, ${point.lat.toFixed(4)})`;
                endPoint.address = address;
            });

            updateBtnStatus();
        }

        // 逆地理编码
        function reverseGeocode(lng, lat, callback) {
            if (!window.AMap) {
                callback(null);
                return;
            }

            AMap.plugin('AMap.Geocoder', function() {
                const geocoder = new AMap.Geocoder({ city: currentCity || '全国' });
                geocoder.getAddress([lng, lat], function(status, result) {
                    if (status === 'complete' && result.regeocode) {
                        const address = result.regeocode.formattedAddress;
                        let shortAddress = address.replace(/^中国/, '');
                        if (currentCity) {
                            const esc = currentCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            shortAddress = shortAddress.replace(new RegExp('^' + esc + '市'), '');
                        }
                        callback(shortAddress || address);
                    } else {
                        callback(null);
                    }
                });
            });
        }

        // 更新按钮状态
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
                if (!isPointValid) {
                    btn.innerText = "等待选择起终点";
                } else {
                    btn.innerText = "请设置游玩时间";
                }
            }
        }

        // 清除POI标记
        function clearPoiMarkers() {
            poiMarkers.forEach(marker => {
                map.remove(marker);
            });
            poiMarkers = [];
        }

        // 添加带有序号的POI标记（仅显示数字，不显示蓝色标记点）
        function addPoiMarkers(pois) {
            clearPoiMarkers();

            if (!Array.isArray(pois) || pois.length === 0) return;

            pois.forEach((poi, index) => {
                if (!poi.location || !Array.isArray(poi.location) || poi.location.length !== 2) {
                    console.warn(`POI ${poi.name} 坐标无效，跳过标记`);
                    return;
                }

                // 只创建序号标签（圆形数字标记 - 使用当前主题色）
                const themeColor = currentTheme ? currentTheme.primary : '#ff7e5f';
                const themeLightColor = currentTheme ? currentTheme.primaryLight : '#feb47b';
                const numberLabel = new AMap.Text({
                    text: `${index+1}`,
                    position: poi.location,
                    offset: new AMap.Pixel(0, 0),
                    style: {
                        'background': `linear-gradient(135deg, ${themeColor}, ${themeLightColor})`,
                        'color': 'white',
                        'border-radius': '0',
                        'min-width': '28px',
                        'height': '28px',
                        'text-align': 'center',
                        'line-height': '28px',
                        'font-size': '13px',
                        'font-weight': 'bold',
                        'border': '3px solid white',
                        'box-shadow': '0 3px 8px rgba(255, 126, 95, 0.4)',
                        'cursor': 'pointer',
                        'padding': '0 6px',
                        'white-space': 'nowrap'
                    },
                    zIndex: 100 + index,
                    title: `${index+1}. ${poi.name}`
                });

                // 点击数字标签显示信息窗口（美化后的样式）
                numberLabel.on('click', function() {
                    const infoWindow = new AMap.InfoWindow({
                        content: `
                            <div style="padding: 16px; font-size: 14px; min-width: 200px; font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif;">
                                <h4 style="margin: 0 0 12px 0; color: #1e293b; font-size: 16px; font-weight: 600; display: flex; align-items: center; gap: 8px;">
                                    <span style="background: linear-gradient(135deg, #ff7e5f, #feb47b); color: white; width: 24px; height: 24px; border-radius: 0; display: inline-flex; align-items: center; justify-content: center; font-size: 12px;">${index+1}</span>
                                    ${poi.name}
                                </h4>
                                <p style="margin: 8px 0; color: #64748b; display: flex; align-items: center; gap: 6px;">
                                    ${cwUseHtml('cw-tag', 14, 14, '#94a3b8')} ${poi.category || poi.type || '未知类型'}
                                </p>
                                <p style="margin: 8px 0; color: #64748b; display: flex; align-items: center; gap: 6px;">
                                    ${cwUseHtml('cw-pin', 14, 14, '#94a3b8')} ${poi.address || '暂无地址'}
                                </p>
                                <p style="margin: 8px 0; color: #ff7e5f; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                                    ${cwUseHtml('cw-clock', 14, 14, '#ff7e5f')} 建议停留 ${poi.stay_time || 8} 分钟
                                </p>
                            </div>
                        `,
                        offset: new AMap.Pixel(0, -18)
                    });
                    infoWindow.open(map, poi.location);
                });

                // 添加到地图
                map.add(numberLabel);
                poiMarkers.push(numberLabel);
            });
        }

        // 重置选择
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

        // 生成路线
        function generateRoute() {
            if (!startPoint || !endPoint) {
                showToast("先选起终点");
                return;
            }

            const planTimeSlider = document.getElementById('planTimeSlider');
            let planTime = parseInt(planTimeSlider.value, 10);

            if (isNaN(planTime) || planTime < 30 || planTime > 180) {
                showToast("计划时长须在 30–180 分钟");
                return;
            }

            const start = [parseFloat(startPoint.lng.toFixed(6)), parseFloat(startPoint.lat.toFixed(6))];
            const end = [parseFloat(endPoint.lng.toFixed(6)), parseFloat(endPoint.lat.toFixed(6))];

            // 显示分步骤加载动画
            showLoadingSteps();

            // 创建超时控制器
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 120秒超时（2分钟）

            fetch(`${API_BASE_URL}/plan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    start: start,
                    end: end,
                    plan_time: planTime,
                    poi_type: selectedPoiType.trim(),
                    city: currentCity
                }),
                signal: controller.signal
            })
            .then(response => {
                clearTimeout(timeoutId);
                if (!response.ok) {
                    // 尝试解析后端返回的JSON错误详情
                    return response.json().then(errData => {
                        const detail = errData.message || errData.error || `HTTP错误：${response.status}`;
                        throw new Error(detail);
                    }).catch(() => {
                        throw new Error(`HTTP错误：${response.status}`);
                    });
                }
                return response.json().catch(err => {
                    throw new Error("后端返回数据格式错误");
                });
            })
            .then(data => {
                hideLoadingSteps();
                if (!data.success) {
                    showToast(`规划失败：${data.message || '未知错误'}`);
                    return;
                }

                routeData = data;

                if (routeLine) map.remove(routeLine);
                // 绘制路线 - 使用当前主题色
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
                    showDir: true  // 显示方向箭头
                });
                map.add(routeLine);

                // 添加带有序号的POI标记
                addPoiMarkers(data.pois);

                map.setFitView([startMarker, endMarker, routeLine, ...poiMarkers], {
                    padding: [50, 50, 50, 50],
                    animate: true
                });

                document.getElementById('distanceValue').textContent =
                    (data.distance / 1000).toFixed(2) + ' km';
                
                // 计算总耗时：步行时间 + POI停留时间（每个POI约5分钟）
                const walkDuration = data.duration || 0;
                const poiStayTime = (data.pois ? data.pois.length : 0) * 5;
                const totalDuration = walkDuration + poiStayTime;
                document.getElementById('durationValue').textContent = totalDuration + ' 分钟';
                
                document.getElementById('poiCountValue').textContent =
                    data.pois.length + '个';

                const poiList = document.getElementById('poiList');
                poiList.innerHTML = '';
                if (poiList) {
                    const pois = Array.isArray(data.pois) ? data.pois : [];
                    if (pois.length > 0) {
                        pois.forEach((poi, index) => {
                            const poiName = poi.name || '未知名称';
                            const poiType = poi.type || '未知类型';
                            const poiItem = document.createElement('div');
                            poiItem.className = 'poi-item';
                            poiItem.onclick = () => {
                                if (poi.location && Array.isArray(poi.location) && poi.location.length === 2) {
                                    map.setCenter(poi.location);
                                    map.setZoom(17);
                                }
                            };
                            poiItem.innerHTML = `
                                <div style="display: flex; align-items: flex-start; gap: 8px;">
                                    ${cwUseHtml('cw-pin', 20, 20, 'var(--primary, #ff7e5f)')}
                                    <div style="flex: 1;">
                                        <strong>${index+1}. ${poiName}</strong>
                                        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${poiType}</div>
                                    </div>
                                </div>
                            `;
                            poiList.appendChild(poiItem);
                        });
                    } else {
                        poiList.innerHTML = `
                            <div class="poi-item" style="color: var(--text-light, #999);">
                                暂无推荐打卡点
                            </div>
                        `;
                    }
                }

                const resultArea = document.getElementById('resultArea');
                if (resultArea) resultArea.style.display = 'block';
                const btnGeneratePlan = document.getElementById('btnGeneratePlan');
                if (btnGeneratePlan) btnGeneratePlan.style.display = 'flex';
                const btnShareImage = document.getElementById('btnShareImage');
                if (btnShareImage) btnShareImage.style.display = 'flex';

                // 生成路线后主动刷新天气
                getCityWeather(currentCity, true);
            })
            .catch(error => {
                hideLoadingSteps();
                let errorMsg = '';
                if (error.name === 'AbortError') {
                    errorMsg = "请求超时：检查后端是否运行或缩短路线";
                } else if (error.message.includes('timeout')) {
                    errorMsg = "请求超时，检查网络或后端";
                } else if (error.message.includes('Failed to fetch')) {
                    errorMsg = "无法连接后端：确认服务已启动、地址端口与跨域";
                } else if (error.message.includes('JSON')) {
                    errorMsg = "接口返回非预期 JSON";
                } else {
                    errorMsg = `请求失败：${error.message}`;
                }
                showToast(errorMsg);
                console.error('路线规划错误：', error);
            });
        }

        // ========== 文字攻略与分享长图 ==========
        // 生成更贴心的文字方案
        function generatePlanText() {
            if (!routeData || !routeData.success) {
                showToast("请先生成路线");
                return;
            }

            // 获取基础数据
            const planTime = document.getElementById('planTimeSlider').value;
            const poiType = selectedPoiType || "无偏好";
            const distance = (routeData.distance / 1000).toFixed(2);
            const walkDuration = routeData.duration || 0;
            const poiCount = routeData.pois ? routeData.pois.length : 0;
            // 总耗时 = 步行时间 + POI停留时间（每个约5分钟）
            const duration = walkDuration + poiCount * 5;

            // 获取当前时间，生成个性化问候
            const now = new Date();
            const hour = now.getHours();
            let greeting = '';
            if (hour < 10) {
                greeting = '早上好';
            } else if (hour < 14) {
                greeting = '中午好';
            } else if (hour < 18) {
                greeting = '下午好';
            } else {
                greeting = '晚上好';
            }

            let poiText = '';
            if (poiCount > 0) {
                poiText = '\n【打卡点】\n';
                routeData.pois.forEach((poi, index) => {
                    const poiName = poi.name || '未知名称';
                    poiText += `${index + 1}. ${poiName}\n`;
                });
            } else {
                poiText = '\n【打卡点】\n暂无推荐点，可自由步行。\n';
            }

            let weatherTips = '\n【天气】\n';
            if (liveWeatherData && liveWeatherData.weather != null) {
                const proxyHint = liveWeatherData.proxyNeighborName
                    ? `（${liveWeatherData.proxyNeighborName}市实况，供${currentCity}参考）`
                    : '';
                weatherTips += `${proxyHint}${currentCity} ${liveWeatherData.weather}，${liveWeatherData.temperature}℃，${liveWeatherData.windDirection}风${liveWeatherData.windPower}级，湿度${liveWeatherData.humidity}%\n`;

                const wx = String(liveWeatherData.weather);
                const t = parseInt(liveWeatherData.temperature, 10);
                if (wx.includes('雨')) {
                    weatherTips += '有雨，注意路滑，建议带伞。\n';
                } else if (t > 30) {
                    weatherTips += '气温偏高，注意防晒与补水。\n';
                } else if (t < 10) {
                    weatherTips += '气温偏低，注意保暖。\n';
                } else {
                    weatherTips += '体感尚可，适合步行。\n';
                }
            } else {
                weatherTips += '暂无实时天气，出门前请自行查看预报。\n';
            }

            const planText = `${greeting}。${currentCity} 步行方案

【主题】${poiType}
【计划时长】${planTime} 分钟
【路线长度】${distance} 公里
【预计总耗时】${duration} 分钟
${weatherTips}
${poiText}

【备注】按序号游览；可随时改路线。`;

            // 使用自定义弹窗展示长文案（避免原生 alert 截断）
            showCustomModal(planText);

            // 复制到剪贴板
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(planText).then(() => {
                        showToast("文字方案已复制");
                    }).catch(err => {
                        throw err;
                    });
                } else {
                    const textArea = document.createElement('textarea');
                    textArea.value = planText;
                    document.body.appendChild(textArea);
                    textArea.focus();
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    showToast("文字方案已复制");
                }
            } catch (err) {
                console.error('复制失败：', err);
                showToast("复制失败，请手动复制弹窗内文字");
            }
        }

// 生成分享长图（使用浏览器原生截图API截取地图）
async function generateShareImage() {
    if (!routeData || !routeData.success) {
        showToast("请先生成路线");
        return;
    }

    showToast("截屏中…");

    // ========== 第一步：使用屏幕共享API截取地图 ==========
    let mapImageUrl = null;
    try {
        showToast("请选择要导出的地图区域");
        
        // 请求屏幕共享
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'never',
                displaySurface: 'browser' // 优先浏览器标签页
            },
            audio: false
        });
        
        showToast("截屏中…");
        
        // 创建视频元素捕获画面
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        // 等待视频准备好
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                setTimeout(resolve, 500); // 额外等待确保画面稳定
            };
        });
        
        // 创建canvas绘制视频帧
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 停止屏幕共享
        stream.getTracks().forEach(track => track.stop());
        
        // 转换为图片URL
        mapImageUrl = canvas.toDataURL('image/png', 0.9);
        showToast("截屏完成，合成中…");
    } catch (e) {
        console.warn('屏幕共享取消或失败:', e);
        if (e.name === 'NotAllowedError') {
            showToast("已取消共享，使用默认背景");
        } else {
            showToast("截图失败，使用默认背景");
        }
    }

    // ========== 第二步：收集数据 ==========
    const poiType = selectedPoiType || "无偏好";
    const distance = (routeData.distance / 1000).toFixed(2);
    const walkDuration = routeData.duration || 0;
    const poiCount = routeData.pois ? routeData.pois.length : 0;
    // 总耗时 = 步行 + POI停留
    const duration = walkDuration + poiCount * 5;
    const now = new Date();
    
    // 主题名称映射
    const themeNames = {
        '无偏好': '城市漫游',
        '自然': '绿意寻踪',
        '历史': '时光漫步',
        '文创': '文艺探索',
        '花店': '花香之旅',
        '咖啡': '咖啡时光',
        '甜品': '甜蜜漫步',
        '烘焙': '麦香寻味',
        '商场': '都市探索'
    };
    const themeName = themeNames[poiType] || '城市漫游';
    
    // 提取区域名称
    const startAddr = startPoint?.address || document.getElementById('startValue').textContent || '';
    const endAddr = endPoint?.address || document.getElementById('endValue').textContent || '';
    let areaName = currentCity;
    
    // 天气信息
    let weatherText = '适宜出行';
    if (liveWeatherData) {
        const px = liveWeatherData.proxyNeighborName
            ? `${liveWeatherData.proxyNeighborName}市 `
            : '';
        weatherText = `${px}${liveWeatherData.weather} ${liveWeatherData.temperature}℃`;
    }
    
    // 日期格式化
    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    
    // ========== 第三步：使用当前网页主题色 ==========
    // 使用与网页相同的主题色，如果没有则随机选择
    let theme;
    if (currentTheme) {
        theme = {
            name: currentTheme.name,
            primary: currentTheme.primary,
            secondary: currentTheme.primaryLight,
            gradient: `linear-gradient(180deg, ${currentTheme.primary}e6 0%, ${currentTheme.primaryLight}b3 50%, transparent 100%)`
        };
    } else {
        // 备选：随机选择
        const colorThemes = [
            { name: '日落橙', primary: '#ff7e5f', secondary: '#feb47b', gradient: 'linear-gradient(180deg, rgba(255,126,95,0.9) 0%, rgba(254,180,123,0.7) 50%, transparent 100%)' },
            { name: '薄荷绿', primary: '#11998e', secondary: '#38ef7d', gradient: 'linear-gradient(180deg, rgba(17,153,142,0.9) 0%, rgba(56,239,125,0.7) 50%, transparent 100%)' },
            { name: '珊瑚粉', primary: '#ff6b6b', secondary: '#feca57', gradient: 'linear-gradient(180deg, rgba(255,107,107,0.9) 0%, rgba(254,202,87,0.7) 50%, transparent 100%)' },
            { name: '深海蓝', primary: '#4facfe', secondary: '#00f2fe', gradient: 'linear-gradient(180deg, rgba(79,172,254,0.9) 0%, rgba(0,242,254,0.7) 50%, transparent 100%)' },
            { name: '紫罗兰', primary: '#a18cd1', secondary: '#fbc2eb', gradient: 'linear-gradient(180deg, rgba(161,140,209,0.9) 0%, rgba(251,194,235,0.7) 50%, transparent 100%)' },
            { name: '樱花粉', primary: '#f093fb', secondary: '#f5576c', gradient: 'linear-gradient(180deg, rgba(240,147,251,0.9) 0%, rgba(245,87,108,0.7) 50%, transparent 100%)' },
            { name: '森林绿', primary: '#56ab2f', secondary: '#a8e063', gradient: 'linear-gradient(180deg, rgba(86,171,47,0.9) 0%, rgba(168,224,99,0.7) 50%, transparent 100%)' },
            { name: '焦糖棕', primary: '#8B4513', secondary: '#D2691E', gradient: 'linear-gradient(180deg, rgba(139,69,19,0.9) 0%, rgba(210,105,30,0.7) 50%, transparent 100%)' }
        ];
        theme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
    }
    
    // 文艺文案库（扩充并优化）
    const slogans = [
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
    const randomSlogan = slogans[Math.floor(Math.random() * slogans.length)];

    // 构建POI列表（美化版，悬浮气泡样式）
    let poisHtml = '';
    if (poiCount > 0) {
        const showPois = routeData.pois.slice(0, 4);
        poisHtml = '<div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 0 10px;">';
        const pinSvgShare = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="none" stroke="#2d3748" stroke-width="1.75" d="M12 21s7-5 7-11a7 7 0 1 0-14 0c0 6 7 11 7 11z"/><circle fill="#2d3748" cx="12" cy="10" r="2"/></svg>';
        showPois.forEach((poi, index) => {
            const poiName = (poi.name || '未知').slice(0, 6);
            poisHtml += `
                <div style="background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.9)); border-radius: 0; padding: 8px 14px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.5); backdrop-filter: blur(10px);">
                    <span style="display:inline-flex;filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">${pinSvgShare}</span>
                    <span style="font-size: 11px; color: #2d3748; font-weight: 600; letter-spacing: 0.3px;">${poiName}</span>
                </div>
            `;
        });
        if (poiCount > 4) {
            poisHtml += `
                <div style="background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary}); border-radius: 0; padding: 8px 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.3);">
                    <span style="font-size: 12px; color: white; font-weight: 700;">+${poiCount - 4}</span>
                </div>
            `;
        }
        poisHtml += '</div>';
    }

    // ========== 第四步：构建长图HTML（4:5比例，美图为主） ==========
    const shareCard = document.createElement('div');
    shareCard.style.cssText = `
        position: fixed;
        top: -9999px;
        left: -9999px;
        width: 400px;
        height: 500px;
        font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
        overflow: hidden;
    `;

    // 背景样式：有地图截图用截图，无截图用渐变
    const bgStyle = mapImageUrl 
        ? `background-image: url('${mapImageUrl}'); background-size: cover; background-position: center;`
        : `background: linear-gradient(135deg, ${theme.primary}22, ${theme.secondary}44);`;

    shareCard.innerHTML = `
        <!-- 地图截图背景层 -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; ${bgStyle}">
            ${mapImageUrl ? '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.25);"></div>' : ''}
        </div>
        
        <!-- 顶部主题色渐变遮罩 -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 150px; background: ${theme.gradient};"></div>
        
        <!-- 底部主题色渐变遮罩 -->
        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 200px; background: linear-gradient(0deg, ${theme.primary}ee 0%, ${theme.secondary}aa 30%, transparent 100%);"></div>
        
        <!-- 顶部信息区 -->
        <div style="position: absolute; top: 0; left: 0; width: 100%; padding: 18px 22px; box-sizing: border-box;">
            <div style="font-size: 10px; color: rgba(255,255,255,0.95); margin-bottom: 6px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">CITYWALK · ${areaName}</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: white; line-height: 1.2; text-shadow: 0 2px 12px rgba(0,0,0,0.3); letter-spacing: 0.5px;">
                ${themeName}
            </h1>
            <div style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.9); font-weight: 500; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">${dateStr} · ${weatherText}</div>
        </div>
        
        <!-- 右侧竖排文案区 -->
        <div style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: upright; z-index: 10;">
            <div style="font-size: 13px; color: white; font-weight: 700; text-shadow: 0 2px 8px rgba(0,0,0,0.4); letter-spacing: 4px; padding: 12px 8px; background: linear-gradient(180deg, ${theme.primary}cc, ${theme.secondary}aa); border-radius: 0; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                ${randomSlogan}
            </div>
        </div>
        
        <!-- 底部信息区 - 毛玻璃卡片样式 -->
        <div style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 360px; padding: 20px; box-sizing: border-box; background: rgba(255,255,255,0.25); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 0; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3);">
            <!-- 数据统计 -->
            <div style="display: flex; justify-content: space-around; margin-bottom: 16px;">
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 26px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.5px;">${distance}<span style="font-size: 11px; font-weight: 600; margin-left: 2px;">km</span></div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">总距离</div>
                </div>
                <div style="width: 1px; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent);"></div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 26px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.5px;">${duration}<span style="font-size: 11px; font-weight: 600; margin-left: 2px;">min</span></div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">预计用时</div>
                </div>
                <div style="width: 1px; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent);"></div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 26px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.5px;">${poiCount}<span style="font-size: 11px; font-weight: 600; margin-left: 2px;">个</span></div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">打卡点</div>
                </div>
            </div>
            
            <!-- POI列表 -->
            ${poisHtml}
        </div>
    `;

    document.body.appendChild(shareCard);

    // ========== 第五步：生成并下载图片 ==========
    try {
        const canvas = await html2canvas(shareCard, {
            scale: 3,
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
            
            showToast("长图已生成");
        }, 'image/png', 0.95);
        
        document.body.removeChild(shareCard);
    } catch (err) {
        console.error('生成图片失败:', err);
        document.body.removeChild(shareCard);
        showToast("导出图片失败，请重试");
    }
}

// 新增：自定义弹窗函数（支持滚动查看全部内容）
function showCustomModal(content) {
    // 创建弹窗容器
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        padding: 20px;
        box-sizing: border-box;
    `;

    // 创建弹窗内容区
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 0;
        padding: 20px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap; /* 保留换行符 */
        word-wrap: break-word; /* 自动换行 */
    `;
    modalContent.textContent = content;

    // 创建关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = `
        margin-top: 20px;
        padding: 8px 20px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 0;
        cursor: pointer;
        font-size: 14px;
        display: block;
        margin-left: auto;
        margin-right: auto;
    `;
    closeBtn.onclick = () => {
        document.body.removeChild(modal);
    };

    // 组装弹窗
    modalContent.appendChild(closeBtn);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 点击空白处关闭
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

        // ========== 初始化与事件绑定（筛选 / 输入 / 搜索） ==========
        // 绑定 POI 类型选择事件
        document.querySelectorAll('.poi-type-btn').forEach(btn => {
            btn.onclick = function() {
                document.querySelectorAll('.poi-type-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                selectedPoiType = this.dataset.type;
            };
        });

        // 时间滑块实时更新
        const planTimeSlider = document.getElementById('planTimeSlider');
        const planTimeValue = document.getElementById('planTimeValue');
        planTimeSlider.addEventListener('input', function() {
            const val = parseInt(this.value);
            planTimeValue.textContent = `${val} 分钟`;
            updateBtnStatus();
        });

        // 搜索框功能
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    const keyword = this.value.trim();
                    if (keyword) {
                        searchAddress(keyword);
                    }
                }
            });
        }

        // 搜索地址（使用PlaceSearch支持模糊搜索）
        function searchAddress(keyword) {
            if (!window.AMap) {
                showToast("地图未就绪");
                return;
            }

            showToast(`搜索中：${keyword}`);

            // 先尝试使用 PlaceSearch 进行POI搜索（支持模糊匹配）
            AMap.plugin('AMap.PlaceSearch', function() {
                const placeSearch = new AMap.PlaceSearch({
                    city: currentCity || '全国',
                    citylimit: false,
                    pageSize: 5,
                    pageIndex: 1
                });
                
                placeSearch.search(keyword, function(status, result) {
                    if (status === 'complete' && result.info === 'OK' && result.poiList && result.poiList.pois.length > 0) {
                        // 找到POI结果
                        const pois = result.poiList.pois;
                        const poi = pois[0];  // 取第一个结果
                        
                        // 在地图上标记位置
                        const marker = new AMap.Marker({
                            position: [poi.location.lng, poi.location.lat],
                            title: poi.name
                        });
                        map.add(marker);
                        
                        // 设置地图中心和缩放
                        map.setCenter([poi.location.lng, poi.location.lat]);
                        map.setZoom(17);
                        
                        // 显示信息窗体
                        const infoWindow = new AMap.InfoWindow({
                            content: `<div style="padding: 10px; font-size: 14px;">
                                <strong>${poi.name}</strong><br/>
                                <span style="color: #666; font-size: 12px;">${poi.address || ''}</span><br/>
                                <span style="color: #ff7e5f; font-size: 12px;">点击地图设为起点或终点</span>
                            </div>`,
                            offset: new AMap.Pixel(0, -30)
                        });
                        infoWindow.open(map, [poi.location.lng, poi.location.lat]);
                        
                        showToast(`已找到「${poi.name}」，请在地图选起终点`);
                        
                        // 3秒后清除标记和信息窗
                        setTimeout(() => {
                            map.remove(marker);
                            infoWindow.close();
                        }, 5000);
                    } else {
                        // POI搜索无结果，尝试地理编码
                        tryGeocodeSearch(keyword);
                    }
                });
            });
        }
        
        // 备选：地理编码搜索
        function tryGeocodeSearch(keyword) {
            AMap.plugin('AMap.Geocoder', function() {
                const geocoder = new AMap.Geocoder({ 
                    city: currentCity || '全国',
                    radius: 50000
                });
                geocoder.getLocation(keyword, function(status, result) {
                    if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                        const geocode = result.geocodes[0];
                        const location = geocode.location;
                        
                        // 在地图上标记位置
                        const marker = new AMap.Marker({
                            position: [location.lng, location.lat],
                            title: geocode.formattedAddress || keyword
                        });
                        map.add(marker);
                        
                        // 设置地图中心和缩放
                        map.setCenter([location.lng, location.lat]);
                        map.setZoom(17);
                        
                        showToast("已定位，请在地图选起终点");
                        
                        // 3秒后清除标记
                        setTimeout(() => {
                            map.remove(marker);
                        }, 3000);
                    } else {
                        showToast("未找到地点，请换关键词");
                    }
                });
            });
        }

        // ========== UI 辅助：加载动画、Toast、面板 ==========
        // 分步骤加载动画
        function showLoadingSteps() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.style.display = 'flex';
                
                // 重置所有步骤状态
                ['step1', 'step2', 'step3', 'step4'].forEach((stepId, index) => {
                    const step = document.getElementById(stepId);
                    step.className = 'loading-step';
                    setTimeout(() => {
                        if (index === 0) {
                            step.classList.add('active');
                        }
                    }, 100);
                });
                
                // 模拟进度（实际由后端响应触发）
                let currentStep = 1;
                window.loadingProgressInterval = setInterval(() => {
                    if (currentStep < 4) {
                        const prevStep = document.getElementById(`step${currentStep}`);
                        prevStep.classList.remove('active');
                        prevStep.classList.add('done');
                        
                        currentStep++;
                        const nextStep = document.getElementById(`step${currentStep}`);
                        nextStep.classList.add('active');
                    }
                }, 1500);
            }
        }

        function hideLoadingSteps() {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                // 清除定时器
                if (window.loadingProgressInterval) {
                    clearInterval(window.loadingProgressInterval);
                }
                
                // 将所有步骤标记为完成
                ['step1', 'step2', 'step3', 'step4'].forEach((stepId) => {
                    const step = document.getElementById(stepId);
                    step.classList.remove('active');
                    step.classList.add('done');
                });
                
                // 延迟关闭动画
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 800);
            }
        }

        // 天气卡片点击刷新
        const weatherCard = document.getElementById('weatherCard');
        if (weatherCard) {
            weatherCard.addEventListener('click', function() {
                getCityWeather(currentCity, true);
            });
        }

        // 页面加载完成初始化
        if (window.AMap) {
            initMap();
        } else {
            setTimeout(() => {
                if (!map) initMap();
            }, 2000);
        }

        // 移动端触摸手势支持 - 流畅的展开/收起
        (function initTouchGestures() {
            const controlPanel = document.querySelector('.control-panel');
            if (!controlPanel) return;

            const header = controlPanel.querySelector('.panel-header');
            if (!header) return;

            let startY = 0;
            let startTime = 0;
            let isExpanded = false;
            let isDragging = false;
            let hasMoved = false;

            // 检测是否为移动设备
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (!isMobile) return;

            // 切换展开/收起状态
            function togglePanel(expand) {
                isExpanded = expand !== undefined ? expand : !isExpanded;
                if (isExpanded) {
                    controlPanel.classList.add('expanded');
                } else {
                    controlPanel.classList.remove('expanded');
                }
            }

            // 点击头部切换（还原为：点击整个头部都可以展开/收起）
            header.addEventListener('click', function(e) {
                if (hasMoved) return; // 如果是拖动操作，不触发点击
                togglePanel();
            });

            // 触摸开始
            header.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                startTime = Date.now();
                isDragging = true;
                hasMoved = false;
                header.style.cursor = 'grabbing';
            }, { passive: true });

            // 触摸移动 - 检测滑动方向
            header.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                
                const currentY = e.touches[0].clientY;
                const deltaY = startY - currentY;
                
                // 移动超过 10px 认为是拖动
                if (Math.abs(deltaY) > 10) {
                    hasMoved = true;
                }
                
                // 根据滑动方向实时反馈
                if (deltaY > 30 && !isExpanded) {
                    // 向上滑动，准备展开
                    header.style.transform = 'translateY(-2px)';
                } else if (deltaY < -30 && isExpanded) {
                    // 向下滑动，准备收起
                    header.style.transform = 'translateY(2px)';
                }
            }, { passive: true });

            // 触摸结束
            header.addEventListener('touchend', function(e) {
                if (!isDragging) return;
                isDragging = false;
                header.style.cursor = 'grab';
                header.style.transform = '';

                const endY = e.changedTouches[0].clientY;
                const deltaY = startY - endY;
                const deltaTime = Date.now() - startTime;

                // 快速滑动（轻扫）
                if (deltaTime < 300 && Math.abs(deltaY) > 50) {
                    if (deltaY > 0) {
                        togglePanel(true); // 向上轻扫，展开
                    } else {
                        togglePanel(false); // 向下轻扫，收起
                    }
                } else if (Math.abs(deltaY) > 80) {
                    // 慢速但滑动距离大
                    if (deltaY > 0) {
                        togglePanel(true);
                    } else {
                        togglePanel(false);
                    }
                }
                // 否则认为是点击，由 click 事件处理
            }, { passive: true });

            // 阻止头部区域的默认滚动行为
            header.addEventListener('touchmove', function(e) {
                e.preventDefault();
            }, { passive: false });

            // 面板内容区域滚动时，如果滚动到顶部继续下拉则收起面板
            const panelBody = controlPanel.querySelector('.panel-body');
            if (panelBody) {
                let bodyStartY = 0;
                
                panelBody.addEventListener('touchstart', function(e) {
                    bodyStartY = e.touches[0].clientY;
                }, { passive: true });

                panelBody.addEventListener('touchmove', function(e) {
                    const currentY = e.touches[0].clientY;
                    const deltaY = currentY - bodyStartY;
                    
                    // 如果已经在顶部且继续向下滑动
                    if (panelBody.scrollTop <= 0 && deltaY > 30) {
                        // 阻止默认滚动，准备收起面板
                        if (deltaY > 50) {
                            togglePanel(false);
                        }
                    }
                }, { passive: true });
            }
        })();

        // 移动端双击放大地图
        (function initMapDoubleTap() {
            const container = document.getElementById('container');
            if (!container) return;

            let lastTapTime = 0;
            let lastTapX = 0;
            let lastTapY = 0;

            container.addEventListener('touchend', function(e) {
                const currentTime = new Date().getTime();
                const tapX = e.changedTouches[0].clientX;
                const tapY = e.changedTouches[0].clientY;
                const tapLength = currentTime - lastTapTime;

                if (tapLength < 300 && tapLength > 0) {
                    // 双击检测
                    const distance = Math.sqrt(
                        Math.pow(tapX - lastTapX, 2) + Math.pow(tapY - lastTapY, 2)
                    );
                    if (distance < 30 && map) {
                        e.preventDefault();
                        const currentZoom = map.getZoom();
                        map.setZoom(currentZoom + 1);
                    }
                }

                lastTapTime = currentTime;
                lastTapX = tapX;
                lastTapY = tapY;
            });
        })();

        // 阻止移动端默认滚动行为（在地图区域）
        document.getElementById('container').addEventListener('touchmove', function(e) {
            // 允许地图正常滚动
            e.stopPropagation();
        }, { passive: true });

        // 点击地图区域收起面板
        (function initMapTapToClose() {
            const container = document.getElementById('container');
            const controlPanel = document.querySelector('.control-panel');
            if (!container || !controlPanel) return;

            container.addEventListener('touchstart', function(e) {
                // 如果面板是展开的，点击地图收起
                if (controlPanel.classList.contains('expanded')) {
                    controlPanel.classList.remove('expanded');
                }
            }, { passive: true });
        })();

