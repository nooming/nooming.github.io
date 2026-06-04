        // ========== Citywalk 前端 · 应用层逻辑 ==========
        // 状态变量与常量已在 cw-state.js 中声明
        // 地图/天气/路线/分享函数已在 cw-map.js / cw-weather.js / cw-route.js / cw-share.js 中声明

        // ===== 主题 =====
        function setRandomTheme() {
            CW.currentTheme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
            const root = document.documentElement;
            root.style.setProperty('--primary', CW.currentTheme.primary);
            root.style.setProperty('--primary-light', CW.currentTheme.primaryLight);
            root.style.setProperty('--primary-dark', CW.currentTheme.primaryDark);
            if (CW.currentTheme.primaryRgb) {
                root.style.setProperty('--primary-rgb', CW.currentTheme.primaryRgb);
            }
        }

        // 页面加载时设置随机主题
        setRandomTheme();

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

            showToast(`已切换到 ${cityName}，地图选点已清空；可在「智能规划」用文字描述新路线`);
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

        // 打卡偏好（仅 .poi-type-group 内、非路线风格按钮）
        bindSingleSelectGroup('.poi-type-group .poi-type-btn:not(.route-style-btn)', (el) => {
            CW.selectedPoiType = el.dataset.type;
        });

        // 路线风格
        bindSingleSelectGroup('.route-style-btn', (el) => {
            CW.selectedRouteStyle = el.dataset.style || 'balanced';
        });

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
        bindClick('btnPlan', generateRoute);
        bindClick('modeBtnRoute', () => switchPlanMode('route'));
        bindClick('modeBtnLoop', () => switchPlanMode('loop'));
        bindClick('btnGeneratePlan', generatePlanText);
        bindClick('btnShareImage', generateShareImage);
        bindClick('btnOpenAmap', openRouteInAmap);
        bindClick('btnClearRecent', clearRouteHistory);
        bindClick('btnBackToPlan', () => {
            const tab = CW.lastPlanTab === 'manual' ? 'manual' : 'agent';
            if (typeof switchPanelTab === 'function') switchPanelTab(tab);
        });
        bindClick('btnDismissTips', () => {
            const box = document.getElementById('planModeTips');
            if (box) box.style.display = 'none';
            try { sessionStorage.setItem('cw_dismiss_tips', '1'); } catch (_) { /* ignore */ }
        });

        // 最近路线 / 收藏：事件委托（恢复 / 收藏 / 删除）
        const recentList = document.getElementById('recentRoutesList');
        if (recentList) {
            recentList.addEventListener('click', (e) => {
                const fav = e.target.closest('.recent-route-fav');
                if (fav) { toggleFavoriteRoute(fav.dataset.id); return; }
                const del = e.target.closest('.recent-route-del');
                if (del) { deleteRouteFromHistory(del.dataset.id); return; }
                const main = e.target.closest('.recent-route-main');
                if (main) { restoreRouteFromHistory(main.dataset.id); }
            });
            recentList.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const main = e.target.closest('.recent-route-main');
                if (main) { e.preventDefault(); restoreRouteFromHistory(main.dataset.id); }
            });
        }
        // 首屏渲染历史
        if (typeof renderRecentRoutes === 'function') renderRecentRoutes();

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
            });
        }

        const agentQueryInput = document.getElementById('agentQueryInput');
        if (agentQueryInput) {
            agentQueryInput.addEventListener('input', updateBtnStatus);
        }
        if (typeof updateBtnStatus === 'function') updateBtnStatus();

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
        };
        if (window.AMap || window.__amapReady) {
            window.__cwOnAMapReady();
        }

        // ===== 移动端手势 =====
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
                    // 慢速但滑动距离长
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

                    // 在顶部继续下拉超过50px时收起面板，并阻止系统滚动
                    if (panelBody.scrollTop <= 0 && deltaY > 50) {
                        e.preventDefault();
                        togglePanel(false);
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
