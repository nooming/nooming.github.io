// ========== Citywalk · 地图模块 ==========

function initMap() {
    if (!window.AMap) {
        showToast("地图加载失败 · 请检查网络后刷新");
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

        // 右键 / 长按：先弹出「订为必去」确认，不立刻写入
        let longPressTimer = null;
        const clearLongPress = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };
        CW.map.on('rightclick', function(e) {
            const lng = parseFloat(e.lnglat.lng.toFixed(6));
            const lat = parseFloat(e.lnglat.lat.toFixed(6));
            openMustGoConfirm(lng, lat);
        });
        const mapContainer = document.getElementById('container');
        if (mapContainer) {
            mapContainer.addEventListener('touchstart', function(ev) {
                if (!ev.touches || ev.touches.length !== 1) return;
                const touch = ev.touches[0];
                clearLongPress();
                longPressTimer = setTimeout(function() {
                    if (!CW.map) return;
                    const rect = mapContainer.getBoundingClientRect();
                    const local = new AMap.Pixel(touch.clientX - rect.left, touch.clientY - rect.top);
                    const lnglat = CW.map.containerToLngLat(local);
                    if (!lnglat) return;
                    const lng = parseFloat(lnglat.lng.toFixed(6));
                    const lat = parseFloat(lnglat.lat.toFixed(6));
                    openMustGoConfirm(lng, lat);
                }, 650);
            }, { passive: true });
            mapContainer.addEventListener('touchend', clearLongPress, { passive: true });
            mapContainer.addEventListener('touchmove', clearLongPress, { passive: true });
        }

        CW.userMovedMap = false;
        CW.map.on('dragend', function() {
            CW.userMovedMap = true;
        });
        CW.map.on('moveend', function() {
            if (typeof scheduleExplorePlaceSearch === 'function') scheduleExplorePlaceSearch();
        });
        CW.map.on('zoomend', function() {
            if (typeof scheduleExplorePlaceSearch === 'function') scheduleExplorePlaceSearch();
        });

        if (typeof loadMapLayerPrefs === 'function') loadMapLayerPrefs();

        startWeatherRefresh();
        locateUserCity();
    } catch (e) {
        showToast("地图加载失败了，请刷新页面重试");
        console.error("地图初始化错误：", e);
    }
}

/**
 * 浏览器定位。
 * 成功：{ coords: {lng,lat}, failCode: null }
 * 失败：{ coords: null, failCode }（1 拒绝 / 2 不可用 / 3 超时；不支持为 null）
 * 不弹阻塞错误 toast。
 */
function getBrowserPosition() {
    return new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve({ coords: null, failCode: null });
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lng = pos.coords.longitude;
                const lat = pos.coords.latitude;
                if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
                    resolve({ coords: null, failCode: null });
                    return;
                }
                resolve({ coords: { lng, lat }, failCode: null });
            },
            (err) => {
                const code = err && err.code != null ? err.code : 0;
                resolve({ coords: null, failCode: code });
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
        );
    });
}

function _queryGeolocationPermission() {
    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
        return Promise.resolve(null);
    }
    return navigator.permissions.query({ name: 'geolocation' }).catch(() => null);
}

/** 权限仍为 prompt 时：等用户点允许后再真正用坐标定位（清掉已 settled 的 promise） */
function _watchGeolocationGrant(locateGen, status) {
    if (CW._geoLocateRetryArmed) return;
    CW._geoLocateRetryArmed = true;
    const onChange = () => {
        if (status.state === 'granted') {
            status.removeEventListener('change', onChange);
            if ((CW.cityLocateGen || 0) !== locateGen) return;
            if (_shareCityLocksLocate()) return;
            CW.cityLocatePromise = null;
            CW.cityLocateReady = false;
            locateUserCity({ isRetry: true });
        } else if (status.state === 'denied') {
            status.removeEventListener('change', onChange);
        }
    };
    status.addEventListener('change', onChange);
}

function _shareCityLocksLocate() {
    try {
        if (typeof _cwPendingSharePayload !== 'undefined'
            && _cwPendingSharePayload
            && _cwPendingSharePayload.city) {
            return true;
        }
    } catch (_) { /* ignore */ }
    return false;
}

function _applyLocatedCity(data, locateGen) {
    if ((CW.cityLocateGen || 0) !== locateGen) return;
    if (_shareCityLocksLocate()) return;
    if (!(data && data.success && data.city)) {
        const el = document.getElementById('currentCity');
        if (el) el.textContent = CW.currentCity;
        getCityWeather(CW.currentCity, true);
        return;
    }
    CW.currentCity = data.city;
    CW.currentCityCenter = data.center || CITY_COORDS[data.city] || [116.4074, 39.9042];
    const cityEl = document.getElementById('currentCity');
    if (cityEl) cityEl.textContent = CW.currentCity;
    if (CW.map) {
        CW.map.setCenter(CW.currentCityCenter);
    }
    getCityWeather(CW.currentCity, true);
}

async function locateUserCity(opts) {
    const isRetry = !!(opts && opts.isRetry);
    if (CW.cityLocatePromise && !isRetry) {
        return CW.cityLocatePromise;
    }
    CW.cityLocatePromise = (async () => {
        const locateGen = CW.cityLocateGen || 0;

        // 分享链接已指定城市：不覆盖，只标记定位完成
        if (_shareCityLocksLocate()) {
            const cityEl = document.getElementById('currentCity');
            if (cityEl) cityEl.textContent = CW.currentCity;
            getCityWeather(CW.currentCity, true);
            CW.cityLocateReady = true;
            return;
        }

        try {
            let { coords, failCode } = await getBrowserPosition();
            if ((CW.cityLocateGen || 0) !== locateGen) {
                return;
            }

            // 首次超时/失败且非明确拒绝：权限已 granted 则立刻再取一次；
            // 仍为 prompt 则监听 change→granted 后重试；无 Permissions API 则单次重试。
            if (!coords && failCode !== 1 && !isRetry) {
                const permStatus = await _queryGeolocationPermission();
                if ((CW.cityLocateGen || 0) !== locateGen) return;

                if (permStatus && permStatus.state === 'granted') {
                    ({ coords, failCode } = await getBrowserPosition());
                } else if (permStatus && permStatus.state === 'prompt') {
                    _watchGeolocationGrant(locateGen, permStatus);
                } else if (!permStatus && failCode === 3) {
                    ({ coords, failCode } = await getBrowserPosition());
                }
                if ((CW.cityLocateGen || 0) !== locateGen) return;
            }

            let url = `${CW_API}/locate_city`;
            if (coords) {
                url += `?lng=${encodeURIComponent(coords.lng)}&lat=${encodeURIComponent(coords.lat)}`;
            }
            const response = await fetch(url);
            const data = await response.json();
            _applyLocatedCity(data, locateGen);
        } catch (e) {
            console.error('城市定位失败：', e);
            if ((CW.cityLocateGen || 0) === locateGen && !_shareCityLocksLocate()) {
                const el = document.getElementById('currentCity');
                if (el) el.textContent = CW.currentCity;
                getCityWeather(CW.currentCity, true);
            }
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

function mustGoActionLabel() {
    return CW.addingRouteStop ? '加入此站' : '订为必去';
}

function confirmMapOrSearchSpot(spot) {
    if (typeof confirmPinnedOrRouteStop === 'function') {
        confirmPinnedOrRouteStop(spot);
        return;
    }
    if (typeof pinMustGoSpot === 'function') pinMustGoSpot(spot);
}

function whenViewportSettled(done) {
    const vv = window.visualViewport;
    if (!vv) {
        setTimeout(done, 320);
        return;
    }
    let last = Math.round(vv.height);
    let stable = 0;
    const started = Date.now();
    const step = () => {
        const h = Math.round(vv.height);
        if (h === last) stable += 1;
        else {
            stable = 0;
            last = h;
        }
        if (stable >= 4 || Date.now() - started > 800) done();
        else requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 40);
}

function finishSearchCamera(lnglat) {
    const point = [Number(lnglat[0]), Number(lnglat[1])];
    CW._lastSearchLngLat = point;
    CW._lastSearchAt = Date.now();
    const settle = !!CW._recenterSearchAfterSettle;
    CW._recenterSearchAfterSettle = false;
    if (!settle) return;
    whenViewportSettled(() => {
        if (!CW.map) return;
        if (typeof CW.map.resize === 'function') CW.map.resize();
        CW.map.setCenter(point);
    });
}

function recenterLastSearch() {
    const point = CW._lastSearchLngLat;
    if (!point || !CW.map || !CW._lastSearchAt) return;
    if (Date.now() - CW._lastSearchAt > 20000) return;
    whenViewportSettled(() => {
        if (!CW.map || !CW._lastSearchLngLat) return;
        if (typeof CW.map.resize === 'function') CW.map.resize();
        CW.map.setCenter(CW._lastSearchLngLat);
    });
}

/** 右键 / 长按后弹出确认，再订为必去（搜索气泡仍直接 pin） */
function openMustGoConfirm(lng, lat) {
    if (!CW.map || !CW.infoWindow) return;
    const confirmToken = (CW._mustGoConfirmToken = (CW._mustGoConfirmToken || 0) + 1);
    const fallbackName = `地图点 (${lng.toFixed(4)}, ${lat.toFixed(4)})`;
    let resolvedName = fallbackName;

    const renderConfirm = (name) => {
        if (CW._mustGoConfirmToken !== confirmToken || !CW.infoWindow || !CW.map) return;
        CW.infoWindow.setContent(`<div class="mustgo-confirm-infowin">
            <div class="mustgo-confirm-name">${cwEscapeHtml(name)}</div>
            <button type="button" class="btn-pin-mustgo" id="btnConfirmMapMustGo">${mustGoActionLabel()}</button>
        </div>`);
        CW.infoWindow.open(CW.map, [lng, lat]);
        setTimeout(() => {
            if (CW._mustGoConfirmToken !== confirmToken) return;
            const btn = document.getElementById('btnConfirmMapMustGo');
            if (!btn) return;
            btn.addEventListener('click', (ev) => {
                ev.preventDefault();
                ev.stopPropagation();
                if (CW._mustGoConfirmToken !== confirmToken) return;
                confirmMapOrSearchSpot({ name: resolvedName, lng, lat });
                CW._mustGoConfirmToken = 0;
                if (CW.infoWindow) CW.infoWindow.close();
            });
        }, 0);
    };

    renderConfirm(fallbackName);

    reverseGeocode(lng, lat, function(address) {
        if (CW._mustGoConfirmToken !== confirmToken) return;
        resolvedName = address || fallbackName;
        const stillOpen = typeof CW.infoWindow.getIsOpen === 'function'
            ? CW.infoWindow.getIsOpen()
            : true;
        if (!stillOpen) return;
        renderConfirm(resolvedName);
    });
}

function clearPoiMarkers() {
    CW.poiMarkers.forEach(marker => {
        CW.map.remove(marker);
    });
    CW.poiMarkers = [];
}

function addPoiMarkers(pois) {
    if (typeof clearPlanningMapLayers === 'function') clearPlanningMapLayers();
    clearPoiMarkers();

    if (!Array.isArray(pois) || pois.length === 0) return;

    pois.forEach((poi, index) => {
        if (!poi.location || !Array.isArray(poi.location) || poi.location.length !== 2) {
            return;
        }

        const themeColor = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
        const themeLightColor = CW.currentTheme ? CW.currentTheme.primaryLight : '#feb47b';
        const typeIcon = (poi.icon || '📍').trim();
        const pinHtml = `<div class="cw-poi-map-pin" data-poi-index="${index}">` +
            `<span class="cw-poi-map-pin-icon">${typeIcon}</span>` +
            `<span class="cw-poi-map-pin-num">${index + 1}</span></div>`;
        const numberLabel = new AMap.Marker({
            position: poi.location,
            content: pinHtml,
            offset: new AMap.Pixel(-16, -18),
            zIndex: 100 + index,
            title: `第 ${index + 1} 站 · ${poi.name}`
        });
        numberLabel._themeColor = themeColor;
        numberLabel._index = index;
        numberLabel._pinClass = 'cw-poi-map-pin';

        numberLabel.on('click', function() {
            CW.infoWindow.setContent(`
                <div class="poi-infowin">
                    <h4 class="poi-infowin-title">
                        <span class="poi-infowin-badge" style="background: linear-gradient(135deg, ${themeColor}, ${themeLightColor})"><span class="poi-infowin-badge-icon">${typeIcon}</span><span class="poi-infowin-badge-num">${index + 1}</span></span>
                        <span class="poi-infowin-name">${cwEscapeHtml(poi.name)}</span>
                    </h4>
                    <p class="poi-infowin-row"><span class="poi-infowin-icon">🏷️</span> ${cwEscapeHtml(poi.category || poi.type || '未知类型')}</p>
                    <p class="poi-infowin-row"><span class="poi-infowin-icon">📍</span> ${cwEscapeHtml(poi.address || '暂无地址')}</p>
                    <p class="poi-infowin-row poi-infowin-stay" style="color:${themeColor}"><span>⏱️</span> 建议停留 ${poi.stay_time || 5} 分钟${poi.optional ? ' · 可选打卡' : ''}</p>
                </div>
            `);
            CW._mustGoConfirmToken = 0;
            CW.infoWindow.open(CW.map, poi.location);
        });

        CW.map.add(numberLabel);
        CW.poiMarkers.push(numberLabel);
    });
}

// 列表项点击时高亮对应 POI 标记（放大 + 主题色光环），其余复位
function _poiMarkerPinEl(marker) {
    if (!marker || typeof marker.getContent !== 'function') return null;
    const root = marker.getContent();
    if (!root) return null;
    if (root.classList && root.classList.contains('cw-poi-map-pin')) return root;
    return root.querySelector ? root.querySelector('.cw-poi-map-pin') : null;
}

function highlightPoiMarker(index) {
    CW.poiMarkers.forEach((marker, i) => {
        const pin = _poiMarkerPinEl(marker);
        if (!pin) return;
        pin.classList.toggle('cw-poi-map-pin--active', i === index);
        if (typeof marker.setzIndex === 'function') {
            marker.setzIndex(i === index ? 300 : 100 + i);
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
                const found = [poi.location.lng, poi.location.lat];
                CW.map.setCenter(found);
                CW.map.setZoom(17);
                finishSearchCamera(found);

                CW.infoWindow.setContent(`<div class="search-infowin">
                    <strong>${cwEscapeHtml(poi.name)}</strong><br/>
                    <span class="search-infowin-addr">${cwEscapeHtml(poi.address || '')}</span><br/>
                    <span class="search-infowin-hint">点击地图设为起点或终点</span><br/>
                    <button type="button" class="btn-pin-mustgo" id="btnPinSearchMustGo">${mustGoActionLabel()}</button>
                </div>`);
                CW._mustGoConfirmToken = 0;
                CW.infoWindow.open(CW.map, [poi.location.lng, poi.location.lat]);
                showToast(`✅ 找到 "${poi.name}"，可订为必去或点地图设起终点`);
                setTimeout(() => {
                    const pinBtn = document.getElementById('btnPinSearchMustGo');
                    if (pinBtn) {
                        pinBtn.addEventListener('click', (ev) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            confirmMapOrSearchSpot({
                                name: poi.name,
                                lng: parseFloat(poi.location.lng.toFixed(6)),
                                lat: parseFloat(poi.location.lat.toFixed(6)),
                                category: poi.type || '',
                            });
                        });
                    }
                }, 0);

                setTimeout(() => {
                    if (CW.searchMarker) { CW.map.remove(CW.searchMarker); CW.searchMarker = null; }
                    CW.infoWindow.close();
                }, 8000);
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
                const found = [location.lng, location.lat];
                CW.map.setCenter(found);
                CW.map.setZoom(17);
                finishSearchCamera(found);
                showToast("✅ 已定位，请点击地图选择为起点或终点");
                setTimeout(() => { if (CW.searchMarker) { CW.map.remove(CW.searchMarker); CW.searchMarker = null; } }, 3000);
            } else {
                CW._recenterSearchAfterSettle = false;
                showToast("未找到该地点 · 请更换关键词（例：外滩、南京路）");
            }
        });
    });
}

// ========== 规划页 · 灵感候选 / 偏好探索图层 ==========

const CW_MAP_INSPIRE_KEY = 'cw_map_inspire_v1';
const CW_MAP_EXPLORE_KEY = 'cw_map_explore_v1';
const EXPLORE_MIN_ZOOM = 14;
const EXPLORE_DEBOUNCE_MS = 520;
const EXPLORE_PAGE_SIZE = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches ? 8 : 12;

const POI_TYPE_EXPLORE_KEYWORDS = {
    '自然': '公园',
    '历史': '博物馆',
    '文创': '文创园',
    '花店': '花店',
    '咖啡甜品': '咖啡厅',
    '商场': '购物中心',
};

function loadMapLayerPrefs() {
    if (!CW.mapLayerPrefs) {
        CW.mapLayerPrefs = { showInspireOnMap: true, showExploreOnMap: false };
    }
    try {
        const ins = localStorage.getItem(CW_MAP_INSPIRE_KEY);
        if (ins === '0') CW.mapLayerPrefs.showInspireOnMap = false;
        if (ins === '1') CW.mapLayerPrefs.showInspireOnMap = true;
        const exp = localStorage.getItem(CW_MAP_EXPLORE_KEY);
        if (exp === '1') CW.mapLayerPrefs.showExploreOnMap = true;
        if (exp === '0') CW.mapLayerPrefs.showExploreOnMap = false;
    } catch (_) { /* ignore */ }
}

function saveMapLayerPrefs() {
    if (!CW.mapLayerPrefs) return;
    try {
        localStorage.setItem(CW_MAP_INSPIRE_KEY, CW.mapLayerPrefs.showInspireOnMap ? '1' : '0');
        localStorage.setItem(CW_MAP_EXPLORE_KEY, CW.mapLayerPrefs.showExploreOnMap ? '1' : '0');
    } catch (_) { /* ignore */ }
}

function clearPlanningMapLayers() {
    clearInspireMarkers();
    clearExploreMarkers();
}

function clearPinnedSeedMarkers() {
    if (!CW.map || !Array.isArray(CW.pinnedSeedMarkers)) {
        CW.pinnedSeedMarkers = [];
        return;
    }
    CW.pinnedSeedMarkers.forEach(marker => {
        try { CW.map.remove(marker); } catch (_) { /* ignore */ }
    });
    CW.pinnedSeedMarkers = [];
}

function syncPinnedSeedMarkers() {
    if (!CW.map) return;
    clearPinnedSeedMarkers();
    const seeds = Array.isArray(CW.pinnedSeeds) ? CW.pinnedSeeds : [];
    seeds.forEach((spot, index) => {
        if (!spot || typeof spot.lng !== 'number' || typeof spot.lat !== 'number') return;
        const pinHtml = `<div class="cw-mustgo-pin" data-mustgo-index="${index}">` +
            `<span class="cw-mustgo-pin-icon">📌</span></div>`;
        const marker = new AMap.Marker({
            position: [spot.lng, spot.lat],
            content: pinHtml,
            offset: new AMap.Pixel(-15, -15),
            zIndex: 75 + index,
            title: `必去 · ${spot.name || '地点'}`,
        });
        marker.on('click', function() {
            if (!CW.infoWindow) return;
            const name = spot.name || '必去点';
            const pinLng = spot.lng;
            const pinLat = spot.lat;
            CW.infoWindow.setContent(`
                <div class="mustgo-infowin">
                    <strong>${cwEscapeHtml(name)}</strong>
                    <p class="mustgo-infowin-tag">必去点</p>
                    <button type="button" class="btn-mustgo-infowin-remove" data-mustgo-lng="${pinLng}" data-mustgo-lat="${pinLat}">移除必去</button>
                </div>
            `);
            CW._mustGoConfirmToken = 0;
            CW.infoWindow.open(CW.map, [pinLng, pinLat]);
            setTimeout(() => {
                const btn = document.querySelector(
                    '.btn-mustgo-infowin-remove[data-mustgo-lng="' + pinLng + '"][data-mustgo-lat="' + pinLat + '"]'
                );
                if (!btn) return;
                btn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof removePinnedSeedAt === 'function') {
                        removePinnedSeedAt(pinLng, pinLat);
                    } else if (typeof removePinnedSeed === 'function') {
                        removePinnedSeed(index);
                    }
                    if (CW.infoWindow) CW.infoWindow.close();
                });
            }, 0);
        });
        CW.map.add(marker);
        CW.pinnedSeedMarkers.push(marker);
    });
}

function _markerPinEl(marker, className) {
    if (!marker || typeof marker.getContent !== 'function') return null;
    const root = marker.getContent();
    if (!root) return null;
    if (root.classList && root.classList.contains(className)) return root;
    return root.querySelector ? root.querySelector('.' + className) : null;
}

function clearInspireMarkers() {
    if (!CW.map || !Array.isArray(CW.inspireMarkers)) {
        CW.inspireMarkers = [];
        return;
    }
    CW.inspireMarkers.forEach(marker => {
        try { CW.map.remove(marker); } catch (_) { /* ignore */ }
    });
    CW.inspireMarkers = [];
}

function _inspireCardChecked(index) {
    const cb = document.getElementById('inspireCard' + index);
    return !!(cb && cb.checked);
}

function setInspireMarkerSelected(index, selected) {
    const marker = CW.inspireMarkers[index];
    if (!marker) return;
    const pin = _markerPinEl(marker, 'cw-inspire-pin');
    if (pin) pin.classList.toggle('cw-inspire-pin--selected', !!selected);
}

function openInspireMarkerInfo(spot, index) {
    if (!CW.infoWindow || !CW.map) return;
    const themeColor = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
    const checked = _inspireCardChecked(index);
    CW.infoWindow.setContent(`
        <div class="inspire-infowin">
            <strong class="inspire-infowin-title">${cwEscapeHtml(spot.name)}</strong>
            ${spot.category ? `<p class="inspire-infowin-tag">${cwEscapeHtml(spot.category)}</p>` : ''}
            ${spot.reason ? `<p class="inspire-infowin-reason">${cwEscapeHtml(spot.reason)}</p>` : ''}
            <button type="button" class="btn-inspire-infowin-toggle" data-inspire-index="${index}" style="border-color:${themeColor};color:${themeColor}">
                ${checked ? '取消勾选' : '勾选此点'}
            </button>
        </div>
    `);
    CW._mustGoConfirmToken = 0;
    CW.infoWindow.open(CW.map, [spot.lng, spot.lat]);
    setTimeout(() => {
        const btn = document.querySelector('.btn-inspire-infowin-toggle[data-inspire-index="' + index + '"]');
        if (!btn) return;
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const cb = document.getElementById('inspireCard' + index);
            if (cb) {
                cb.checked = !cb.checked;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                setInspireMarkerSelected(index, !checked);
            }
            CW.infoWindow.close();
        });
    }, 0);
}

function syncInspireMarkers(spots, options) {
    if (!CW.map) return;
    const opts = options || {};
    if (!CW.mapLayerPrefs || !CW.mapLayerPrefs.showInspireOnMap) {
        clearInspireMarkers();
        return;
    }
    const list = Array.isArray(spots) ? spots.filter(
        s => s && s.name && typeof s.lng === 'number' && typeof s.lat === 'number'
    ) : [];
    clearInspireMarkers();
    if (list.length === 0) return;

    const themeColor = CW.currentTheme ? CW.currentTheme.primary : '#ff7e5f';
    const themeLight = CW.currentTheme ? CW.currentTheme.primaryLight : '#feb47b';

    list.forEach((spot, index) => {
        const initial = _inspireCardChecked(index);
        const pinHtml = `<div class="cw-inspire-pin${initial ? ' cw-inspire-pin--selected' : ''}" data-inspire-index="${index}">` +
            `<span class="cw-inspire-pin-icon">✨</span></div>`;
        const marker = new AMap.Marker({
            position: [spot.lng, spot.lat],
            content: pinHtml,
            offset: new AMap.Pixel(-14, -14),
            zIndex: 60 + index,
            title: spot.name,
        });
        marker._inspireIndex = index;
        marker.on('click', function() {
            openInspireMarkerInfo(spot, index);
        });
        CW.map.add(marker);
        CW.inspireMarkers.push(marker);
    });

    if (opts.fitView && !CW.userMovedMap && CW.inspireMarkers.length) {
        CW.map.setFitView(CW.inspireMarkers, {
            padding: [80, 80, 80, 80],
            animate: true,
        });
    }
}

function clearExploreMarkers() {
    if (!CW.map || !Array.isArray(CW.exploreMarkers)) {
        CW.exploreMarkers = [];
        return;
    }
    CW.exploreMarkers.forEach(marker => {
        try { CW.map.remove(marker); } catch (_) { /* ignore */ }
    });
    CW.exploreMarkers = [];
}

function _coordKey(lng, lat) {
    return `${Number(lng).toFixed(4)},${Number(lat).toFixed(4)}`;
}

function _isDuplicateOfInspire(lng, lat, name) {
    const candidates = CW.inspireCandidates || [];
    const normName = (name || '').trim();
    for (let i = 0; i < candidates.length; i++) {
        const s = candidates[i];
        if (!s || typeof s.lng !== 'number' || typeof s.lat !== 'number') continue;
        if (normName && s.name && s.name.trim() === normName) return true;
        if (Math.abs(s.lng - lng) < 0.00045 && Math.abs(s.lat - lat) < 0.00045) return true;
    }
    return false;
}

function syncExploreMarkers(pois) {
    if (!CW.map) return;
    clearExploreMarkers();
    if (!Array.isArray(pois) || pois.length === 0) return;

    const seen = new Set();
    pois.forEach((poi, index) => {
        if (!poi || !poi.location) return;
        const loc = poi.location;
        let lng = loc.lng;
        let lat = loc.lat;
        if (!Number.isFinite(lng) && typeof loc.getLng === 'function') lng = loc.getLng();
        if (!Number.isFinite(lat) && typeof loc.getLat === 'function') lat = loc.getLat();
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        if (_isDuplicateOfInspire(lng, lat, poi.name)) return;
        const key = _coordKey(lng, lat) + '|' + (poi.name || '');
        if (seen.has(key)) return;
        seen.add(key);

        const pinHtml = `<div class="cw-explore-pin" title="${cwEscapeHtml(poi.name || '')}"></div>`;
        const marker = new AMap.Marker({
            position: [lng, lat],
            content: pinHtml,
            offset: new AMap.Pixel(-10, -10),
            zIndex: 40 + index,
            title: poi.name || '探索点',
        });
        marker.on('click', function() {
            if (!CW.infoWindow) return;
            CW.infoWindow.setContent(`
                <div class="explore-infowin">
                    <strong>${cwEscapeHtml(poi.name || '地点')}</strong>
                    <p class="explore-infowin-addr">${cwEscapeHtml(poi.address || '')}</p>
                    <p class="explore-infowin-hint">地图探索 · 仅供参考</p>
                    <button type="button" class="btn-pin-mustgo" id="btnPinExploreMustGo">${mustGoActionLabel()}</button>
                </div>
            `);
            CW._mustGoConfirmToken = 0;
            CW.infoWindow.open(CW.map, [lng, lat]);
            setTimeout(() => {
                const pinBtn = document.getElementById('btnPinExploreMustGo');
                if (pinBtn) {
                    pinBtn.addEventListener('click', (ev) => {
                        ev.preventDefault();
                        ev.stopPropagation();
                        confirmMapOrSearchSpot({
                            name: poi.name || '探索点',
                            lng: parseFloat(Number(lng).toFixed(6)),
                            lat: parseFloat(Number(lat).toFixed(6)),
                            category: poi.type || '',
                        });
                    });
                }
            }, 0);
        });
        CW.map.add(marker);
        CW.exploreMarkers.push(marker);
    });
}

function scheduleExplorePlaceSearch() {
    if (!CW.mapLayerPrefs || !CW.mapLayerPrefs.showExploreOnMap) return;
    if (CW.exploreSearchTimer) clearTimeout(CW.exploreSearchTimer);
    CW.exploreSearchTimer = setTimeout(runExplorePlaceSearch, EXPLORE_DEBOUNCE_MS);
}

function runExplorePlaceSearch() {
    CW.exploreSearchTimer = null;
    if (!CW.map || !window.AMap) return;
    if (!CW.mapLayerPrefs || !CW.mapLayerPrefs.showExploreOnMap) {
        clearExploreMarkers();
        return;
    }
    const poiType = (CW.selectedPoiType || '无偏好').trim();
    const keyword = POI_TYPE_EXPLORE_KEYWORDS[poiType];
    if (!keyword || poiType === '无偏好') {
        clearExploreMarkers();
        return;
    }
    const zoom = CW.map.getZoom();
    if (typeof zoom === 'number' && zoom < EXPLORE_MIN_ZOOM) {
        clearExploreMarkers();
        return;
    }

    const token = ++CW.exploreSearchToken;
    const bounds = CW.map.getBounds();
    if (!bounds) return;

    AMap.plugin('AMap.PlaceSearch', function() {
        const placeSearch = new AMap.PlaceSearch({
            city: CW.currentCity || '全国',
            citylimit: true,
            pageSize: EXPLORE_PAGE_SIZE,
            pageIndex: 1,
        });

        const onResult = function(status, result) {
            if (token !== CW.exploreSearchToken) return;
            if (status !== 'complete' || !result || result.info !== 'OK' || !result.poiList) {
                return;
            }
            const pois = result.poiList.pois || [];
            syncExploreMarkers(pois);
        };

        if (typeof placeSearch.searchInBounds === 'function') {
            placeSearch.searchInBounds(keyword, bounds, onResult);
        } else {
            placeSearch.search(keyword, onResult);
        }
    });
}

function initMapLayerControls() {
    if (CW._mapLayerControlsBound) return;
    CW._mapLayerControlsBound = true;

    loadMapLayerPrefs();
    const inspireEl = document.getElementById('mapShowInspire');
    const exploreEl = document.getElementById('mapShowExplore');
    if (inspireEl) {
        inspireEl.checked = !!CW.mapLayerPrefs.showInspireOnMap;
        inspireEl.addEventListener('change', function() {
            CW.mapLayerPrefs.showInspireOnMap = inspireEl.checked;
            saveMapLayerPrefs();
            if (inspireEl.checked && CW.inspireCandidates && CW.inspireCandidates.length) {
                syncInspireMarkers(CW.inspireCandidates);
            } else {
                clearInspireMarkers();
            }
        });
    }
    if (exploreEl) {
        exploreEl.checked = !!CW.mapLayerPrefs.showExploreOnMap;
        exploreEl.addEventListener('change', function() {
            CW.mapLayerPrefs.showExploreOnMap = exploreEl.checked;
            saveMapLayerPrefs();
            if (exploreEl.checked) {
                const poiType = (CW.selectedPoiType || '无偏好').trim();
                if (poiType === '无偏好' || !POI_TYPE_EXPLORE_KEYWORDS[poiType]) {
                    exploreEl.checked = false;
                    CW.mapLayerPrefs.showExploreOnMap = false;
                    saveMapLayerPrefs();
                    showToast('请先选择途经偏好（非「无偏好」）再开地图探索');
                    return;
                }
                runExplorePlaceSearch();
            } else {
                clearExploreMarkers();
                CW.exploreSearchToken++;
            }
        });
    }

    const prevPlanPrefsChange = window.__cwOnPlanPrefsChange;
    window.__cwOnPlanPrefsChange = function() {
        if (typeof prevPlanPrefsChange === 'function') prevPlanPrefsChange();
        if (!CW.mapLayerPrefs || !CW.mapLayerPrefs.showExploreOnMap) return;
        const poiType = (CW.selectedPoiType || '无偏好').trim();
        if (poiType === '无偏好' || !POI_TYPE_EXPLORE_KEYWORDS[poiType]) {
            clearExploreMarkers();
            const exploreEl = document.getElementById('mapShowExplore');
            if (exploreEl && exploreEl.checked) {
                exploreEl.checked = false;
                CW.mapLayerPrefs.showExploreOnMap = false;
                saveMapLayerPrefs();
            }
            return;
        }
        scheduleExplorePlaceSearch();
    };
}
