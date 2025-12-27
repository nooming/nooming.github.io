// 公共工具函数

// 生成唯一ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 检测是否为移动端
function isMobile() {
    return window.innerWidth <= 768;
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
            if (toast.parentNode) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 2000);
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

