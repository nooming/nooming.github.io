// 等待DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // ========== 获取DOM元素 ==========
    const encodeInput = document.getElementById('encodeInput');
    const decodeInput = document.getElementById('decodeInput');
    const encodeBtn = document.getElementById('encodeBtn');
    const decodeBtn = document.getElementById('decodeBtn');
    const clearEncodeBtn = document.getElementById('clearEncodeBtn');
    const clearDecodeBtn = document.getElementById('clearDecodeBtn');
    const encodeErrorTip = document.getElementById('encodeErrorTip');
    const decodeErrorTip = document.getElementById('decodeErrorTip');
    const encodeResult = document.getElementById('encodeResult');
    const decodeResult = document.getElementById('decodeResult');
    const copyBtns = document.querySelectorAll('.copy-btn');

    // ========== 绑定事件 ==========
    encodeBtn.addEventListener('click', encodeText);
    decodeBtn.addEventListener('click', decodeText);
    clearEncodeBtn.addEventListener('click', clearEncode);
    clearDecodeBtn.addEventListener('click', clearDecode);
    
    // 实时编码功能（防抖处理，输入后500ms自动编码）
    const debouncedEncode = debounce(encodeText, 500);
    encodeInput.addEventListener('input', function() {
        const text = this.value.trim();
        if (text) {
            debouncedEncode();
        } else {
            clearEncode();
        }
    });

    // 实时解码功能（防抖处理，输入后500ms自动解码）
    const debouncedDecode = debounce(decodeText, 500);
    decodeInput.addEventListener('input', function() {
        const text = this.value.trim();
        if (text) {
            debouncedDecode();
        } else {
            clearDecode();
        }
    });

    // Enter 键触发
    encodeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            encodeText();
        }
    });
    decodeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            decodeText();
        }
    });
    
    // 绑定所有复制按钮的事件
    copyBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const text = document.getElementById(targetId).textContent;
            if (text === '——') return; // 跳过默认值
            copyToClipboard(text);
        });
    });

    // ========== 核心函数：Base64 编码 ==========
    function encodeText() {
        const text = encodeInput.value.trim();

        // 校验空输入
        if (!text) {
            showEncodeError('请输入要编码的文本！');
            return;
        }

        try {
            // 使用 btoa 进行 Base64 编码
            // 对于包含非 ASCII 字符的文本，需要先进行 UTF-8 编码
            const base64 = btoa(unescape(encodeURIComponent(text)));
            hideEncodeError();
            encodeResult.textContent = base64;
        } catch (err) {
            showEncodeError('编码失败，请检查输入内容！');
            encodeResult.textContent = '——';
        }
    }

    // ========== 核心函数：Base64 解码 ==========
    function decodeText() {
        const base64Text = decodeInput.value.trim();

        // 校验空输入
        if (!base64Text) {
            showDecodeError('请输入要解码的 Base64 字符串！');
            return;
        }

        // 校验 Base64 格式（去除可能的空白字符）
        const cleanBase64 = base64Text.replace(/\s/g, '');
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(cleanBase64)) {
            showDecodeError('输入格式错误，Base64 字符串只能包含 A-Z、a-z、0-9、+、/ 和 = 字符！');
            decodeResult.textContent = '——';
            return;
        }

        try {
            // 使用 atob 进行 Base64 解码
            // 对于包含非 ASCII 字符的结果，需要进行 UTF-8 解码
            const decoded = decodeURIComponent(escape(atob(cleanBase64)));
            hideDecodeError();
            decodeResult.textContent = decoded;
        } catch (err) {
            showDecodeError('解码失败，请检查 Base64 字符串是否正确！');
            decodeResult.textContent = '——';
        }
    }

    // ========== 辅助函数：清空编码区域 ==========
    function clearEncode() {
        encodeInput.value = '';
        encodeResult.textContent = '——';
        hideEncodeError();
    }

    // ========== 辅助函数：清空解码区域 ==========
    function clearDecode() {
        decodeInput.value = '';
        decodeResult.textContent = '——';
        hideDecodeError();
    }

    // ========== 辅助函数：显示编码错误提示 ==========
    function showEncodeError(msg) {
        encodeErrorTip.textContent = msg;
        encodeErrorTip.style.display = 'block';
    }

    // ========== 辅助函数：隐藏编码错误提示 ==========
    function hideEncodeError() {
        encodeErrorTip.style.display = 'none';
    }

    // ========== 辅助函数：显示解码错误提示 ==========
    function showDecodeError(msg) {
        decodeErrorTip.textContent = msg;
        decodeErrorTip.style.display = 'block';
    }

    // ========== 辅助函数：隐藏解码错误提示 ==========
    function hideDecodeError() {
        decodeErrorTip.style.display = 'none';
    }

});

