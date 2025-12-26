// 页面管理

// 对齐选项配置（与render.js中的ALIGN_OPTIONS保持一致）
const ALIGN_OPTIONS = [
    { align: 'left', iconClass: 'align-icon-left', title: '左对齐' },
    { align: 'center', iconClass: 'align-icon-center', title: '居中' },
    { align: 'right', iconClass: 'align-icon-right', title: '右对齐' }
];

// 对齐命令映射
const ALIGN_COMMANDS = {
    'left': 'justifyLeft',
    'center': 'justifyCenter',
    'right': 'justifyRight'
};

// 处理绘图按钮点击
function handleDrawButtonClick(e) {
    // 只切换面板，不创建页面
    toggleDrawPanel(e);
}

// 处理文本按钮点击
function handleTextButtonClick(e) {
    // 只切换面板，不创建页面
    toggleTextPanel(e);
}

// 创建页面
function createPage(type) {
    // 生成唯一的页面名称
    const baseName = type === 'text' ? '文本页面' : '绘图页面';
    const sameTypePages = state.pages.filter(p => p.type === type);
    
    // 查找已使用的编号
    const usedNumbers = new Set();
    sameTypePages.forEach(page => {
        const match = page.title.match(new RegExp(`^${baseName}\\s+(\\d+)$`));
        if (match) {
            usedNumbers.add(parseInt(match[1]));
        }
    });
    
    // 找到第一个未使用的编号
    let pageNumber = 1;
    while (usedNumbers.has(pageNumber)) {
        pageNumber++;
    }
    
    const newPage = {
        id: generateId(),
        title: `${baseName} ${pageNumber}`,
        type: type, // 'text' 或 'draw'
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    // 根据页面类型设置数据
    if (type === 'text') {
        newPage.content = '';
    } else {
        newPage.strokes = [];
        newPage.imageData = null;
    }
    
    state.pages.push(newPage);
    state.activePageId = newPage.id;
    saveState();
    render();
}

// 更新页面
function updatePage() {
    if (!state.activePageId) return;
    
    const page = state.pages.find(p => p.id === state.activePageId);
    if (page) {
        if (page.type === 'text') {
            // 文本页面：保存文本内容（HTML格式）
            const textEditor = document.getElementById('textEditor');
            if (textEditor) {
                page.content = textEditor.innerHTML;
            }
        } else {
            // 绘图页面：保存笔画数据和图片数据
            if (canvas) {
                page.strokes = strokes;
                page.imageData = canvas.toDataURL('image/png');
            }
        }
        page.updatedAt = Date.now();
        saveState();
    }
}

// 清空文本
function clearText() {
    if (confirm('确定要清空文本吗？')) {
        const textEditor = document.getElementById('textEditor');
        if (textEditor) {
            textEditor.innerHTML = '';
            updatePage();
            updateTextLines();
        }
    }
}

// 删除页面
function deletePage(pageId) {
    if (confirm('确定要删除这个页面吗？')) {
        state.pages = state.pages.filter(p => p.id !== pageId);
        if (state.activePageId === pageId) {
            state.activePageId = null;
        }
        saveState();
        render();
    }
}

// 设置活动页面
function setActive(pageId) {
    state.activePageId = pageId;
    // 切换页面时关闭查找面板并清理查找状态
    if (findPanelOpen) {
        findPanelOpen = false;
        clearFindHighlights();
    }
    saveState();
    render();
}

// 更新页面标题
function updatePageTitle(pageId, title) {
    const page = state.pages.find(p => p.id === pageId);
    if (page) {
        page.title = title;
        saveState();
        renderSidebar();
    }
}

// 切换多选模式
function toggleMultiSelect() {
    multiSelectMode = !multiSelectMode;
    if (!multiSelectMode) {
        selectedPageIds = [];
    }
    render();
}

// 切换页面选中状态
function togglePageSelection(pageId, checked) {
    if (checked) {
        if (!selectedPageIds.includes(pageId)) {
            selectedPageIds.push(pageId);
        }
    } else {
        selectedPageIds = selectedPageIds.filter(id => id !== pageId);
    }
    updateMultiSelectUI();
    renderSidebar();
}

// 全选/取消全选某个类型的页面
function toggleSelectAll(type, checked) {
    const pages = state.pages.filter(page => page.type === type);
    if (checked) {
        pages.forEach(page => {
            if (!selectedPageIds.includes(page.id)) {
                selectedPageIds.push(page.id);
            }
        });
    } else {
        const pageIds = pages.map(page => page.id);
        selectedPageIds = selectedPageIds.filter(id => !pageIds.includes(id));
    }
    updateMultiSelectUI();
    renderSidebar();
}

// 更新多选UI状态
function updateMultiSelectUI() {
    const selectedCountEl = document.getElementById('selectedCount');
    const btnDeleteSelected = document.getElementById('btnDeleteSelected');
    
    if (selectedCountEl) {
        selectedCountEl.textContent = selectedPageIds.length;
    }
    
    if (btnDeleteSelected) {
        btnDeleteSelected.disabled = selectedPageIds.length === 0;
    }
}

// 批量删除选中的页面
function deleteSelectedPages() {
    if (selectedPageIds.length === 0) return;
    
    const count = selectedPageIds.length;
    if (confirm(`确定要删除选中的 ${count} 个页面吗？`)) {
        // 如果当前活动页面在被删除列表中，清除活动页面
        if (selectedPageIds.includes(state.activePageId)) {
            state.activePageId = null;
        }
        
        // 删除选中的页面
        state.pages = state.pages.filter(p => !selectedPageIds.includes(p.id));
        
        // 清空选中列表并退出多选模式
        selectedPageIds = [];
        multiSelectMode = false;
        
        saveState();
        render();
    }
}

// ============ 文本编辑器功能函数 ============

// 复制文本
function copyText() {
    const textEditor = document.getElementById('textEditor');
    if (textEditor) {
        // 获取选中文本或全部文本
        const selection = window.getSelection();
        let textToCopy = '';
        
        if (selection.rangeCount > 0 && !selection.isCollapsed) {
            // 有选中文本，复制选中的
            textToCopy = selection.toString();
        } else {
            // 没有选中，复制全部文本（纯文本格式）
            const range = document.createRange();
            range.selectNodeContents(textEditor);
            const cloned = range.cloneContents();
            const div = document.createElement('div');
            div.appendChild(cloned);
            textToCopy = div.innerText || div.textContent || '';
        }
        
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                showToast('文本已复制到剪贴板');
            }).catch(() => {
                // 降级方案
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                showToast('文本已复制到剪贴板');
            });
        } else {
            showToast('没有可复制的内容');
        }
    }
}


// 切换查找面板
function toggleFindPanel() {
    findPanelOpen = !findPanelOpen;
    const panel = document.getElementById('findPanel');
    if (panel) {
        panel.classList.toggle('open', findPanelOpen);
        if (findPanelOpen) {
            const findInput = document.getElementById('findInput');
            if (findInput) {
                findInput.focus();
                findInput.select();
            }
        } else {
            // 清除高亮
            clearFindHighlights();
        }
    }
}

// 执行查找
function performFind(searchText) {
    findText = searchText;
    const textEditor = document.getElementById('textEditor');
    if (!textEditor || !searchText.trim()) {
        clearFindHighlights();
        updateFindResults(0, -1);
        return;
    }
    
    // 获取纯文本内容用于查找
    const text = textEditor.innerText || textEditor.textContent || '';
    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    findMatches = [];
    let match;
    
    while ((match = regex.exec(text)) !== null) {
        findMatches.push({
            index: match.index,
            length: match[0].length
        });
    }
    
    currentFindIndex = findMatches.length > 0 ? 0 : -1;
    highlightFindResults();
    updateFindResults(findMatches.length, currentFindIndex);
    
    // 跳转到第一个匹配项
    if (findMatches.length > 0) {
        scrollToFindMatch(0);
    }
}

// 高亮查找结果
function highlightFindResults() {
    // contenteditable div中，查找高亮通过滚动到匹配项来实现
    // 实际的视觉高亮由scrollToFindMatch中的选中范围提供
}

// 清除查找高亮
function clearFindHighlights() {
    findMatches = [];
    currentFindIndex = -1;
    updateFindResults(0, -1);
}

// 更新查找结果显示
function updateFindResults(total, current) {
    const resultsEl = document.getElementById('findResults');
    if (resultsEl) {
        if (total > 0 && current >= 0) {
            resultsEl.textContent = `${current + 1} / ${total}`;
        } else if (total > 0) {
            resultsEl.textContent = `${total} 个结果`;
        } else {
            resultsEl.textContent = '';
        }
    }
}

// 查找下一个
function findNext() {
    if (findMatches.length === 0) return;
    currentFindIndex = (currentFindIndex + 1) % findMatches.length;
    scrollToFindMatch(currentFindIndex);
    updateFindResults(findMatches.length, currentFindIndex);
}

// 查找上一个
function findPrevious() {
    if (findMatches.length === 0) return;
    currentFindIndex = currentFindIndex <= 0 ? findMatches.length - 1 : currentFindIndex - 1;
    scrollToFindMatch(currentFindIndex);
    updateFindResults(findMatches.length, currentFindIndex);
}

// 滚动到查找匹配项
function scrollToFindMatch(index) {
    const textEditor = document.getElementById('textEditor');
    if (!textEditor || index < 0 || index >= findMatches.length) return;
    
    const match = findMatches[index];
    const text = textEditor.innerText || textEditor.textContent || '';
    const textBeforeMatch = text.substring(0, match.index);
    
    // 创建range并选中匹配的文本
    const range = document.createRange();
    const walker = document.createTreeWalker(
        textEditor,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let currentPos = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;
    
    let node;
    while (node = walker.nextNode()) {
        const nodeLength = node.textContent.length;
        if (currentPos + nodeLength >= match.index && !startNode) {
            startNode = node;
            startOffset = match.index - currentPos;
        }
        if (currentPos + nodeLength >= match.index + match.length && !endNode) {
            endNode = node;
            endOffset = match.index + match.length - currentPos;
            break;
        }
        currentPos += nodeLength;
    }
    
    if (startNode && endNode) {
        try {
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textEditor.focus();
            
            // 滚动到可见区域
            const lineHeight = parseFloat(getComputedStyle(textEditor).lineHeight);
            const linesBeforeMatch = textBeforeMatch.split('\n').length - 1;
            const scrollTop = linesBeforeMatch * lineHeight - textEditor.clientHeight / 2;
            textEditor.scrollTop = Math.max(0, scrollTop);
        } catch (e) {
            console.error('滚动到匹配项失败:', e);
        }
    }
}

// 处理查找输入框的键盘事件
function handleFindKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
            findPrevious();
        } else {
            findNext();
        }
    } else if (e.key === 'Escape') {
        toggleFindPanel();
    }
}

// 插入日期时间
function insertDateTime() {
    const textEditor = document.getElementById('textEditor');
    if (!textEditor) return;
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const dateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    
    // 使用contenteditable的方式插入文本
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const textNode = document.createTextNode(dateTime);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    textEditor.focus();
    updatePage();
    updateTextLines();
}

// 显示文本统计
function showTextStats() {
    const textEditor = document.getElementById('textEditor');
    if (!textEditor) return;
    
    // 获取纯文本内容
    const text = textEditor.innerText || textEditor.textContent || '';
    const chars = text.length;
    const charsNoSpaces = text.replace(/\s/g, '').length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split('\n').length;
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length || (text.trim() ? 1 : 0);
    
    const message = `字数统计：
字符数（含空格）：${chars}
字符数（不含空格）：${charsNoSpaces}
单词数：${words}
行数：${lines}
段落数：${paragraphs}`;
    
    alert(message);
}

// 更新文本统计（用于实时显示，如果需要的话）
function updateTextStats() {
    // 预留接口，可用于实时统计更新
}

// 切换对齐面板
function toggleAlignPanel(e) {
    e.stopPropagation();
    alignPanelOpen = !alignPanelOpen;
    const panel = document.querySelector('.align-presets-panel');
    if (panel) {
        panel.classList.toggle('open', alignPanelOpen);
    }
}

// 设置文本对齐方式
function setTextAlign(align) {
    const textEditor = document.getElementById('textEditor');
    if (!textEditor) return;
    
    const command = ALIGN_COMMANDS[align];
    if (!command) return;
    
    textEditor.focus();
    document.execCommand(command, false, null);
    currentTextAlign = align;
    updateAlignButtons();
    updatePage();
}

// 更新对齐按钮激活状态
function updateAlignButtons() {
    // 更新选项按钮状态
    document.querySelectorAll('.align-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-align') === currentTextAlign);
    });
    
    // 更新主按钮图标
    const currentOption = ALIGN_OPTIONS.find(opt => opt.align === currentTextAlign) || ALIGN_OPTIONS[0];
    const triggerBtn = document.querySelector('.align-trigger');
    const iconSpan = triggerBtn?.querySelector('.align-icon');
    if (iconSpan) {
        iconSpan.className = `align-icon ${currentOption.iconClass}`;
    }
}

// 处理单个节点的高亮切换
function processHighlightNode(node, fragment) {
    if (node.nodeType === Node.ELEMENT_NODE && 
        node.tagName === 'SPAN' && 
        node.classList?.contains('text-highlight')) {
        // 高亮span：移除高亮，只保留文本
        Array.from(node.textContent).forEach(char => {
            fragment.appendChild(document.createTextNode(char));
        });
    } else if (node.nodeType === Node.TEXT_NODE) {
        // 文本节点：添加高亮
        Array.from(node.textContent).forEach(char => {
            const span = document.createElement('span');
            span.className = 'text-highlight';
            span.textContent = char;
            fragment.appendChild(span);
        });
    } else if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
        // 其他节点：递归处理子节点
        Array.from(node.childNodes).forEach(child => {
            processHighlightNode(child, fragment);
        });
    }
}

// 高亮选中文本（逐字符切换：未高亮则高亮，已高亮则取消高亮）
function highlightSelectedText() {
    const textEditor = document.getElementById('textEditor');
    if (!textEditor) return;
    
    const selection = window.getSelection();
    if (!selection?.rangeCount || selection.isCollapsed) {
        showToast('请先选中要高亮的文本');
        return;
    }
    
    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer;
    if (container.nodeType === Node.TEXT_NODE) {
        container = container.parentNode;
    }
    if (!textEditor.contains(container)) {
        showToast('请选中编辑器内的文本');
        return;
    }
    
    try {
        const selectedContent = range.extractContents();
        const fragment = document.createDocumentFragment();
        processHighlightNode(selectedContent, fragment);
        
        range.insertNode(fragment);
        
        const newRange = document.createRange();
        newRange.setStart(range.endContainer, range.endOffset);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        updatePage();
        textEditor.focus();
    } catch (e) {
        console.error('高亮文本失败:', e);
        showToast('高亮失败，请重试');
    }
}

// 显示提示消息
function showToast(message) {
    // 创建临时提示元素
    const toast = document.createElement('div');
    toast.className = 'toast-message';
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        right: 28px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        animation: fadeIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 2000);
}

