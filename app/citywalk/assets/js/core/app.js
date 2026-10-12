        // ========== Citywalk 前端 · 应用层逻辑 ==========
        // 状态变量与常量已在 cw-state.js 中声明
        // 地图/天气/路线/分享函数已在 cw-map.js / cw-weather.js / cw-route.js / cw-share.js 中声明

        // ===== 主题（持久化，刷新不重随）=====
        const CW_THEME_KEY = 'cw_theme_v1';

        function applyTheme(theme) {
            if (!theme) return;
            CW.currentTheme = theme;
            const root = document.documentElement;
            root.style.setProperty('--primary', theme.primary);
            root.style.setProperty('--primary-light', theme.primaryLight);
            root.style.setProperty('--primary-dark', theme.primaryDark);
            if (theme.primaryRgb) {
                root.style.setProperty('--primary-rgb', theme.primaryRgb);
            }
            if (theme.name) {
                try { localStorage.setItem(CW_THEME_KEY, theme.name); } catch (_) { /* ignore */ }
            }
        }

        function initPersistedTheme() {
            let savedName = null;
            try { savedName = localStorage.getItem(CW_THEME_KEY); } catch (_) { /* ignore */ }
            const found = savedName ? colorThemes.find(t => t.name === savedName) : null;
            applyTheme(found || colorThemes[Math.floor(Math.random() * colorThemes.length)]);
        }

        initPersistedTheme();

        // ===== 城市切换 =====
        function switchCity() {
            const cityInput = document.getElementById('cityInput');
            const city = cityInput.value.trim();
            if (!city) {
                showToast('请输入城市名称');
                return;
            }
            quickSwitchCity(city);
        }

        // 快速切换城市
        async function quickSwitchCity(city) {
            if (!city || !city.trim()) {
                showToast('请输入有效的城市名称');
                return;
            }

            const cityName = city.trim();

            // 检查是否是已知城市（预置坐标）
            if (CITY_COORDS[cityName]) {
                CW.currentCity = cityName;
                CW.currentCityCenter = CITY_COORDS[cityName];
                applyCitySwitch(CW.currentCity, CW.currentCityCenter);
                return;
            }

            // 未知城市，使用高德地理编码获取坐标
            showToast(`🔍 正在定位 ${cityName}...`);

            try {
                const coords = await geocodeCity(cityName);
                if (coords) {
                    CW.currentCity = cityName;
                    CW.currentCityCenter = coords;
                    applyCitySwitch(CW.currentCity, CW.currentCityCenter);
                } else {
                    showToast(`没找到「${cityName}」这座城市，换个名字试试`);
                }
            } catch (e) {
                console.error('城市定位失败', e);
                showToast(`没能定位「${cityName}」，换个名字试试`);
            }
        }

        // 使用高德地理编码获取城市坐标
        window.geocodeCity = function geocodeCity(cityName) {
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
            // 丢弃进行中的自动定位结果，避免晚到的 locate 覆盖用户选择
            CW.cityLocateGen = (CW.cityLocateGen || 0) + 1;
            CW.cityLocateReady = true;

            document.getElementById('currentCity').textContent = cityName;
            document.getElementById('cityInput').value = '';

            // 更新地图中心
            if (CW.map) {
                CW.map.setCenter(center);
                CW.map.setZoom(13);
            }

            // 更新天气（切换城市后强制拉取最新）
            getCityWeather(cityName, true);

            // 重置路线选择
            resetSelection();

            const cityDetails = document.getElementById('citySwitcherDetails');
            if (cityDetails) cityDetails.open = false;

            showToast(`已切换到 ${cityName}，地图选点已清空`);
            if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
        }

        // ===== 攻略与分享 =====
        function buildTemplatePlanText() {
            const now = new Date();
            const hour = now.getHours();
            let greeting = '';
            const distance = (CW.routeData.distance / 1000).toFixed(2);
            const walkDuration = CW.routeData.duration || 0;
            const poiCount = CW.routeData.pois ? CW.routeData.pois.length : 0;
            const stayDuration = CW.routeData.pois
                ? CW.routeData.pois.reduce((sum, p) => sum + (p.stay_time || 5), 0) : 0;
            const duration = walkDuration + stayDuration;
            const poiType = CW.selectedPoiType || "无偏好";
            const planTime = document.getElementById('planTimeValue')?.textContent || '60 分钟';
            if (hour < 10) {
                greeting = '☀️ 早上好';
            } else if (hour < 14) {
                greeting = '🍛 中午好';
            } else if (hour < 18) {
                greeting = '☀️ 下午好';
            } else {
                greeting = '🌙 晚上好';
            }

            let poiText = '';
            if (poiCount > 0) {
                poiText = '\n📍 【今日推荐打卡点】\n';
                CW.routeData.pois.forEach((poi, index) => {
                    const poiName = poi.name || '未知名称';
                    const poiIcon = poi.icon || '📍';
                    const opt = poi.optional ? '（可选，可跳过）' : '';
                    poiText += `${index + 1}. ${poiIcon} ${poiName}${opt}\n`;
                });
            } else {
                poiText = '\n📍 【今日推荐打卡点】\n这次沿途暂时没有推荐打卡点，随心走走也会有惊喜';
            }

            let weatherTips = '\n🌤️ 【今日天气小贴士】\n';
            if (CW.liveWeatherData && CW.liveWeatherData.weather != null) {
                const proxyHint = CW.liveWeatherData.proxyNeighborName
                    ? `（${CW.liveWeatherData.proxyNeighborName}市实况，${CW.currentCity}参考）`
                    : '';
                weatherTips += `${proxyHint}今天${CW.currentCity}${CW.liveWeatherData.weather}，气温${CW.liveWeatherData.temperature}℃，${CW.liveWeatherData.windDirection}${CW.liveWeatherData.windPower}级，湿度${CW.liveWeatherData.humidity}%\n`;

                const wx = String(CW.liveWeatherData.weather);
                const t = parseInt(CW.liveWeatherData.temperature, 10);
                if (wx.includes('雨')) {
                    weatherTips += '💧 今日有雨，记得带伞，路面湿滑慢慢走\n';
                } else if (t > 30) {
                    weatherTips += '☀️ 今日气温较高，注意防晒、多补水\n';
                } else if (t < 10) {
                    weatherTips += '🧣 今日气温较低，多穿一点别着凉\n';
                } else if (wx.includes('晴')) {
                    weatherTips += '😊 今日天气不错，适合出门走走\n';
                } else {
                    weatherTips += '😊 今日天气舒适，适合慢慢漫步\n';
                }
            } else {
                weatherTips += '暂时拿不到实时天气，出门前看下当地预报吧\n';
            }

            const planText = `${greeting}，这是为你定制的 ${CW.currentCity} Citywalk 攻略

🎈 【漫步主题】：${poiType}
⏱ 【计划时长】：${planTime}
📏 【路线总长】：${distance}公里
🕐 【预计耗时】：${duration} 分钟
${weatherTips}
${poiText}

💖 【贴心小建议】：
1. 按序号顺序走，每个打卡点慢慢逛，不用赶
2. 走累了就找家小店歇歇脚，喝杯咖啡
3. 注意随身物品，开心出门、平安回家

✨ 愿你在 ${CW.currentCity} 的街头遇见美好`;
            return planText;
        }

        function copyPlanTextToClipboard(planText) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(planText).then(() => {
                        showToast("攻略已复制，去分享吧");
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
                    showToast("攻略已复制，去分享吧");
                }
            } catch (err) {
                console.error('复制失败', err);
                showToast("复制没成功，可以手动选中弹窗内容复制");
            }
        }

        async function generatePlanText() {
            if (!CW.routeData || !CW.routeData.success) {
                showToast("请先生成一条路线吧");
                return;
            }

            const btn = document.getElementById('btnGeneratePlan');
            const oldText = btn ? btn.textContent : '';
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'AI 撰写中...';
            }

            let planText = null;
            try {
                if (typeof fetchAgentGuideText === 'function') {
                    planText = await fetchAgentGuideText();
                }
            } catch (e) {
                console.warn('AI 攻略失败，使用模板', e);
            }

            if (btn) {
                btn.disabled = false;
                btn.textContent = oldText || '生成游记攻略';
            }

            if (!planText) {
                planText = buildTemplatePlanText();
                showToast('已用本地模板生成攻略', 3000);
            } else {
                showToast('✨ 专属攻略已生成', 2500);
            }

            showCustomModal(planText);
            copyPlanTextToClipboard(planText);
        }

        // 自定义弹窗函数（支持滚动查看全部内容，样式见 styles.css 的 .cw-modal*）
        function showCustomModal(content) {
            const modal = document.createElement('div');
            modal.className = 'cw-modal';

            const modalContent = document.createElement('div');
            modalContent.className = 'cw-modal-content';
            modalContent.textContent = content;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'cw-modal-close';
            closeBtn.textContent = '关闭';
            closeBtn.onclick = () => {
                document.body.removeChild(modal);
            };

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

        // ===== 事件绑定 =====

        // 单选按钮组通用：点击后组内互斥高亮 + 同步 aria-pressed
        function bindSingleSelectGroup(selector, onSelect) {
            const btns = document.querySelectorAll(selector);
            btns.forEach(btn => {
                btn.addEventListener('click', function() {
                    btns.forEach(b => {
                        b.classList.remove('active');
                        b.setAttribute('aria-pressed', 'false');
                    });
                    this.classList.add('active');
                    this.setAttribute('aria-pressed', 'true');
                    onSelect(this);
                });
            });
        }

        // 打卡偏好（共享区芯片；点击即锁定，提交时优先生效）
        bindSingleSelectGroup('.poi-type-group .poi-type-btn:not(.route-style-btn):not(.visit-pace-btn):not(.time-of-day-btn)', (el) => {
            CW.selectedPoiType = el.dataset.type;
            CW.poiTypeLocked = true;
            if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
        });

        // 路线风格
        bindSingleSelectGroup('.route-style-btn', (el) => {
            CW.selectedRouteStyle = el.dataset.style || 'balanced';
            if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
        });

        // 逛法节奏
        bindSingleSelectGroup('.visit-pace-btn', (el) => {
            CW.selectedVisitPace = el.dataset.pace === 'relaxed' ? 'relaxed' : 'checkin';
            if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
        });

        // 出行时段
        bindSingleSelectGroup('.time-of-day-btn', (el) => {
            CW.selectedTimeOfDay = el.dataset.tod || 'now';
            if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
        });

        if (typeof CitywalkPrefs !== 'undefined' && CitywalkPrefs.initPlanPrefs) {
            CitywalkPrefs.initPlanPrefs();
        }

        if (typeof initPanelTabs === 'function') initPanelTabs();
        if (typeof syncPanelSharedPlanMode === 'function') syncPanelSharedPlanMode();

        const tipsBox = document.getElementById('planModeTips');
        if (tipsBox && sessionStorage.getItem('cw_dismiss_tips') === '1') {
            tipsBox.style.display = 'none';
        }

        // 顶部 / 表单按钮（替代原内联 onclick）
        function bindClick(id, handler) {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', handler);
        }
        bindClick('citySwitchBtn', switchCity);
        bindClick('btnAgentPlan', generateSmartRoute);
        bindClick('btnInspireCards', fetchInspirationCards);
        bindClick('btnAgentChat', sendAgentChat);
        bindClick('btnReset', resetSelection);
        bindClick('btnResetAgent', resetSelection);
        bindClick('btnSheetMore', () => setSheetDetent('full'));
        bindClick('sheetScrim', () => setSheetDetent('half'));
        bindClick('btnPlan', generateRoute);
        bindClick('modeBtnRoute', () => switchPlanMode('route'));
        bindClick('modeBtnLoop', () => switchPlanMode('loop'));
        bindClick('btnGeneratePlan', generatePlanText);
        bindClick('btnShareImage', generateShareImage);
        bindClick('btnCopyShareLink', () => {
            if (typeof copyShareableRouteLink === 'function') copyShareableRouteLink();
        });
        bindClick('btnRecordCommunity', () => {
            if (window.CitywalkBridge && typeof window.CitywalkBridge.navigateToCommunityWithImport === 'function') {
                window.CitywalkBridge.navigateToCommunityWithImport();
            }
        });
        bindClick('btnOpenAmap', openRouteInAmap);
        bindClick('btnNextStop', openNextStopInAmap);
        bindClick('btnClearRecentMain', clearRouteHistory);
        bindClick('btnExpandRecent', () => {
            if (typeof toggleRecentRoutesExpand === 'function') toggleRecentRoutesExpand();
        });
        bindClick('btnShareReplan', () => {
            const banner = document.getElementById('shareRestoreBanner');
            if (banner) banner.hidden = true;
            const coordsReady = CW.planMode === 'loop'
                ? !!CW.startPoint
                : !!(CW.startPoint && CW.endPoint);
            // 分享链接不含描述框；有起终点（或环线中心）即可规划
            if (coordsReady) {
                if (typeof generateSmartRoute === 'function') generateSmartRoute();
                else if (typeof generateRoute === 'function') generateRoute();
            } else {
                showToast('请先确认起终点，再规划');
            }
        });
        bindClick('btnBackToPlan', () => {
            const tab = CW.lastPlanTab === 'manual' ? 'manual' : 'agent';
            if (typeof switchPanelTab === 'function') switchPanelTab(tab);
        });
        bindClick('btnDismissTips', () => {
            const box = document.getElementById('planModeTips');
            if (box) box.style.display = 'none';
            try { sessionStorage.setItem('cw_dismiss_tips', '1'); } catch (_) { /* ignore */ }
        });

        // 最近路线 / 收藏：事件委托（主列表）
        function bindRecentList(el) {
            if (!el) return;
            el.addEventListener('click', (e) => {
                const fav = e.target.closest('.recent-route-fav');
                if (fav) { toggleFavoriteRoute(fav.dataset.id); return; }
                const del = e.target.closest('.recent-route-del');
                if (del) { deleteRouteFromHistory(del.dataset.id); return; }
                const main = e.target.closest('.recent-route-main');
                if (main) { restoreRouteFromHistory(main.dataset.id); }
            });
            el.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const main = e.target.closest('.recent-route-main');
                if (main) { e.preventDefault(); restoreRouteFromHistory(main.dataset.id); }
            });
        }
        bindRecentList(document.getElementById('recentRoutesListMain'));
        // 首屏：挂到智能规划按钮下方并渲染历史
        if (typeof placeRecentRoutesBlock === 'function') placeRecentRoutesBlock(CW.activePanelTab || 'agent');
        if (typeof renderRecentRoutes === 'function') renderRecentRoutes();
        if (typeof initShareableRouteFromUrl === 'function') initShareableRouteFromUrl();
        if (typeof CitywalkAuth !== 'undefined' && CitywalkAuth.initAuth) CitywalkAuth.initAuth();
        if (typeof renderPinnedSeeds === 'function') renderPinnedSeeds();

        // 城市输入框回车切换
        const cityInputEl = document.getElementById('cityInput');
        if (cityInputEl) {
            cityInputEl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') switchCity();
            });
        }

        // 对话输入框回车发送
        const agentChatInputEl = document.getElementById('agentChatInput');
        if (agentChatInputEl) {
            agentChatInputEl.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendAgentChat();
            });
        }

        // 热门城市标签（事件委托）
        const hotCitiesRow = document.querySelector('.hot-cities-row');
        if (hotCitiesRow) {
            hotCitiesRow.addEventListener('click', (e) => {
                const tag = e.target.closest('.hot-city-tag');
                if (tag && tag.dataset.city) quickSwitchCity(tag.dataset.city);
            });
        }

        // 时间滑块实时更新
        const planTimeSlider = document.getElementById('planTimeSlider');
        const planTimeValue = document.getElementById('planTimeValue');
        if (planTimeSlider && planTimeValue) {
            planTimeSlider.addEventListener('input', function() {
                const val = parseInt(this.value, 10);
                planTimeValue.textContent = `${val} 分钟`;
                updateBtnStatus();
                if (typeof window.__cwOnPlanPrefsChange === 'function') window.__cwOnPlanPrefsChange();
            });
        }

        const agentQueryInput = document.getElementById('agentQueryInput');
        if (agentQueryInput) {
            agentQueryInput.addEventListener('input', updateBtnStatus);
        }
        if (typeof updateBtnStatus === 'function') updateBtnStatus();

        // 搜索框功能。窄屏聚焦时底栏收成搜索行，贴在可视区域底部。
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            const narrowSheetQuery = '(max-width: 768px) and (min-height: 501px)';
            const syncSearchSheetToKeyboard = () => {
                const panel = document.querySelector('.control-panel');
                if (!panel || !panel.classList.contains('search-focused')) return;
                const vv = window.visualViewport;
                let bottom = 0;
                if (vv) {
                    bottom = Math.max(0, Math.round(window.innerHeight - vv.offsetTop - vv.height));
                }
                panel.style.setProperty('--cw-vv-bottom', bottom + 'px');
                if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
            };
            const onSearchViewport = () => syncSearchSheetToKeyboard();
            searchInput.addEventListener('focus', () => {
                if (!window.matchMedia(narrowSheetQuery).matches) return;
                const panel = document.querySelector('.control-panel');
                if (!panel) return;
                panel.classList.add('search-focused');
                syncSearchSheetToKeyboard();
                if (window.visualViewport) {
                    window.visualViewport.addEventListener('resize', onSearchViewport);
                    window.visualViewport.addEventListener('scroll', onSearchViewport);
                }
                window.addEventListener('resize', onSearchViewport);
            });
            searchInput.addEventListener('blur', () => {
                const panel = document.querySelector('.control-panel');
                if (panel) {
                    panel.classList.remove('search-focused');
                    panel.style.removeProperty('--cw-vv-bottom');
                }
                if (window.visualViewport) {
                    window.visualViewport.removeEventListener('resize', onSearchViewport);
                    window.visualViewport.removeEventListener('scroll', onSearchViewport);
                }
                window.removeEventListener('resize', onSearchViewport);
            });
            searchInput.addEventListener('keydown', function(e) {
                if (e.key !== 'Enter') return;
                const keyword = this.value.trim();
                if (!keyword) return;
                e.preventDefault();
                if (window.matchMedia(narrowSheetQuery).matches) {
                    CW._recenterSearchAfterSettle = true;
                    this.blur();
                    const panel = document.querySelector('.control-panel');
                    if (panel) {
                        panel.classList.remove('search-focused');
                        panel.style.removeProperty('--cw-vv-bottom');
                        setSheetDetent('peek');
                    }
                }
                searchAddress(keyword);
            });
        }

        // searchAddress / tryGeocodeSearch 已在 cw-map.js 中声明，此处不再重复
        // showLoadingSteps / hideLoadingSteps 已在 cw-route.js 中声明，此处不再重复

        // 天气卡片点击/回车刷新
        const weatherCard = document.getElementById('weatherCard');
        if (weatherCard) {
            const refreshWeather = () => {
                showToast('🔄 正在刷新天气...');
                getCityWeather(CW.currentCity, true);
            };
            weatherCard.addEventListener('click', refreshWeather);
            weatherCard.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    refreshWeather();
                }
            });
        }

        // ===== 地图初始化（通过 index.html 的就绪桥接，取代 setTimeout 猜测）=====
        window.__cwOnAMapReady = function() {
            if (!CW.map) initMap();
            // 分享起终点须在地图存在后落点（init 早期可能已解析偏好）
            if (typeof finishShareRestoreAfterMapReady === 'function') {
                finishShareRestoreAfterMapReady();
            }
            if (typeof finishSavedRouteRestoreAfterMapReady === 'function') {
                finishSavedRouteRestoreAfterMapReady();
            }
        };
        if (window.AMap || window.__amapReady) {
            window.__cwOnAMapReady();
        }

        // ===== 移动端三档底栏：收起 / 半屏 / 全屏 =====
        const SHEET_DETENTS = ['peek', 'half', 'full'];
        const SHEET_MEDIA = '(max-width: 768px) and (min-height: 501px)';

        function sheetDetentsActive() {
            return window.matchMedia(SHEET_MEDIA).matches;
        }

        function currentSheetDetent(panel) {
            const el = panel || document.querySelector('.control-panel');
            if (!el || !el.classList.contains('expanded')) return 'peek';
            return el.classList.contains('sheet-full') ? 'full' : 'half';
        }

        function notifyMapLayoutChange() {
            if (!CW.map || typeof CW.map.resize !== 'function') return;
            requestAnimationFrame(function () {
                if (CW.map) CW.map.resize();
            });
        }

        function syncPlanPrefsDisclosure() {
            const details = document.getElementById('planPrefsDisclosure');
            if (!details) return;
            const mobile = window.matchMedia('(max-width: 768px)').matches;
            details.open = mobile;
        }

        function setSheetDetent(detent) {
            const panel = document.querySelector('.control-panel');
            if (!panel || !sheetDetentsActive()) return;
            const next = SHEET_DETENTS.indexOf(detent) >= 0 ? detent : 'peek';
            panel.classList.remove('expanded', 'sheet-full');
            if (next === 'half') panel.classList.add('expanded');
            if (next === 'full') panel.classList.add('expanded', 'sheet-full');
            const scrim = document.getElementById('sheetScrim');
            if (scrim) {
                const on = next === 'full';
                scrim.classList.toggle('is-on', on);
                scrim.setAttribute('aria-hidden', on ? 'false' : 'true');
            }
            const grabber = document.getElementById('sheetGrabber');
            if (grabber) {
                const label = next === 'peek' ? '展开到半屏' : (next === 'half' ? '展开到全屏' : '收起面板');
                grabber.setAttribute('aria-label', label);
            }
            if (next === 'peek') {
                const body = panel.querySelector('.panel-body');
                if (body) body.scrollTop = 0;
                if (typeof recenterLastSearch === 'function') recenterLastSearch();
            }
            if (next === 'full') syncPlanPrefsDisclosure();
        }

        window.setSheetDetent = setSheetDetent;

        (function initDesktopPanelResize() {
            const DESKTOP_PANEL_MQ = '(min-width: 769px)';
            const STORAGE_KEY = 'cw_panel_width_v1';
            const panel = document.getElementById('controlPanel') || document.querySelector('.control-panel');
            const handle = document.getElementById('panelResizeHandle');
            if (!panel || !handle) return;

            function readStoredWidth() {
                try {
                    const n = parseInt(localStorage.getItem(STORAGE_KEY), 10);
                    if (Number.isFinite(n)) return n;
                } catch (_) { /* ignore */ }
                return null;
            }

            function applyPanelWidth(px) {
                const min = parseInt(getComputedStyle(panel).getPropertyValue('--cw-panel-width-min'), 10) || 340;
                const max = parseInt(getComputedStyle(panel).getPropertyValue('--cw-panel-width-max'), 10) || 480;
                const w = Math.max(min, Math.min(max, Math.round(px)));
                panel.style.setProperty('--cw-panel-width', w + 'px');
                notifyMapLayoutChange();
                return w;
            }

            const stored = readStoredWidth();
            if (stored != null) applyPanelWidth(stored);

            let dragging = false;
            let startX = 0;
            let startW = 0;

            function onMove(clientX) {
                if (!dragging) return;
                const delta = startX - clientX;
                applyPanelWidth(startW + delta);
            }

            function stopDrag() {
                if (!dragging) return;
                dragging = false;
                panel.classList.remove('is-resizing');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                try {
                    const w = parseInt(getComputedStyle(panel).width, 10);
                    if (Number.isFinite(w)) localStorage.setItem(STORAGE_KEY, String(w));
                } catch (_) { /* ignore */ }
            }

            handle.addEventListener('mousedown', function (e) {
                if (!window.matchMedia(DESKTOP_PANEL_MQ).matches) return;
                e.preventDefault();
                dragging = true;
                startX = e.clientX;
                startW = panel.getBoundingClientRect().width;
                panel.classList.add('is-resizing');
                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
            });

            window.addEventListener('mousemove', function (e) {
                if (!dragging) return;
                onMove(e.clientX);
            });
            window.addEventListener('mouseup', stopDrag);

            handle.addEventListener('keydown', function (e) {
                if (!window.matchMedia(DESKTOP_PANEL_MQ).matches) return;
                const step = e.shiftKey ? 24 : 12;
                let w = panel.getBoundingClientRect().width;
                if (e.key === 'ArrowLeft') w += step;
                else if (e.key === 'ArrowRight') w -= step;
                else return;
                e.preventDefault();
                const applied = applyPanelWidth(w);
                try { localStorage.setItem(STORAGE_KEY, String(applied)); } catch (_) { /* ignore */ }
            });
        })();

        syncPlanPrefsDisclosure();
        window.addEventListener('resize', syncPlanPrefsDisclosure);

        (function initTouchGestures() {
            const controlPanel = document.querySelector('.control-panel');
            const grabber = document.getElementById('sheetGrabber');
            if (!controlPanel || !grabber) return;

            let startY = 0;
            let dragging = false;
            let moved = false;
            let suppressClick = false;

            function stepDetent(dir) {
                const order = SHEET_DETENTS;
                let i = order.indexOf(currentSheetDetent(controlPanel));
                i = Math.max(0, Math.min(order.length - 1, i + dir));
                setSheetDetent(order[i]);
            }

            grabber.addEventListener('click', function() {
                if (!sheetDetentsActive()) return;
                if (suppressClick) {
                    suppressClick = false;
                    return;
                }
                const i = SHEET_DETENTS.indexOf(currentSheetDetent(controlPanel));
                setSheetDetent(SHEET_DETENTS[(i + 1) % SHEET_DETENTS.length]);
            });

            grabber.addEventListener('touchstart', function(e) {
                if (!sheetDetentsActive() || controlPanel.classList.contains('search-focused')) return;
                startY = e.touches[0].clientY;
                dragging = true;
                moved = false;
            }, { passive: true });

            grabber.addEventListener('touchmove', function(e) {
                if (!dragging) return;
                if (Math.abs(e.touches[0].clientY - startY) > 10) moved = true;
            }, { passive: true });

            grabber.addEventListener('touchend', function(e) {
                if (!dragging) return;
                dragging = false;
                const deltaY = startY - e.changedTouches[0].clientY;
                if (Math.abs(deltaY) > 42) {
                    suppressClick = true;
                    stepDetent(deltaY > 0 ? 1 : -1);
                } else if (moved) {
                    suppressClick = true;
                }
            }, { passive: true });

            const panelBody = controlPanel.querySelector('.panel-body');
            if (panelBody) {
                let bodyStartY = 0;
                let bodyStepped = false;
                panelBody.addEventListener('touchstart', function(e) {
                    bodyStartY = e.touches[0].clientY;
                    bodyStepped = false;
                }, { passive: true });
                panelBody.addEventListener('touchmove', function(e) {
                    if (bodyStepped || !sheetDetentsActive() || controlPanel.classList.contains('search-focused')) return;
                    const deltaY = e.touches[0].clientY - bodyStartY;
                    if (panelBody.scrollTop <= 0 && deltaY > 56 && currentSheetDetent(controlPanel) !== 'peek') {
                        bodyStepped = true;
                        e.preventDefault();
                        stepDetent(-1);
                    }
                }, { passive: false });
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
                    if (distance < 30 && CW.map) {
                        e.preventDefault();
                        const currentZoom = CW.map.getZoom();
                        CW.map.setZoom(currentZoom + 1);
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

        // 全屏时点遮罩回到半屏（见 sheetScrim）。半屏与收起不拦截地图，方便选点。
