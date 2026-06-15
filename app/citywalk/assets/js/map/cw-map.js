// ========== Citywalk · 地图模块 ==========

function initMap() {
    if (!window.AMap) {
        showToast("地图加载失败了，检查下网络再刷新吧");
        return;
    }

    try {
        CW.map = new AMap.Map('container', {
            zoom: 13,
            center: CW.currentCityCenter,
            viewMode: '2D',
            clickEnable: true,
            dragEnable: true,
            resizeEnable: true
        });

        CW.infoWindow = new AMap.InfoWindow({
            offset: new AMap.Pixel(0, -30)
        });

        CW.map.on('click', function(e) {
            const lng = e.lnglat.lng;
            const lat = e.lnglat.lat;
            const point = {
                lng: parseFloat(lng.toFixed(6)),
                lat: parseFloat(lat.toFixed(6))
            };

            if (CW.planMode === 'loop') {
                setStartPoint(point);
                CW.endPoint = null;
                if (CW.endMarker && CW.map) {
                    CW.map.remove(CW.endMarker);
                    CW.endMarker = null;
                }
                const endVal = document.getElementById('endValue');
                if (endVal) endVal.textContent = '探索模式无需终点';
                updateBtnStatus();
                return;
            }

            if (!CW.startPoint) {
                setStartPoint(point);
            } else if (!CW.endPoint) {
                setEndPoint(point);
            } else {
                setEndPoint(point);
                showToast("终点已更新，如需重设起点请点击「重置选择」");
            }
        });

        startWeatherRefresh();
        locateUserCity();
    } catch (e) {
        showToast("地图加载失败了，请刷新页面重试");
        console.error("地图初始化错误：", e);
    }
}

async function locateUserCity() {
    if (CW.cityLocatePromise) {
        return CW.cityLocatePromise;
    }
    CW.cityLocatePromise = (async () => {
        try {
            const response = await fetch(`${CW_API}/locate_city`);
            const data = await response.json();
            if (data.success && data.city) {
                CW.currentCity = data.city;
                CW.currentCityCenter = data.center || CITY_COORDS[data.city] || [116.4074, 39.9042];
                document.getElementById('currentCity').textContent = CW.currentCity;
                if (CW.map) {
                    CW.map.setCenter(CW.currentCityCenter);
                }
                getCityWeather(CW.currentCity, true);
            }
        } catch (e) {
            console.error('IP定位失败：', e);
            document.getElementById('currentCity').textContent = CW.currentCity;
            getCityWeather(CW.currentCity, true);
        } finally {
            CW.cityLocateReady = true;
        }
    })();
    return CW.cityLocatePromise;
}

// 主题色自定义起终点标记（与 POI 编号标记同一视觉语言）
function endpointMarkerHTML(label, color, isEnd) {
    const extra = isEnd ? ' cw-endpoint-marker--end' : '';
    return `<div class="cw-endpoint-marker${extra}" style="background:${color}">${label}</div>`;
}

function setStartPoint(point) {
    CW.startPoint = point;
    if (CW.startMarker) CW.map.remove(CW.startMarker);

    const themeColor = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
    CW.startMarker = new AMap.Marker({
        position: [point.lng, point.lat],
        title: '起点',
        anchor: 'center',
        content: endpointMarkerHTML('起', themeColor),
        zIndex: 100
    });
    CW.map.add(CW.startMarker);

    document.getElementById('startCard').className = 'status-card selected';
    document.getElementById('startValue').textContent = '定位中...';

    reverseGeocode(point.lng, point.lat, function(address) {
        const t = address || `(${point.lng.toFixed(4)}, ${point.lat.toFixed(4)})`;
        if (typeof setPickupStatusText === 'function') setPickupStatusText('startValue', t);
        else document.getElementById('startValue').textContent = t;
        CW.startPoint.address = address;
    });

    updateBtnStatus();
}

function setEndPoint(point) {
    CW.endPoint = point;
    if (CW.endMarker) CW.map.remove(CW.endMarker);

    const themeColor = CW.currentTheme ? CW.currentTheme.primaryDark : '#e85d40';
    CW.endMarker = new AMap.Marker({
        position: [point.lng, point.lat],
        title: '终点',
        anchor: 'center',
        content: endpointMarkerHTML('终', themeColor, true),
        zIndex: 110
    });
    CW.map.add(CW.endMarker);

    document.getElementById('endCard').className = 'status-card selected';
    document.getElementById('endValue').textContent = '定位中...';

    reverseGeocode(point.lng, point.lat, function(address) {
        const t = address || `(${point.lng.toFixed(4)}, ${point.lat.toFixed(4)})`;
        if (typeof setPickupStatusText === 'function') setPickupStatusText('endValue', t);
        else document.getElementById('endValue').textContent = t;
        CW.endPoint.address = address;
    });

    updateBtnStatus();
}

function reverseGeocode(lng, lat, callback) {
    if (!window.AMap) {
        callback(null);
        return;
    }

    AMap.plugin('AMap.Geocoder', function() {
        const geocoder = new AMap.Geocoder({ city: CW.currentCity || '全国' });
        geocoder.getAddress([lng, lat], function(status, result) {
            if (status === 'complete' && result.regeocode) {
                const address = result.regeocode.formattedAddress;
                let shortAddress = address.replace(/^中国/, '');
                if (CW.currentCity) {
                    const esc = CW.currentCity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
    CW.poiMarkers.forEach(marker => {
        CW.map.remove(marker);
    });
    CW.poiMarkers = [];
}

function addPoiMarkers(pois) {
    clearPoiMarkers();

    if (!Array.isArray(pois) || pois.length === 0) return;

    pois.forEach((poi, index) => {
        if (!poi.location || !Array.isArray(poi.location) || poi.location.length !== 2) {
            return;
        }

        const themeColor = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
        const themeLightColor = CW.currentTheme ? CW.currentTheme.primaryLight : '#feb47b';
        const baseStyle = {
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
        };
        const numberLabel = new AMap.Text({
            text: `${index+1}`,
            position: poi.location,
            offset: new AMap.Pixel(0, 0),
            style: baseStyle,
            zIndex: 100 + index,
            title: `打卡${index + 1}（沿途）· ${poi.name}`
        });
        // 记录基础样式与主题色，供列表点击时切换「选中态」
        numberLabel._baseStyle = baseStyle;
        numberLabel._themeColor = themeColor;
        numberLabel._index = index;

        numberLabel.on('click', function() {
            CW.infoWindow.setContent(`
                <div class="poi-infowin">
                    <h4 class="poi-infowin-title">
                        <span class="poi-infowin-badge" style="background: linear-gradient(135deg, ${themeColor}, ${themeLightColor})">${index+1}</span>
                        <span class="poi-infowin-name">${cwEscapeHtml(poi.name)}</span>
                    </h4>
                    <p class="poi-infowin-row"><span class="poi-infowin-icon">🏷️</span> ${cwEscapeHtml(poi.category || poi.type || '未知类型')}</p>
                    <p class="poi-infowin-row"><span class="poi-infowin-icon">📍</span> ${cwEscapeHtml(poi.address || '暂无地址')}</p>
                    <p class="poi-infowin-row poi-infowin-stay" style="color:${themeColor}"><span>⏱️</span> 建议停留 ${poi.stay_time || 5} 分钟${poi.optional ? ' · 可选打卡' : ''}</p>
                </div>
            `);
            CW.infoWindow.open(CW.map, poi.location);
        });

        CW.map.add(numberLabel);
        CW.poiMarkers.push(numberLabel);
    });
}

// 列表项点击时高亮对应 POI 标记（放大 + 主题色光环），其余复位
function highlightPoiMarker(index) {
    CW.poiMarkers.forEach((marker, i) => {
        if (!marker || typeof marker.setStyle !== 'function' || !marker._baseStyle) return;
        if (i === index) {
            const ring = (marker._themeColor || '#ff7e5f') + '88';
            marker.setStyle(Object.assign({}, marker._baseStyle, {
                'border': '3px solid white',
                'box-shadow': `0 0 0 4px ${ring}, 0 4px 12px rgba(0,0,0,0.3)`,
                'transform': 'scale(1.18)'
            }));
            if (typeof marker.setzIndex === 'function') marker.setzIndex(300);
        } else {
            marker.setStyle(marker._baseStyle);
            if (typeof marker.setzIndex === 'function') marker.setzIndex(100 + i);
        }
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
            city: CW.currentCity || '全国',
            citylimit: false,
            pageSize: 5,
            pageIndex: 1
        });

        placeSearch.search(keyword, function(status, result) {
            if (status === 'complete' && result.info === 'OK' && result.poiList && result.poiList.pois.length > 0) {
                const poi = result.poiList.pois[0];
                if (CW.searchMarker) CW.map.remove(CW.searchMarker);
                CW.searchMarker = new AMap.Marker({
                    position: [poi.location.lng, poi.location.lat],
                    title: poi.name
                });
                CW.map.add(CW.searchMarker);
                CW.map.setCenter([poi.location.lng, poi.location.lat]);
                CW.map.setZoom(17);

                CW.infoWindow.setContent(`<div class="search-infowin">
                    <strong>${cwEscapeHtml(poi.name)}</strong><br/>
                    <span class="search-infowin-addr">${cwEscapeHtml(poi.address || '')}</span><br/>
                    <span class="search-infowin-hint">点击地图设为起点或终点</span>
                </div>`);
                CW.infoWindow.open(CW.map, [poi.location.lng, poi.location.lat]);
                showToast(`✅ 找到 "${poi.name}"，点击地图选择为起点或终点`);

                setTimeout(() => {
                    if (CW.searchMarker) { CW.map.remove(CW.searchMarker); CW.searchMarker = null; }
                    CW.infoWindow.close();
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
            city: CW.currentCity || '全国',
            radius: 50000
        });
        geocoder.getLocation(keyword, function(status, result) {
            if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                const geocode = result.geocodes[0];
                const location = geocode.location;
                if (CW.searchMarker) CW.map.remove(CW.searchMarker);
                CW.searchMarker = new AMap.Marker({
                    position: [location.lng, location.lat],
                    title: geocode.formattedAddress || keyword
                });
                CW.map.add(CW.searchMarker);
                CW.map.setCenter([location.lng, location.lat]);
                CW.map.setZoom(17);
                showToast("✅ 已定位，请点击地图选择为起点或终点");
                setTimeout(() => { if (CW.searchMarker) { CW.map.remove(CW.searchMarker); CW.searchMarker = null; } }, 3000);
            } else {
                showToast("没找到这个地点，换个关键词试试，比如 外滩、南京路");
            }
        });
    });
}
