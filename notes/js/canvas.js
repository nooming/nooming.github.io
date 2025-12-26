// 画布绘制相关功能

// 加载页面内容到画布
function loadPageContent() {
    if (!canvas || !ctx) return;
    
    const activePage = state.pages.find(p => p.id === state.activePageId);
    if (activePage && activePage.type === 'draw') {
        // 如果偏移量为0（首次加载），则设置为居中
        if (canvasOffsetX === 0 && canvasOffsetY === 0) {
            const editorContent = document.querySelector('.editor-content');
            if (editorContent) {
                canvasOffsetX = (editorContent.clientWidth - canvas.width) / 2;
                canvasOffsetY = (editorContent.clientHeight - canvas.height) / 2;
                applyCanvasTransform();
            }
        }
        
        // 优先使用笔画数据，如果没有则使用图片数据（兼容旧数据）
        if (activePage.strokes && activePage.strokes.length > 0) {
            strokes = activePage.strokes;
            redrawCanvas();
        } else if (activePage.imageData) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
            };
            img.src = activePage.imageData;
            strokes = [];
        } else {
            strokes = [];
        }
    } else {
        strokes = [];
    }
}

// 画布初始化
function initCanvas() {
    const editorContent = document.querySelector('.editor-content');
    if (!editorContent) return;

    // 添加canvas-mode类，允许画布溢出显示
    editorContent.classList.add('canvas-mode');

    // 移除旧画布
    const oldCanvas = document.getElementById('canvas');
    if (oldCanvas) oldCanvas.remove();

    // 创建新画布 - 设置为更大的尺寸，超出屏幕范围
    canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    // 画布尺寸设置为窗口大小的4倍，提供更大的绘制空间
    // 最小尺寸为5000x5000，确保有足够的绘制区域
    const canvasWidth = Math.max(window.innerWidth * 4, 5000);
    const canvasHeight = Math.max(window.innerHeight * 4, 5000);
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    // 设置CSS尺寸，保持画布的实际显示大小
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    editorContent.appendChild(canvas);

    ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;

    // 设置初始偏移量，使画布居中显示
    // 计算居中位置：画布中心对齐容器中心
    canvasOffsetX = (editorContent.clientWidth - canvasWidth) / 2;
    canvasOffsetY = (editorContent.clientHeight - canvasHeight) / 2;
    applyCanvasTransform();

    // 加载页面内容
    loadPageContent();

    // 创建准心元素
    const oldCrosshair = document.getElementById('crosshair');
    if (oldCrosshair) oldCrosshair.remove();
    
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.display = 'none';
    editorContent.appendChild(crosshair);

    // 鼠标事件
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', (e) => {
        // 只有在按下时才更新准心（删除模式下）
        if (isDrawing && currentMode === 'eraser') {
            updateCrosshair(e);
        }
        draw(e);
    });
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', (e) => {
        hideCrosshair();
        stopDraw(e);
    });

    // 触摸事件（使用 passive: false 以便调用 preventDefault）
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouch, { passive: false });
}

// 获取画布坐标（考虑偏移量）
function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    let x, y;
    if (e.touches) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
    }
    // getBoundingClientRect()已经包含了CSS transform的偏移
    // 但是画布内部的坐标系并没有改变，所以直接返回相对于画布的位置即可
    // 不需要再减去canvasOffsetX和canvasOffsetY
    return {
        x: x,
        y: y
    };
}

// 应用画布变换（通过CSS transform实现拖拽效果）
function applyCanvasTransform() {
    if (canvas) {
        canvas.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px)`;
        canvas.style.transition = 'none'; // 拖拽时不要过渡动画
    }
}

// 获取事件坐标（支持鼠标和触摸）
function getEventPos(e) {
    if (e.touches) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

// 开始拖拽
function startDrag(e) {
    isDragging = true;
    const pos = getEventPos(e);
    dragStartX = pos.x;
    dragStartY = pos.y;
    dragStartOffsetX = canvasOffsetX;
    dragStartOffsetY = canvasOffsetY;
    canvas.style.cursor = 'grabbing';
}

// 处理拖拽
function handleDrag(e) {
    if (!isDragging) return;
    const pos = getEventPos(e);
    canvasOffsetX = dragStartOffsetX + (pos.x - dragStartX);
    canvasOffsetY = dragStartOffsetY + (pos.y - dragStartY);
    applyCanvasTransform();
}

// 停止拖拽
function stopDrag() {
    isDragging = false;
    canvas.style.cursor = 'grab';
}

// 开始绘制
function startDraw(e) {
    e.preventDefault();
    
    // 拖拽模式
    if (currentMode === 'drag') {
        startDrag(e);
        return;
    }
    
    const pos = getCanvasPos(e);
    
    if (currentMode === 'eraser') {
        // 删除笔画模式：允许滑动删除
        isDrawing = true;
        lastEraserPos = pos;
        // 显示准心（按下时）
        updateCrosshair(e);
        // 检测起始位置的笔画
        deleteStrokeAt(pos.x, pos.y);
        return;
    }
    
    isDrawing = true;
    // 创建新笔画
    currentStroke = {
        id: generateId(),
        points: [{ x: pos.x, y: pos.y }],
        color: currentColor,
        size: currentSize
    };
    strokes.push(currentStroke);
    
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
}

// 执行实际绘制（在 requestAnimationFrame 中批量处理）
function performDrawBatch() {
    if (!isDrawing || !currentStroke || pendingPoints.length === 0) return;
    
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineWidth = currentSize;
    ctx.strokeStyle = currentColor;
    
    // 批量处理所有待绘制的点
    // 优化：使用 beginPath 和一次性绘制所有线段，提高性能
    ctx.beginPath();
    
    // 找到当前笔画的最后一个点作为起点
    const lastPoint = currentStroke.points.length > 0 
        ? currentStroke.points[currentStroke.points.length - 1]
        : null;
    
    if (lastPoint) {
        ctx.moveTo(lastPoint.x, lastPoint.y);
    } else if (pendingPoints.length > 0) {
        ctx.moveTo(pendingPoints[0].x, pendingPoints[0].y);
        currentStroke.points.push({ x: pendingPoints[0].x, y: pendingPoints[0].y });
    }
    
    // 每次只处理少量点，但更频繁地绘制，让画面更新更实时
    const maxPointsPerBatch = 2; // 每次只处理2个点，减少单次绘制时间，增加绘制频率
    const pointsToProcess = pendingPoints.slice(0, maxPointsPerBatch);
    const remainingPoints = pendingPoints.slice(maxPointsPerBatch);
    
    for (let i = lastPoint ? 0 : 1; i < pointsToProcess.length; i++) {
        const pos = pointsToProcess[i];
        currentStroke.points.push({ x: pos.x, y: pos.y });
        ctx.lineTo(pos.x, pos.y);
    }
    
    ctx.stroke();
    
    // 如果还有剩余点，保留它们供下次绘制
    pendingPoints = remainingPoints;
    
    // 如果还有待处理的点，立即安排下一个 RAF，实现多次快速绘制
    if (pendingPoints.length > 0 && isDrawing) {
        rafId = requestAnimationFrame(() => {
            performDrawBatch();
            rafId = null;
        });
    }
}

// 绘制（优化版本，使用 requestAnimationFrame）
function draw(e) {
    e.preventDefault();
    
    // 拖拽模式
    if (currentMode === 'drag') {
        handleDrag(e);
        return;
    }
    
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    
    if (currentMode === 'eraser') {
        // 删除笔画模式：检测滑动路径上的笔画
        // 对于删除模式，需要立即执行，不能延迟
        if (lastEraserPos) {
            // 检测从上一个位置到当前位置的线段是否与笔画相交
            deleteStrokesAlongPath(lastEraserPos.x, lastEraserPos.y, pos.x, pos.y);
        } else {
            // 检测当前位置的笔画
            deleteStrokeAt(pos.x, pos.y);
        }
        lastEraserPos = pos;
        return;
    }
    
    if (!currentStroke) return;
    
    // 检测是否为触摸事件（移动端）
    const isTouch = e.touches && e.touches.length > 0;
    
    // 统一使用 requestAnimationFrame 优化性能
    // 将点添加到队列中
    pendingPoints.push({ x: pos.x, y: pos.y });
    
    // 每次移动都安排一个新的 RAF，确保及时绘制
    // 如果已有 RAF，取消它并创建新的，这样可以保证最新的点被绘制
    // 这样可以确保绘制尽可能及时，接近拖拽的流畅度
    if (rafId) {
        cancelAnimationFrame(rafId);
    }
    
    rafId = requestAnimationFrame(() => {
        performDrawBatch();
        rafId = null;
    });
}

// 停止绘制
function stopDraw(e) {
    // 拖拽模式
    if (currentMode === 'drag') {
        stopDrag();
        return;
    }
    
    if (isDrawing) {
        isDrawing = false;
        
        // 确保所有待处理的绘制都完成（移动端）
        if (pendingPoints.length > 0) {
            // 如果有待处理的点，立即执行最后一次绘制
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
            performDrawBatch();
        }
        
        // 如果是触摸结束，添加最后一个点
        if (e && e.changedTouches && e.changedTouches.length > 0 && currentStroke) {
            // 从 changedTouches 获取最后一个触摸点
            const touch = e.changedTouches[0];
            const rect = canvas.getBoundingClientRect();
            const finalPos = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            
            // 如果队列中还有待处理的点，先绘制它们
            if (pendingPoints.length > 0) {
                performDrawBatch();
            }
            
            // 添加最后一个点并绘制
            currentStroke.points.push({ x: finalPos.x, y: finalPos.y });
            
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = currentSize;
            ctx.strokeStyle = currentColor;
            ctx.lineTo(finalPos.x, finalPos.y);
            ctx.stroke();
        }
        
        pendingPoints = [];
        rafId = null;
        
        if (currentMode === 'eraser') {
            lastEraserPos = null;
            hideCrosshair(); // 松开时隐藏准心
        } else {
            currentStroke = null;
        }
        updatePage();
    }
}

// 处理触摸
function handleTouch(e) {
    e.preventDefault();
    if (e.type === 'touchstart') {
        startDraw(e);
        // startDraw 中会处理准心的显示
    } else if (e.type === 'touchmove') {
        // 只有在按下时才更新准心（删除模式下）
        if (isDrawing && currentMode === 'eraser') {
            updateCrosshair(e);
        }
        draw(e);
    } else if (e.type === 'touchend') {
        hideCrosshair();
        stopDraw(e);
    }
}

// 切换颜色面板
function toggleColorPanel(e) {
    e.stopPropagation();
    colorPanelOpen = !colorPanelOpen;
    const panel = document.querySelector('.color-presets-panel');
    if (panel) {
        panel.classList.toggle('open', colorPanelOpen);
    }
}

// 切换粗细面板
function toggleSizePanel(e) {
    e.stopPropagation();
    sizePanelOpen = !sizePanelOpen;
    const panel = document.querySelector('.size-presets-panel');
    if (panel) {
        panel.classList.toggle('open', sizePanelOpen);
    }
}

// 切换页面面板（绘图或文本）
function togglePagePanel(e, panelType) {
    e.stopPropagation();
    const isDraw = panelType === 'draw';
    
    // 切换当前面板状态
    if (isDraw) {
        drawPanelOpen = !drawPanelOpen;
        textPanelOpen = false;
    } else {
        textPanelOpen = !textPanelOpen;
        drawPanelOpen = false;
    }
    
    // 更新面板显示
    const currentPanel = document.getElementById(isDraw ? 'drawPagesPanel' : 'textPagesPanel');
    const otherPanel = document.getElementById(isDraw ? 'textPagesPanel' : 'drawPagesPanel');
    
    if (currentPanel) {
        currentPanel.classList.toggle('open', isDraw ? drawPanelOpen : textPanelOpen);
    }
    if (otherPanel) {
        otherPanel.classList.remove('open');
    }
    
    renderSidebar();
}

// 切换绘图页面面板
function toggleDrawPanel(e) {
    togglePagePanel(e, 'draw');
}

// 切换文本页面面板
function toggleTextPanel(e) {
    togglePagePanel(e, 'text');
}

// 设置颜色
function setColor(color) {
    currentColor = color;
    if (ctx) {
        ctx.strokeStyle = color;
    }
}

// 设置大小
function setSize(size) {
    currentSize = size;
    if (ctx) {
        ctx.lineWidth = size;
    }
    updateSizeButtons();
}

// 设置模式
function setMode(mode) {
    currentMode = mode;
    
    // 更新画布光标样式
    if (mode === 'drag') {
        if (canvas) {
            canvas.style.cursor = 'grab';
        }
        hideCrosshair();
    } else if (mode === 'eraser') {
        if (canvas) {
            canvas.style.cursor = 'default';
        }
        // 准心会在按下时显示
        hideCrosshair();
    } else {
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        hideCrosshair();
    }
}

// 更新准心位置
function updateCrosshair(e) {
    // 只有在删除模式下且正在绘制时才显示准心
    if (currentMode !== 'eraser' || !canvas || !isDrawing) {
        hideCrosshair();
        return;
    }
    
    const crosshair = document.getElementById('crosshair');
    if (!crosshair) return;
    
    const editorContent = document.querySelector('.editor-content');
    if (!editorContent) return;
    
    // 使用页面坐标（clientX/clientY），因为准心是相对于 editorContent 定位的
    let x, y;
    if (e.touches) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    
    const editorRect = editorContent.getBoundingClientRect();
    const tolerance = 10;
    const size = tolerance * 2;
    
    crosshair.style.display = 'block';
    crosshair.style.left = (x - editorRect.left - tolerance) + 'px';
    crosshair.style.top = (y - editorRect.top - tolerance) + 'px';
    crosshair.style.width = size + 'px';
    crosshair.style.height = size + 'px';
}

// 隐藏准心
function hideCrosshair() {
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.display = 'none';
    }
}

// 检测点是否在笔画上
function isPointOnStroke(x, y, stroke, tolerance = 10) {
    const points = stroke.points;
    if (points.length < 2) {
        // 单点笔画，检查距离
        const dx = x - points[0].x;
        const dy = y - points[0].y;
        return Math.sqrt(dx * dx + dy * dy) <= tolerance;
    }
    
    // 检查点到线段的距离
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        
        // 计算点到线段的距离
        const A = x - p1.x;
        const B = y - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        if (param < 0) {
            xx = p1.x;
            yy = p1.y;
        } else if (param > 1) {
            xx = p2.x;
            yy = p2.y;
        } else {
            xx = p1.x + param * C;
            yy = p1.y + param * D;
        }
        
        const dx = x - xx;
        const dy = y - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // 考虑笔画宽度
        const strokeWidth = stroke.size || 3;
        if (distance <= tolerance + strokeWidth / 2) {
            return true;
        }
    }
    
    return false;
}

// 检测线段是否与笔画相交
function isLineIntersectingStroke(x1, y1, x2, y2, stroke, tolerance = 10) {
    const points = stroke.points;
    if (points.length === 0) return false;
    
    if (points.length === 1) {
        // 单点笔画，检查点到线段的距离
        const dist = pointToLineDistance(points[0].x, points[0].y, x1, y1, x2, y2);
        const strokeWidth = stroke.size || 3;
        return dist <= tolerance + strokeWidth / 2;
    }
    
    // 检查线段是否与笔画的任何线段相交
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = stroke.points[i];
        const p2 = stroke.points[i + 1];
        
        // 检查两条线段是否相交或接近
        if (areLinesClose(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y, tolerance + (stroke.size || 3) / 2)) {
            return true;
        }
    }
    
    return false;
}

// 计算点到线段的距离
function pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
}

// 检查两条线段是否接近（考虑容差）
function areLinesClose(x1, y1, x2, y2, x3, y3, x4, y4, tolerance) {
    // 检查线段端点是否在另一条线段附近
    if (pointToLineDistance(x1, y1, x3, y3, x4, y4) <= tolerance) return true;
    if (pointToLineDistance(x2, y2, x3, y3, x4, y4) <= tolerance) return true;
    if (pointToLineDistance(x3, y3, x1, y1, x2, y2) <= tolerance) return true;
    if (pointToLineDistance(x4, y4, x1, y1, x2, y2) <= tolerance) return true;
    
    // 检查线段中间点
    const mid1x = (x1 + x2) / 2;
    const mid1y = (y1 + y2) / 2;
    const mid2x = (x3 + x4) / 2;
    const mid2y = (y3 + y4) / 2;
    
    if (pointToLineDistance(mid1x, mid1y, x3, y3, x4, y4) <= tolerance) return true;
    if (pointToLineDistance(mid2x, mid2y, x1, y1, x2, y2) <= tolerance) return true;
    
    return false;
}

// 删除指定位置的笔画
function deleteStrokeAt(x, y) {
    // 从后往前查找，删除最后一个匹配的笔画
    for (let i = strokes.length - 1; i >= 0; i--) {
        if (isPointOnStroke(x, y, strokes[i])) {
            strokes.splice(i, 1);
            redrawCanvas();
            return true;
        }
    }
    return false;
}

// 删除滑动路径上的笔画
function deleteStrokesAlongPath(x1, y1, x2, y2) {
    let deleted = false;
    // 从后往前查找，删除所有与路径相交的笔画
    for (let i = strokes.length - 1; i >= 0; i--) {
        if (isLineIntersectingStroke(x1, y1, x2, y2, strokes[i])) {
            strokes.splice(i, 1);
            deleted = true;
        }
    }
    if (deleted) {
        redrawCanvas();
    }
}

// 重绘画布
function redrawCanvas() {
    if (!canvas || !ctx) return;
    
    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 重绘所有笔画（不需要应用偏移量，因为笔画数据已经存储了正确的坐标）
    strokes.forEach(stroke => {
        if (stroke.points.length === 0) return;
        
        ctx.beginPath();
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        ctx.globalCompositeOperation = 'source-over';
        
        const firstPoint = stroke.points[0];
        ctx.moveTo(firstPoint.x, firstPoint.y);
        
        for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
        }
        
        ctx.stroke();
    });
}

// 清空画布
function clearCanvas() {
    if (confirm('确定要清空画布吗？')) {
        strokes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // 重置偏移量
        canvasOffsetX = 0;
        canvasOffsetY = 0;
        applyCanvasTransform();
        updatePage();
    }
}

