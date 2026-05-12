// ========== Citywalk · 地图模块 ==========

function initMap() {
    if (!window.AMap) {
        showToast("高德地图加载失败，请检查网络或Key有效性");
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
                setEndPoint(point);
                showToast("终点已更新，如需重设起点请点击「重置选择」");
            }
        });

        startWeatherRefresh();
        locateUserCity();
    } catch (e) {
        showToast(`地图初始化失败：${e.message}`);
        console.error("地图初始化错误：", e);
    }
}

async function locateUserCity() {
    try {
        const response = await fetch(`${API_BASE_URL}/locate_city`);
        const data = await response.json();
        if (data.success && data.city) {
            currentCity = data.city;
            currentCityCenter = data.center || CITY_COORDS[data.city] || [116.4074, 39.9042];
            document.getElementById('currentCity').textContent = currentCity;
            if (map) {
                map.setCenter(currentCityCenter);
            }
            getCityWeather(currentCity, true);
        }
    } catch (e) {
        console.error('IP定位失败：', e);
        document.getElementById('currentCity').textContent = currentCity;
        getCityWeather(currentCity, true);
    }
}

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

    reverseGeocode(point.lng, point.lat, function(address) {
        document.getElementById('startValue').textContent = address || `(${point.lng.toFixed(4)}, ${point.lat.toFixed(4)})`;
        startPoint.address = address;
    });

    updateBtnStatus();
}

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

    reverseGeocode(point.lng, point.lat, function(address) {
        document.getElementById('endValue').textContent = address || `(${point.lng.toFixed(4)}, ${point.lat.toFixed(4)})`;
        endPoint.address = address;
    });

    updateBtnStatus();
}

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

function clearPoiMarkers() {
    poiMarkers.forEach(marker => {
        map.remove(marker);
    });
    poiMarkers = [];
}

function addPoiMarkers(pois) {
    clearPoiMarkers();

    if (!Array.isArray(pois) || pois.length === 0) return;

    pois.forEach((poi, index) => {
        if (!poi.location || !Array.isArray(poi.location) || poi.location.length !== 2) {
            return;
        }

        const themeColor = currentTheme ? currentTheme.primary : '#ff7e5f';
        const themeLightColor = currentTheme ? currentTheme.primaryLight : '#feb47b';
        const numberLabel = new AMap.Text({
            text: `${index+1}`,
            position: poi.location,
            offset: new AMap.Pixel(0, 0),
            style: {
                'background': `linear-gradient(135deg, ${themeColor}, ${themeLightColor})`,
                'color': 'white',
                'border-radius': '14px',
                'min-width': '28px',
                'height': '28px',
                'text-align': 'center',
                'line-height': '28px',
                'font-size': '13px',
                'font-weight': 'bold',
                'border': '3px solid white',
                'box-shadow': '0 3px 8px rgba(0,0,0,0.25)',
                'cursor': 'pointer',
                'padding': '0 6px',
                'white-space': 'nowrap'
            },
            zIndex: 100 + index,
            title: `${index+1}. ${poi.name}`
        });

        numberLabel.on('click', function() {
            infoWindow.setContent(`
                <div class="poi-infowin">
                    <h4 class="poi-infowin-title">
                        <span class="poi-infowin-badge" style="background: linear-gradient(135deg, ${themeColor}, ${themeLightColor})">${index+1}</span>
                        <span class="poi-infowin-name">${poi.name}</span>
                    </h4>
                    <p class="poi-infowin-row"><span class="poi-infowin-icon">🏷️</span> ${poi.category || poi.type || '未知类型'}</p>
                    <p class="poi-infowin-row"><span class="poi-infowin-icon">📍</span> ${poi.address || '暂无地址'}</p>
                    <p class="poi-infowin-row poi-infowin-stay" style="color:${themeColor}"><span>⏱️</span> 建议停留 ${poi.stay_time || 5} 分钟</p>
                </div>
            `);
            infoWindow.open(map, poi.location);
        });

        map.add(numberLabel);
        poiMarkers.push(numberLabel);
    });
}

function searchAddress(keyword) {
    if (!window.AMap) {
        showToast("地图未加载，请稍后重试");
        return;
    }

    showToast(`🔍 正在搜索 "${keyword}"...`);

    AMap.plugin('AMap.PlaceSearch', function() {
        const placeSearch = new AMap.PlaceSearch({
            city: currentCity || '全国',
            citylimit: false,
            pageSize: 5,
            pageIndex: 1
        });

        placeSearch.search(keyword, function(status, result) {
            if (status === 'complete' && result.info === 'OK' && result.poiList && result.poiList.pois.length > 0) {
                const poi = result.poiList.pois[0];
                if (searchMarker) map.remove(searchMarker);
                searchMarker = new AMap.Marker({
                    position: [poi.location.lng, poi.location.lat],
                    title: poi.name
                });
                map.add(searchMarker);
                map.setCenter([poi.location.lng, poi.location.lat]);
                map.setZoom(17);

                infoWindow.setContent(`<div class="search-infowin">
                    <strong>${poi.name}</strong><br/>
                    <span class="search-infowin-addr">${poi.address || ''}</span><br/>
                    <span class="search-infowin-hint">点击地图设为起点或终点</span>
                </div>`);
                infoWindow.open(map, [poi.location.lng, poi.location.lat]);
                showToast(`✅ 找到 "${poi.name}"，点击地图选择为起点或终点`);

                setTimeout(() => {
                    if (searchMarker) { map.remove(searchMarker); searchMarker = null; }
                    infoWindow.close();
                }, 5000);
            } else {
                tryGeocodeSearch(keyword);
            }
        });
    });
}

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
                if (searchMarker) map.remove(searchMarker);
                searchMarker = new AMap.Marker({
                    position: [location.lng, location.lat],
                    title: geocode.formattedAddress || keyword
                });
                map.add(searchMarker);
                map.setCenter([location.lng, location.lat]);
                map.setZoom(17);
                showToast("✅ 已定位，请点击地图选择为起点或终点");
                setTimeout(() => { if (searchMarker) { map.remove(searchMarker); searchMarker = null; } }, 3000);
            } else {
                showToast("❌ 未找到相关地点，请尝试其他关键词如：南京路、外滩、陆家嘴");
            }
        });
    });
}
