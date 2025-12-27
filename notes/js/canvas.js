// 画布绘制相关功能 - 使用Excalidraw的perfect-freehand算法

// 等待perfect-freehand库加载
(function checkPerfectFreehand() {
    if (typeof window !== 'undefined' && !window.getStroke) {
        // 库还在加载中，等待后重试
        if (window.perfectFreehandLoaded !== false) {
            setTimeout(checkPerfectFreehand, 100);
        } else {
            console.warn('perfect-freehand库加载失败，将使用降级绘制方案');
        }
    }
})();

// 获取调整后的粗细值（除了第一个粗细外，其他都调细）
function getAdjustedSize(size) {
    if (size === 1) {
        return size; // 第一个粗细保持不变
    }
    return size * 0.6; // 其他粗细调细到60%
}

// 将SVG路径转换为Path2D（用于检测碰撞）
function getSvgPathFromStroke(points) {
    if (!points || points.length === 0) return '';
    
    const max = points.length - 1;
    if (max < 1) return '';
    
    const med = (A, B) => [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    
    const pathData = points.reduce((acc, point, i, arr) => {
        if (i === max) {
            acc.push(point, med(point, arr[0]), 'L', arr[0], 'Z');
        } else {
            acc.push(point, med(point, arr[i + 1]));
        }
        return acc;
    }, ['M', points[0], 'Q']);
    
    return pathData.join(' ');
}

// 将十六进制颜色转换为带透明度的 rgba 颜色
function colorToRgba(hex, opacity) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// 使用perfect-freehand生成笔画路径
function generateStrokePath(points, strokeWidth) {
    if (!window.getStroke || !points || points.length === 0) {
        return null;
    }
    
    // 对于除了第一个粗细（1）之外的值，应用缩放因子来减小粗细
    const adjustedWidth = getAdjustedSize(strokeWidth);
    
    // Excalidraw的配置参数
    const options = {
        simulatePressure: true, // 模拟压感
        size: adjustedWidth * 4.25, // Excalidraw使用的尺寸倍数
        thinning: 0.6,
        smoothing: 0.5,
        streamline: 0.5,
        easing: (t) => Math.sin((t * Math.PI) / 2), // easeOutSine
        last: true,
    };
    
    // 将points转换为perfect-freehand需要的格式 [x, y, pressure?]
    const inputPoints = points.map(p => {
        if (Array.isArray(p)) {
            return p.length >= 3 ? [p[0], p[1], p[2]] : [p[0], p[1], 0.5];
        } else {
            // 兼容旧格式 {x, y}
            return [p.x, p.y, 0.5];
        }
    });
    
    try {
        const strokePoints = window.getStroke(inputPoints, options);
        return getSvgPathFromStroke(strokePoints);
    } catch (e) {
        console.error('生成笔画路径失败:', e);
        return null;
    }
}

// 绘制笔画（使用perfect-freehand生成的路径）
function drawStroke(ctx, stroke, fadeOpacity = 1) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;
    
    // 转换旧格式的点数据
    const points = stroke.points.map(p => {
        if (Array.isArray(p)) {
            return p;
        } else {
            return [p.x, p.y];
        }
    });
    
    // 根据 fadeOpacity 调整颜色透明度
    let strokeColor = stroke.color;
    if (fadeOpacity < 1) {
        // 如果颜色已经是 rgba 格式，需要解析
        if (stroke.color.startsWith('rgba')) {
            const match = stroke.color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
                strokeColor = `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${fadeOpacity})`;
            }
        } else if (stroke.color.startsWith('#')) {
            strokeColor = colorToRgba(stroke.color, fadeOpacity);
        }
    }
    
    const strokeSize = stroke.size || currentSize;
    const pathData = generateStrokePath(points, strokeSize);
    if (!pathData) {
        // 降级：如果生成路径失败，绘制简单路径
        const adjustedSize = getAdjustedSize(strokeSize);
        if (points.length === 1) {
            ctx.beginPath();
            ctx.arc(points[0][0] || points[0].x, points[0][1] || points[0].y, adjustedSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.fill();
            return;
        }
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = adjustedSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(points[0][0] || points[0].x, points[0][1] || points[0].y);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0] || points[i].x, points[i][1] || points[i].y);
        }
        ctx.stroke();
        return;
    }
    
    // 使用Path2D绘制路径
    const path = new Path2D(pathData);
    ctx.fillStyle = strokeColor;
    ctx.fill(path);
}

// 加载页面内容到画布
function loadPageContent() {
    if (!canvas || !ctx) return;
    
    // 切换页面时清空撤销/重做栈
    undoStack = [];
    redoStack = [];
    
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
            // 为没有 id 的旧笔画添加 id（兼容旧数据）
            strokes.forEach(stroke => {
                if (!stroke.id) {
                    stroke.id = generateId();
                }
            });
            redrawCanvas();
        } else if (activePage.imageData) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (offscreenCtx && offscreenCanvas) {
                    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
                    offscreenCtx.drawImage(img, 0, 0);
                    ctx.drawImage(offscreenCanvas, 0, 0);
                } else {
                    ctx.drawImage(img, 0, 0);
                }
            };
            img.src = activePage.imageData;
            strokes = [];
        } else {
            strokes = [];
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (offscreenCtx && offscreenCanvas) {
                offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
            }
        }
    } else {
        strokes = [];
    }
}

// 画布初始化
function initCanvas() {
    const editorContent = document.querySelector('.editor-content');
    if (!editorContent) return;

    editorContent.classList.add('canvas-mode');

    const oldCanvas = document.getElementById('canvas');
    if (oldCanvas) oldCanvas.remove();

    const canvasWidth = Math.max(window.innerWidth * 4, 5000);
    const canvasHeight = Math.max(window.innerHeight * 4, 5000);
    canvas = document.createElement('canvas');
    canvas.id = 'canvas';
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    editorContent.appendChild(canvas);

    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 创建离屏canvas用于存储已完成的笔画
    offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = canvasWidth;
    offscreenCanvas.height = canvasHeight;
    offscreenCtx = offscreenCanvas.getContext('2d');
    offscreenCtx.imageSmoothingEnabled = true;
    offscreenCtx.imageSmoothingQuality = 'high';

    // 设置初始偏移量，使画布居中显示
    canvasOffsetX = (editorContent.clientWidth - canvasWidth) / 2;
    canvasOffsetY = (editorContent.clientHeight - canvasHeight) / 2;
    applyCanvasTransform();

    // 加载页面内容
    loadPageContent();
    
    // 初始化撤销/重做按钮状态
    updateUndoRedoButtons();

    // 创建准心元素
    const oldCrosshair = document.getElementById('crosshair');
    if (oldCrosshair) oldCrosshair.remove();
    
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.display = 'none';
    editorContent.appendChild(crosshair);

    // 创建尾迹SVG元素
    const oldTrail = document.getElementById('eraser-trail');
    if (oldTrail) oldTrail.remove();
    
    const trailSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    trailSvg.id = 'eraser-trail';
    trailSvg.style.display = 'none';
    editorContent.appendChild(trailSvg);

    // 鼠标事件
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', (e) => {
        if (currentMode === 'select') {
            updateSelectionCursor(e);
        } else if (currentMode === 'eraser') {
            updateCrosshair(e);
            if (isDrawing) {
                updateEraserTrail(e);
            }
        }
        draw(e);
    });
    canvas.addEventListener('mouseup', stopDraw);
    canvas.addEventListener('mouseout', (e) => {
        if (currentMode === 'select') {
            canvas.style.cursor = 'default';
        } else if (currentMode !== 'eraser') {
            hideCrosshair();
        }
        stopDraw(e);
    });

    // 触摸事件
    canvas.addEventListener('touchstart', handleTouch, { passive: false });
    canvas.addEventListener('touchmove', handleTouch, { passive: false });
    canvas.addEventListener('touchend', handleTouch, { passive: false });
}

// 获取画布坐标
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
    return { x, y };
}

// 应用画布变换
function applyCanvasTransform() {
    if (canvas) {
        canvas.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px)`;
        canvas.style.transition = 'none';
    }
}

// 获取事件坐标
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

// 获取笔画的边界框
function getStrokeBounds(stroke) {
    if (!stroke || !stroke.points || stroke.points.length === 0) {
        return null;
    }
    
    const points = stroke.points.map(p => {
        if (Array.isArray(p)) {
            return { x: p[0], y: p[1] };
        }
        return p;
    });
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    
    const strokeSize = stroke.size || currentSize;
    const adjustedSize = getAdjustedSize(strokeSize);
    const padding = adjustedSize * 4.25 / 2;
    
    return {
        x1: minX - padding,
        y1: minY - padding,
        x2: maxX + padding,
        y2: maxY + padding,
        width: maxX - minX + padding * 2,
        height: maxY - minY + padding * 2
    };
}

// 获取所有选中笔画的共同边界框
function getSelectionBounds() {
    if (selectedStrokeIds.size === 0) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let hasBounds = false;
    
    strokes.forEach(stroke => {
        if (stroke.id && selectedStrokeIds.has(stroke.id)) {
            const bounds = getStrokeBounds(stroke);
            if (bounds) {
                minX = Math.min(minX, bounds.x1);
                minY = Math.min(minY, bounds.y1);
                maxX = Math.max(maxX, bounds.x2);
                maxY = Math.max(maxY, bounds.y2);
                hasBounds = true;
            }
        }
    });
    
    if (!hasBounds) return null;
    
    return {
        x1: minX,
        y1: minY,
        x2: maxX,
        y2: maxY,
        width: maxX - minX,
        height: maxY - minY,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
    };
}

// 检测点是否在选择框内
function isPointInSelectionBox(x, y, box) {
    if (!box) return false;
    const minX = Math.min(box.x1, box.x2);
    const maxX = Math.max(box.x1, box.x2);
    const minY = Math.min(box.y1, box.y2);
    const maxY = Math.max(box.y1, box.y2);
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
}

// 检测笔画是否在选择框内
function isStrokeInSelectionBox(stroke, box) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return false;
    
    const points = stroke.points.map(p => {
        if (Array.isArray(p)) {
            return { x: p[0], y: p[1] };
        }
        return p;
    });
    
    // 检查是否至少有一个点在框内，或者笔画与框相交
    for (let p of points) {
        if (isPointInSelectionBox(p.x, p.y, box)) {
            return true;
        }
    }
    
    // 检查笔画边界框是否与选择框相交
    const bounds = getStrokeBounds(stroke);
    if (!bounds) return false;
    
    const boxMinX = Math.min(box.x1, box.x2);
    const boxMaxX = Math.max(box.x1, box.x2);
    const boxMinY = Math.min(box.y1, box.y2);
    const boxMaxY = Math.max(box.y1, box.y2);
    
    return !(bounds.x2 < boxMinX || bounds.x1 > boxMaxX || 
             bounds.y2 < boxMinY || bounds.y1 > boxMaxY);
}

// 检测点击是否在变换控制点上
function getTransformHandleAt(x, y, bounds) {
    if (!bounds || selectedStrokeIds.size === 0) return null;
    
    const HANDLE_SIZE = 8;
    const handles = [
        { type: 'nw', x: bounds.x1, y: bounds.y1 },
        { type: 'ne', x: bounds.x2, y: bounds.y1 },
        { type: 'sw', x: bounds.x1, y: bounds.y2 },
        { type: 'se', x: bounds.x2, y: bounds.y2 },
        { type: 'n', x: bounds.centerX, y: bounds.y1 },
        { type: 's', x: bounds.centerX, y: bounds.y2 },
        { type: 'w', x: bounds.x1, y: bounds.centerY },
        { type: 'e', x: bounds.x2, y: bounds.centerY }
    ];
    
    for (let handle of handles) {
        const dx = x - handle.x;
        const dy = y - handle.y;
        if (Math.sqrt(dx * dx + dy * dy) <= HANDLE_SIZE) {
            return handle.type;
        }
    }
    
    return null;
}

// 根据变换控制点类型获取光标样式
function getCursorForTransformHandle(handleType) {
    if (!handleType) return 'default';
    
    switch (handleType) {
        case 'n':
        case 's':
            return 'ns-resize'; // 上下缩放
        case 'w':
        case 'e':
            return 'ew-resize'; // 左右缩放
        case 'nw':
        case 'se':
            return 'nwse-resize'; // 左上-右下缩放
        case 'ne':
        case 'sw':
            return 'nesw-resize'; // 右上-左下缩放
        default:
            return 'default';
    }
}

// 更新选择模式下的光标
function updateSelectionCursor(e) {
    if (!canvas || currentMode !== 'select') return;
    
    // 如果正在缩放，保持缩放光标
    if (isResizingSelection && resizeHandle) {
        canvas.style.cursor = getCursorForTransformHandle(resizeHandle);
        return;
    }
    
    // 如果正在移动，显示移动光标
    if (isMovingSelection) {
        canvas.style.cursor = 'move';
        return;
    }
    
    // 检测鼠标位置
    const pos = getCanvasPos(e);
    const bounds = getSelectionBounds();
    
    if (bounds) {
        // 检测是否在变换控制点上
        const handle = getTransformHandleAt(pos.x, pos.y, bounds);
        if (handle) {
            canvas.style.cursor = getCursorForTransformHandle(handle);
            return;
        }
        
        // 检测是否在选中区域内（可移动）
        if (isPointInSelectionBox(pos.x, pos.y, bounds)) {
            canvas.style.cursor = 'move';
            return;
        }
    }
    
    // 默认光标
    canvas.style.cursor = 'default';
}

// 绘制选择框和变换控制点
function drawSelectionBox() {
    if (selectedStrokeIds.size === 0) return;
    
    const bounds = getSelectionBounds();
    if (!bounds) return;
    
    // 绘制虚线边界框
    ctx.save();
    ctx.strokeStyle = '#0066FF';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(bounds.x1, bounds.y1, bounds.width, bounds.height);
    
    // 绘制变换控制点
    const HANDLE_SIZE = 6;
    ctx.fillStyle = '#0066FF';
    ctx.setLineDash([]);
    
    // 四个角
    ctx.fillRect(bounds.x1 - HANDLE_SIZE/2, bounds.y1 - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillRect(bounds.x2 - HANDLE_SIZE/2, bounds.y1 - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillRect(bounds.x1 - HANDLE_SIZE/2, bounds.y2 - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillRect(bounds.x2 - HANDLE_SIZE/2, bounds.y2 - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    
    // 四个边中点
    ctx.fillRect(bounds.centerX - HANDLE_SIZE/2, bounds.y1 - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillRect(bounds.centerX - HANDLE_SIZE/2, bounds.y2 - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillRect(bounds.x1 - HANDLE_SIZE/2, bounds.centerY - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    ctx.fillRect(bounds.x2 - HANDLE_SIZE/2, bounds.centerY - HANDLE_SIZE/2, HANDLE_SIZE, HANDLE_SIZE);
    
    ctx.restore();
}

// 绘制选择框（临时框选时）
function drawSelectionBoxTemp() {
    if (!selectionBox || !isSelecting) return;
    
    // 在主canvas上绘制临时选择框（在已有内容之上）
    ctx.save();
    ctx.strokeStyle = '#0066FF';
    ctx.fillStyle = 'rgba(0, 102, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    const x = Math.min(selectionBox.x1, selectionBox.x2);
    const y = Math.min(selectionBox.y1, selectionBox.y2);
    const w = Math.abs(selectionBox.x2 - selectionBox.x1);
    const h = Math.abs(selectionBox.y2 - selectionBox.y1);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}

// 移动选中的笔画
function moveSelectedStrokes(dx, dy) {
    strokes.forEach(stroke => {
        if (stroke.id && selectedStrokeIds.has(stroke.id)) {
            stroke.points = stroke.points.map(p => {
                if (Array.isArray(p)) {
                    return [p[0] + dx, p[1] + dy];
                }
                return { x: p.x + dx, y: p.y + dy };
            });
        }
    });
}

// 缩放选中的笔画
function scaleSelectedStrokes(scaleX, scaleY, centerX, centerY) {
    strokes.forEach(stroke => {
        if (stroke.id && selectedStrokeIds.has(stroke.id)) {
            stroke.points = stroke.points.map(p => {
                let x, y;
                if (Array.isArray(p)) {
                    x = p[0];
                    y = p[1];
                } else {
                    x = p.x;
                    y = p.y;
                }
                
                // 相对于中心点缩放
                const newX = centerX + (x - centerX) * scaleX;
                const newY = centerY + (y - centerY) * scaleY;
                
                if (Array.isArray(p)) {
                    return [newX, newY];
                }
                return { x: newX, y: newY };
            });
        }
    });
}

// 更改选中笔画的颜色（全局函数，供HTML调用）
function changeSelectedStrokesColor(color) {
    if (selectedStrokeIds.size === 0) return;
    
    saveStateToHistory();
    strokes.forEach(stroke => {
        if (stroke.id && selectedStrokeIds.has(stroke.id)) {
            stroke.color = color;
        }
    });
    redrawCanvas();
    updatePage();
    updateUndoRedoButtons();
}

// 将函数暴露为全局函数
window.changeSelectedStrokesColor = changeSelectedStrokesColor;

// 开始绘制
function startDraw(e) {
    e.preventDefault();
    
    if (currentMode === 'drag') {
        startDrag(e);
        return;
    }
    
    const pos = getCanvasPos(e);
    
    if (currentMode === 'select') {
        const bounds = getSelectionBounds();
        const handle = bounds ? getTransformHandleAt(pos.x, pos.y, bounds) : null;
        
        if (handle) {
            // 开始缩放
            isResizingSelection = true;
            resizeHandle = handle;
            resizeStartBounds = { ...bounds };
            resizeStartX = pos.x;
            resizeStartY = pos.y;
            saveStateToHistory();
        } else if (bounds && isPointInSelectionBox(pos.x, pos.y, bounds)) {
            // 开始移动
            isMovingSelection = true;
            moveStartX = pos.x;
            moveStartY = pos.y;
            saveStateToHistory();
        } else {
            // 开始框选
            isSelecting = true;
            selectionStartX = pos.x;
            selectionStartY = pos.y;
            selectionBox = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
            selectedStrokeIds.clear();
        }
        return;
    }
    
    if (currentMode === 'eraser') {
        isDrawing = true;
        lastEraserPos = pos;
        updateCrosshair(e);
        // 清空待删除集合，开始新的橡皮擦操作
        strokesToDelete.clear();
        // 初始化尾迹
        eraserTrailPoints = [];
        const editorContent = document.querySelector('.editor-content');
        if (editorContent) {
            const editorRect = editorContent.getBoundingClientRect();
            let x, y;
            if (e.touches) {
                x = e.touches[0].clientX;
                y = e.touches[0].clientY;
            } else {
                x = e.clientX;
                y = e.clientY;
            }
            const relX = x - editorRect.left;
            const relY = y - editorRect.top;
            eraserTrailPoints.push({ x: relX, y: relY, time: performance.now() });
        }
        // 在开始删除前保存状态
        saveStateToHistory();
        deleteStrokeAt(pos.x, pos.y);
        return;
    }
    
    // 在开始绘制前保存当前状态（这样撤销时能回到绘制前的状态）
    // 但只有在撤销栈为空时才保存，避免重复保存相同状态
    if (undoStack.length === 0 || JSON.stringify(strokes) !== JSON.stringify(undoStack[undoStack.length - 1])) {
        saveStateToHistory();
    }
    
    isDrawing = true;
    
    // 将离屏canvas的内容复制到主canvas
    if (offscreenCanvas && offscreenCtx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreenCanvas, 0, 0);
    }
    
    // 创建新笔画 - 使用数组格式 [x, y]
    currentStroke = {
        id: generateId(),
        points: [[pos.x, pos.y]], // 使用数组格式，兼容perfect-freehand
        color: currentColor,
        size: currentSize
    };
    strokes.push(currentStroke);
}

// 绘制
function draw(e) {
    e.preventDefault();
    
    if (currentMode === 'drag') {
        handleDrag(e);
        return;
    }
    
    if (currentMode === 'select') {
        const pos = getCanvasPos(e);
        
        if (isResizingSelection && resizeHandle && resizeStartBounds) {
            // 更新光标为缩放光标
            if (canvas) {
                canvas.style.cursor = getCursorForTransformHandle(resizeHandle);
            }
            
            // 缩放选中内容
            const dx = pos.x - resizeStartX;
            const dy = pos.y - resizeStartY;
            
            let scaleX = 1, scaleY = 1;
            const centerX = resizeStartBounds.centerX;
            const centerY = resizeStartBounds.centerY;
            
            if (resizeHandle.includes('e')) {
                scaleX = Math.max(0.1, (resizeStartBounds.width + dx) / resizeStartBounds.width);
            } else if (resizeHandle.includes('w')) {
                scaleX = Math.max(0.1, (resizeStartBounds.width - dx) / resizeStartBounds.width);
            }
            
            if (resizeHandle.includes('s')) {
                scaleY = Math.max(0.1, (resizeStartBounds.height + dy) / resizeStartBounds.height);
            } else if (resizeHandle.includes('n')) {
                scaleY = Math.max(0.1, (resizeStartBounds.height - dy) / resizeStartBounds.height);
            }
            
            // 如果是角点，保持宽高比
            if (['nw', 'ne', 'sw', 'se'].includes(resizeHandle)) {
                const avgScale = (scaleX + scaleY) / 2;
                scaleX = avgScale;
                scaleY = avgScale;
            }
            
            // 先恢复到原始状态
            if (undoStack.length > 0) {
                const previousState = undoStack[undoStack.length - 1];
                strokes = previousState.map(stroke => ({
                    id: stroke.id,
                    points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
                    color: stroke.color,
                    size: stroke.size
                }));
            }
            
            scaleSelectedStrokes(scaleX, scaleY, centerX, centerY);
            redrawCanvas();
        } else if (isMovingSelection) {
            // 更新光标为移动光标
            if (canvas) {
                canvas.style.cursor = 'move';
            }
            // 移动选中内容
            const dx = pos.x - moveStartX;
            const dy = pos.y - moveStartY;
            
            // 先恢复到原始状态
            if (undoStack.length > 0) {
                const previousState = undoStack[undoStack.length - 1];
                strokes = previousState.map(stroke => ({
                    id: stroke.id,
                    points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
                    color: stroke.color,
                    size: stroke.size
                }));
            }
            
            moveSelectedStrokes(dx, dy);
            redrawCanvas();
        } else if (isSelecting && selectionBox) {
            // 更新选择框
            selectionBox.x2 = pos.x;
            selectionBox.y2 = pos.y;
            
            // 检测选中的笔画
            selectedStrokeIds.clear();
            strokes.forEach(stroke => {
                if (stroke.id && isStrokeInSelectionBox(stroke, selectionBox)) {
                    selectedStrokeIds.add(stroke.id);
                }
            });
            
            // 重绘并显示选择框
            redrawCanvas();
            drawSelectionBoxTemp();
        }
        return;
    }
    
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    
    if (currentMode === 'eraser') {
        if (lastEraserPos) {
            deleteStrokesAlongPath(lastEraserPos.x, lastEraserPos.y, pos.x, pos.y);
        } else {
            deleteStrokeAt(pos.x, pos.y);
        }
        lastEraserPos = pos;
        return;
    }
    
    if (!currentStroke) return;
    
    // 添加当前点到笔画
    currentStroke.points.push([pos.x, pos.y]);
    
    // 使用perfect-freehand实时绘制当前笔画
    const pathData = generateStrokePath(currentStroke.points, currentStroke.size);
    if (pathData) {
        // 清除当前笔画区域（近似）
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(offscreenCanvas, 0, 0);
        
        // 绘制当前笔画
        const path = new Path2D(pathData);
        ctx.fillStyle = currentStroke.color;
        ctx.fill(path);
    }
}

// 停止绘制
function stopDraw(e) {
    if (currentMode === 'drag') {
        stopDrag();
        return;
    }
    
    if (currentMode === 'select') {
        if (isResizingSelection) {
            isResizingSelection = false;
            resizeHandle = null;
            resizeStartBounds = null;
            redrawCanvas();
            updatePage();
            updateUndoRedoButtons();
        } else if (isMovingSelection) {
            isMovingSelection = false;
            redrawCanvas();
            updatePage();
            updateUndoRedoButtons();
        } else if (isSelecting) {
            isSelecting = false;
            selectionBox = null;
            redrawCanvas();
        }
        return;
    }
    
    if (isDrawing) {
        isDrawing = false;
        
        if (currentMode === 'eraser') {
            // 真正删除被标记的笔画
            if (strokesToDelete.size > 0) {
                strokes = strokes.filter(stroke => !(stroke.id && strokesToDelete.has(stroke.id)));
                strokesToDelete.clear();
                redrawCanvas();
                updatePage();
                updateUndoRedoButtons();
            }
            lastEraserPos = null;
            // 清除尾迹（带延迟，让尾迹自然消失）
            setTimeout(() => {
                clearEraserTrail();
            }, 150); // 减小延迟时间，与衰减时间一致
        } else if (currentStroke) {
            // 将当前完成的笔画保存到离屏canvas
            saveCurrentStrokeToOffscreen();
            currentStroke = null;
            updatePage();
            updateUndoRedoButtons();
        }
    }
}

// 将当前笔画保存到离屏canvas
function saveCurrentStrokeToOffscreen() {
    if (!currentStroke || !offscreenCtx || !offscreenCanvas || currentStroke.points.length === 0) return;
    
    // 将主canvas的当前内容复制到离屏canvas
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    offscreenCtx.drawImage(canvas, 0, 0);
}

// 处理触摸
function handleTouch(e) {
    e.preventDefault();
    if (e.type === 'touchstart') {
        startDraw(e);
    } else if (e.type === 'touchmove') {
        if (currentMode === 'eraser') {
            updateCrosshair(e);
        }
        if (isDrawing && currentMode === 'eraser') {
            updateEraserTrail(e);
        }
        draw(e);
    } else if (e.type === 'touchend') {
        if (currentMode !== 'eraser') {
            hideCrosshair();
        }
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

// 切换页面面板
function togglePagePanel(e, panelType) {
    e.stopPropagation();
    const isDraw = panelType === 'draw';
    
    if (isDraw) {
        drawPanelOpen = !drawPanelOpen;
        textPanelOpen = false;
    } else {
        textPanelOpen = !textPanelOpen;
        drawPanelOpen = false;
    }
    
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
    // 更新颜色按钮显示
    const colorTrigger = document.querySelector('.color-trigger span');
    if (colorTrigger) {
        colorTrigger.style.backgroundColor = color;
    }
}

// 设置大小
function setSize(size) {
    currentSize = size;
    updateSizeButtons();
}

// 设置模式
function setMode(mode) {
    // 如果从橡皮擦模式切换到其他模式，清空待删除集合并重绘
    if (currentMode === 'eraser' && mode !== 'eraser') {
        strokesToDelete.clear();
        redrawCanvas();
    }
    // 如果从选择模式切换到其他模式，清除选择
    if (currentMode === 'select' && mode !== 'select') {
        selectedStrokeIds.clear();
        selectionBox = null;
        redrawCanvas();
    }
    currentMode = mode;
    
    if (mode === 'drag') {
        if (canvas) {
            canvas.style.cursor = 'grab';
        }
        hideCrosshair();
    } else if (mode === 'eraser') {
        if (canvas) {
            canvas.style.cursor = 'none'; // 隐藏默认cursor，使用自定义准心
        }
        clearEraserTrail();
    } else if (mode === 'select') {
        if (canvas) {
            canvas.style.cursor = 'default';
        }
        hideCrosshair();
        // 清除选择相关的状态
        selectedStrokeIds.clear();
        selectionBox = null;
        isSelecting = false;
        isMovingSelection = false;
        isResizingSelection = false;
    } else {
        if (canvas) {
            canvas.style.cursor = 'crosshair';
        }
        hideCrosshair();
    }
}

// 更新准心位置
function updateCrosshair(e) {
    if (currentMode !== 'eraser' || !canvas) {
        hideCrosshair();
        return;
    }
    
    const crosshair = document.getElementById('crosshair');
    if (!crosshair) return;
    
    const editorContent = document.querySelector('.editor-content');
    if (!editorContent) return;
    
    let x, y;
    if (e.touches) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    
    const editorRect = editorContent.getBoundingClientRect();
    
    crosshair.style.display = 'block';
    crosshair.style.left = (x - editorRect.left) + 'px';
    crosshair.style.top = (y - editorRect.top) + 'px';
}

// 隐藏准心
function hideCrosshair() {
    const crosshair = document.getElementById('crosshair');
    if (crosshair) {
        crosshair.style.display = 'none';
    }
}

// 更新橡皮擦尾迹
function updateEraserTrail(e) {
    const trailSvg = document.getElementById('eraser-trail');
    if (!trailSvg) return;
    
    const editorContent = document.querySelector('.editor-content');
    if (!editorContent) return;
    
    let x, y;
    if (e.touches) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
    } else {
        x = e.clientX;
        y = e.clientY;
    }
    
    const editorRect = editorContent.getBoundingClientRect();
    const relX = x - editorRect.left;
    const relY = y - editorRect.top;
    
    // 添加当前点到尾迹路径
    eraserTrailPoints.push({ x: relX, y: relY, time: performance.now() });
    
    // 限制尾迹点数，只保留最近的点
    const MAX_POINTS = 50;
    if (eraserTrailPoints.length > MAX_POINTS) {
        eraserTrailPoints.shift();
    }
    
    // 设置SVG尺寸
    trailSvg.setAttribute('width', editorContent.offsetWidth);
    trailSvg.setAttribute('height', editorContent.offsetHeight);
    trailSvg.style.display = 'block';
    
    // 开始动画循环来更新尾迹
    if (!eraserTrailAnimationFrame) {
        animateEraserTrail();
    }
}

// 动画更新尾迹（持续更新，让旧路径逐渐消失）
function animateEraserTrail() {
    const trailSvg = document.getElementById('eraser-trail');
    if (!trailSvg) {
        eraserTrailAnimationFrame = null;
        return;
    }
    
    const DECAY_TIME = 120; // 减小衰减时间，让尾迹消失更快
    const DECAY_LENGTH = 10;
    const now = performance.now();
    
    // 移除超过衰减时间的旧点
    eraserTrailPoints = eraserTrailPoints.filter(p => now - p.time < DECAY_TIME);
    
    // 清除旧的路径元素
    trailSvg.innerHTML = '';
    
    if (eraserTrailPoints.length < 2) {
        eraserTrailAnimationFrame = null;
        return;
    }
    
    // 使用perfect-freehand生成平滑的填充路径
    if (window.getStroke && eraserTrailPoints.length >= 2) {
        try {
            // 应用sizeMapping来实现衰减效果
            // 根据存在时间调整每个点的大小，让尾迹随着时间逐渐变细
            const easeOut = (k) => 1 - Math.pow(1 - k, 4); // excalidraw使用的easeOut函数
            
            const inputPoints = eraserTrailPoints.map((p, index) => {
                // 计算点的年龄（0表示最新，1表示最旧）
                const age = (now - p.time) / DECAY_TIME;
                
                // 使用更陡峭的衰减曲线，让变细效果更明显
                // t值：1表示最新（最粗），0表示最旧（最细）
                const t = Math.max(0, 1 - age);
                // 使用平方根让衰减更快，效果更明显
                const sizeFactor = Math.pow(easeOut(t), 0.7);
                
                // 将sizeFactor映射到pressure，范围从0.0到1.0，让变细效果更明显
                // thinning值越大，pressure的影响越明显
                // 旧的点的pressure更小，所以会更细
                const pressure = sizeFactor;
                
                return [p.x, p.y, pressure];
            });
            
            const options = {
                simulatePressure: false, // 使用实际的pressure值
                size: 1.5 * 4.25, // 基础大小，再次减小初始粗细
                thinning: 0.8, // 使用thinning让pressure影响大小，值越大变细效果越明显
                smoothing: 0.5,
                streamline: 0.2, // excalidraw使用0.2
                easing: (t) => Math.sin((t * Math.PI) / 2), // easeOutSine
                last: true,
            };
            
            const strokePoints = window.getStroke(inputPoints, options);
            const pathData = getSvgPathFromStroke(strokePoints);
            
            if (pathData) {
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', pathData);
                path.setAttribute('fill', 'rgba(0, 0, 0, 0.2)');
                path.setAttribute('stroke', 'none');
                trailSvg.appendChild(path);
            }
        } catch (err) {
            console.warn('生成尾迹路径失败:', err);
        }
    }
    
    // 降级方案：使用简单的填充路径
    if (trailSvg.children.length === 0 && eraserTrailPoints.length >= 2) {
        // 使用perfect-freehand但使用固定的pressure
        if (window.getStroke) {
            try {
                const inputPoints = eraserTrailPoints.map(p => [p.x, p.y, 0.5]);
                const options = {
                    simulatePressure: true,
                    size: 3 * 4.25, // 减小以让尾迹更细
                    thinning: 0,
                    smoothing: 0.5,
                    streamline: 0.2,
                    last: true,
                };
                const strokePoints = window.getStroke(inputPoints, options);
                const pathData = getSvgPathFromStroke(strokePoints);
                
                if (pathData) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', pathData);
                    path.setAttribute('fill', 'rgba(0, 0, 0, 0.2)');
                    path.setAttribute('stroke', 'none');
                    trailSvg.appendChild(path);
                }
            } catch (err) {
                // 降级到最简单的方案
            }
        }
        
        // 最简单的降级方案：使用stroke
        if (trailSvg.children.length === 0) {
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            let pathData = '';
            eraserTrailPoints.forEach((p, i) => {
                if (i === 0) {
                    pathData += `M ${p.x} ${p.y}`;
                } else {
                    pathData += ` L ${p.x} ${p.y}`;
                }
            });
            path.setAttribute('d', pathData);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', 'rgba(0, 0, 0, 0.2)');
            path.setAttribute('stroke-width', '3'); // 减小以让尾迹更细
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');
            trailSvg.appendChild(path);
        }
    }
    
    // 继续动画循环
    if (eraserTrailPoints.length > 0) {
        eraserTrailAnimationFrame = requestAnimationFrame(animateEraserTrail);
    } else {
        eraserTrailAnimationFrame = null;
    }
}

// 清除橡皮擦尾迹
function clearEraserTrail() {
    // 停止动画循环
    if (eraserTrailAnimationFrame) {
        cancelAnimationFrame(eraserTrailAnimationFrame);
        eraserTrailAnimationFrame = null;
    }
    
    const trailSvg = document.getElementById('eraser-trail');
    if (trailSvg) {
        trailSvg.innerHTML = '';
        trailSvg.style.display = 'none';
    }
    eraserTrailPoints = [];
}

// 检测点是否在笔画路径上
function isPointOnStroke(x, y, stroke, tolerance = 15) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return false;
    
    // 转换点格式
    const points = stroke.points.map(p => {
        if (Array.isArray(p)) {
            return { x: p[0], y: p[1] };
        }
        return p;
    });
    
    // 检查是否在笔画的边界框内
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(p => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
    });
    
    const strokeSize = stroke.size || currentSize;
    const adjustedSize = getAdjustedSize(strokeSize);
    const strokeWidth = adjustedSize * 4.25;
    if (x < minX - strokeWidth || x > maxX + strokeWidth || 
        y < minY - strokeWidth || y > maxY + strokeWidth) {
        return false;
    }
    
    // 检查点到路径的距离（简化版本）
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const dx = x - p.x;
        const dy = y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= tolerance + strokeWidth / 2) {
            return true;
        }
    }
    
    // 检查点到线段的距离
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        const dist = pointToLineDistance(x, y, p1.x, p1.y, p2.x, p2.y);
        if (dist <= tolerance + strokeWidth / 2) {
            return true;
        }
    }
    
    return false;
}

// 检测线段是否与笔画相交
function isLineIntersectingStroke(x1, y1, x2, y2, stroke, tolerance = 15) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return false;
    
    // 转换点格式
    const points = stroke.points.map(p => {
        if (Array.isArray(p)) {
            return { x: p[0], y: p[1] };
        }
        return p;
    });
    
    const strokeSize = stroke.size || currentSize;
    const adjustedSize = getAdjustedSize(strokeSize);
    const strokeWidth = adjustedSize * 4.25;
    
    if (points.length === 1) {
        const dist = pointToLineDistance(points[0].x, points[0].y, x1, y1, x2, y2);
        return dist <= tolerance + strokeWidth / 2;
    }
    
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (areLinesClose(x1, y1, x2, y2, p1.x, p1.y, p2.x, p2.y, tolerance + strokeWidth / 2)) {
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

// 检查两条线段是否接近
function areLinesClose(x1, y1, x2, y2, x3, y3, x4, y4, tolerance) {
    if (pointToLineDistance(x1, y1, x3, y3, x4, y4) <= tolerance) return true;
    if (pointToLineDistance(x2, y2, x3, y3, x4, y4) <= tolerance) return true;
    if (pointToLineDistance(x3, y3, x1, y1, x2, y2) <= tolerance) return true;
    if (pointToLineDistance(x4, y4, x1, y1, x2, y2) <= tolerance) return true;
    
    const mid1x = (x1 + x2) / 2;
    const mid1y = (y1 + y2) / 2;
    const mid2x = (x3 + x4) / 2;
    const mid2y = (y3 + y4) / 2;
    
    if (pointToLineDistance(mid1x, mid1y, x3, y3, x4, y4) <= tolerance) return true;
    if (pointToLineDistance(mid2x, mid2y, x1, y1, x2, y2) <= tolerance) return true;
    
    return false;
}

// 标记指定位置的笔画为待删除
function deleteStrokeAt(x, y) {
    let marked = false;
    for (let i = strokes.length - 1; i >= 0; i--) {
        if (isPointOnStroke(x, y, strokes[i]) && strokes[i].id) {
            strokesToDelete.add(strokes[i].id);
            marked = true;
        }
    }
    if (marked) {
        redrawCanvas();
    }
    return marked;
}

// 标记滑动路径上的笔画为待删除
function deleteStrokesAlongPath(x1, y1, x2, y2) {
    let marked = false;
    for (let i = strokes.length - 1; i >= 0; i--) {
        if (isLineIntersectingStroke(x1, y1, x2, y2, strokes[i]) && strokes[i].id) {
            strokesToDelete.add(strokes[i].id);
            marked = true;
        }
    }
    if (marked) {
        redrawCanvas();
    }
}

// 重绘画布
function redrawCanvas() {
    if (!canvas || !ctx || !offscreenCanvas || !offscreenCtx) return;
    
    offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
    
    // 在离屏canvas上绘制所有未标记为待删除的笔画
    strokes.forEach(stroke => {
        if (stroke.id && !strokesToDelete.has(stroke.id)) {
            drawStroke(offscreenCtx, stroke);
        } else if (!stroke.id) {
            // 兼容没有 id 的旧笔画
            drawStroke(offscreenCtx, stroke);
        }
    });
    
    // 在主canvas上先绘制离屏canvas的内容
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offscreenCanvas, 0, 0);
    
    // 在主canvas上绘制待删除的笔画（变浅显示）
    strokes.forEach(stroke => {
        if (stroke.id && strokesToDelete.has(stroke.id)) {
            drawStroke(ctx, stroke, 0.3); // 使用30%的透明度
        }
    });
    
    // 绘制选择框和变换控制点
    if (currentMode === 'select') {
        drawSelectionBox();
    }
}

// 清空画布
function clearCanvas() {
    if (confirm('确定要清空画布吗？')) {
        saveStateToHistory(); // 保存清空前的状态
        strokes = [];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (offscreenCtx) {
            offscreenCtx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        }
        canvasOffsetX = 0;
        canvasOffsetY = 0;
        applyCanvasTransform();
        updatePage();
        updateUndoRedoButtons();
    }
}

// 保存当前状态到历史记录
function saveStateToHistory() {
    if (!state.activePageId) return;
    
    // 深拷贝当前笔画数组
    const strokesCopy = strokes.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
        color: stroke.color,
        size: stroke.size
    }));
    
    // 添加到撤销栈
    undoStack.push(strokesCopy);
    
    // 限制历史记录数量
    if (undoStack.length > MAX_HISTORY_SIZE) {
        undoStack.shift();
    }
    
    // 清空重做栈（新的操作会清除重做历史）
    redoStack = [];
}

// 撤销操作
function undo() {
    // 如果撤销栈为空，但当前有笔画，先保存当前状态到撤销栈
    if (undoStack.length === 0 && strokes.length > 0) {
        const currentState = strokes.map(stroke => ({
            id: stroke.id,
            points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
            color: stroke.color,
            size: stroke.size
        }));
        undoStack.push(currentState);
    }
    
    if (undoStack.length === 0) return;
    
    // 保存当前状态到重做栈
    const currentState = strokes.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
        color: stroke.color,
        size: stroke.size
    }));
    redoStack.push(currentState);
    
    // 从撤销栈恢复上一个状态
    const previousState = undoStack.pop();
    strokes = previousState.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
        color: stroke.color,
        size: stroke.size
    }));
    
    // 重绘画布
    redrawCanvas();
    updatePage();
    updateUndoRedoButtons();
}

// 重做操作
function redo() {
    if (redoStack.length === 0) return;
    
    // 保存当前状态到撤销栈
    const currentState = strokes.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
        color: stroke.color,
        size: stroke.size
    }));
    undoStack.push(currentState);
    
    // 从重做栈恢复下一个状态
    const nextState = redoStack.pop();
    strokes = nextState.map(stroke => ({
        id: stroke.id,
        points: stroke.points.map(p => Array.isArray(p) ? [...p] : { ...p }),
        color: stroke.color,
        size: stroke.size
    }));
    
    // 重绘画布
    redrawCanvas();
    updatePage();
    updateUndoRedoButtons();
}

// 更新撤销/重做按钮状态
function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (undoBtn) {
        undoBtn.disabled = undoStack.length === 0;
        undoBtn.style.opacity = undoStack.length === 0 ? '0.5' : '1';
    }
    
    if (redoBtn) {
        redoBtn.disabled = redoStack.length === 0;
        redoBtn.style.opacity = redoStack.length === 0 ? '0.5' : '1';
    }
}
