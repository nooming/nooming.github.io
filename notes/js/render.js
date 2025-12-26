// UI渲染

// 渲染单个页面列表项
function renderPageListItem(page, panelType) {
    const isActive = state.activePageId === page.id;
    const isEditing = editingPageId === page.id;
    const isSelected = selectedPageIds.includes(page.id);
    const panelId = panelType === 'draw' ? 'drawPagesPanel' : 'textPagesPanel';
    const panelVar = panelType === 'draw' ? 'drawPanelOpen' : 'textPanelOpen';

    if (multiSelectMode) {
        return `
            <div class="page-list-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}">
                <label class="page-checkbox">
                    <input type="checkbox" 
                        ${isSelected ? 'checked' : ''}
                        onchange="togglePageSelection('${page.id}', this.checked)">
                    <span class="page-name">${page.title}</span>
                </label>
            </div>
        `;
    }
    
    if (isEditing) {
        return `
            <div class="page-list-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}">
                <input class="edit-input" 
                    value="${page.title}" 
                    onblur="updatePageTitle('${page.id}', this.value); editingPageId = null; render();"
                    onkeydown="if(event.key === 'Enter') { updatePageTitle('${page.id}', this.value); editingPageId = null; render(); } else if(event.key === 'Escape') { editingPageId = null; render(); }"
                    autofocus>
            </div>
        `;
    }
    
    return `
        <div class="page-list-item ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}">
            <span class="page-name" 
                onclick="setActive('${page.id}'); ${panelVar} = false; const panel = document.getElementById('${panelId}'); if (panel) panel.classList.remove('open');" 
                ondblclick="editingPageId = '${page.id}'; render();">
                ${page.title}
            </span>
            <button class="btn-icon-small" 
                onclick="event.stopPropagation(); editingPageId = '${page.id}'; render();" 
                title="重命名">✏️</button>
            <button class="btn-icon-small" 
                onclick="event.stopPropagation(); deletePage('${page.id}')" 
                title="删除页面">🗑️</button>
        </div>
    `;
}

// 渲染页面列表面板
function renderPageListPanel(pages, panelId, panelOpen) {
    const panel = document.getElementById(panelId);
    if (!panel) return;
    
    // 优化：使用数组join代替字符串拼接
    const html = pages.length === 0 
        ? '<div class="empty-page-item">暂无页面</div>'
        : pages.map(page => {
            const panelType = page.type === 'draw' ? 'draw' : 'text';
            return renderPageListItem(page, panelType);
        }).join('');
    
    panel.innerHTML = html;
    panel.classList.toggle('open', panelOpen);
}

// 渲染侧边栏
function renderSidebar() {
    const multiSelectControls = document.getElementById('multiSelectControls');
    const normalControls = document.querySelector('.normal-controls');
    
    // 更新多选控制按钮的显示状态
    if (multiSelectControls && normalControls) {
        if (multiSelectMode) {
            multiSelectControls.style.display = 'flex';
            normalControls.style.display = 'none';
        } else {
            multiSelectControls.style.display = 'none';
            normalControls.style.display = 'block';
        }
    }
    
    // 更新选中数量和删除按钮状态
    updateMultiSelectUI();

    // 按类型分组并排序（优化：一次遍历完成分组和排序）
    const textPages = [];
    const drawPages = [];
    
    state.pages.forEach(page => {
        if (page.type === 'text') {
            textPages.push(page);
        } else if (page.type === 'draw') {
            drawPages.push(page);
        }
    });
    
    // 排序
    textPages.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    drawPages.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // 渲染页面列表
    renderPageListPanel(drawPages, 'drawPagesPanel', drawPanelOpen);
    renderPageListPanel(textPages, 'textPagesPanel', textPanelOpen);
}

// 生成工具栏按钮HTML（通用函数）
function generateToolbarButton(text, onclick, title, active = false) {
    const activeClass = active ? 'active' : '';
    return `<button class="toolbar-btn ${activeClass}" onclick="${onclick}" title="${title}">${text}</button>`;
}

// 关闭面板的通用函数（用于内联onclick）
// 注意：由于需要在HTML字符串中内联调用，使用全局变量访问
function closePanelInline(panelSelector, stateVarName) {
    // 通过window对象访问全局变量
    window[stateVarName] = false;
    const panel = document.querySelector(panelSelector);
    if (panel) panel.classList.remove('open');
}

// 生成颜色选择器HTML（优化：使用数组join）
function generateColorPickerHTML() {
    const colorButtons = presetColors.map(color => `
        <button class="color-btn ${currentColor === color.value ? 'active' : ''}" 
            style="background-color: ${color.value};" 
            onclick="setColor('${color.value}'); 
            document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active')); 
            this.classList.add('active');
            closePanelInline('.color-presets-panel', 'colorPanelOpen');"
            title="${color.name}">
        </button>
    `).join('');
    
    return `
        <div class="color-picker-wrapper">
            <button class="toolbar-btn color-trigger" onclick="toggleColorPanel(event)" title="选择颜色">
                <span style="display: inline-block; width: 20px; height: 20px; background-color: ${currentColor}; border: 1px solid #ddd; border-radius: 3px; vertical-align: middle;"></span>
                颜色
            </button>
            <div class="color-presets-panel ${colorPanelOpen ? 'open' : ''}">
                ${colorButtons}
            </div>
        </div>
    `;
}

// 大小映射配置
const SIZE_CONFIG = {
    1: { dotSize: 3, title: '细' },
    3: { dotSize: 5, title: '中' },
    5: { dotSize: 7, title: '粗' },
    8: { dotSize: 10, title: '很粗' }
};

// 生成粗细选择器HTML（优化：使用数组join）
function generateSizePickerHTML() {
    const sizePreview = SIZE_CONFIG[currentSize]?.dotSize || SIZE_CONFIG[3].dotSize;
    const sizeOptions = Object.entries(SIZE_CONFIG).map(([size, config]) => ({
        size: parseInt(size),
        dotSize: config.dotSize,
        title: config.title
    }));
    
    const sizeButtons = sizeOptions.map(opt => `
        <button class="size-option-btn ${currentSize === opt.size ? 'active' : ''}" 
            onclick="setSize(${opt.size}); updateSizeButtons(); closePanelInline('.size-presets-panel', 'sizePanelOpen');" 
            title="${opt.title}">
            <span class="size-dot" style="width: ${opt.dotSize}px; height: ${opt.dotSize}px;"></span>
        </button>
    `).join('');
    
    return `
        <div class="size-picker-wrapper">
            <button class="toolbar-btn size-trigger" onclick="toggleSizePanel(event)" title="选择粗细">
                <span class="size-preview-dot" style="width: ${sizePreview}px; height: ${sizePreview}px;"></span>
                粗细
            </button>
            <div class="size-presets-panel ${sizePanelOpen ? 'open' : ''}">
                ${sizeButtons}
            </div>
        </div>
    `;
}

// 生成对齐选择器HTML（优化：使用数组join）
// 注意：ALIGN_OPTIONS 和 ALIGN_COMMANDS 在 page.js 中已定义
function generateAlignPickerHTML() {
    const currentAlignOption = ALIGN_OPTIONS.find(opt => opt.align === currentTextAlign) || ALIGN_OPTIONS[0];
    
    const alignButtons = ALIGN_OPTIONS.map(opt => `
        <button class="align-option-btn ${currentTextAlign === opt.align ? 'active' : ''}" 
            data-align="${opt.align}"
            onclick="setTextAlign('${opt.align}'); closePanelInline('.align-presets-panel', 'alignPanelOpen');" 
            title="${opt.title}">
            <span class="align-icon ${opt.iconClass}"></span>
        </button>
    `).join('');
    
    return `
        <div class="align-picker-wrapper">
            <button class="toolbar-btn align-trigger" onclick="toggleAlignPanel(event)" title="文本对齐">
                <span class="align-icon ${currentAlignOption.iconClass}"></span>
                对齐
            </button>
            <div class="align-presets-panel ${alignPanelOpen ? 'open' : ''}">
                ${alignButtons}
            </div>
        </div>
    `;
}

// 生成工具栏HTML
function generateToolbarHTML(pageType) {
    if (pageType === 'text') {
        return `
            ${generateToolbarButton('📋 复制', 'copyText()', '复制全部文本')}
            ${generateToolbarButton('🔍 查找', 'toggleFindPanel()', '查找文本')}
            ${generateToolbarButton('🖍️ 高亮', 'highlightSelectedText()', '高亮选中文本')}
            ${generateToolbarButton('📊 统计', 'showTextStats()', '字数统计')}
            ${generateAlignPickerHTML()}
            ${generateToolbarButton('🗑️ 清空', 'clearText()', '清空文本')}
        `;
    }
    
    // 绘图页面工具栏
    return `
        ${generateToolbarButton('✏️ 画笔', "setMode('pen'); updateToolbarActive();", '画笔', currentMode === 'pen')}
        ${generateToolbarButton('🗑️ 删除笔画', "setMode('eraser'); updateToolbarActive();", '删除笔画', currentMode === 'eraser')}
        ${generateToolbarButton('✋ 拖拽', "setMode('drag'); updateToolbarActive();", '拖拽画布', currentMode === 'drag')}
        ${generateColorPickerHTML()}
        ${generateSizePickerHTML()}
        ${generateToolbarButton('🗑️ 清空', 'clearCanvas()', '清空画布')}
    `;
}

// 生成编辑器内容HTML
function generateEditorContentHTML(pageType, activePage) {
    const toolbarHTML = generateToolbarHTML(pageType);
    const toolbarButtonsClass = `editor-toolbar-buttons ${floatingToolbarVisible ? 'visible' : 'hidden'}`;
    const toggleClass = `floating-toolbar-toggle ${!floatingToolbarVisible ? 'visible' : ''}`;
    
    if (pageType === 'text') {
        return `
            <div class="editor-content">
                <div class="${toolbarButtonsClass}" id="editorToolbarButtons">
                    ${toolbarHTML}
                    <button class="toolbar-btn btn-hide-toolbar" onclick="toggleToolbar()" title="隐藏工具栏">▼</button>
                </div>
                <div class="${toggleClass}" id="floatingToolbarToggle">
                    <button class="toolbar-btn btn-toggle-toolbar" onclick="toggleFloatingToolbar()" title="显示工具栏">▲</button>
                </div>
                <div class="find-panel ${findPanelOpen ? 'open' : ''}" id="findPanel">
                    <input type="text" id="findInput" class="find-input" placeholder="输入要查找的文本..." 
                        oninput="performFind(this.value)"
                        onkeydown="handleFindKeydown(event)">
                    <button class="find-btn" onclick="findPrevious()" title="上一个">▲</button>
                    <button class="find-btn" onclick="findNext()" title="下一个">▼</button>
                    <button class="find-btn find-close" onclick="toggleFindPanel()" title="关闭">✕</button>
                    <span class="find-results" id="findResults"></span>
                </div>
                <div class="text-editor-wrapper">
                    <div class="text-editor-lines" id="textEditorLines"></div>
                    <div id="textEditor" class="text-editor" 
                        contenteditable="true"
                        data-placeholder="开始输入..." 
                        oninput="updatePage(); updateTextLines(); updateTextStats();"
                        onblur="updatePage()"
                        onscroll="syncTextLinesScroll();"
                        onkeyup="updateTextLines();"
                        style="font-size: ${TEXT_FONT_SIZE}px;">${activePage.content || ''}</div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="editor-content">
            <div class="${toolbarButtonsClass}" id="editorToolbarButtons">
                ${toolbarHTML}
                <button class="toolbar-btn btn-hide-toolbar" onclick="toggleToolbar()" title="隐藏工具栏">▼</button>
            </div>
            <div class="${toggleClass}" id="floatingToolbarToggle">
                <button class="toolbar-btn btn-toggle-toolbar" onclick="toggleFloatingToolbar()" title="显示工具栏">▲</button>
            </div>
        </div>
    `;
}

// 渲染编辑器
function renderEditor() {
    const editor = document.getElementById('editor');
    const activePage = state.pages.find(page => page.id === state.activePageId);

    if (!activePage) {
        editor.className = 'editor empty';
        editor.innerHTML = `
            <div class="empty-editor">
                <h2>选择一个页面开始</h2>
                <p>从左侧选择一个页面，或创建新的页面</p>
            </div>
        `;
        canvas = null;
        ctx = null;
        return;
    }

    editor.className = 'editor';
    editor.innerHTML = generateEditorContentHTML(activePage.type, activePage);
    
    // 移除canvas-mode类（如果存在）
    const editorContent = document.querySelector('.editor-content');
    if (editorContent) {
        editorContent.classList.remove('canvas-mode');
    }
    
    if (activePage.type === 'text') {
        canvas = null;
        ctx = null;
        setTimeout(() => initTextEditor(activePage), 10);
    } else {
        setTimeout(() => initCanvas(), 10);
    }
}

// 初始化文本编辑器
function initTextEditor(activePage) {
    updateTextLines();
    const textEditor = document.getElementById('textEditor');
    if (!textEditor) return;
    
    // 应用固定字体大小
    const lineHeight = TEXT_FONT_SIZE * 1.8;
    textEditor.style.fontSize = TEXT_FONT_SIZE + 'px';
    textEditor.style.lineHeight = lineHeight + 'px';
    
    const linesContainer = document.getElementById('textEditorLines');
    if (linesContainer) {
        linesContainer.style.fontSize = TEXT_FONT_SIZE + 'px';
        linesContainer.style.lineHeight = lineHeight + 'px';
    }
    
    // 确保内容正确加载（支持HTML格式）
    textEditor.innerHTML = activePage.content || '';
    
    // 更新对齐按钮状态
    updateAlignButtons();
}

// 渲染全部
function render() {
    renderSidebar();
    renderEditor();
    updateSidebarVisibility();
}


// 调整画布大小（通用函数）
function adjustCanvasSize() {
    if (!canvas) return;
    // 画布大小现在是固定的，不需要根据容器调整
    // 但需要重新加载内容以确保显示正确
    setTimeout(() => {
        loadPageContent();
    }, 100);
}

// 更新工具栏显示状态
function updateToolbarVisibility(visible) {
    floatingToolbarVisible = visible;
    const editorToolbarButtons = document.getElementById('editorToolbarButtons');
    const toggleBtn = document.getElementById('floatingToolbarToggle');
    
    if (editorToolbarButtons) {
        editorToolbarButtons.classList.toggle('visible', visible);
        editorToolbarButtons.classList.toggle('hidden', !visible);
    }
    
    if (toggleBtn) {
        toggleBtn.classList.toggle('visible', !visible);
    }
    
    adjustCanvasSize();
}

// 切换工具栏显示/隐藏
function toggleToolbar() {
    updateToolbarVisibility(false);
}

// 切换浮动工具栏显示
function toggleFloatingToolbar() {
    updateToolbarVisibility(true);
}

// 模式按钮文本映射
const MODE_BUTTON_TEXT = {
    'pen': '画笔',
    'eraser': '删除笔画',
    'drag': '拖拽'
};

// 更新工具栏按钮激活状态（优化：减少DOM查询）
function updateToolbarActive() {
    const buttons = document.querySelectorAll('.toolbar-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    const buttonText = MODE_BUTTON_TEXT[currentMode];
    if (buttonText) {
        // 优化：直接使用已查询的按钮列表
        const activeBtn = Array.from(buttons)
            .find(btn => btn.textContent.includes(buttonText));
        if (activeBtn) activeBtn.classList.add('active');
    }
}

// 更新粗细按钮激活状态（优化：减少重复查询）
function updateSizeButtons() {
    const sizeButtons = document.querySelectorAll('.size-option-btn');
    const config = SIZE_CONFIG[currentSize];
    
    sizeButtons.forEach(btn => {
        btn.classList.remove('active');
        if (config) {
            const dot = btn.querySelector('.size-dot');
            if (dot) {
                const dotSize = parseInt(dot.style.width);
                if (dotSize === config.dotSize) {
                    btn.classList.add('active');
                }
            }
        }
    });
    
    // 更新预览圆点大小
    const previewDot = document.querySelector('.size-preview-dot');
    if (previewDot && config) {
        previewDot.style.width = config.dotSize + 'px';
        previewDot.style.height = config.dotSize + 'px';
    }
}

// 切换侧边栏显示/隐藏
function toggleSidebar() {
    sidebarVisible = !sidebarVisible;
    updateSidebarVisibility();
}

// 检测是否为移动端
function isMobile() {
    return window.innerWidth <= 768;
}

// 更新侧边栏可见性
function updateSidebarVisibility() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        if (isMobile()) {
            // 移动端：使用transform控制显示/隐藏
            sidebar.classList.toggle('hidden', !sidebarVisible);
        } else {
            // 桌面端：保持原有逻辑
            sidebar.classList.toggle('hidden', !sidebarVisible);
        }
    }
    
    if (toggleBtn) {
        toggleBtn.classList.toggle('visible', !sidebarVisible);
    }
    
    // 移动端遮罩层控制
    if (overlay && isMobile()) {
        overlay.classList.toggle('visible', sidebarVisible);
    }
    
    adjustCanvasSize();
}

// 更新文本编辑器的横线显示（优化：只在行数变化时更新DOM）
let lastLineCount = 0;
function updateTextLines() {
    const textEditor = document.getElementById('textEditor');
    const linesContainer = document.getElementById('textEditorLines');
    
    if (!textEditor || !linesContainer) return;
    
    // 获取纯文本内容
    const text = textEditor.innerText || textEditor.textContent || '';
    const lines = text.split('\n');
    
    // 计算需要显示的行数（基于编辑器高度）
    const editorHeight = textEditor.scrollHeight;
    const lineHeight = parseFloat(getComputedStyle(textEditor).lineHeight) || TEXT_FONT_SIZE * 1.8;
    const minLines = Math.max(
        Math.ceil(editorHeight / lineHeight),
        lines.length || 20  // 至少显示20行，确保有足够的横线
    );
    
    // 只在行数变化时更新DOM，提高性能
    if (minLines !== lastLineCount) {
        linesContainer.innerHTML = '';
        
        // 使用文档片段批量添加元素，提高性能
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < minLines; i++) {
            const lineElement = document.createElement('div');
            lineElement.className = 'text-editor-line';
            fragment.appendChild(lineElement);
        }
        linesContainer.appendChild(fragment);
        
        lastLineCount = minLines;
    }
}

// 同步横线层的滚动位置
function syncTextLinesScroll() {
    const textEditor = document.getElementById('textEditor');
    const linesContainer = document.getElementById('textEditorLines');
    
    if (textEditor && linesContainer) {
        linesContainer.scrollTop = textEditor.scrollTop;
    }
}

