/**
 * WanderWalk · 规划偏好 localStorage（城市、时长、风格等）
 */
(function (global) {
    const CW_PREFS_KEY = 'cw_plan_prefs_v1';

    function readPrefs() {
        try {
            const raw = localStorage.getItem(CW_PREFS_KEY);
            if (!raw) return null;
            const o = JSON.parse(raw);
            return o && typeof o === 'object' ? o : null;
        } catch (_) {
            return null;
        }
    }

    function writePrefs(patch) {
        const prev = readPrefs() || {};
        const next = Object.assign({}, prev, patch);
        try {
            localStorage.setItem(CW_PREFS_KEY, JSON.stringify(next));
        } catch (_) { /* ignore quota */ }
        return next;
    }

    function activateChip(selector, matchFn) {
        const btns = document.querySelectorAll(selector);
        let hit = null;
        btns.forEach((btn) => {
            const ok = matchFn(btn);
            btn.classList.toggle('active', ok);
            btn.setAttribute('aria-pressed', ok ? 'true' : 'false');
            if (ok) hit = btn;
        });
        return hit;
    }

    function applyPlanPrefs(prefs, options) {
        if (!prefs || !global.CW) return;
        const CW = global.CW;

        if (prefs.planMode === 'loop' || prefs.planMode === 'route') {
            CW.planMode = prefs.planMode;
            if (typeof global.syncPanelSharedPlanMode === 'function') {
                global.syncPanelSharedPlanMode();
            }
        }

        if (typeof prefs.planTime === 'number') {
            const slider = document.getElementById('planTimeSlider');
            const label = document.getElementById('planTimeValue');
            const v = Math.min(240, Math.max(30, prefs.planTime));
            if (slider) slider.value = String(v);
            if (label) label.textContent = `${v} 分钟`;
        }

        if (prefs.poiType) {
            CW.selectedPoiType = prefs.poiType;
            CW.poiTypeLocked = !!prefs.poiTypeLocked;
            activateChip(
                '.poi-type-group .poi-type-btn:not(.route-style-btn):not(.visit-pace-btn):not(.time-of-day-btn)',
                (btn) => btn.dataset.type === prefs.poiType
            );
        }

        if (prefs.routeStyle) {
            CW.selectedRouteStyle = prefs.routeStyle;
            activateChip('.route-style-btn', (btn) => (btn.dataset.style || 'balanced') === prefs.routeStyle);
        }

        if (prefs.visitPace) {
            CW.selectedVisitPace = prefs.visitPace === 'relaxed' ? 'relaxed' : 'checkin';
            activateChip('.visit-pace-btn', (btn) => {
                const p = btn.dataset.pace === 'relaxed' ? 'relaxed' : 'checkin';
                return p === CW.selectedVisitPace;
            });
        }

        if (prefs.timeOfDay) {
            CW.selectedTimeOfDay = prefs.timeOfDay;
            activateChip('.time-of-day-btn', (btn) => (btn.dataset.tod || 'now') === prefs.timeOfDay);
        }

        if (prefs.city) {
            applyCityPreference(prefs.city, !!(options && options.softCity));
        }
    }

    function applyCityPreference(cityName, soft) {
        const city = (cityName || '').trim();
        if (!city || !global.CW) return;
        const CW = global.CW;
        const coordsMap = global.CITY_COORDS || {};
        const el = document.getElementById('currentCity');

        function applyCoords(center) {
            CW.currentCity = city;
            CW.currentCityCenter = center;
            if (el) el.textContent = city;
            if (CW.map && center) {
                CW.map.setCenter(center);
                CW.map.setZoom(13);
            }
            if (typeof global.getCityWeather === 'function') {
                global.getCityWeather(city, false);
            }
        }

        if (coordsMap[city]) {
            applyCoords(coordsMap[city]);
            return;
        }
        if (soft && typeof global.geocodeCity === 'function') {
            global.geocodeCity(city).then((coords) => {
                if (coords) applyCoords(coords);
                else if (el) el.textContent = city;
            }).catch(() => {
                if (el) el.textContent = city;
            });
            CW.currentCity = city;
            if (el) el.textContent = city;
            return;
        }
        if (typeof global.quickSwitchCity === 'function') {
            global.quickSwitchCity(city);
        } else {
            CW.currentCity = city;
            if (el) el.textContent = city;
        }
    }

    function collectPlanPrefsFromCW() {
        const CW = global.CW || {};
        const slider = document.getElementById('planTimeSlider');
        const planTime = slider ? parseInt(slider.value, 10) : 60;
        return {
            city: CW.currentCity || '',
            planMode: CW.planMode || 'route',
            planTime: Number.isFinite(planTime) ? planTime : 60,
            poiType: CW.selectedPoiType || '无偏好',
            poiTypeLocked: !!CW.poiTypeLocked,
            routeStyle: CW.selectedRouteStyle || 'balanced',
            visitPace: CW.selectedVisitPace || 'checkin',
            timeOfDay: CW.selectedTimeOfDay || 'now',
        };
    }

    function savePlanPrefsFromUI() {
        return writePrefs(collectPlanPrefsFromCW());
    }

    function initPlanPrefs() {
        const saved = readPrefs();
        if (saved) applyPlanPrefs(saved, { softCity: true });

        const saveSoon = (function () {
            let t = 0;
            return function () {
                clearTimeout(t);
                t = setTimeout(savePlanPrefsFromUI, 120);
            };
        })();

        global.__cwSavePlanPrefs = savePlanPrefsFromUI;
        global.__cwOnPlanPrefsChange = saveSoon;
        return saved;
    }

    global.CitywalkPrefs = {
        initPlanPrefs,
        savePlanPrefsFromUI,
        applyPlanPrefs,
        applyCityPreference,
        readPrefs,
    };
})(typeof window !== 'undefined' ? window : globalThis);
