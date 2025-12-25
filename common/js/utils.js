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

/**
 * 安全的 localStorage 操作函数
 * 封装 localStorage 操作，添加错误处理
 */
const SafeStorage = {
    /**
     * 安全地获取 localStorage 值
     * @param {string} key - 存储键
     * @param {*} defaultValue - 默认值（如果获取失败或不存在）
     * @returns {*} 存储的值或默认值
     */
    getItem(key, defaultValue = null) {
        try {
            const value = localStorage.getItem(key);
            return value !== null ? value : defaultValue;
        } catch (e) {
            console.warn('localStorage.getItem failed:', e);
            return defaultValue;
        }
    },
    
    /**
     * 安全地设置 localStorage 值
     * @param {string} key - 存储键
     * @param {*} value - 要存储的值
     * @returns {boolean} 是否成功
     */
    setItem(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage.setItem failed:', e);
            // 如果存储空间已满，尝试清理旧数据
            if (e.name === 'QuotaExceededError') {
                console.warn('localStorage quota exceeded, attempting cleanup...');
            }
            return false;
        }
    },
    
    /**
     * 安全地删除 localStorage 值
     * @param {string} key - 存储键
     * @returns {boolean} 是否成功
     */
    removeItem(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage.removeItem failed:', e);
            return false;
        }
    },
    
    /**
     * 检查 localStorage 是否可用
     * @returns {boolean} 是否可用
     */
    isAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
};

/**
 * 初始化返回顶部按钮功能
 * 自动查找页面中的 #backToTop 按钮并绑定事件
 */
function initBackToTop() {
    const backToTopBtn = document.getElementById('backToTop');
    
    if (!backToTopBtn) {
        return; // 如果页面没有返回顶部按钮，直接返回
    }
    
    // 使用节流优化滚动事件
    let ticking = false;
    const handleScroll = () => {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                if (window.pageYOffset > 100) {
                    backToTopBtn.classList.add('show');
                } else {
                    backToTopBtn.classList.remove('show');
                }
                ticking = false;
            });
            ticking = true;
        }
    };
    
    // 监听滚动事件
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // 点击按钮返回顶部
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // 页面加载时检查初始位置
    handleScroll();
}

// DOM 加载完成后自动初始化返回顶部功能
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackToTop);
} else {
    // DOM 已经加载完成
    initBackToTop();
}

