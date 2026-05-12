        // ========== Citywalk 前端 · 应用层逻辑 ==========
        // 状态变量与常量已在 cw-state.js 中声明
        // 地图/天气/路线函数已在 cw-map.js / cw-weather.js / cw-route.js 中声明

        // ===== 主题 =====
        function setRandomTheme() {
            currentTheme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
            const root = document.documentElement;
            root.style.setProperty('--primary', currentTheme.primary);
            root.style.setProperty('--primary-light', currentTheme.primaryLight);
            root.style.setProperty('--primary-dark', currentTheme.primaryDark);
        }

        // 页面加载时设置随机主�?        setRandomTheme();

        // ===== 地图错误处理 =====
        function mapLoadError() {
            showToast("高德地图加载失败，请刷新页面重试");
        }

        // ===== 城市切换 =====
        function switchCity() {
            const cityInput = document.getElementById('cityInput');
            const city = cityInput.value.trim();
            if (!city) {
                showToast('请输入城市名�?);
                return;
            }
            quickSwitchCity(city);
        }

        // 快速切换城�?        async function quickSwitchCity(city) {
            if (!city || !city.trim()) {
                showToast('请输入有效的城市名称');
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
            
            // 未知城市，使用高德地理编码获取坐�?            showToast(`🔍 正在定位 ${cityName}...`);
            
            try {
                const coords = await geocodeCity(cityName);
                if (coords) {
                    currentCity = cityName;
                    currentCityCenter = coords;
                    applyCitySwitch(currentCity, currentCityCenter);
                } else {
                    showToast(`�?无法定位城市�?{cityName}，请检查城市名称`);
                }
            } catch (e) {
                console.error('城市定位失败�?, e);
                showToast(`�?定位失败�?{cityName}`);
            }
        }
        
        // 使用高德地理编码获取城市坐标
        function geocodeCity(cityName) {
            return new Promise((resolve, reject) => {
                if (!window.AMap) {
                    reject(new Error('高德地图未加�?));
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
            
            // 更新天气（切换城市后强制拉取�?            getCityWeather(cityName, true);
            
            // 重置路线选择
            resetSelection();
            
            showToast(`�?已切换到�?{cityName}`);
        }

        // ===== 攻略与分享 =====
        function generatePlanText() {
            if (!routeData || !routeData.success) {
                showToast("请先生成有效的路线规划！");
                return;
            }
            const now = new Date();
            const hour = now.getHours();
            let greeting = '';
            const distance = (routeData.distance / 1000).toFixed(2);
            const walkDuration = routeData.duration || 0;
            const poiCount = routeData.pois ? routeData.pois.length : 0;
            const stayDuration = routeData.pois
                ? routeData.pois.reduce((sum, p) => sum + (p.stay_time || 5), 0) : 0;
            const duration = walkDuration + stayDuration;
            const poiType = selectedPoiType || "无偏好";
            const planTime = document.getElementById('planTimeValue')?.textContent || '60 分钟';
            if (hour < 10) {
                greeting = '☀�?早上好呀�?;
            } else if (hour < 14) {
                greeting = '🍛 中午好～';
            } else if (hour < 18) {
                greeting = '�?下午好～';
            } else {
                greeting = '🌙 晚上好～';
            }

            let poiText = '';
            if (poiCount > 0) {
                poiText = '\n�?【今日推荐打卡点】\n';
                routeData.pois.forEach((poi, index) => {
                    const poiName = poi.name || '未知名称';
                    const poiIcon = poi.icon || '📍';
                    poiText += `${index + 1}. ${poiIcon} ${poiName}\n`;
                });
            } else {
                poiText = '\n�?【今日推荐打卡点】\n暂时没有推荐的打卡点哦，不妨随心走走，说不定会发现意外的美好�?;
            }

            let weatherTips = '\n🌤�?【今日天气小贴士】\n';
            if (liveWeatherData && liveWeatherData.weather != null) {
                const proxyHint = liveWeatherData.proxyNeighborName
                    ? `�?{liveWeatherData.proxyNeighborName}市实况，�?{currentCity}参考）`
                    : '';
                weatherTips += `${proxyHint}今天${currentCity}${liveWeatherData.weather}，气�?{liveWeatherData.temperature}℃，${liveWeatherData.windDirection}${liveWeatherData.windPower}级，湿度${liveWeatherData.humidity}%\n`;

                const wx = String(liveWeatherData.weather);
                const t = parseInt(liveWeatherData.temperature, 10);
                if (wx.includes('�?)) {
                    weatherTips += '💧 温馨提示：今日有雨，记得带上小雨伞哦～路面可能湿滑，走路慢慢走，安全第一❤️\n';
                } else if (t > 30) {
                    weatherTips += '☀�?温馨提示：今日气温较高，做好防晒哦～记得随身带瓶水，补充水分💦\n';
                } else if (t < 10) {
                    weatherTips += '🧣 温馨提示：今日气温较低，多穿点衣服哦～别着凉啦❤️\n';
                } else if (wx.includes('�?)) {
                    weatherTips += '😘 温馨提示：今日天气超棒！适合出门走走，记得带上好心情～\n';
                } else {
                    weatherTips += '😊 温馨提示：今日天气舒适，适合Citywalk，享受慢时光～\n';
                }
            } else {
                weatherTips += '暂时无法获取实时天气，出门前记得看下天气预报哦～\n';
            }

            const planText = `${greeting} 这份专属你的${currentCity}Citywalk攻略来啦�?
🎈 【游玩主题】：${poiType}
�?【计划时长】：${planTime}分钟
📏 【路线总长】：${distance}公里
�?【预计耗时】：${duration} 分钟
${weatherTips}
${poiText}

💖 【暖心小建议】：
1. 建议按照序号顺序游玩，每个打卡点慢慢逛，不用赶时间～
2. 走路累了可以找家小店歇歇脚，喝杯咖啡或奶茶☕
3. 记得多拍点美美的照片，记录美好的瞬间�?4. 注意随身物品安全，开开心心出门，平平安安回家～
5. 如果走累了，随时可以调整路线，游玩最重要的是开心呀🥳

�?愿你�?{currentCity}的街头，遇见美好，收获满满的快乐～`;

            // 使用自定义弹窗展示长文案（避免原�?alert 截断�?            showCustomModal(planText);

            // 复制到剪贴板
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    navigator.clipboard.writeText(planText).then(() => {
                        showToast("❤️ 游玩方案已复制到剪贴板啦�?);
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
                    showToast("❤️ 游玩方案已复制到剪贴板啦�?);
                }
            } catch (err) {
                console.error('复制失败�?, err);
                showToast("😥 复制失败啦，可以手动复制弹窗里的内容哦～");
            }
        }

// 生成分享长图（使用浏览器原生截图API截取地图�?async function generateShareImage() {
    if (!routeData || !routeData.success) {
        showToast("请先生成有效的路线规划！");
        return;
    }

    showToast("🎨 正在截取地图，请稍�?..");

    // ========== 第一步：使用屏幕共享API截取地图 ==========
    let mapImageUrl = null;
    try {
        showToast("🗺�?请选择要分享的地图区域...");
        
        // 请求屏幕共享
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: 'never',
                displaySurface: 'browser' // 优先浏览器标签页
            },
            audio: false
        });
        
        showToast("📸 正在截取地图...");
        
        // 创建视频元素捕获画面
        const video = document.createElement('video');
        video.srcObject = stream;
        video.play();
        
        // 等待视频准备�?        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                setTimeout(resolve, 500); // 额外等待确保画面稳定
            };
        });
        
        // 创建canvas绘制视频�?        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // 停止屏幕共享
        stream.getTracks().forEach(track => track.stop());
        
        // 转换为图片URL
        mapImageUrl = canvas.toDataURL('image/png', 0.9);
        showToast("�?地图截取成功，正在合成长�?..");
    } catch (e) {
        console.warn('屏幕共享取消或失�?', e);
        if (e.name === 'NotAllowedError') {
            showToast("已取消屏幕共享，使用默认背景...");
        } else {
            showToast("截图失败，使用默认背�?..");
        }
    }

    // ========== 第二步：收集数据 ==========
    const poiType = selectedPoiType || "无偏�?;
    const distance = (routeData.distance / 1000).toFixed(2);
    const walkDuration = routeData.duration || 0;
    const poiCount = routeData.pois ? routeData.pois.length : 0;
    // 总耗时 = 步行 + POI停留（使用后端返回的 stay_time，默认5分钟）
    const stayDuration = routeData.pois
        ? routeData.pois.reduce((sum, p) => sum + (p.stay_time || 5), 0) : 0;
    const duration = walkDuration + stayDuration;
    const now = new Date();
    
    // 主题名称映射
    const themeNames = {
        '无偏�?: '城市漫游',
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
    let weatherIcon = '🌤�?;
    if (liveWeatherData) {
        const px = liveWeatherData.proxyNeighborName
            ? `${liveWeatherData.proxyNeighborName}�?`
            : '';
        weatherText = `${px}${liveWeatherData.weather} ${liveWeatherData.temperature}℃`;
        weatherIcon = getWeatherIcon(liveWeatherData.weather);
    }
    
    // 日期格式�?    const dateStr = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' });
    
    // ========== 第三步：使用当前网页主题�?==========
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
            { name: '日落�?, primary: '#ff7e5f', secondary: '#feb47b', gradient: 'linear-gradient(180deg, rgba(255,126,95,0.9) 0%, rgba(254,180,123,0.7) 50%, transparent 100%)' },
            { name: '薄荷�?, primary: '#11998e', secondary: '#38ef7d', gradient: 'linear-gradient(180deg, rgba(17,153,142,0.9) 0%, rgba(56,239,125,0.7) 50%, transparent 100%)' },
            { name: '珊瑚�?, primary: '#ff6b6b', secondary: '#feca57', gradient: 'linear-gradient(180deg, rgba(255,107,107,0.9) 0%, rgba(254,202,87,0.7) 50%, transparent 100%)' },
            { name: '深海�?, primary: '#4facfe', secondary: '#00f2fe', gradient: 'linear-gradient(180deg, rgba(79,172,254,0.9) 0%, rgba(0,242,254,0.7) 50%, transparent 100%)' },
            { name: '紫罗�?, primary: '#a18cd1', secondary: '#fbc2eb', gradient: 'linear-gradient(180deg, rgba(161,140,209,0.9) 0%, rgba(251,194,235,0.7) 50%, transparent 100%)' },
            { name: '樱花�?, primary: '#f093fb', secondary: '#f5576c', gradient: 'linear-gradient(180deg, rgba(240,147,251,0.9) 0%, rgba(245,87,108,0.7) 50%, transparent 100%)' },
            { name: '森林�?, primary: '#56ab2f', secondary: '#a8e063', gradient: 'linear-gradient(180deg, rgba(86,171,47,0.9) 0%, rgba(168,224,99,0.7) 50%, transparent 100%)' },
            { name: '焦糖�?, primary: '#8B4513', secondary: '#D2691E', gradient: 'linear-gradient(180deg, rgba(139,69,19,0.9) 0%, rgba(210,105,30,0.7) 50%, transparent 100%)' }
        ];
        theme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
    }
    
    // 文艺文案库（扩充并优化）
    const slogans = [
        '用脚步丈量城市的温度',
        '在街角遇见生活的美好',
        '每一步都是新的发�?,
        '与城市来一场浪漫邂�?,
        '慢下来，看见不一样的风景',
        '漫步城市，发现不一样的自己',
        '最好的风景，永远在路上',
        '城市的每一个角落都有故�?,
        '走街串巷，品味人间烟�?,
        '今日份的美好已送达',
        '生活明朗，万物可�?,
        '保持热爱，奔赴山�?,
        '不负春光，野蛮生�?,
        '心之所向，素履以往'
    ];
    const randomSlogan = slogans[Math.floor(Math.random() * slogans.length)];

    // 构建POI列表（美化版，悬浮气泡样式）
    let poisHtml = '';
    if (poiCount > 0) {
        const showPois = routeData.pois.slice(0, 4);
        poisHtml = '<div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 0 10px;">';
        showPois.forEach((poi, index) => {
            const poiIcon = poi.icon || '📍';
            const poiName = (poi.name || '未知').slice(0, 6);
            poisHtml += `
                <div style="background: linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.9)); border-radius: 20px; padding: 8px 14px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.5); backdrop-filter: blur(10px);">
                    <span style="font-size: 16px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));">${poiIcon}</span>
                    <span style="font-size: 11px; color: #2d3748; font-weight: 600; letter-spacing: 0.3px;">${poiName}</span>
                </div>
            `;
        });
        if (poiCount > 4) {
            poisHtml += `
                <div style="background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary}); border-radius: 20px; padding: 8px 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.3);">
                    <span style="font-size: 12px; color: white; font-weight: 700;">+${poiCount - 4}</span>
                </div>
            `;
        }
        poisHtml += '</div>';
    }

    // ========== 第四步：构建长图HTML�?:5比例，美图为主） ==========
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
        <!-- 地图截图背景�?-->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; ${bgStyle}">
            ${mapImageUrl ? '<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.25);"></div>' : ''}
        </div>
        
        <!-- 顶部主题色渐变遮�?-->
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 150px; background: ${theme.gradient};"></div>
        
        <!-- 底部主题色渐变遮�?-->
        <div style="position: absolute; bottom: 0; left: 0; width: 100%; height: 200px; background: linear-gradient(0deg, ${theme.primary}ee 0%, ${theme.secondary}aa 30%, transparent 100%);"></div>
        
        <!-- 顶部信息�?-->
        <div style="position: absolute; top: 0; left: 0; width: 100%; padding: 18px 22px; box-sizing: border-box;">
            <div style="font-size: 10px; color: rgba(255,255,255,0.95); margin-bottom: 6px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 500; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">🚶 CITYWALK · ${areaName}</div>
            <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: white; line-height: 1.2; text-shadow: 0 2px 12px rgba(0,0,0,0.3); letter-spacing: 0.5px;">
                ${themeName}
            </h1>
            <div style="margin-top: 10px; font-size: 12px; color: rgba(255,255,255,0.9); font-weight: 500; text-shadow: 0 1px 3px rgba(0,0,0,0.2);">${dateStr} · ${weatherIcon} ${weatherText}</div>
        </div>
        
        <!-- 右侧竖排文案�?-->
        <div style="position: absolute; right: 16px; top: 50%; transform: translateY(-50%); writing-mode: vertical-rl; text-orientation: upright; z-index: 10;">
            <div style="font-size: 13px; color: white; font-weight: 700; text-shadow: 0 2px 8px rgba(0,0,0,0.4); letter-spacing: 4px; padding: 12px 8px; background: linear-gradient(180deg, ${theme.primary}cc, ${theme.secondary}aa); border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                ${randomSlogan}
            </div>
        </div>
        
        <!-- 底部信息�?- 毛玻璃卡片样�?-->
        <div style="position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%); width: calc(100% - 32px); max-width: 360px; padding: 20px; box-sizing: border-box; background: rgba(255,255,255,0.25); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-radius: 24px; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3);">
            <!-- 数据统计 -->
            <div style="display: flex; justify-content: space-around; margin-bottom: 16px;">
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 26px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.5px;">${distance}<span style="font-size: 11px; font-weight: 600; margin-left: 2px;">km</span></div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">总距�?/div>
                </div>
                <div style="width: 1px; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent);"></div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 26px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.5px;">${duration}<span style="font-size: 11px; font-weight: 600; margin-left: 2px;">min</span></div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">预计用时</div>
                </div>
                <div style="width: 1px; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.5), transparent);"></div>
                <div style="text-align: center; flex: 1;">
                    <div style="font-size: 26px; font-weight: 800; color: white; text-shadow: 0 2px 8px rgba(0,0,0,0.3); letter-spacing: -0.5px;">${poiCount}<span style="font-size: 11px; font-weight: 600; margin-left: 2px;">�?/span></div>
                    <div style="font-size: 11px; color: rgba(255,255,255,0.85); margin-top: 4px; font-weight: 500;">打卡�?/div>
                </div>
            </div>
            
            <!-- POI列表 -->
            ${poisHtml}
        </div>
    `;

    document.body.appendChild(shareCard);

    // ========== 第五步：生成并下载图�?==========
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
            
            showToast("🎉 精美长图已生成，快去分享吧！");
        }, 'image/png', 0.95);
        
        document.body.removeChild(shareCard);
    } catch (err) {
        console.error('生成图片失败:', err);
        document.body.removeChild(shareCard);
        showToast("😥 生成图片失败，请重试");
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

    // 创建弹窗内容�?    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white;
        border-radius: 10px;
        padding: 20px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap; /* 保留换行�?*/
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
        border-radius: 5px;
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

    // 点击空白处关�?    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
}

        // ===== 事件绑定 =====
        // POI 类型选择
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

        // 搜索框功�?        const searchInput = document.getElementById('searchInput');
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

        // 天气卡片点击刷新
        const weatherCard = document.getElementById('weatherCard');
        if (weatherCard) {
            weatherCard.addEventListener('click', function() {
                showToast('🔄 正在刷新天气...');
                getCityWeather(currentCity, true);
            });
        }

        // 页面加载完成初始�?        if (window.AMap) {
            initMap();
        } else {
            setTimeout(() => {
                if (!map) initMap();
            }, 2000);
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

            // 切换展开/收起状�?            function togglePanel(expand) {
                isExpanded = expand !== undefined ? expand : !isExpanded;
                if (isExpanded) {
                    controlPanel.classList.add('expanded');
                } else {
                    controlPanel.classList.remove('expanded');
                }
            }

            // 点击头部切换（还原为：点击整个头部都可以展开/收起�?            header.addEventListener('click', function(e) {
                if (hasMoved) return; // 如果是拖动操作，不触发点�?                togglePanel();
            });

            // 触摸开�?            header.addEventListener('touchstart', function(e) {
                startY = e.touches[0].clientY;
                startTime = Date.now();
                isDragging = true;
                hasMoved = false;
                header.style.cursor = 'grabbing';
            }, { passive: true });

            // 触摸移动 - 检测滑动方�?            header.addEventListener('touchmove', function(e) {
                if (!isDragging) return;
                
                const currentY = e.touches[0].clientY;
                const deltaY = startY - currentY;
                
                // 移动超过 10px 认为是拖�?                if (Math.abs(deltaY) > 10) {
                    hasMoved = true;
                }
                
                // 根据滑动方向实时反馈
                if (deltaY > 30 && !isExpanded) {
                    // 向上滑动，准备展开
                    header.style.transform = 'translateY(-2px)';
                } else if (deltaY < -30 && isExpanded) {
                    // 向下滑动，准备收�?                    header.style.transform = 'translateY(2px)';
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

                // 快速滑动（轻扫�?                if (deltaTime < 300 && Math.abs(deltaY) > 50) {
                    if (deltaY > 0) {
                        togglePanel(true); // 向上轻扫，展开
                    } else {
                        togglePanel(false); // 向下轻扫，收�?                    }
                } else if (Math.abs(deltaY) > 80) {
                    // 慢速但滑动距离�?                    if (deltaY > 0) {
                        togglePanel(true);
                    } else {
                        togglePanel(false);
                    }
                }
                // 否则认为是点击，�?click 事件处理
            }, { passive: true });

            // 阻止头部区域的默认滚动行�?            header.addEventListener('touchmove', function(e) {
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

        // 移动端双击放大地�?        (function initMapDoubleTap() {
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
                    // 双击检�?                    const distance = Math.sqrt(
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

