// 等待DOM加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // ========== 获取DOM元素 ==========
    const qrInput = document.getElementById('qrInput');
    const qrSize = document.getElementById('qrSize');
    const qrColor = document.getElementById('qrColor');
    const qrBgColor = document.getElementById('qrBgColor');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const errorTip = document.getElementById('errorTip');
    const qrCode = document.getElementById('qrCode');
    const qrPlaceholder = document.querySelector('.qr-placeholder');

    // 识别相关元素
    const decodeFileInput = document.getElementById('decodeFile');
    const decodeBtn = document.getElementById('decodeBtn');
    const decodeClearBtn = document.getElementById('decodeClearBtn');
    const decodeCopyBtn = document.getElementById('decodeCopyBtn');
    const decodeErrorTip = document.getElementById('decodeErrorTip');
    const decodePreviewImg = document.getElementById('decodePreview');
    const decodePreviewPlaceholder = document.querySelector('.decode-preview-placeholder');
    const decodeResult = document.getElementById('decodeResult');

    if (!qrInput || !generateBtn || !qrCode) {
        console.error('Required DOM elements not found');
        return;
    }

    let currentQRCodeDataURL = null;
    let currentDecodeObjectUrl = null;

    // ========== 绑定事件（生成） ==========
    generateBtn.addEventListener('click', generateQRCode);
    clearBtn.addEventListener('click', clearAll);
    downloadBtn.addEventListener('click', downloadQRCode);

    // ========== 绑定事件（识别） ==========
    if (decodeFileInput && decodeBtn && decodeClearBtn) {
        decodeBtn.addEventListener('click', decodeQRCodeImage);
        decodeClearBtn.addEventListener('click', clearDecode);
        decodeFileInput.addEventListener('change', handleDecodeFileChange);
    }

    if (decodeCopyBtn && decodeResult) {
        decodeCopyBtn.addEventListener('click', function() {
            const text = decodeResult.textContent.trim();
            if (!text || text === '——' || text === '识别中，请稍候...') return;
            // 使用公共工具函数复制
            copyToClipboard(text, '识别结果已复制到剪贴板');
        });
    }
    
    // 设置改变时重新生成
    qrSize.addEventListener('change', function() {
        if (qrInput.value.trim()) {
            generateQRCode();
        }
    });
    qrColor.addEventListener('change', function() {
        if (qrInput.value.trim()) {
            generateQRCode();
        }
    });
    qrBgColor.addEventListener('change', function() {
        if (qrInput.value.trim()) {
            generateQRCode();
        }
    });

    // Enter 键触发（Ctrl+Enter）
    qrInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            generateQRCode();
        }
    });

    // ========== 核心函数：生成二维码 ==========
    function generateQRCode() {
        const text = qrInput.value.trim();

        // 校验空输入
        if (!text) {
            showError('请输入要生成二维码的内容！');
            qrCode.innerHTML = '';
            qrCode.parentElement.classList.remove('has-qrcode');
            qrPlaceholder.style.display = 'block';
            downloadBtn.disabled = true;
            currentQRCodeDataURL = null;
            return;
        }

        // 隐藏错误提示
        hideError();

        // 获取设置
        const size = parseInt(qrSize.value);
        const color = qrColor.value;
        const bgColor = qrBgColor.value;

        // 清空之前的二维码
        qrCode.innerHTML = '';

        // 使用在线 API 生成二维码（无需下载库文件）
        // 将颜色转换为 URL 编码
        const encodedText = encodeURIComponent(text);
        const darkColor = color.replace('#', '');
        const lightColor = bgColor.replace('#', '');
        
        // 使用 api.qrserver.com 生成二维码
        const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedText}&color=${darkColor}&bgcolor=${lightColor}&margin=2`;
        
        // 创建 img 元素
        qrCode.innerHTML = '';
        const img = document.createElement('img');
        img.alt = 'QR Code';
        
        // 图片加载成功
        img.onload = function() {
            // 直接使用二维码图片地址进行下载（避免跨域导致 canvas 报错）
            currentQRCodeDataURL = qrApiUrl;
            
            // 更新 UI
            qrPlaceholder.style.display = 'none';
            qrCode.parentElement.classList.add('has-qrcode');
            downloadBtn.disabled = false;
        };
        
        // 图片加载失败
        img.onerror = function() {
            showError('生成二维码失败，请检查网络连接或稍后重试！');
            qrCode.innerHTML = '';
            qrCode.parentElement.classList.remove('has-qrcode');
            qrPlaceholder.style.display = 'block';
            downloadBtn.disabled = true;
            currentQRCodeDataURL = null;
            console.error('QR Code generation error: Failed to load image');
        };
        
        // 设置图片源
        img.src = qrApiUrl;
        qrCode.appendChild(img);
    }

    // ========== 核心函数：识别二维码（调用在线 API） ==========
    function decodeQRCodeImage() {
        const file = decodeFileInput && decodeFileInput.files ? decodeFileInput.files[0] : null;
        if (!file) {
            showDecodeError('请选择要识别的二维码图片！');
            return;
        }

        // 仅简单限制一下大小（例如 5MB），避免过大文件
        if (file.size > 5 * 1024 * 1024) {
            showDecodeError('图片过大，请选择 5MB 以内的图片。');
            return;
        }

        hideDecodeError();
        decodeResult.textContent = '识别中，请稍候...';

        const formData = new FormData();
        formData.append('file', file);

        fetch('https://api.qrserver.com/v1/read-qr-code/', {
            method: 'POST',
            body: formData
        })
            .then(response => response.json())
            .then(data => {
                try {
                    if (!Array.isArray(data) || !data[0] || !Array.isArray(data[0].symbol)) {
                        throw new Error('返回数据格式异常');
                    }
                    const symbol = data[0].symbol[0];
                    if (symbol.error || !symbol.data) {
                        showDecodeError('未能识别出二维码内容，请更换图片重试。');
                        decodeResult.textContent = '——';
                        return;
                    }
                    hideDecodeError();
                    decodeResult.textContent = symbol.data;
                    if (decodeCopyBtn) {
                        decodeCopyBtn.disabled = false;
                    }
                } catch (e) {
                    showDecodeError('解析返回结果失败，请稍后重试。');
                    decodeResult.textContent = '——';
                    if (decodeCopyBtn) {
                        decodeCopyBtn.disabled = true;
                    }
                }
            })
            .catch(() => {
                showDecodeError('识别失败，可能是网络问题或接口不可用。');
                decodeResult.textContent = '——';
                if (decodeCopyBtn) {
                    decodeCopyBtn.disabled = true;
                }
            });
    }

    // 处理文件选择并预览
    function handleDecodeFileChange() {
        const file = decodeFileInput && decodeFileInput.files ? decodeFileInput.files[0] : null;
        if (!file) {
            clearDecodePreviewOnly();
            return;
        }

        hideDecodeError();

        if (currentDecodeObjectUrl) {
            URL.revokeObjectURL(currentDecodeObjectUrl);
            currentDecodeObjectUrl = null;
        }

        const objectUrl = URL.createObjectURL(file);
        currentDecodeObjectUrl = objectUrl;

        if (decodePreviewImg) {
            decodePreviewImg.src = objectUrl;
            decodePreviewImg.style.display = 'block';
        }
        if (decodePreviewPlaceholder) {
            decodePreviewPlaceholder.style.display = 'none';
        }
        // 清空上一次识别结果提示
        decodeResult.textContent = '——';
    }

    function clearDecodePreviewOnly() {
        if (decodePreviewImg) {
            decodePreviewImg.src = '';
            decodePreviewImg.style.display = 'none';
        }
        if (decodePreviewPlaceholder) {
            decodePreviewPlaceholder.style.display = 'block';
        }
        if (currentDecodeObjectUrl) {
            URL.revokeObjectURL(currentDecodeObjectUrl);
            currentDecodeObjectUrl = null;
        }
    }

    // ========== 核心函数：下载二维码 ==========
    function downloadQRCode() {
        if (!currentQRCodeDataURL) {
            return;
        }
        
        // 优先使用 fetch + blob 的方式强制下载，避免浏览器直接在新标签页打开图片
        try {
            fetch(currentQRCodeDataURL)
                .then(response => response.blob())
                .then(blob => {
                    const objectUrl = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = 'qrcode.png';
                    link.href = objectUrl;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    // 释放 URL
                    URL.revokeObjectURL(objectUrl);
                })
                .catch(err => {
                    // 失败时退化为在新标签页打开图片，由用户手动另存为
                    window.open(currentQRCodeDataURL, '_blank');
                });
        } catch (e) {
            window.open(currentQRCodeDataURL, '_blank');
        }
    }

    // ========== 辅助函数：清空所有 ==========
    function clearAll() {
        qrInput.value = '';
        qrCode.innerHTML = '';
        qrCode.parentElement.classList.remove('has-qrcode');
        qrPlaceholder.style.display = 'block';
        downloadBtn.disabled = true;
        currentQRCodeDataURL = null;
        hideError();
    }

    // ========== 辅助函数：显示错误提示 ==========
    function showError(msg) {
        errorTip.textContent = msg;
        errorTip.style.display = 'block';
    }

    // ========== 辅助函数：隐藏错误提示 ==========
    function hideError() {
        errorTip.style.display = 'none';
    }

    // 清空识别区域
    function clearDecode() {
        if (decodeFileInput) {
            decodeFileInput.value = '';
        }
        clearDecodePreviewOnly();
        hideDecodeError();
        if (decodeResult) {
            decodeResult.textContent = '——';
        }
        if (decodeCopyBtn) {
            decodeCopyBtn.disabled = true;
        }
    }

    // ========== 识别错误提示 ==========
    function showDecodeError(msg) {
        if (!decodeErrorTip) return;
        decodeErrorTip.textContent = msg;
        decodeErrorTip.style.display = 'block';
    }

    function hideDecodeError() {
        if (!decodeErrorTip) return;
        decodeErrorTip.style.display = 'none';
    }

});


