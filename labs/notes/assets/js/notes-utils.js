// ========== 手写笔记 · 域内工具函数（Toast 等见 ../../common/js/utils.js） ==========

// 生成唯一 ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 检测是否为移动端
function isMobile() {
    return window.innerWidth <= 768;
}

// 关闭面板的通用函数
function closePanel(panelSelector, stateVarName) {
    if (window[stateVarName] !== undefined) {
        window[stateVarName] = false;
    }
    const panel = document.querySelector(panelSelector);
    if (panel) {
        panel.classList.remove('open');
    }
}

