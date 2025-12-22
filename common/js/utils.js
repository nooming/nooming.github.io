// ============================================
// 公共工具函数
// ============================================

/**
 * 显示 Toast 提示消息
 * @param {string} message - 提示消息
 * @param {string} type - 类型: 'success', 'error', 'info' (默认: 'info')
 * @param {number} duration - 显示时长（毫秒，默认: 2000）
 */
function showToast(message, type = 'info', duration = 2000) {
    // 移除已存在的 toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // 创建新的 toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 触发显示动画
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @param {string} successMsg - 成功提示消息（默认: '复制成功！'）
 */
async function copyToClipboard(text, successMsg = '复制成功！') {
    try {
        await navigator.clipboard.writeText(text);
        showToast(successMsg, 'success');
    } catch (err) {
        // 降级方案：使用传统方法
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showToast(successMsg, 'success');
        } catch (e) {
            showToast('复制失败，请手动复制', 'error');
        }
        document.body.removeChild(textArea);
    }
}

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

