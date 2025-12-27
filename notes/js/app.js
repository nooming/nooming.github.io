// 主入口和事件绑定

// 工具函数已移至 utils.js

// 点击外部关闭面板
document.addEventListener('click', (e) => {
    // 移动端：点击编辑器区域时关闭侧边栏
    if (isMobile() && typeof sidebarVisible !== 'undefined' && sidebarVisible) {
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
    
    // 关闭各种面板（统一处理）
    const panelConfigs = [
        { wrapper: '.color-picker-wrapper', panel: '.color-presets-panel', stateVar: 'colorPanelOpen' },
        { wrapper: '.size-picker-wrapper', panel: '.size-presets-panel', stateVar: 'sizePanelOpen' },
        { wrapper: '.align-picker-wrapper', panel: '.align-presets-panel', stateVar: 'alignPanelOpen' },
        { wrapper: '.page-picker-wrapper:first-of-type', panel: '#drawPagesPanel', stateVar: 'drawPanelOpen' },
        { wrapper: '.page-picker-wrapper:last-of-type', panel: '#textPagesPanel', stateVar: 'textPanelOpen' },
        { wrapper: '.selection-color-picker-wrapper', panel: '#selectionColorPanel', stateVar: null }
    ];
    
    panelConfigs.forEach(config => {
        const wrapper = document.querySelector(config.wrapper);
        if (wrapper && !wrapper.contains(e.target)) {
            if (config.stateVar === null || window[config.stateVar]) {
                if (config.stateVar) {
                    window[config.stateVar] = false;
                }
                const panel = document.querySelector(config.panel);
                if (panel) {
                    panel.classList.remove('open');
                }
            }
        }
    });
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

