// 主入口和事件绑定

// 主入口和事件绑定

// 检测是否为移动端
function isMobileDevice() {
    return window.innerWidth <= 768;
}

// 点击外部关闭面板
document.addEventListener('click', (e) => {
    // 移动端：点击编辑器区域时关闭侧边栏
    if (isMobileDevice() && typeof sidebarVisible !== 'undefined' && sidebarVisible) {
        const editor = document.getElementById('editor');
        const sidebar = document.getElementById('sidebar');
        if (editor && sidebar && !sidebar.contains(e.target) && 
            !e.target.closest('.sidebar-toggle-btn') && 
            !e.target.closest('.sidebar-overlay')) {
            // 如果点击的是编辑器区域，关闭侧边栏
            if (editor.contains(e.target) || e.target === editor) {
                if (typeof toggleSidebar === 'function') {
                    toggleSidebar();
                }
            }
        }
    }
    
    // 关闭颜色面板
    const colorWrapper = document.querySelector('.color-picker-wrapper');
    if (colorWrapper && !colorWrapper.contains(e.target) && colorPanelOpen) {
        colorPanelOpen = false;
        const panel = document.querySelector('.color-presets-panel');
        if (panel) panel.classList.remove('open');
    }
    
    // 关闭粗细面板
    const sizeWrapper = document.querySelector('.size-picker-wrapper');
    if (sizeWrapper && !sizeWrapper.contains(e.target) && sizePanelOpen) {
        sizePanelOpen = false;
        const panel = document.querySelector('.size-presets-panel');
        if (panel) panel.classList.remove('open');
    }
    
    // 关闭对齐面板
    const alignWrapper = document.querySelector('.align-picker-wrapper');
    if (alignWrapper && !alignWrapper.contains(e.target) && alignPanelOpen) {
        alignPanelOpen = false;
        const panel = document.querySelector('.align-presets-panel');
        if (panel) panel.classList.remove('open');
    }
    
    // 关闭绘图页面面板
    const drawWrapper = document.querySelector('.page-picker-wrapper:first-of-type');
    if (drawWrapper && !drawWrapper.contains(e.target) && drawPanelOpen) {
        drawPanelOpen = false;
        const panel = document.getElementById('drawPagesPanel');
        if (panel) panel.classList.remove('open');
    }
    
    // 关闭文本页面面板
    const textWrapper = document.querySelector('.page-picker-wrapper:last-of-type');
    if (textWrapper && !textWrapper.contains(e.target) && textPanelOpen) {
        textPanelOpen = false;
        const panel = document.getElementById('textPagesPanel');
        if (panel) panel.classList.remove('open');
    }
});

// 窗口大小改变时调整画布
window.addEventListener('resize', () => {
    if (canvas) {
        // 画布大小现在是固定的，不需要根据窗口大小调整
        // 但可以重新加载内容以确保显示正确
        loadPageContent();
    }
    // 更新文本编辑器的横线
    updateTextLines();
    // 更新侧边栏可见性（适配移动端/桌面端切换）
    if (typeof updateSidebarVisibility === 'function') {
        updateSidebarVisibility();
    }
});


// 初始化
loadState();
render();

